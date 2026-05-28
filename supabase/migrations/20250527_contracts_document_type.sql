ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS document_type TEXT NOT NULL DEFAULT 'contract'
  CHECK (document_type IN ('contract', 'proposal'));
