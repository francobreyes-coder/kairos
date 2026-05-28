-- Persist the tutor's own SAT/ACT scores on their profile so students browsing
-- /find-tutors can see the credential next to the SAT/ACT Prep service. These
-- are separate from tutor_applications.sat_score (admin-only application data)
-- and are only collected during onboarding when the relevant service is in
-- the tutor's approved services.

alter table tutor_profiles
  add column if not exists sat_score smallint
    check (sat_score is null or (sat_score between 400 and 1600));

alter table tutor_profiles
  add column if not exists act_score smallint
    check (act_score is null or (act_score between 1 and 36));
