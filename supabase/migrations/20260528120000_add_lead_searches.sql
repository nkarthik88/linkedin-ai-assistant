-- Find Leads feature: track monthly lead-search usage separately from generations.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS lead_searches_this_month integer NOT NULL DEFAULT 0;

ALTER TABLE public.extension_accounts
  ADD COLUMN IF NOT EXISTS lead_searches_this_month integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.users.lead_searches_this_month IS 'Find Leads searches used this month; resets with quota_reset_at';
COMMENT ON COLUMN public.extension_accounts.lead_searches_this_month IS 'Find Leads searches used this month; resets with quota_reset_at';
