-- Per-feature usage tracking: one JSONB column instead of 4 separate columns.
-- Keys: generate_post, personalized_dm, reply_comment, improve_headline, viral_rewriter
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS feature_usage JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.extension_accounts
  ADD COLUMN IF NOT EXISTS feature_usage JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.users.feature_usage IS 'Per-feature monthly usage counts; resets with quota_reset_at';
COMMENT ON COLUMN public.extension_accounts.feature_usage IS 'Per-feature monthly usage counts; resets with quota_reset_at';
