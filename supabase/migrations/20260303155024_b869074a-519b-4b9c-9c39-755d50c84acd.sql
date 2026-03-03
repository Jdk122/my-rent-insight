ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS verdict text,
  ADD COLUMN IF NOT EXISTS utm_source text,
  ADD COLUMN IF NOT EXISTS utm_medium text,
  ADD COLUMN IF NOT EXISTS utm_campaign text;