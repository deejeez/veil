ALTER TABLE couples
  ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS guest_count INTEGER,
  ADD COLUMN IF NOT EXISTS target_season TEXT CHECK (target_season IN ('spring', 'summer', 'fall', 'winter')),
  ADD COLUMN IF NOT EXISTS target_year INTEGER,
  ADD COLUMN IF NOT EXISTS budget_range TEXT;
