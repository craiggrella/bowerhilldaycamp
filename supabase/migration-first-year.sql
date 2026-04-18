-- First-year registrants in 3rd grade and under attend for FREE.
-- This flag is set at registration time and surfaced in admin + emails.
alter table campers
  add column if not exists first_year boolean not null default false;
