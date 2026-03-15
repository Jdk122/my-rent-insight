CREATE OR REPLACE FUNCTION public.admin_daily_submissions(p_days integer DEFAULT 90)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT coalesce(json_agg(row_to_json(t) ORDER BY t.day), '[]'::json) FROM (
    SELECT
      date_trunc('day', created_at AT TIME ZONE 'America/New_York')::date as day,
      count(*) as submissions
    FROM analyses
    WHERE created_at > now() - (p_days || ' days')::interval
    GROUP BY date_trunc('day', created_at AT TIME ZONE 'America/New_York')::date
    ORDER BY day
  ) t;
$function$;