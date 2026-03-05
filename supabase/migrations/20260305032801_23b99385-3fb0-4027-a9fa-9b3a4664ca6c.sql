CREATE TABLE public.agent_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  bedrooms text,
  bathrooms text,
  move_date text,
  neighborhoods text,
  zip text,
  current_rent numeric,
  proposed_rent numeric,
  property_type text,
  verdict_label text,
  fairness_score integer,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous inserts" ON public.agent_leads FOR INSERT WITH CHECK (true);
CREATE POLICY "Deny public select" ON public.agent_leads FOR SELECT USING (false);