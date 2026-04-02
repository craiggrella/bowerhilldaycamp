-- Clear existing tracts
DELETE FROM activity_tracts;

-- Time slots:
-- Slot 1: 9:00-10:30 AM (Day Camp + Jr Day Camp)
-- Slot 2: 10:30-12:00 PM (Day Camp + Jr Day Camp)
-- Slot 3: 12:30-2:00 PM (Day Camp only)
-- Slot 4: 2:00-3:30 PM (Day Camp only)

-- We set camp_type_id to NULL since tracts are shared across camp types.
-- The time_slot field determines which camp types see it:
--   Slots 1-2 = both camps, Slots 3-4 = Day Camp only

-- Slot 1: 9:00 - 10:30 AM
INSERT INTO activity_tracts (camp_type_id, name, description, time_slot, capacity) VALUES
  (NULL, 'Arts & Crafts', 'Painting, drawing, and hands-on creative projects', '9:00 - 10:30 AM', 20),
  (NULL, 'Sports & Games', 'Team games, relay races, and outdoor sports', '9:00 - 10:30 AM', 20),
  (NULL, 'Music & Worship', 'Singing, instruments, and worship time', '9:00 - 10:30 AM', 20),
  (NULL, 'Science & Nature', 'Experiments, nature walks, and exploration', '9:00 - 10:30 AM', 20),
  (NULL, 'Bible Adventure', 'Interactive Bible stories and activities', '9:00 - 10:30 AM', 20);

-- Slot 2: 10:30 AM - 12:00 PM
INSERT INTO activity_tracts (camp_type_id, name, description, time_slot, capacity) VALUES
  (NULL, 'Arts & Crafts', 'Painting, drawing, and hands-on creative projects', '10:30 AM - 12:00 PM', 20),
  (NULL, 'Sports & Games', 'Team games, relay races, and outdoor sports', '10:30 AM - 12:00 PM', 20),
  (NULL, 'Music & Worship', 'Singing, instruments, and worship time', '10:30 AM - 12:00 PM', 20),
  (NULL, 'Science & Nature', 'Experiments, nature walks, and exploration', '10:30 AM - 12:00 PM', 20),
  (NULL, 'Bible Adventure', 'Interactive Bible stories and activities', '10:30 AM - 12:00 PM', 20);

-- Slot 3: 12:30 - 2:00 PM (Day Camp only)
INSERT INTO activity_tracts (camp_type_id, name, description, time_slot, capacity) VALUES
  (NULL, 'Arts & Crafts', 'Painting, drawing, and hands-on creative projects', '12:30 - 2:00 PM', 20),
  (NULL, 'Sports & Games', 'Team games, relay races, and outdoor sports', '12:30 - 2:00 PM', 20),
  (NULL, 'Music & Worship', 'Singing, instruments, and worship time', '12:30 - 2:00 PM', 20),
  (NULL, 'Science & Nature', 'Experiments, nature walks, and exploration', '12:30 - 2:00 PM', 20),
  (NULL, 'Bible Adventure', 'Interactive Bible stories and activities', '12:30 - 2:00 PM', 20);

-- Slot 4: 2:00 - 3:30 PM (Day Camp only)
INSERT INTO activity_tracts (camp_type_id, name, description, time_slot, capacity) VALUES
  (NULL, 'Arts & Crafts', 'Painting, drawing, and hands-on creative projects', '2:00 - 3:30 PM', 20),
  (NULL, 'Sports & Games', 'Team games, relay races, and outdoor sports', '2:00 - 3:30 PM', 20),
  (NULL, 'Music & Worship', 'Singing, instruments, and worship time', '2:00 - 3:30 PM', 20),
  (NULL, 'Science & Nature', 'Experiments, nature walks, and exploration', '2:00 - 3:30 PM', 20),
  (NULL, 'Bible Adventure', 'Interactive Bible stories and activities', '2:00 - 3:30 PM', 20);
