-- Camp types
create table camp_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  schedule text,
  price_cents integer not null,
  capacity integer,
  created_at timestamptz default now()
);

-- Activities (shared across camp types)
create table activities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  type text not null,            -- 'Creative', 'Active', 'Spiritual', 'Educational'
  capacity integer,
  created_at timestamptz default now()
);

-- Registrations (one per family payment)
create table registrations (
  id uuid primary key default gen_random_uuid(),
  stripe_payment_id text,
  stripe_payment_status text,
  amount_cents integer,
  status text default 'paid',
  created_at timestamptz default now()
);

-- Campers (one per kid)
create table campers (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid references registrations(id) on delete cascade,
  camp_type_id uuid references camp_types(id),
  first_name text not null,
  last_name text,
  age text,
  grade text,
  role text,
  created_at timestamptz default now()
);

-- Activity choices (which activities each kid picked)
create table camper_activity_choices (
  id uuid primary key default gen_random_uuid(),
  camper_id uuid references campers(id) on delete cascade,
  activity_id uuid references activities(id),
  created_at timestamptz default now(),
  unique(camper_id, activity_id)
);

-- Parent / guardian
create table guardians (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid references registrations(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  relationship text not null,
  email text not null,
  phone text not null,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  zip text,
  created_at timestamptz default now()
);

-- Emergency contacts / authorized pickup
create table emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid references registrations(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  relationship text not null,
  phone text not null,
  created_at timestamptz default now()
);

-- Medical info (one per camper)
create table medical_info (
  id uuid primary key default gen_random_uuid(),
  camper_id uuid references campers(id) on delete cascade,
  allergies text,
  medications text,
  dietary_restrictions text,
  doctor_name text,
  doctor_phone text,
  insurance_provider text,
  insurance_policy_number text,
  special_needs text,
  created_at timestamptz default now()
);

-- Waivers / consents
create table consents (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid references registrations(id) on delete cascade,
  liability_waiver boolean default false,
  photo_release boolean default false,
  authorized_pickup_persons text,
  signed_by text not null,
  signed_at timestamptz default now(),
  created_at timestamptz default now()
);

-- ============ SEED DATA ============

insert into camp_types (name, description, schedule, price_cents, capacity) values
  ('Day Camp', 'Full day camp experience for kids', 'Full Day', 5000, 50),
  ('Jr Day Camp', 'Half day camp for younger children', 'Half Day', 3500, 30);

insert into activities (name, description, type, capacity) values
  ('Arts & Crafts', 'Painting, drawing, sculpting, and hands-on creative projects kids can take home', 'Creative', 20),
  ('Sports & Games', 'Team relay races, kickball, capture the flag, and outdoor competitions', 'Active', 25),
  ('Music & Worship', 'Singing, rhythm instruments, and learning worship songs together', 'Spiritual', 20),
  ('Science Lab', 'Mind-blowing experiments, slime-making, volcanoes, and STEM challenges', 'Educational', 15),
  ('Drama & Skits', 'Acting, improv games, puppets, and putting on skits for the group', 'Creative', 20),
  ('Nature Explorers', 'Bug hunts, plant identification, nature hikes, and outdoor discovery', 'Educational', 15),
  ('Water Games', 'Sprinklers, water balloons, slip-n-slide, and splash zone fun', 'Active', 25),
  ('Cooking & Snacks', 'Making themed snacks, no-bake treats, and learning simple recipes', 'Creative', 15),
  ('Bible Adventure', 'Interactive Bible stories, crafts tied to scripture, and group discussion', 'Spiritual', 20),
  ('Dance & Movement', 'Choreography, freeze dance, group routines, and high-energy movement', 'Active', 25);
