CREATE OR REPLACE FUNCTION public.update_lead_outcome(p_lead_id uuid, p_outcome text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.leads
  SET outcome = p_outcome,
      unsubscribed = CASE WHEN p_outcome = 'unsubscribe' THEN true ELSE unsubscribed END
  WHERE id = p_lead_id;
END;
$function$;