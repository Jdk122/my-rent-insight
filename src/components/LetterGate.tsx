import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { trackEvent, trackAdsConversion } from '@/lib/analytics';
import { getUtmParams } from '@/lib/utm';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { Check, Loader2 } from 'lucide-react';
import type { LeadContext } from './EmailCapture';

const SESSION_KEY = 'rr_letter_unlocked';

interface LetterGateProps {
  children: React.ReactNode;
  leadContext?: LeadContext;
  onEmailCaptured?: (email: string) => void;
  prefilledEmail?: string;
}

const LetterGate = ({ children, leadContext, onEmailCaptured, prefilledEmail }: LetterGateProps) => {
  const [unlocked, setUnlocked] = useState(() => {
    if (prefilledEmail) return true;
    return sessionStorage.getItem(SESSION_KEY) === 'true';
  });
  const [email, setEmail] = useState(prefilledEmail || '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (prefilledEmail && !unlocked) {
      setUnlocked(true);
      sessionStorage.setItem(SESSION_KEY, 'true');
    }
  }, [prefilledEmail]);

  const validateEmail = (val: string): string => {
    if (!val.trim()) return 'Please enter your email address.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim())) return 'Please enter a valid email address.';
    return '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateEmail(email);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError('');
    setLoading(true);

    const utm = getUtmParams();
    const verdict = 'above';

    try {
      const { error: dbError } = await supabase.rpc('upsert_lead', {
        p_email: email.trim(),
        p_analysis_id: leadContext?.analysisId || null,
        p_capture_source: 'letter_gate',
        p_address: null,
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
        p_letter_generated: true,
        p_verdict: verdict,
        p_utm_source: utm.utm_source || null,
        p_utm_medium: utm.utm_medium || null,
        p_utm_campaign: utm.utm_campaign || null,
        p_fairness_score: leadContext?.fairnessScore ?? null,
        p_comp_median_rent: leadContext?.compMedianRent ?? null,
        p_hud_fmr_value: leadContext?.hudFmrValue ?? null,
      } as any);

      if (dbError) throw dbError;

      // Set letter_generated_at for the 7-day follow-up system
      if (leadContext?.analysisId) {
        await supabase.from('leads' as any).update({
          letter_generated_at: new Date().toISOString(),
        } as any).eq('analysis_id', leadContext.analysisId);
      }

      // Insert into lead_events for history
      await supabase.from('lead_events' as any).insert({
        email: email.trim(),
        analysis_id: leadContext?.analysisId || null,
        event_type: 'letter_gate',
        fairness_score: leadContext?.fairnessScore ?? null,
        address: null,
        zip: leadContext?.zip || null,
        current_rent: leadContext?.currentRent ?? null,
        proposed_rent: leadContext?.proposedRent ?? null,
        increase_pct: leadContext?.increasePct ?? null,
        verdict,
        comp_median_rent: leadContext?.compMedianRent ?? null,
        hud_fmr_value: leadContext?.hudFmrValue ?? null,
      } as any);
    } catch {
      setLoading(false);
      setError('Something went wrong. Please try again.');
      return;
    }

    onEmailCaptured?.(email.trim());
    trackEvent('email_submitted', { verdict, zip_code: leadContext?.zip || '', source: 'letter_gate' });
    trackAdsConversion();
    sessionStorage.setItem(SESSION_KEY, 'true');
    setUnlocked(true);
    setLoading(false);
    toast.success('Letter unlocked!');
  };

  if (unlocked) {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-title">Your Negotiation Letter</h2>
          <div className="flex items-center gap-1.5 text-xs text-verdict-good">
            <Check className="w-3.5 h-3.5" />
            <span>Letter unlocked</span>
          </div>
        </div>
        {children}
      </div>
    );
  }

  return (
    <div>
      <h2 className="section-title">Your Negotiation Letter</h2>

      {/* Blurred preview */}
      <div className="relative mt-4">
        <div
          className="select-none pointer-events-none min-h-[200px]"
          style={{ filter: 'blur(6px)', WebkitFilter: 'blur(6px)' }}
          aria-hidden="true"
        >
          {children}
        </div>
        {/* Overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-card/60 backdrop-blur-[2px] rounded-lg px-4">
          <p className="font-display text-lg font-semibold text-foreground mb-1" style={{ letterSpacing: '-0.01em' }}>
            Your negotiation letter is ready
          </p>
          <p className="text-sm text-muted-foreground mb-4 max-w-[320px] text-center">
            Enter your email to unlock it — we'll also save a copy for you.
          </p>
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 w-full max-w-[380px]">
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); if (error) setError(''); }}
              className={`flex-1 min-w-0 px-4 py-3 text-sm border rounded-lg bg-card text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 ${
                error ? 'border-destructive focus:border-destructive' : 'border-border focus:border-foreground'
              }`}
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-primary text-primary-foreground px-4 py-3 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm shadow-primary/20 whitespace-nowrap shrink-0 min-h-[48px] text-base sm:text-sm disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Unlocking…</>
              ) : (
                'Unlock my letter →'
              )}
            </button>
          </form>
          {error && (
            <p className="text-[13px] text-destructive mt-1.5">{error}</p>
          )}
          <p className="text-[11px] text-muted-foreground/60 mt-2">
            No spam. See our{' '}
            <Link to="/privacy" className="underline hover:text-foreground transition-colors">Privacy Policy</Link>.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LetterGate;
