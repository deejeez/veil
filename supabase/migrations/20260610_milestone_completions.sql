CREATE TABLE milestone_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id uuid REFERENCES couples(id) ON DELETE CASCADE,
  milestone_key text NOT NULL,
  completed_at timestamptz DEFAULT now(),
  UNIQUE(couple_id, milestone_key)
);

ALTER TABLE milestone_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own milestone completions" ON milestone_completions
  FOR ALL USING (couple_id IN (
    SELECT id FROM couples WHERE user_id_primary = auth.uid() OR user_id_partner = auth.uid()
  ));
