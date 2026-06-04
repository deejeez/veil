CREATE TABLE guests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  couple_id UUID REFERENCES couples(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  household TEXT,
  side TEXT NOT NULL CHECK (side IN ('bride', 'groom', 'mutual')),
  tier TEXT NOT NULL DEFAULT 'a_list' CHECK (tier IN ('a_list', 'b_list')),
  plus_ones INTEGER NOT NULL DEFAULT 0,
  kids INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE guests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their couple's guests"
  ON guests FOR ALL
  USING (
    couple_id IN (
      SELECT id FROM couples
      WHERE user_id_primary = auth.uid() OR user_id_partner = auth.uid()
    )
  );
