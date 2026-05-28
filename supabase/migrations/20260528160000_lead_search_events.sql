-- Analytics: one row per Find Leads search, for usage insights.
CREATE TABLE IF NOT EXISTS public.lead_search_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id text,
  target text,
  profiles_count integer NOT NULL DEFAULT 0,
  leads_count integer NOT NULL DEFAULT 0,
  hot_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lead_search_events_user_id_idx
  ON public.lead_search_events (user_id);
CREATE INDEX IF NOT EXISTS lead_search_events_created_at_idx
  ON public.lead_search_events (created_at);

ALTER TABLE public.lead_search_events ENABLE ROW LEVEL SECURITY;
