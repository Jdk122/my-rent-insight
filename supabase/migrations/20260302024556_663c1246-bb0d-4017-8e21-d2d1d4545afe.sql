
-- Add SELECT policy for analyses (needed for insert().select('id'))
CREATE POLICY "Allow anonymous select" ON public.analyses
  FOR SELECT USING (true);
