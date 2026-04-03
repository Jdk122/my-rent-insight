CREATE OR REPLACE FUNCTION public.admin_dashboard_stats()
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT json_build_object(
    'total_submissions', (SELECT count(*) FROM analyses),
    'submissions_30d', (SELECT count(*) FROM analyses WHERE created_at > now() - interval '30 days'),
    'submissions_today', (SELECT count(*) FROM analyses WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'America/New_York') AT TIME ZONE 'America/New_York'),
    'unique_zips', (SELECT count(DISTINCT zip) FROM analyses),
    'unfair_excessive_count', (SELECT count(*) FROM analyses WHERE verdict_label IN ('Unfair', 'Excessive')),
    'avg_overpayment', (SELECT round(coalesce(avg(dollar_overpayment), 0)::numeric, 0) FROM analyses WHERE dollar_overpayment > 0),
    'letter_count', (SELECT count(*) FROM analyses WHERE letter_generated = true),
    'shared_count', (SELECT count(*) FROM analyses WHERE results_shared = true),
    'total_leads', (SELECT count(*) FROM leads WHERE coalesce(unsubscribed, false) = false),
    'total_leads_all', (SELECT count(*) FROM leads),
    'partner_optin_count', (SELECT count(*) FROM leads WHERE partner_opt_in = true),
    'above_market_count', (SELECT count(*) FROM analyses WHERE verdict_label IN ('Moderate', 'Unfair', 'Excessive')),
    'paywall_clicks', (SELECT count(*) FROM lead_events WHERE event_type = 'toolkit_click'),
    'paywall_clicks_30d', (SELECT count(*) FROM lead_events WHERE event_type = 'toolkit_click' AND created_at > now() - interval '30 days'),
    'purchases', (SELECT count(*) FROM lead_events WHERE event_type = 'purchase_completed'),
    'purchases_30d', (SELECT count(*) FROM lead_events WHERE event_type = 'purchase_completed' AND created_at > now() - interval '30 days'),
    'revenue', (SELECT round((count(*) * 4.99)::numeric, 2) FROM lead_events WHERE event_type = 'purchase_completed'),
    'paywall_clicks_by_verdict', (
      SELECT coalesce(json_agg(row_to_json(t)), '[]'::json) FROM (
        SELECT coalesce(verdict, 'unknown') as verdict, count(*) as count
        FROM lead_events WHERE event_type = 'toolkit_click'
        GROUP BY verdict ORDER BY count(*) DESC
      ) t
    ),
    'purchases_by_verdict', (
      SELECT coalesce(json_agg(row_to_json(t)), '[]'::json) FROM (
        SELECT coalesce(verdict, 'unknown') as verdict, count(*) as count
        FROM lead_events WHERE event_type = 'purchase_completed'
        GROUP BY verdict ORDER BY count(*) DESC
      ) t
    ),
    'capture_by_first_source', (
      SELECT coalesce(json_agg(row_to_json(t)), '[]'::json) FROM (
        SELECT
          coalesce(original_capture_source, capture_source) as source,
          count(*) as count,
          count(CASE WHEN created_at > now() - interval '30 days' THEN 1 END) as count_30d
        FROM leads
        WHERE email IS NOT NULL AND coalesce(unsubscribed, false) = false
        GROUP BY coalesce(original_capture_source, capture_source)
        ORDER BY count(*) DESC
      ) t
    )
  );
$function$;