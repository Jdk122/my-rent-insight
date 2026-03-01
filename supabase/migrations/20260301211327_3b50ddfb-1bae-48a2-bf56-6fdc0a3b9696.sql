CREATE TABLE public.leads (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  email text NOT NULL,
  address text,
  city text,
  state text,
  zip text,
  bedrooms integer,
  current_rent numeric,
  proposed_rent numeric,
  increase_pct numeric,
  market_trend_pct numeric,
  fair_counter_offer numeric,
  comps_position text,
  letter_generated boolean DEFAULT false,
  lease_expiration_month text,
  lease_expiration_year integer
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous inserts" ON public.leads
  FOR INSERT WITH CHECK (true);
