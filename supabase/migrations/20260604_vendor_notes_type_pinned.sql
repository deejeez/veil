-- Add type and pinned columns to vendor_notes for Communication Log feature
ALTER TABLE vendor_notes ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'note';
ALTER TABLE vendor_notes ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false;
