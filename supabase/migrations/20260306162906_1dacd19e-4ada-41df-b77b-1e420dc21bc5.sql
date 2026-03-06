
CREATE TABLE public.priority_zips (
  zip TEXT PRIMARY KEY,
  city TEXT,
  state TEXT,
  source TEXT NOT NULL DEFAULT 'zori',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.priority_zips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public reads" ON public.priority_zips
  FOR SELECT USING (true);
