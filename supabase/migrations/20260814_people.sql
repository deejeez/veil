-- Named helpers a couple can assign work to — planner, parents, wedding party.
--
-- Tasks previously offered only "Both of us" and the two names from onboarding.
-- The interim fix was a free-text field with suggestions, which read as neither
-- a text box nor a dropdown. People are managed in Settings now and tasks pick
-- from them.

CREATE TABLE people (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id  uuid NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (couple_id, name)
);

CREATE INDEX ON people (couple_id);

ALTER TABLE people ENABLE ROW LEVEL SECURITY;

CREATE POLICY "couple members can manage people"
  ON people FOR ALL
  USING (
    couple_id IN (
      SELECT id FROM couples
      WHERE auth.uid() = user_id_primary OR auth.uid() = user_id_partner
    )
  );

-- Backfill anyone already assigned a task, so names typed under the free-text
-- version survive the change instead of being orphaned. Excludes 'couple' (the
-- "Both of us" sentinel) and the couple's own names, which the dropdown always
-- offers separately.
INSERT INTO people (couple_id, name)
SELECT DISTINCT t.couple_id, trim(t.assigned_to)
FROM tasks t
JOIN couples c ON c.id = t.couple_id
WHERE t.assigned_to IS NOT NULL
  AND trim(t.assigned_to) <> ''
  AND t.assigned_to <> 'couple'
  AND trim(t.assigned_to) IS DISTINCT FROM trim(COALESCE(c.name_primary, ''))
  AND trim(t.assigned_to) IS DISTINCT FROM trim(COALESCE(c.name_partner, ''))
ON CONFLICT (couple_id, name) DO NOTHING;
