-- LinkedIn AI Assistant: monthly usage tracking
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS usage_this_month integer NOT NULL DEFAULT 0;

-- Anonymous extension users (client-generated UUID, no auth.users FK)
CREATE TABLE IF NOT EXISTS public.extension_accounts (
  id uuid PRIMARY KEY,
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'plus')),
  usage_this_month integer NOT NULL DEFAULT 0,
  quota_reset_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.extension_accounts ENABLE ROW LEVEL SECURITY;
