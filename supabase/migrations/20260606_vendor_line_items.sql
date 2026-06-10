-- Create vendor_line_items table for AI-extracted proposal/contract line items
CREATE TABLE vendor_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id uuid REFERENCES couples(id) ON DELETE CASCADE,
  vendor_id uuid REFERENCES vendors(id) ON DELETE CASCADE,
  label text NOT NULL,
  normalized_label text NOT NULL,
  amount numeric,
  quantity integer,
  unit text,
  notes text,
  source text NOT NULL DEFAULT 'extracted',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE vendor_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own line items" ON vendor_line_items
  FOR ALL USING (couple_id IN (
    SELECT id FROM couples WHERE user_id_primary = auth.uid() OR user_id_partner = auth.uid()
  ));

CREATE INDEX ON vendor_line_items (couple_id);
CREATE INDEX ON vendor_line_items (vendor_id);
