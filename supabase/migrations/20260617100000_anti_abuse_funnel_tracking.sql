-- Funnel event tracking (onboarded → feature_used → limit_hit → upgrade_initiated → payment_completed)
CREATE TABLE IF NOT EXISTS funnel_events (
  id          BIGSERIAL PRIMARY KEY,
  user_id     TEXT        NOT NULL,
  event       TEXT        NOT NULL,
  feature     TEXT,
  plan        TEXT,
  meta        JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_funnel_events_user_id    ON funnel_events(user_id);
CREATE INDEX IF NOT EXISTS idx_funnel_events_event      ON funnel_events(event);
CREATE INDEX IF NOT EXISTS idx_funnel_events_created_at ON funnel_events(created_at);

-- Block accounts that abuse reinstall + new email (LinkedIn ID conflict or fingerprint flood)
ALTER TABLE extension_accounts ADD COLUMN IF NOT EXISTS blocked_reason TEXT;
