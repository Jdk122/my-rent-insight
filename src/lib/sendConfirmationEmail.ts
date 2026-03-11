import { supabase } from '@/integrations/supabase/client';

interface ConfirmationEmailParams {
  email: string;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  bedrooms?: number | null;
  toolType: 'renewal' | 'wsip';
  fairnessScore?: number | null;
  verdictLabel?: string | null;
  reportUrl?: string | null;
}

export async function sendConfirmationEmail(params: ConfirmationEmailParams) {
  try {
    await supabase.functions.invoke('send-confirmation', {
      body: {
        email: params.email,
        city: params.city || null,
        state: params.state || null,
        zip: params.zip || null,
        bedrooms: params.bedrooms ?? null,
        tool_type: params.toolType,
        fairness_score: params.fairnessScore ?? null,
        verdict_label: params.verdictLabel || null,
        report_url: params.reportUrl || null,
      },
    });
  } catch (err) {
    // Fire-and-forget — don't block UX
    console.error('[confirmation-email] send failed:', err);
  }
}
