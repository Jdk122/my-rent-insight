
DROP POLICY "Deny public select" ON public.referral_clicks;
CREATE POLICY "Allow public select" ON public.referral_clicks FOR SELECT USING (true);
