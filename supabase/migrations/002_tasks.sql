-- Tasks / To-Do list for couples

CREATE TABLE IF NOT EXISTS tasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id   UUID REFERENCES couples(id) ON DELETE CASCADE NOT NULL,
  title       TEXT NOT NULL,
  description TEXT,
  due_date    DATE,
  completed   BOOLEAN DEFAULT FALSE NOT NULL,
  assigned_to TEXT DEFAULT 'couple' NOT NULL,
  category    TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Couple members can manage tasks"
  ON tasks FOR ALL
  USING (
    couple_id IN (
      SELECT id FROM couples
      WHERE user_id_primary = auth.uid()
         OR user_id_partner = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS tasks_couple_id_idx ON tasks(couple_id);
CREATE INDEX IF NOT EXISTS tasks_completed_idx ON tasks(couple_id, completed);
