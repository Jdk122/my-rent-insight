
ALTER TABLE public.referral_clicks ADD COLUMN IF NOT EXISTS event_type text DEFAULT 'affiliate_click';
ALTER TABLE public.referral_clicks ADD COLUMN IF NOT EXISTS placement text DEFAULT NULL;
ALTER TABLE public.analyses ADD COLUMN IF NOT EXISTS user_intent text DEFAULT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'analyses_user_intent_check'
  ) THEN
    ALTER TABLE public.analyses ADD CONSTRAINT analyses_user_intent_check CHECK (user_intent IN ('stay', 'move') OR user_intent IS NULL);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'referral_clicks_event_type_check'
  ) THEN
    ALTER TABLE public.referral_clicks ADD CONSTRAINT referral_clicks_event_type_check CHECK (event_type IN ('intent_selected', 'affiliate_impression', 'affiliate_click'));
  END IF;
END $$;
