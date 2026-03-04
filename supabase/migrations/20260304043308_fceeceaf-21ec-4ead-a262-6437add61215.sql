
-- Remove overly permissive UPDATE policy on leads
-- upsert_lead() uses SECURITY DEFINER so it bypasses RLS
DROP POLICY IF EXISTS "Allow anonymous upserts" ON public.leads;
