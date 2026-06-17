ALTER TABLE extension_accounts ADD COLUMN IF NOT EXISTS returned_lead_urls JSONB DEFAULT '[]'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS returned_lead_urls JSONB DEFAULT '[]'::jsonb;
