-- Add status and payment_method columns to payments table
ALTER TABLE payments ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'upcoming';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_method text;

-- Backfill: mark existing paid payments as 'paid'
UPDATE payments SET status = 'paid' WHERE paid_date IS NOT NULL AND status = 'upcoming';
