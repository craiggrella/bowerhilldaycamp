-- Add junction table for per-camper emergency contacts
CREATE TABLE IF NOT EXISTS camper_emergency_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  camper_id uuid REFERENCES campers(id) ON DELETE CASCADE,
  emergency_contact_id uuid REFERENCES emergency_contacts(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(camper_id, emergency_contact_id)
);

-- RLS
ALTER TABLE camper_emergency_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon insert camper_emergency_contacts" ON camper_emergency_contacts FOR INSERT WITH CHECK (true);
CREATE POLICY "Read camper_emergency_contacts" ON camper_emergency_contacts FOR SELECT USING (true);
