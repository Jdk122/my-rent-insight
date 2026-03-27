import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { trackEvent, trackAdsConversion } from '@/lib/analytics';
import { getUtmParams } from '@/lib/utm';
import { sendConfirmationEmail } from '@/lib/sendConfirmationEmail';
import { generateSharedReport, SharedReportPayload } from '@/lib/generateSharedReport';
import { notifySubmission } from '@/lib/notifySubmission';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { Check, Copy, Loader2 } from 'lucide-react';
import type { LeadContext } from './EmailCapture';
import SocialProofLine from './SocialProofLine';
import PostConversionFlow from './PostConversionFlow';

interface LetterGateProps {
  children: React.ReactNode;
  leadContext?: LeadContext;
  onEmailCaptured?: (email: string) => void;
  prefilledEmail?: string;
  verdictLabel?: string;
  shareReportPayload?: SharedReportPayload;
  onReportGenerated?: (url: string) => void;
}

const LetterGate = ({ children, leadContext, onEmailCaptured, prefilledEmail, verdictLabel, shareReportPayload, onReportGenerated }: LetterGateProps) => {
  const [unlocked, setUnlocked] = useState(() => !!prefilledEmail);
  const [email, setEmail] = useState(prefilledEmail || '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const letterRef = useRef<HTMLDivElement>(null);
  const blurRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prefilledEmail && !unlocked) {
      setUnlocked(true);
    }
  }, [prefilledEmail]);

  // Track when the blurred letter enters viewport
  useEffect(() => {
    if (unlocked) return;
    const el = blurRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          trackEvent('prompt_shown', { prompt: 'letter_gate', tool: 'renewal', verdict: verdictLabel || 'above', zip: leadContext?.zip || '' });
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [unlocked, leadContext?.zip]);

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

    const normalizedEmail = email.trim().toLowerCase();
    const utm = getUtmParams();
    const verdict = verdictLabel || 'above';

    try {
      const leadParams = {
        p_email: normalizedEmail,
        p_analysis_id: leadContext?.analysisId || null,
        p_capture_source: 'letter_gate',
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
        p_letter_generated: true,
        p_verdict: verdict,
        p_utm_source: utm.utm_source || null,
        p_utm_medium: utm.utm_medium || null,
        p_utm_campaign: utm.utm_campaign || null,
        p_fairness_score: leadContext?.fairnessScore ?? null,
        p_comp_median_rent: leadContext?.compMedianRent ?? null,
        p_hud_fmr_value: leadContext?.hudFmrValue ?? null,
      } as any;

      let { error: rpcError } = await supabase.rpc('upsert_lead', leadParams);
      if (rpcError && leadContext?.analysisId) {
        console.warn('[lead] upsert_lead FK retry (letter_gate):', rpcError.message);
        ({ error: rpcError } = await supabase.rpc('upsert_lead', { ...leadParams, p_analysis_id: null }));
      }
      if (rpcError) {
        console.error('[lead] upsert_lead failed (letter_gate):', rpcError.message);
        throw rpcError;
      }

      const evtPayload = {
        email: normalizedEmail,
        analysis_id: leadContext?.analysisId || null,
        event_type: 'letter_gate',
        fairness_score: leadContext?.fairnessScore ?? null,
        address: leadContext?.address || null,
        zip: leadContext?.zip || null,
        current_rent: leadContext?.currentRent ?? null,
        proposed_rent: leadContext?.proposedRent ?? null,
        increase_pct: leadContext?.increasePct ?? null,
        verdict,
        comp_median_rent: leadContext?.compMedianRent ?? null,
        hud_fmr_value: leadContext?.hudFmrValue ?? null,
      } as any;
      let { error: evtError } = await supabase.from('lead_events' as any).insert(evtPayload);
      if (evtError && leadContext?.analysisId) {
        ({ error: evtError } = await supabase.from('lead_events' as any).insert({ ...evtPayload, analysis_id: null }));
      }
      if (evtError) console.error('[lead] lead_events insert failed (letter_gate):', evtError.message);
    } catch (err) {
      console.error('[lead] letter_gate error:', err);
      setLoading(false);
      setError('Something went wrong. Please try again.');
      return;
    }

    onEmailCaptured?.(normalizedEmail);
    trackEvent('email_captured', { gate: 'letter_gate', tool: 'renewal', verdict, zip: leadContext?.zip || '' });
    trackAdsConversion('renewal', normalizedEmail);
    setUnlocked(true);
    setLoading(false);
    toast.success('Letter unlocked!');

    // Generate report + send email + re-notify in parallel (non-blocking)
    (async () => {
      let reportUrl: string | null = null;
      if (shareReportPayload) {
        reportUrl = await generateSharedReport(shareReportPayload, leadContext?.analysisId, normalizedEmail);
        if (reportUrl) onReportGenerated?.(reportUrl);
      }
      sendConfirmationEmail({
        email: normalizedEmail,
        city: leadContext?.city,
        state: leadContext?.state,
        zip: leadContext?.zip,
        bedrooms: leadContext?.bedrooms,
        toolType: 'renewal',
        fairnessScore: leadContext?.fairnessScore,
        verdictLabel: verdict,
        reportUrl,
      });
      // Re-notify with captured email
      await notifySubmission({
        email: normalizedEmail,
        zip: leadContext?.zip || null,
        city: leadContext?.city || null,
        state: leadContext?.state || null,
        bedrooms: leadContext?.bedrooms ?? null,
        current_rent: leadContext?.currentRent ?? null,
        proposed_rent: leadContext?.proposedRent ?? null,
        increase_pct: leadContext?.increasePct ?? null,
        fairness_score: leadContext?.fairnessScore ?? null,
        verdict_label: verdict || null,
        address: leadContext?.address || null,
        comp_median_rent: leadContext?.compMedianRent ?? null,
        hud_fmr_value: leadContext?.hudFmrValue ?? null,
        analysis_id: leadContext?.analysisId || null,
      }, 'letter_gate_email_capture');
    })();
  };

  const handleCopy = () => {
    const text = letterRef.current?.innerText || '';
    navigator.clipboard.writeText(text);
    trackEvent('letter_used', { action: 'copied' });
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
    toast.success('Copied to clipboard');
  };

  const fmtRent = leadContext?.proposedRent
    ? `$${leadContext.proposedRent.toLocaleString('en-US', { maximumFractionDigits: 0 })}/mo`
    : '';

  const isAbove = !verdictLabel || verdictLabel.toLowerCase() === 'above' || ['Unfair', 'Excessive', 'Moderate'].includes(verdictLabel);
  const isBelow = verdictLabel?.toLowerCase() === 'below';
  // fair = everything else

  const gateHeading = isAbove
    ? 'Your personalized negotiation letter is ready'
    : isBelow
    ? 'Lock in your good deal.'
    : 'Even a fair increase is worth negotiating.';

  const gateSubline = isAbove
    ? `Tailored to your ${fmtRent} rent${leadContext?.address ? ` at ${leadContext.address.split(',')[0]}` : ''} — includes market data and a specific counter-offer amount.`
    : isBelow
    ? 'Your letter positions you to secure a longer lease term or improvements while your landlord is offering below-market terms.'
    : 'Your letter requests extras your landlord can offer instead of a lower rate — longer lease, unit upgrades, or overdue maintenance. Landlords expect this.';

  return (
    <div>
      <h2 className="section-title mb-4">Your Negotiation Letter</h2>

      {/* Letter container */}
      <div className="relative" ref={blurRef} style={!unlocked ? { minHeight: '500px' } : undefined}>
        {/* Full letter renders behind the blur — all content visible as blurred outlines */}
        <div
          ref={letterRef}
          data-letter-content
          style={!unlocked ? {
            userSelect: 'none',
            WebkitUserSelect: 'none',
            filter: 'blur(4px)',
            pointerEvents: 'none',
          } as React.CSSProperties : undefined}
        >
          {children}
        </div>

        {/* Blur overlay when locked */}
        {!unlocked && (
          <>
            {/* Gradient: clear first ~4 lines, then gentle fade to semi-transparent */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'linear-gradient(to bottom, hsl(var(--card) / 0) 0%, hsl(var(--card) / 0.15) 5rem, hsl(var(--card) / 0.45) 10rem, hsl(var(--card) / 0.55) 100%)',
              }}
            />

            {/* Capture card overlay — centered over the blurred letter */}
            <div className="absolute inset-x-0 top-[4rem] bottom-0 flex items-start justify-center pt-6 sm:pt-10">
              <div className="bg-card border border-border rounded-xl shadow-lg px-5 sm:px-8 py-6 sm:py-8 max-w-[440px] w-full mx-4 text-center pointer-events-auto">
                <h3 className="font-display text-lg font-semibold text-foreground mb-2">
                  {gateHeading}
                </h3>
                <p className="text-sm text-muted-foreground mb-5">
                  {gateSubline}
                </p>

                <form onSubmit={handleSubmit} className="space-y-2">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="email"
                      placeholder="you@email.com"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); if (error) setError(''); }}
                      autoComplete="email"
                      className={`flex-1 min-w-0 px-4 py-3 text-sm border rounded-lg bg-card text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 ${
                        error ? 'border-destructive focus:border-destructive' : 'border-border focus:border-foreground'
                      }`}
                    />
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full sm:w-auto bg-primary text-primary-foreground px-4 py-3 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity whitespace-nowrap shrink-0 disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</> : 'Unlock my letter →'}
                    </button>
                  </div>
                  {error && <p className="text-[13px] text-destructive">{error}</p>}
                </form>

                <div className="mt-3 space-y-1">
                  <SocialProofLine />
                  <p className="text-[10px] text-muted-foreground/60 text-center mt-1.5">
                    By entering your email, you agree to our{' '}
                    <Link to="/privacy" className="underline hover:text-foreground transition-colors">Privacy Policy</Link>{' '}
                    and{' '}
                    <Link to="/terms" className="underline hover:text-foreground transition-colors">Terms of Service</Link>.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Post-unlock controls */}
      {unlocked && (
        <div className="mt-6">
          <div className="flex items-center gap-1.5 text-xs text-verdict-good mb-3">
            <Check className="w-3.5 h-3.5" />
            <span>Letter unlocked</span>
          </div>
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-2 border border-border px-5 py-3 rounded-lg text-sm text-foreground hover:border-foreground cursor-pointer transition-colors"
          >
            {copied ? <><Check size={16} /> Copied!</> : <><Copy size={16} /> Copy to clipboard</>}
          </button>

          {/* Post-conversion flow */}
          <PostConversionFlow
            email={email || prefilledEmail || ''}
            leadContext={leadContext}
            verdictLabel={verdictLabel || 'above'}
            zip={leadContext?.zip || ''}
          />
        </div>
      )}
    </div>
  );
};

export default LetterGate;
