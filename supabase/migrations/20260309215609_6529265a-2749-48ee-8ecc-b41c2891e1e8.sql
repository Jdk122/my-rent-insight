
DROP FUNCTION IF EXISTS public.update_lead_outcome(uuid, text);

CREATE OR REPLACE FUNCTION public.update_lead_outcome(p_lead_id uuid, p_outcome text, p_testimonial text DEFAULT NULL)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.leads
  SET outcome = p_outcome,
      testimonial = COALESCE(p_testimonial, testimonial),
      unsubscribed = CASE WHEN p_outcome = 'unsubscribe' THEN true ELSE unsubscribed END
  WHERE id = p_lead_id;
END;
$$;
