
-- Create shared_reports table for shareable report links
CREATE TABLE public.shared_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  short_id text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  zip_code text NOT NULL,
  address text,
  bedrooms integer NOT NULL,
  current_rent numeric NOT NULL,
  proposed_increase numeric NOT NULL,
  increase_type text NOT NULL DEFAULT 'percent',
  report_data jsonb NOT NULL
);

-- Index on short_id for fast lookups
CREATE INDEX idx_shared_reports_short_id ON public.shared_reports (short_id);

-- Enable RLS
ALTER TABLE public.shared_reports ENABLE ROW LEVEL SECURITY;

-- Anyone with the link can view
CREATE POLICY "Allow public reads" ON public.shared_reports
  FOR SELECT USING (true);

-- Allow inserts from the app (anon key)
CREATE POLICY "Allow anonymous inserts" ON public.shared_reports
  FOR INSERT WITH CHECK (true);
