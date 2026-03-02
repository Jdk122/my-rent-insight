
-- Fix analyses policies: change from RESTRICTIVE to PERMISSIVE
DROP POLICY IF EXISTS "Allow anonymous inserts" ON public.analyses;
DROP POLICY IF EXISTS "Allow anonymous updates" ON public.analyses;

CREATE POLICY "Allow anonymous inserts" ON public.analyses
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anonymous updates" ON public.analyses
  FOR UPDATE USING (true) WITH CHECK (true);
