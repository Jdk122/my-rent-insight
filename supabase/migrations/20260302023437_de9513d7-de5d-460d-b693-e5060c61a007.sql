
CREATE TABLE public.dhcr_buildings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  borough text NOT NULL,
  zip text NOT NULL,
  bldg_no text NOT NULL,
  street text NOT NULL,
  street_suffix text,
  bldg_no2 text,
  street2 text,
  street_suffix2 text,
  city text,
  county text,
  status1 text,
  status2 text,
  status3 text,
  block text,
  lot text
);

-- Index on zip for fast lookups
CREATE INDEX idx_dhcr_buildings_zip ON public.dhcr_buildings (zip);

-- RLS: allow public reads (no auth needed for lookup)
ALTER TABLE public.dhcr_buildings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public reads" ON public.dhcr_buildings
  FOR SELECT USING (true);
