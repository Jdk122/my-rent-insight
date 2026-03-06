
CREATE TABLE public.data_freshness_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  all_fresh BOOLEAN NOT NULL,
  stale_sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  alert_sent BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE public.data_freshness_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public reads on freshness log" ON public.data_freshness_log
  FOR SELECT USING (true);
