CREATE TABLE vendor_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  couple_id UUID REFERENCES couples(id) ON DELETE CASCADE NOT NULL,
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE vendor_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their couple's vendor notes"
  ON vendor_notes FOR ALL
  USING (
    couple_id IN (
      SELECT id FROM couples
      WHERE user_id_primary = auth.uid() OR user_id_partner = auth.uid()
    )
  );
