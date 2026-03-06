
-- Drop overly permissive SELECT policies
DROP POLICY IF EXISTS "Allow public select" ON public.analyses;
DROP POLICY IF EXISTS "Allow public select" ON public.leads;
DROP POLICY IF EXISTS "Allow public select" ON public.lead_events;
DROP POLICY IF EXISTS "Allow public select" ON public.shared_reports;

-- analyses: only allow SELECT for rows referenced by shared_reports
CREATE POLICY "Allow select for shared" ON public.analyses
  FOR SELECT USING (id IN (SELECT analysis_id FROM public.shared_reports WHERE analysis_id IS NOT NULL));

-- shared_reports: allow public SELECT (contains only non-sensitive user-shared data)
CREATE POLICY "Allow select shared reports" ON public.shared_reports
  FOR SELECT USING (true);

-- leads: NO public SELECT (insert-only via RLS)
-- lead_events: NO public SELECT (insert-only via RLS)
