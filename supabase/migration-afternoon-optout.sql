-- Add afternoon opt-out flag for Day Camp campers (3rd-grade and up may opt out of 12-3pm block)
alter table campers
  add column if not exists afternoon_opt_out boolean not null default false;

-- Update camp type pricing & schedule to match new model
-- Jr Day Camp (PreK-2nd): 9:30am-12pm, $25
-- Day Camp (3rd-6th+): 9:30am-3pm, $75 (6th-and-up helper pricing handled in app code)
update camp_types
  set price_cents = 2500, schedule = '9:30 AM – 12:00 PM'
  where name = 'Jr Day Camp';

update camp_types
  set price_cents = 7500, schedule = '9:30 AM – 3:00 PM'
  where name = 'Day Camp';
