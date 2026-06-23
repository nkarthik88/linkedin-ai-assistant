CREATE POLICY "service_role_all" ON funnel_events
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
