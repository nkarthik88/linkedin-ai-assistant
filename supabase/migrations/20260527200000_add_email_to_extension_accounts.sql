-- Add email column to extension_accounts for receipt/notification emails
ALTER TABLE extension_accounts
  ADD COLUMN IF NOT EXISTS email text;
