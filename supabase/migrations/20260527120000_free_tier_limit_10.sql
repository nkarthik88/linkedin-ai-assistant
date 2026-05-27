-- Free tier: 10 generations per month (was implicitly 20 via app config)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS usage_limit integer NOT NULL DEFAULT 10;

ALTER TABLE public.extension_accounts
  ADD COLUMN IF NOT EXISTS usage_limit integer NOT NULL DEFAULT 10;

COMMENT ON COLUMN public.users.usage_limit IS 'Monthly generation cap; free default 10';
COMMENT ON COLUMN public.extension_accounts.usage_limit IS 'Monthly generation cap; free default 10';
