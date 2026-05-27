-- Adds a yes/no field capturing whether the applicant has prior SAT/ACT
-- tutoring experience. Collected in the tutor application form and surfaced
-- to admins reviewing applications.

alter table tutor_applications
  add column if not exists prior_sat_act_tutoring text not null default '';
