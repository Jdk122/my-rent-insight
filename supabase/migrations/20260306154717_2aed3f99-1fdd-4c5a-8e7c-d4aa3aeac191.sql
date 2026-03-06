
CREATE TABLE public.referral_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid REFERENCES public.analyses(id) ON DELETE SET NULL,
  email text,
  link_type text NOT NULL,
  zip text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.referral_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous inserts" ON public.referral_clicks
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Deny public select" ON public.referral_clicks
  FOR SELECT USING (false);
