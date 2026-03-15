-- Add budget column to agent_leads
ALTER TABLE public.agent_leads ADD COLUMN IF NOT EXISTS budget text;

-- Create function_request_log table for rate limiting
CREATE TABLE IF NOT EXISTS public.function_request_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name text NOT NULL,
  ip_address text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  success boolean,
  response_status integer
);

-- Index for rolling window lookups
CREATE INDEX IF NOT EXISTS idx_function_request_log_lookup
  ON public.function_request_log (function_name, ip_address, created_at DESC);

-- RLS: deny public access, only service role writes
ALTER TABLE public.function_request_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny all public access" ON public.function_request_log
  FOR ALL TO public USING (false);

-- Update update_lead_outcome to unsubscribe ALL rows for an email
CREATE OR REPLACE FUNCTION public.update_lead_outcome(p_lead_id uuid, p_outcome text, p_testimonial text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_email text;
BEGIN
  SELECT email INTO v_email FROM public.leads WHERE id = p_lead_id;

  UPDATE public.leads
  SET outcome = p_outcome,
      testimonial = COALESCE(p_testimonial, testimonial),
      unsubscribed = CASE WHEN p_outcome = 'unsubscribe' THEN true ELSE unsubscribed END
  WHERE id = p_lead_id;

  IF p_outcome = 'unsubscribe' AND v_email IS NOT NULL THEN
    UPDATE public.leads
    SET unsubscribed = true
    WHERE email = v_email AND id != p_lead_id;
  END IF;
END;
$function$;

-- Cleanup cron for function_request_log (prune entries older than 1 hour)
SELECT cron.schedule(
  'cleanup-function-request-log',
  '15 * * * *',
  $$DELETE FROM public.function_request_log WHERE created_at < now() - interval '1 hour'$$
);