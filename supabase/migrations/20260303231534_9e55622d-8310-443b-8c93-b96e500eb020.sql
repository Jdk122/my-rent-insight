
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
  p_partner_opt_in boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.leads (
    email, analysis_id, capture_source, address, city, state, zip,
    bedrooms, current_rent, proposed_rent, increase_pct, market_trend_pct,
    fair_counter_offer, comps_position, letter_generated, verdict,
    utm_source, utm_medium, utm_campaign,
    lease_expiration_month, lease_expiration_year, partner_opt_in
  ) VALUES (
    p_email, p_analysis_id, p_capture_source, p_address, p_city, p_state, p_zip,
    p_bedrooms, p_current_rent, p_proposed_rent, p_increase_pct, p_market_trend_pct,
    p_fair_counter_offer, p_comps_position, p_letter_generated, p_verdict,
    p_utm_source, p_utm_medium, p_utm_campaign,
    p_lease_expiration_month, p_lease_expiration_year, p_partner_opt_in
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
    partner_opt_in = COALESCE(EXCLUDED.partner_opt_in, leads.partner_opt_in);
END;
$$;
