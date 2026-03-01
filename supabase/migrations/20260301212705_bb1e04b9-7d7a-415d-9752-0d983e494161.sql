
-- Drop old leads table
DROP TABLE IF EXISTS public.leads;

-- Create analyses table for anonymous logging
CREATE TABLE public.analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  address text,
  city text,
  state text,
  zip text,
  bedrooms integer,
  current_rent numeric,
  proposed_rent numeric,
  increase_pct numeric,
  market_trend_pct numeric,
  fair_counter_offer text,
  comps_count integer,
  comps_position text,
  sale_data_found boolean DEFAULT false,
  markup_multiplier numeric,
  letter_generated boolean DEFAULT false,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anonymous inserts" ON public.analyses FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous updates" ON public.analyses FOR UPDATE USING (true) WITH CHECK (true);

-- Create new leads table with deduplication
CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  analysis_id uuid REFERENCES public.analyses(id),
  capture_source text,
  address text,
  city text,
  state text,
  zip text,
  bedrooms integer,
  current_rent numeric,
  proposed_rent numeric,
  increase_pct numeric,
  market_trend_pct numeric,
  fair_counter_offer text,
  comps_position text,
  letter_generated boolean DEFAULT false,
  lease_expiration_month integer,
  lease_expiration_year integer,
  reminder_sent_at timestamptz,
  unsubscribed boolean DEFAULT false,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anonymous inserts" ON public.leads FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous upserts" ON public.leads FOR UPDATE USING (true) WITH CHECK (true);
