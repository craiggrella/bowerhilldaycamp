-- Lock down all tables: RLS on, no policies = anon/authenticated cannot read or write.
-- All access goes through server-side route handlers using the service-role key.
-- Admin pages call protected API routes that verify a Supabase Auth session first.

alter table camp_types enable row level security;
alter table activities enable row level security;
alter table registrations enable row level security;
alter table campers enable row level security;
alter table camper_activity_choices enable row level security;
alter table guardians enable row level security;
alter table emergency_contacts enable row level security;
alter table camper_emergency_contacts enable row level security;
alter table medical_info enable row level security;
alter table consents enable row level security;
