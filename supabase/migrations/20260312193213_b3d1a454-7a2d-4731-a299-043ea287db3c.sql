
CREATE TABLE public.user_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  analysis_id uuid NOT NULL,
  rating text NOT NULL CHECK (rating IN ('positive', 'negative')),
  reason text,
  comment text,
  page text NOT NULL CHECK (page IN ('renewal_results', 'wsip_results')),
  verdict_snapshot text,
  score_snapshot numeric,
  confidence_snapshot text,
  UNIQUE (analysis_id, page)
);

ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous inserts" ON public.user_feedback
  FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Allow anonymous updates" ON public.user_feedback
  FOR UPDATE TO public USING (true) WITH CHECK (true);

CREATE POLICY "Allow anonymous select" ON public.user_feedback
  FOR SELECT TO public USING (true);
