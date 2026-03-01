
-- Add columns for follow-up email tracking
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS letter_generated_at timestamptz DEFAULT NULL;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS followup_sent_at timestamptz DEFAULT NULL;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS outcome text DEFAULT NULL;

-- Function for social proof counter (anonymous readable)
CREATE OR REPLACE FUNCTION public.get_analyses_count()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT count(*) FROM public.analyses;
$$;

-- Allow anonymous SELECT on analyses count via RPC
GRANT EXECUTE ON FUNCTION public.get_analyses_count() TO anon;
GRANT EXECUTE ON FUNCTION public.get_analyses_count() TO authenticated;

-- Allow anonymous SELECT on leads for outcome tracking page
CREATE POLICY "Allow anonymous select for outcome" ON public.leads
  FOR SELECT USING (true);
