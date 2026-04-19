-- Track whether a registration was created manually by an admin
-- (as opposed to a guardian checking out via Stripe) and allow the
-- `status` column to hold "pending" when admin has not yet received
-- cash/check payment.
alter table registrations
  add column if not exists manual_entry boolean not null default false;

-- Existing status values: "paid", "free". New value: "pending"
-- (manual entries where admin hasn't received the payment yet).
