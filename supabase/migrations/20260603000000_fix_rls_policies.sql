-- Fix RLS policies across all public tables
-- Corrects: user_id column assumption on extension_accounts (uses email instead),
--           type mismatch on lead_search_events (user_id is text, not uuid),
--           overly permissive waitlist INSERT policy.

-- ============================================================
-- extension_accounts
-- Identity: email (no user_id column)
-- ============================================================
ALTER TABLE public.extension_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "extension_accounts_service_role_all"  ON public.extension_accounts;
DROP POLICY IF EXISTS "service_role_all_extension_accounts"  ON public.extension_accounts;
DROP POLICY IF EXISTS "authenticated_own_extension_accounts" ON public.extension_accounts;
DROP POLICY IF EXISTS "users_read_own_account"               ON public.extension_accounts;
DROP POLICY IF EXISTS "users_update_own_account"             ON public.extension_accounts;

CREATE POLICY "service_role_all_extension_accounts"
  ON public.extension_accounts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated_own_extension_accounts"
  ON public.extension_accounts
  FOR ALL
  TO authenticated
  USING (email = auth.jwt() ->> 'email')
  WITH CHECK (email = auth.jwt() ->> 'email');

-- ============================================================
-- lead_search_events
-- Identity: user_id (text, not uuid — cast auth.uid())
-- ============================================================
ALTER TABLE public.lead_search_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lead_search_events_service_role_all"  ON public.lead_search_events;
DROP POLICY IF EXISTS "lead_search_events_auth_select"       ON public.lead_search_events;
DROP POLICY IF EXISTS "lead_search_events_auth_insert"       ON public.lead_search_events;
DROP POLICY IF EXISTS "lead_search_events_auth_update"       ON public.lead_search_events;
DROP POLICY IF EXISTS "lead_search_events_auth_delete"       ON public.lead_search_events;
DROP POLICY IF EXISTS "service_role_all_lead_search_events"  ON public.lead_search_events;
DROP POLICY IF EXISTS "authenticated_own_lead_search_events" ON public.lead_search_events;

CREATE POLICY "service_role_all_lead_search_events"
  ON public.lead_search_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated_own_lead_search_events"
  ON public.lead_search_events
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

-- ============================================================
-- waitlist_emails
-- No user-identity column; public INSERT only, no read-back for anon
-- ============================================================
ALTER TABLE public.waitlist_emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "waitlist_service_role_all"        ON public.waitlist_emails;
DROP POLICY IF EXISTS "waitlist_public_insert_secure"    ON public.waitlist_emails;
DROP POLICY IF EXISTS "allow_insert_waitlist"            ON public.waitlist_emails;
DROP POLICY IF EXISTS "service_role_all_waitlist_emails" ON public.waitlist_emails;
DROP POLICY IF EXISTS "public_insert_waitlist_emails"    ON public.waitlist_emails;

CREATE POLICY "service_role_all_waitlist_emails"
  ON public.waitlist_emails
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- anon/authenticated: INSERT only, non-empty email required
CREATE POLICY "public_insert_waitlist_emails"
  ON public.waitlist_emails
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (email IS NOT NULL AND email <> '');
