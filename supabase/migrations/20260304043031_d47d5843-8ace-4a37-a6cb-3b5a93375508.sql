
-- 1. Remove overly permissive SELECT on analyses (get_analyses_count uses SECURITY DEFINER, no client SELECT needed)
DROP POLICY IF EXISTS "Allow anonymous select" ON public.analyses;

-- 2. Restrict shared_reports SELECT to require knowledge of short_id
DROP POLICY IF EXISTS "Allow public reads" ON public.shared_reports;

-- 3. Add policies that deny all public access on backend-only tables
-- lookup_rate_limits: used only by edge functions
ALTER TABLE public.lookup_rate_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deny all public access" ON public.lookup_rate_limits FOR ALL USING (false);

-- property_cache: used only by edge functions  
ALTER TABLE public.property_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deny all public access" ON public.property_cache FOR ALL USING (false);

-- rentcast_cache: used only by edge functions
ALTER TABLE public.rentcast_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deny all public access" ON public.rentcast_cache FOR ALL USING (false);
