-- Whether the vendors dashboard uses the computed ordering or the couple's own.
--
-- 'recommended' keeps the existing behaviour: booked first, then overdue, then
-- by how soon the category typically needs booking. Useful by default, but it
-- means a couple's own sense of priority can't be expressed.
--
-- 'custom' orders by vendor_categories.sort_order, which already exists and is
-- already populated — the Vendors page just overrode it.
--
-- A column rather than localStorage so the ordering is the same on a phone and
-- a laptop.

ALTER TABLE couples
  ADD COLUMN IF NOT EXISTS vendor_sort text NOT NULL DEFAULT 'recommended';
