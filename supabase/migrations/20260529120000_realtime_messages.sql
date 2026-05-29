-- Enable Supabase Realtime for the messages table so clients can subscribe to
-- live INSERTs and receive new messages without polling. The page subscribes
-- on a channel filtered by conversation_id, so each tab only sees events for
-- the thread it has open.
--
-- The supabase_realtime publication is created by Supabase on project bootstrap.
-- If a previous run already added the table, the do-block is a no-op (safe to
-- re-run).

do $$
begin
  if not exists (
    select 1
      from pg_publication_tables
     where pubname    = 'supabase_realtime'
       and schemaname = 'public'
       and tablename  = 'messages'
  ) then
    alter publication supabase_realtime add table messages;
  end if;
end $$;
