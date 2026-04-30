-- One-shot: promote the existing admin user to "owner" role.
-- Replace YOUR_ADMIN_EMAIL_HERE with the email you log into /admin with.
--
-- After running, requireOwner() will accept this user for destructive
-- routes (invite, revoke, role change). New invitees default to "staff".
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"owner"}'::jsonb
where email = 'YOUR_ADMIN_EMAIL_HERE';
