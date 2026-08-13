-- Officiant was offered as a tile in onboarding but was never a real vendor
-- category. Booking it wrote a `vendors` row for a category absent from
-- vendor_categories, so it was counted by nothing: invisible on the Vendors
-- page, excluded from the dashboard's booked count, and still listed under
-- "Next up: book officiant" even after the couple had booked one.
--
-- New couples get it from the seed list in types/database.ts. This backfills
-- everyone who signed up before that. Nobody can have deliberately deleted it,
-- since it never existed as a category.

INSERT INTO vendor_categories (couple_id, slug, label, sort_order)
SELECT
  c.id,
  'officiant',
  'Officiant',
  COALESCE((SELECT MAX(vc.sort_order) FROM vendor_categories vc WHERE vc.couple_id = c.id), -1) + 1
FROM couples c
WHERE NOT EXISTS (
  SELECT 1 FROM vendor_categories vc
  WHERE vc.couple_id = c.id AND vc.slug = 'officiant'
)
-- Only couples that already have a seeded category list; couples who have
-- never loaded the app get the full list (including officiant) on first load.
AND EXISTS (
  SELECT 1 FROM vendor_categories vc WHERE vc.couple_id = c.id
);
