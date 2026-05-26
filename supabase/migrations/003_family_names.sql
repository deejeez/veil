-- Add family name columns to couples table
-- These are used for payment attribution (Couple / Family A / Family B)

ALTER TABLE couples
  ADD COLUMN IF NOT EXISTS family_a_name text,
  ADD COLUMN IF NOT EXISTS family_b_name text;
