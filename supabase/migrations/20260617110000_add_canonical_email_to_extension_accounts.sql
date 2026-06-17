ALTER TABLE extension_accounts ADD COLUMN IF NOT EXISTS canonical_email TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_extension_accounts_canonical_email
  ON extension_accounts(canonical_email) WHERE canonical_email IS NOT NULL;
UPDATE extension_accounts SET canonical_email = email WHERE canonical_email IS NULL AND email IS NOT NULL;
