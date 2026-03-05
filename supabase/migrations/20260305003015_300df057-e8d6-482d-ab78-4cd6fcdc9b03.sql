
ALTER TABLE public.analyses
  ADD COLUMN IF NOT EXISTS dollar_overpayment numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS counter_offer_low numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS counter_offer_high numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS letter_tone text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS results_shared boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS utm_source text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS utm_medium text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS utm_campaign text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS confidence_level text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS rent_stabilized boolean DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS verdict_label text DEFAULT NULL;
