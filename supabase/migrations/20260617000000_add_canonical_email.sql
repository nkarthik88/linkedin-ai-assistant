-- Add canonical_email column
ALTER TABLE users ADD COLUMN IF NOT EXISTS canonical_email TEXT;

-- Create unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_canonical_email
  ON users(canonical_email) WHERE canonical_email IS NOT NULL;

-- Backfill data
UPDATE users
SET canonical_email = email
WHERE canonical_email IS NULL;
