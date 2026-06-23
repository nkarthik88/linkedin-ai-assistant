CREATE POLICY "authenticated_read" ON funnel_events
FOR SELECT
TO authenticated
USING (true);
