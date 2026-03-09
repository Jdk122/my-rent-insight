import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { trackEvent, trackAdsConversion } from '@/lib/analytics';
import { getUtmParams } from '@/lib/utm';
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
}

const LetterGate = ({ children, leadContext, onEmailCaptured, prefilledEmail }: LetterGateProps) => {
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
          trackEvent('letter_blur_shown', { verdict: 'above', zip_code: leadContext?.zip || '' });
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

    const utm = getUtmParams();
    const verdict = 'above';

    try {
      const { error: dbError } = await supabase.rpc('upsert_lead', {
        p_email: email.trim(),
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
      } as any);

      if (dbError) throw dbError;

      if (leadContext?.analysisId) {
        await supabase.from('leads' as any).update({
          letter_generated_at: new Date().toISOString(),
        } as any).eq('analysis_id', leadContext.analysisId);
      }

      await supabase.from('lead_events' as any).insert({
        email: email.trim(),
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
      } as any);
    } catch {
      setLoading(false);
      setError('Something went wrong. Please try again.');
      return;
    }

    onEmailCaptured?.(email.trim());
    trackEvent('email_submitted', { verdict, zip_code: leadContext?.zip || '', source: 'letter_gate' });
    trackAdsConversion();
    setUnlocked(true);
    setLoading(false);
    toast.success('Letter unlocked!');
  };

  const handleCopy = () => {
    const text = letterRef.current?.innerText || '';
    navigator.clipboard.writeText(text);
    trackEvent('letter_copied', { source: 'letter_gate' });
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
    toast.success('Copied to clipboard');
  };

  const fmtRent = leadContext?.proposedRent
    ? `$${leadContext.proposedRent.toLocaleString('en-US', { maximumFractionDigits: 0 })}/mo`
    : '';

  return (
    <div>
      <h2 className="section-title mb-4">Your Negotiation Letter</h2>

      {/* Letter container */}
      <div className="relative" ref={blurRef}>
        <div
          ref={letterRef}
          data-letter-content
          style={!unlocked ? { userSelect: 'none', WebkitUserSelect: 'none' } as React.CSSProperties : undefined}
        >
          {children}
        </div>

        {/* Blur overlay when locked */}
        {!unlocked && (
          <>
            {/* Gradient fade + blur that covers everything after ~4 lines */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'linear-gradient(to bottom, transparent 6rem, hsl(var(--card) / 0.4) 8rem, hsl(var(--card) / 0.85) 12rem, hsl(var(--card)) 16rem)',
              }}
            />
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backdropFilter: 'blur(0px)',
                WebkitBackdropFilter: 'blur(0px)',
                maskImage: 'linear-gradient(to bottom, transparent 5rem, black 10rem)',
                WebkitMaskImage: 'linear-gradient(to bottom, transparent 5rem, black 10rem)',
              }}
            />

            {/* Capture card overlay */}
            <div className="absolute inset-x-0 bottom-0 top-[8rem] flex items-start justify-center pt-8 sm:pt-12">
              <div className="bg-card border border-border rounded-xl shadow-lg px-5 sm:px-8 py-6 sm:py-8 max-w-[440px] w-full mx-4 text-center pointer-events-auto">
                <h3 className="font-display text-lg font-semibold text-foreground mb-2">
                  Your personalized negotiation letter is ready
                </h3>
                <p className="text-sm text-muted-foreground mb-5">
                  Tailored to your {fmtRent} rent{leadContext?.address ? ` at ${leadContext.address.split(',')[0]}` : ''} — includes market data and a specific counter-offer amount.
                </p>

                <form onSubmit={handleSubmit} className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="email"
                      placeholder="you@email.com"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); if (error) setError(''); }}
                      className={`flex-1 min-w-0 px-4 py-3 text-sm border rounded-lg bg-card text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 ${
                        error ? 'border-destructive focus:border-destructive' : 'border-border focus:border-foreground'
                      }`}
                    />
                    <button
                      type="submit"
                      disabled={loading}
                      className="bg-primary text-primary-foreground px-4 py-3 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity whitespace-nowrap shrink-0 disabled:opacity-60 flex items-center gap-2"
                    >
                      {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</> : 'Send me my letter →'}
                    </button>
                  </div>
                  {error && <p className="text-[13px] text-destructive">{error}</p>}
                </form>

                <div className="mt-3 space-y-1">
                  <SocialProofLine />
                  <p className="text-[11px] text-muted-foreground/60">
                    No spam. See our{' '}
                    <Link to="/privacy" className="underline hover:text-foreground transition-colors">Privacy Policy</Link>.
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
            verdictLabel="above"
            zip={leadContext?.zip || ''}
          />
        </div>
      )}
    </div>
  );
};

export default LetterGate;
