
-- Table 1: deal_analyses (public-safe, no email)
CREATE TABLE deal_analyses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  short_id TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '30 days'),
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state_abbr TEXT,
  zip TEXT,
  beds INTEGER NOT NULL,
  baths NUMERIC,
  sqft INTEGER,
  rent INTEGER NOT NULL,
  days_on_market INTEGER,
  listing_url TEXT,
  score INTEGER NOT NULL,
  verdict TEXT NOT NULL,
  savings_per_month INTEGER NOT NULL,
  savings_pct NUMERIC,
  median INTEGER NOT NULL,
  is_suspicious BOOLEAN DEFAULT false,
  has_leverage BOOLEAN DEFAULT false,
  leverage_note TEXT,
  trend_context TEXT,
  walk_score INTEGER,
  is_rent_stabilized BOOLEAN DEFAULT false,
  score_version TEXT DEFAULT 'v1',
  components JSONB,
  fair_range JSONB
);

CREATE INDEX idx_deal_analyses_short_id ON deal_analyses (short_id);

ALTER TABLE deal_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public reads deal analyses (table is non-sensitive)"
  ON deal_analyses FOR SELECT
  USING (true);

CREATE POLICY "Service role inserts deal analyses"
  ON deal_analyses FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Table 2: deal_analysis_leads (private, never browser-readable)
CREATE TABLE deal_analysis_leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_analysis_id UUID NOT NULL REFERENCES deal_analyses(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE deal_analysis_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages deal analysis leads"
  ON deal_analysis_leads FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
