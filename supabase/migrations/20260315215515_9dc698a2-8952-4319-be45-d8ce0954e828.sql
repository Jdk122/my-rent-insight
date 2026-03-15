
-- Add founder_followup_sent_at to leads (separate from existing followup_sent_at used by day-7 HTML followup)
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS founder_followup_sent_at timestamp with time zone;

-- Create email send attempts log table
CREATE TABLE public.email_send_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL,
  email text NOT NULL,
  template text NOT NULL DEFAULT 'founder_followup',
  attempted_at timestamp with time zone NOT NULL DEFAULT now(),
  success boolean NOT NULL DEFAULT false,
  error_message text,
  CONSTRAINT fk_lead FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE
);

ALTER TABLE public.email_send_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny all public access" ON public.email_send_attempts FOR ALL TO public USING (false);
