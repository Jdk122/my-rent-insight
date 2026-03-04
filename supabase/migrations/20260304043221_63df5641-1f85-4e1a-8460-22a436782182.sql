
-- Add explicit SELECT deny policies for all PII tables to satisfy security scanner
-- (RLS already denies SELECT without a policy, but explicit is better)

CREATE POLICY "Deny public select" ON public.leads FOR SELECT USING (false);
CREATE POLICY "Deny public select" ON public.lead_events FOR SELECT USING (false);
CREATE POLICY "Deny public select" ON public.contact_submissions FOR SELECT USING (false);
CREATE POLICY "Deny public select" ON public.analyses FOR SELECT USING (false);
CREATE POLICY "Deny public select" ON public.shared_reports FOR SELECT USING (false);
