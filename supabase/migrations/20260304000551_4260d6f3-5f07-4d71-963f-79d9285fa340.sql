
-- 1. Add fairness_score, comp_median_rent, hud_fmr_value to analyses
ALTER TABLE public.analyses
  ADD COLUMN IF NOT EXISTS fairness_score integer,
  ADD COLUMN IF NOT EXISTS comp_median_rent numeric,
  ADD COLUMN IF NOT EXISTS hud_fmr_value numeric;

-- 2. Add fairness_score, comp_median_rent, hud_fmr_value to leads
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS fairness_score integer,
  ADD COLUMN IF NOT EXISTS comp_median_rent numeric,
  ADD COLUMN IF NOT EXISTS hud_fmr_value numeric;

-- 3. Add analysis_id and lead_email to shared_reports
ALTER TABLE public.shared_reports
  ADD COLUMN IF NOT EXISTS analysis_id uuid REFERENCES public.analyses(id),
  ADD COLUMN IF NOT EXISTS lead_email text;

-- 4. Create lead_events table
CREATE TABLE public.lead_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  analysis_id uuid REFERENCES public.analyses(id),
  event_type text NOT NULL,
  fairness_score integer,
  address text,
  zip text,
  current_rent numeric,
  proposed_rent numeric,
  increase_pct numeric,
  verdict text,
  comp_median_rent numeric,
  hud_fmr_value numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. RLS on lead_events (write-only for anon, no SELECT)
ALTER TABLE public.lead_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous inserts"
  ON public.lead_events
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- 6. Update upsert_lead function to accept new fields
CREATE OR REPLACE FUNCTION public.upsert_lead(
  p_email text,
  p_analysis_id uuid DEFAULT NULL,
  p_capture_source text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_state text DEFAULT NULL,
  p_zip text DEFAULT NULL,
  p_bedrooms integer DEFAULT NULL,
  p_current_rent numeric DEFAULT NULL,
  p_proposed_rent numeric DEFAULT NULL,
  p_increase_pct numeric DEFAULT NULL,
  p_market_trend_pct numeric DEFAULT NULL,
  p_fair_counter_offer text DEFAULT NULL,
  p_comps_position text DEFAULT NULL,
  p_letter_generated boolean DEFAULT false,
  p_verdict text DEFAULT NULL,
  p_utm_source text DEFAULT NULL,
  p_utm_medium text DEFAULT NULL,
  p_utm_campaign text DEFAULT NULL,
  p_lease_expiration_month integer DEFAULT NULL,
  p_lease_expiration_year integer DEFAULT NULL,
  p_partner_opt_in boolean DEFAULT false,
  p_fairness_score integer DEFAULT NULL,
  p_comp_median_rent numeric DEFAULT NULL,
  p_hud_fmr_value numeric DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.leads (
    email, analysis_id, capture_source, address, city, state, zip,
    bedrooms, current_rent, proposed_rent, increase_pct, market_trend_pct,
    fair_counter_offer, comps_position, letter_generated, verdict,
    utm_source, utm_medium, utm_campaign,
    lease_expiration_month, lease_expiration_year, partner_opt_in,
    fairness_score, comp_median_rent, hud_fmr_value
  ) VALUES (
    p_email, p_analysis_id, p_capture_source, p_address, p_city, p_state, p_zip,
    p_bedrooms, p_current_rent, p_proposed_rent, p_increase_pct, p_market_trend_pct,
    p_fair_counter_offer, p_comps_position, p_letter_generated, p_verdict,
    p_utm_source, p_utm_medium, p_utm_campaign,
    p_lease_expiration_month, p_lease_expiration_year, p_partner_opt_in,
    p_fairness_score, p_comp_median_rent, p_hud_fmr_value
  )
  ON CONFLICT (email) DO UPDATE SET
    analysis_id = COALESCE(EXCLUDED.analysis_id, leads.analysis_id),
    capture_source = COALESCE(EXCLUDED.capture_source, leads.capture_source),
    address = COALESCE(EXCLUDED.address, leads.address),
    city = COALESCE(EXCLUDED.city, leads.city),
    state = COALESCE(EXCLUDED.state, leads.state),
    zip = COALESCE(EXCLUDED.zip, leads.zip),
    bedrooms = COALESCE(EXCLUDED.bedrooms, leads.bedrooms),
    current_rent = COALESCE(EXCLUDED.current_rent, leads.current_rent),
    proposed_rent = COALESCE(EXCLUDED.proposed_rent, leads.proposed_rent),
    increase_pct = COALESCE(EXCLUDED.increase_pct, leads.increase_pct),
    market_trend_pct = COALESCE(EXCLUDED.market_trend_pct, leads.market_trend_pct),
    fair_counter_offer = COALESCE(EXCLUDED.fair_counter_offer, leads.fair_counter_offer),
    comps_position = COALESCE(EXCLUDED.comps_position, leads.comps_position),
    letter_generated = COALESCE(EXCLUDED.letter_generated, leads.letter_generated),
    verdict = COALESCE(EXCLUDED.verdict, leads.verdict),
    utm_source = COALESCE(EXCLUDED.utm_source, leads.utm_source),
    utm_medium = COALESCE(EXCLUDED.utm_medium, leads.utm_medium),
    utm_campaign = COALESCE(EXCLUDED.utm_campaign, leads.utm_campaign),
    lease_expiration_month = COALESCE(EXCLUDED.lease_expiration_month, leads.lease_expiration_month),
    lease_expiration_year = COALESCE(EXCLUDED.lease_expiration_year, leads.lease_expiration_year),
    partner_opt_in = COALESCE(EXCLUDED.partner_opt_in, leads.partner_opt_in),
    fairness_score = COALESCE(EXCLUDED.fairness_score, leads.fairness_score),
    comp_median_rent = COALESCE(EXCLUDED.comp_median_rent, leads.comp_median_rent),
    hud_fmr_value = COALESCE(EXCLUDED.hud_fmr_value, leads.hud_fmr_value);
END;
$$;
