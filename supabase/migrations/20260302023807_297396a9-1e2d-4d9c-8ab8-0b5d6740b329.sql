
-- Create unified Rentcast cache table
CREATE TABLE public.rentcast_cache (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lookup_key text NOT NULL,
  endpoint text NOT NULL,
  response_data jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(lookup_key, endpoint)
);

CREATE INDEX idx_rentcast_cache_lookup ON public.rentcast_cache (lookup_key, endpoint);

ALTER TABLE public.rentcast_cache ENABLE ROW LEVEL SECURITY;

-- Edge functions use service role, no public access needed
-- But allow select for edge function reads
CREATE POLICY "Service role full access" ON public.rentcast_cache
  FOR ALL USING (true) WITH CHECK (true);

-- Add cache_hit to analyses
ALTER TABLE public.analyses ADD COLUMN cache_hit boolean DEFAULT false;
