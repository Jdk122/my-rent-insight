
-- Create a SECURITY DEFINER function to look up shared reports by short_id only
-- This replaces the direct SELECT which was too permissive
CREATE OR REPLACE FUNCTION public.get_shared_report(p_short_id text)
RETURNS TABLE (
  id uuid,
  short_id text,
  zip_code text,
  bedrooms integer,
  current_rent numeric,
  proposed_increase numeric,
  increase_type text,
  address text,
  report_data jsonb,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, short_id, zip_code, bedrooms, current_rent, proposed_increase, 
         increase_type, address, report_data, created_at
  FROM public.shared_reports
  WHERE shared_reports.short_id = p_short_id
  LIMIT 1;
$$;
