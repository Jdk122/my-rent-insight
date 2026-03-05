
-- Drop restrictive deny-select policies so admin can read data
DROP POLICY IF EXISTS "Deny public select" ON public.analyses;
DROP POLICY IF EXISTS "Deny public select" ON public.leads;
DROP POLICY IF EXISTS "Deny public select" ON public.lead_events;
DROP POLICY IF EXISTS "Deny public select" ON public.shared_reports;

-- Add permissive select policies
CREATE POLICY "Allow public select" ON public.analyses FOR SELECT USING (true);
CREATE POLICY "Allow public select" ON public.leads FOR SELECT USING (true);
CREATE POLICY "Allow public select" ON public.lead_events FOR SELECT USING (true);
CREATE POLICY "Allow public select" ON public.shared_reports FOR SELECT USING (true);

-- Dashboard summary stats RPC
CREATE OR REPLACE FUNCTION public.admin_dashboard_stats()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'total_submissions', (SELECT count(*) FROM analyses),
    'submissions_30d', (SELECT count(*) FROM analyses WHERE created_at > now() - interval '30 days'),
    'submissions_today', (SELECT count(*) FROM analyses WHERE created_at > now() - interval '1 day'),
    'unique_zips', (SELECT count(DISTINCT zip) FROM analyses),
    'unfair_excessive_count', (SELECT count(*) FROM analyses WHERE verdict_label IN ('Unfair', 'Excessive')),
    'avg_overpayment', (SELECT round(coalesce(avg(dollar_overpayment), 0)::numeric, 0) FROM analyses WHERE dollar_overpayment > 0),
    'letter_count', (SELECT count(*) FROM analyses WHERE letter_generated = true),
    'shared_count', (SELECT count(*) FROM analyses WHERE results_shared = true),
    'total_leads', (SELECT count(*) FROM leads WHERE coalesce(unsubscribed, false) = false),
    'total_leads_all', (SELECT count(*) FROM leads),
    'partner_optin_count', (SELECT count(*) FROM leads WHERE partner_opt_in = true),
    'above_market_count', (SELECT count(*) FROM analyses WHERE verdict_label IN ('Moderate', 'Unfair', 'Excessive'))
  );
$$;

-- Zip code leaderboard RPC
CREATE OR REPLACE FUNCTION public.admin_zip_leaderboard()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(json_agg(row_to_json(t)), '[]'::json) FROM (
    SELECT
      a.zip,
      (SELECT city FROM analyses WHERE zip = a.zip AND city IS NOT NULL LIMIT 1) as city,
      count(*) as submissions,
      round(avg(a.fairness_score)::numeric, 0) as avg_fairness_score,
      round(avg(CASE WHEN a.dollar_overpayment > 0 THEN a.dollar_overpayment END)::numeric, 0) as avg_overpayment,
      count(CASE WHEN a.verdict_label IN ('Unfair', 'Excessive') THEN 1 END) as unfair_count,
      count(DISTINCT l.email) as leads_with_email,
      count(CASE WHEN a.letter_generated = true THEN 1 END) as letter_count,
      count(CASE WHEN a.created_at > now() - interval '30 days' THEN 1 END) as submissions_30d,
      count(CASE WHEN a.verdict_label IN ('Unfair', 'Excessive') AND a.created_at > now() - interval '30 days' THEN 1 END) as unfair_30d
    FROM analyses a
    LEFT JOIN leads l ON l.analysis_id = a.id
    WHERE a.zip IS NOT NULL
    GROUP BY a.zip
    HAVING count(*) >= 3
    ORDER BY count(*) DESC
    LIMIT 100
  ) t;
$$;

-- Traffic source stats RPC
CREATE OR REPLACE FUNCTION public.admin_traffic_stats()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(json_agg(row_to_json(t)), '[]'::json) FROM (
    SELECT
      coalesce(a.utm_source, 'Direct') as source,
      count(*) as submissions,
      round(avg(a.fairness_score)::numeric, 0) as avg_fairness_score,
      count(CASE WHEN a.verdict_label IN ('Unfair', 'Excessive') THEN 1 END) as unfair_count,
      round(avg(CASE WHEN a.dollar_overpayment > 0 THEN a.dollar_overpayment END)::numeric, 0) as avg_overpayment,
      count(DISTINCT l.email) as leads_with_email
    FROM analyses a
    LEFT JOIN leads l ON l.analysis_id = a.id
    GROUP BY coalesce(a.utm_source, 'Direct')
    ORDER BY count(*) DESC
  ) t;
$$;

-- Daily submission counts RPC
CREATE OR REPLACE FUNCTION public.admin_daily_submissions(p_days integer DEFAULT 90)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(json_agg(row_to_json(t) ORDER BY t.day), '[]'::json) FROM (
    SELECT
      date_trunc('day', created_at)::date as day,
      count(*) as submissions
    FROM analyses
    WHERE created_at > now() - (p_days || ' days')::interval
    GROUP BY date_trunc('day', created_at)::date
    ORDER BY day
  ) t;
$$;
