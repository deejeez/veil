-- Add first name columns for each person in the couple
-- Used to personalize the dashboard ("Marco & Sarah")

ALTER TABLE couples
  ADD COLUMN IF NOT EXISTS name_primary text,
  ADD COLUMN IF NOT EXISTS name_partner text;
