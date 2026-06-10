-- Add contract_url and proposal_url columns to vendors table
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS contract_url text;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS proposal_url text;

-- Create documents storage bucket (private, 10MB limit)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  10485760,  -- 10MB
  ARRAY['application/pdf', 'image/png', 'image/jpeg']
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for documents bucket
CREATE POLICY "couple members can upload documents"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'documents' AND
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM couples
      WHERE auth.uid() = user_id_primary OR auth.uid() = user_id_partner
    )
  );

CREATE POLICY "couple members can read documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'documents' AND
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM couples
      WHERE auth.uid() = user_id_primary OR auth.uid() = user_id_partner
    )
  );

CREATE POLICY "couple members can delete documents"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'documents' AND
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM couples
      WHERE auth.uid() = user_id_primary OR auth.uid() = user_id_partner
    )
  );
