-- Add an optional free-text field so guardians can tell us about
-- friend groups / sibling pairing preferences during registration.
alter table campers add column if not exists pairing_notes text;
