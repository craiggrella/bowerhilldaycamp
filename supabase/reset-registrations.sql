-- Wipe all registration-related data before launch.
-- Keeps camp_types (seed data) intact. Run in Supabase SQL editor.
truncate table
  consents,
  camper_emergency_contacts,
  emergency_contacts,
  guardians,
  medical_info,
  campers,
  registrations
restart identity cascade;
