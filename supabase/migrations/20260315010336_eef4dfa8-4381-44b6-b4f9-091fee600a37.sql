
CREATE OR REPLACE FUNCTION public.find_orphaned_leads()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(json_agg(row_to_json(t)), '[]'::json) FROM (
    SELECT l.id, l.email, l.analysis_id, l.capture_source, l.created_at
    FROM leads l
    LEFT JOIN analyses a ON a.id = l.analysis_id
    WHERE l.analysis_id IS NOT NULL AND a.id IS NULL
    ORDER BY l.created_at DESC
    LIMIT 50
  ) t;
$$;
