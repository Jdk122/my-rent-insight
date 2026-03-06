
CREATE POLICY "Allow public select on rentcast_cache"
  ON public.rentcast_cache
  FOR SELECT
  USING (true);
