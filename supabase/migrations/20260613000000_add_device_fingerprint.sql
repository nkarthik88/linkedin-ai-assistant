ALTER TABLE extension_accounts
ADD COLUMN IF NOT EXISTS device_fingerprint TEXT;
