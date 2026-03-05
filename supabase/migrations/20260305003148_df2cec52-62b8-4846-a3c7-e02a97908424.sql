
CREATE POLICY "Allow anonymous updates on own analyses"
ON public.analyses
FOR UPDATE
USING (true)
WITH CHECK (true);
