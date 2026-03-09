import { useState, useEffect } from 'react';
import { trackEvent, trackAdsConversion } from '@/lib/analytics';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getUtmParams } from '@/lib/utm';
import SocialProofLine from './SocialProofLine';
import PostConversionFlow from './PostConversionFlow';

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 6 }, (_, i) => currentYear + i);

export interface LeadContext {
  analysisId?: string | null;
  address?: string | null;
  city?: string;
  state?: string;
  zip?: string;
  bedrooms?: number;
  currentRent?: number;
  proposedRent?: number;
  increasePct?: number;
  marketTrendPct?: number;
  fairCounterOffer?: string;
  compsPosition?: string;
  letterGenerated?: boolean;
  fairnessScore?: number | null;
  compMedianRent?: number | null;
  hudFmrValue?: number | null;
}

interface EmailCaptureProps {
  city?: string;
  captureSource?: string;
  prefilledEmail?: string;
  onEmailCaptured?: (email: string) => void;
  leadContext?: LeadContext;
  heading?: string;
  subtext?: string;
  verdict?: string;
}

const EmailCapture = ({ city, captureSource = 'lease_reminder', prefilledEmail, onEmailCaptured, leadContext, heading, subtext, verdict }: EmailCaptureProps) => {
  const [email, setEmail] = useState(prefilledEmail || '');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (prefilledEmail && !email) setEmail(prefilledEmail);
  }, [prefilledEmail]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    const utm = getUtmParams();

    try {
      await supabase.rpc('upsert_lead', {
        p_email: email,
        p_analysis_id: leadContext?.analysisId || null,
        p_capture_source: captureSource,
        p_address: leadContext?.address || null,
        p_city: leadContext?.city || null,
        p_state: leadContext?.state || null,
        p_zip: leadContext?.zip || null,
        p_bedrooms: leadContext?.bedrooms ?? null,
        p_current_rent: leadContext?.currentRent ?? null,
        p_proposed_rent: leadContext?.proposedRent ?? null,
        p_increase_pct: leadContext?.increasePct ?? null,
        p_market_trend_pct: leadContext?.marketTrendPct ?? null,
        p_fair_counter_offer: leadContext?.fairCounterOffer || null,
        p_comps_position: leadContext?.compsPosition || null,
        p_letter_generated: leadContext?.letterGenerated ?? false,
        p_verdict: verdict || null,
        p_utm_source: utm.utm_source || null,
        p_utm_medium: utm.utm_medium || null,
        p_utm_campaign: utm.utm_campaign || null,
        p_fairness_score: leadContext?.fairnessScore ?? null,
        p_comp_median_rent: leadContext?.compMedianRent ?? null,
        p_hud_fmr_value: leadContext?.hudFmrValue ?? null,
      } as any);

      await supabase.from('lead_events' as any).insert({
        email,
        analysis_id: leadContext?.analysisId || null,
        event_type: captureSource,
        fairness_score: leadContext?.fairnessScore ?? null,
        address: leadContext?.address || null,
        zip: leadContext?.zip || null,
        current_rent: leadContext?.currentRent ?? null,
        proposed_rent: leadContext?.proposedRent ?? null,
        increase_pct: leadContext?.increasePct ?? null,
        verdict: verdict || null,
        comp_median_rent: leadContext?.compMedianRent ?? null,
        hud_fmr_value: leadContext?.hudFmrValue ?? null,
      } as any);
    } catch (err) {
      console.error('Lead save failed:', err);
      toast.error('Something went wrong saving your info.');
    }

    onEmailCaptured?.(email);
    trackEvent('email_submitted', { verdict: verdict || 'unknown', zip_code: leadContext?.zip || '', source: captureSource });
    trackAdsConversion();
    if (captureSource === 'lease_reminder') {
      trackEvent('lease_reminder_signup');
    }
    setSubmitted(true);
    toast.success("You're on the list.");
  };

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="space-y-4"
      >
        <div className="py-4">
          <div className="inline-flex items-center justify-center w-8 h-8 rounded-full mb-3" style={{ background: 'hsl(var(--accent-green) / 0.1)' }}>
            <Check className="w-4 h-4 text-verdict-good" />
          </div>
          <h3 className="font-display text-lg font-semibold text-foreground">You're all set</h3>
          <p className="text-xs text-muted-foreground mt-1.5 max-w-xs mx-auto">
            We'll send you updated market data before your lease renews.
          </p>
        </div>

        {/* Progressive reveal: lease renewal fields */}
        <PostConversionFlow
          email={email}
          leadContext={leadContext}
          verdictLabel={verdict || 'unknown'}
          zip={leadContext?.zip || ''}
        />
      </motion.div>
    );
  }

  return (
    <div>
      <h2 className="font-display text-xl font-semibold text-foreground mb-1.5" style={{ letterSpacing: '-0.01em' }}>
        {heading || 'Get Reminded Before Your Lease Is Up'}
      </h2>
      <p className="text-sm text-foreground/70 mb-5">
        {subtext || `We'll send you updated market data for ${city || 'your area'} before your next renewal.`}
      </p>
      <form onSubmit={handleSubmit} className="max-w-[440px] mx-auto space-y-2">
        <div className="flex gap-2">
          <input
            type="email"
            placeholder="you@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="flex-1 min-w-0 px-4 py-3 text-sm border border-border rounded-lg bg-card text-foreground outline-none focus:border-foreground transition-colors placeholder:text-muted-foreground/50"
          />
          <button type="submit" className="bg-primary text-primary-foreground px-4 sm:px-5 py-3 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm shadow-primary/20 whitespace-nowrap shrink-0">
            Save my results →
          </button>
        </div>
        <div className="mt-2">
          <SocialProofLine />
        </div>
      </form>
      <div className="max-w-[440px] mx-auto mt-2 space-y-1.5">
        <p className="text-[11px] text-muted-foreground/60 text-center">
          No spam. Unsubscribe anytime. See our{' '}
          <Link to="/privacy" className="underline hover:text-foreground transition-colors">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
};

export default EmailCapture;
