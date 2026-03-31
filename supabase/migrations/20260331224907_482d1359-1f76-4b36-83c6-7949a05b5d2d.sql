-- 1. Drop overly permissive leads UPDATE policy
DROP POLICY IF EXISTS "Allow anonymous upserts" ON public.leads;

-- 2. Drop anonymous UPDATE on analyses
DROP POLICY IF EXISTS "Allow anonymous updates on own analyses" ON public.analyses;

-- 3. RPC: safe_update_analysis
CREATE OR REPLACE FUNCTION public.safe_update_analysis(
  p_id uuid,
  p_letter_generated boolean DEFAULT NULL,
  p_results_shared boolean DEFAULT NULL,
  p_user_intent text DEFAULT NULL,
  p_verdict_label text DEFAULT NULL,
  p_fairness_score numeric DEFAULT NULL,
  p_dollar_overpayment numeric DEFAULT NULL,
  p_comp_median_rent numeric DEFAULT NULL,
  p_hud_fmr_value numeric DEFAULT NULL,
  p_comps_count integer DEFAULT NULL,
  p_comps_position text DEFAULT NULL,
  p_gate_variant text DEFAULT NULL,
  p_rent_stabilized boolean DEFAULT NULL,
  p_letter_tone text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_user_intent IS NOT NULL AND p_user_intent NOT IN ('stay', 'move') THEN
    RAISE EXCEPTION 'Invalid user_intent value: %', p_user_intent;
  END IF;

  UPDATE public.analyses SET
    letter_generated = COALESCE(p_letter_generated, letter_generated),
    results_shared = COALESCE(p_results_shared, results_shared),
    user_intent = COALESCE(p_user_intent, user_intent),
    verdict_label = COALESCE(p_verdict_label, verdict_label),
    fairness_score = COALESCE(p_fairness_score, fairness_score),
    dollar_overpayment = COALESCE(p_dollar_overpayment, dollar_overpayment),
    comp_median_rent = COALESCE(p_comp_median_rent, comp_median_rent),
    hud_fmr_value = COALESCE(p_hud_fmr_value, hud_fmr_value),
    comps_count = COALESCE(p_comps_count, comps_count),
    comps_position = COALESCE(p_comps_position, comps_position),
    rent_stabilized = COALESCE(p_rent_stabilized, rent_stabilized),
    letter_tone = COALESCE(p_letter_tone, letter_tone)
  WHERE id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.safe_update_analysis TO anon;
GRANT EXECUTE ON FUNCTION public.safe_update_analysis TO authenticated;

-- 4. Index for rate limiting queries
CREATE INDEX IF NOT EXISTS idx_fn_request_log_ratelimit
  ON public.function_request_log (function_name, ip_address, created_at DESC);