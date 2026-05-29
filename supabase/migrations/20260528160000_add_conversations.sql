-- Persistent chat threads. Before this migration, a "conversation" was
-- implicit in the pair (sender_id, receiver_id) on each message, and the
-- API tried to bridge users with multiple ids (Google vs credentials sign-up
-- under the same email) at *read* time via resolveAllIds. That bridge is
-- fragile — when it failed, the receiver simply didn't see the message.
--
-- This migration introduces an explicit conversation entity that messages
-- attach to at *insert* time. The API still resolves ids when finding-or-
-- creating a conversation for a given user pair, but once the conversation
-- exists, every future message just stores conversation_id and is anchored
-- to the thread forever.
--
-- conversation_participants.user_id is text, not an FK to users(id), for the
-- same reason messages.sender_id is text: prod has historical ids that drift
-- between users.id and tutor_applications.user_id, and a hard FK would break
-- the backfill. The "tied to users" guarantee comes from the API picking the
-- canonical users.id at participant-insert time, not from a constraint.

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists conversation_participants (
  conversation_id uuid not null references conversations(id) on delete cascade,
  user_id text not null,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create index if not exists idx_conversation_participants_user
  on conversation_participants(user_id);

alter table messages
  add column if not exists conversation_id uuid references conversations(id);

create index if not exists idx_messages_conversation
  on messages(conversation_id, created_at);

-- ── Backfill ──────────────────────────────────────────────────────────────
-- For every distinct (LEAST, GREATEST) participant pair in existing messages,
-- find-or-create one conversation, register both participants, then link all
-- messages in that pair to it. We use raw ids here; the API uses email-based
-- canonical-id resolution at chat-open time, so any drifted-id threads will
-- get merged into a single conversation the next time either side opens it.

do $$
declare
  pair_row record;
  conv_id uuid;
begin
  for pair_row in
    select distinct
      least(sender_id, receiver_id)    as a,
      greatest(sender_id, receiver_id) as b
    from messages
    where conversation_id is null
  loop
    select c.id into conv_id
    from conversations c
    where exists (
      select 1 from conversation_participants p
      where p.conversation_id = c.id and p.user_id = pair_row.a
    )
      and exists (
        select 1 from conversation_participants p
        where p.conversation_id = c.id and p.user_id = pair_row.b
      )
    limit 1;

    if conv_id is null then
      insert into conversations default values returning id into conv_id;
      insert into conversation_participants (conversation_id, user_id)
        values (conv_id, pair_row.a), (conv_id, pair_row.b)
        on conflict do nothing;
    end if;

    update messages
       set conversation_id = conv_id
     where conversation_id is null
       and least(sender_id, receiver_id) = pair_row.a
       and greatest(sender_id, receiver_id) = pair_row.b;
  end loop;
end $$;

-- Lock new messages to a conversation. Backfill above guarantees every row
-- has a value, so this alter cannot fail unless someone races an insert in.
alter table messages
  alter column conversation_id set not null;
