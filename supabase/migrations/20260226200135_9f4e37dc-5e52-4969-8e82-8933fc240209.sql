
-- Cache property lookups to avoid repeat API charges
CREATE TABLE IF NOT EXISTS public.property_cache (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  address_normalized text UNIQUE NOT NULL,
  data jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_property_cache_created ON public.property_cache (created_at);

-- Rate limiting
CREATE TABLE IF NOT EXISTS public.lookup_rate_limits (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_ip_created ON public.lookup_rate_limits (ip_address, created_at);

-- RLS: Allow service role only (edge functions use service role key)
ALTER TABLE public.property_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lookup_rate_limits ENABLE ROW LEVEL SECURITY;

-- No public access policies - only service role can read/write these tables
