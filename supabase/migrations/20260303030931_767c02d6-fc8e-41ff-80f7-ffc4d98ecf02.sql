
-- 1. Remove UPDATE policy on analyses (anon users should never update analyses)
DROP POLICY IF EXISTS "Allow anonymous updates" ON public.analyses;

-- 2. Remove overly broad ALL policy on rentcast_cache
-- Edge functions use service_role which bypasses RLS entirely
DROP POLICY IF EXISTS "Service role full access" ON public.rentcast_cache;

-- 3. Fix get_analyses_count function with proper search_path
CREATE OR REPLACE FUNCTION public.get_analyses_count()
 RETURNS bigint
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = public
AS $function$
  SELECT count(*) FROM public.analyses;
$function$;
