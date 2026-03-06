import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { trackEvent } from '@/lib/analytics';
import { getUtmParams } from '@/lib/utm';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { Check, Copy, Mail, Loader2 } from 'lucide-react';
import type { LeadContext } from './EmailCapture';

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
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [copied, setCopied] = useState(false);
  const letterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prefilledEmail && !unlocked) {
      setUnlocked(true);
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
    setUnlocked(true);
    setLoading(false);
    setShowEmailInput(false);
    toast.success('Letter sent to your email!');
  };

  const handleCopy = () => {
    const text = letterRef.current?.innerText || '';
    navigator.clipboard.writeText(text);
    trackEvent('letter_copied', { source: 'letter_gate' });
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
    toast.success('Copied to clipboard');
  };

  return (
    <div>
      <h2 className="section-title mb-4">Your Negotiation Letter</h2>

      {/* Letter content — always visible */}
      <div
        ref={letterRef}
        style={!unlocked ? { userSelect: 'none', WebkitUserSelect: 'none' } as React.CSSProperties : undefined}
      >
        {children}
      </div>

      {/* Delivery section */}
      <div className="mt-6">
        {unlocked && (
          <div className="flex items-center gap-1.5 text-xs text-verdict-good mb-3">
            <Check className="w-3.5 h-3.5" />
            <span>Letter sent to your email</span>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          {/* Email button */}
          <button
            onClick={() => {
              if (unlocked) {
                // Resend flow — just show input again
                setShowEmailInput(true);
              } else {
                setShowEmailInput(!showEmailInput);
              }
            }}
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-3 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            <Mail size={16} />
            {unlocked ? 'Resend to email' : 'Email this letter to myself →'}
          </button>

          {/* Copy button */}
          <div className="flex flex-col items-start">
            <button
              onClick={unlocked ? handleCopy : undefined}
              disabled={!unlocked}
              className={`inline-flex items-center gap-2 border border-border px-5 py-3 rounded-lg text-sm transition-colors ${
                unlocked
                  ? 'text-foreground hover:border-foreground cursor-pointer'
                  : 'text-muted-foreground opacity-50 cursor-not-allowed'
              }`}
            >
              {copied ? <><Check size={16} /> Copied!</> : <><Copy size={16} /> Copy to clipboard</>}
            </button>
            {!unlocked && (
              <span className="text-[10px] text-muted-foreground/50 mt-1 ml-1">Enter your email to enable copy</span>
            )}
          </div>
        </div>

        {/* Inline email input — expands below buttons */}
        {showEmailInput && !unlocked && (
          <div className="mt-3 overflow-hidden">
            <form onSubmit={handleSubmit} className="flex gap-2 max-w-[440px]">
              <input
                type="email"
                placeholder="you@email.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (error) setError(''); }}
                autoFocus
                className={`flex-1 min-w-0 px-4 py-3 text-sm border rounded-lg bg-card text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 ${
                  error ? 'border-destructive focus:border-destructive' : 'border-border focus:border-foreground'
                }`}
              />
              <button
                type="submit"
                disabled={loading}
                className="bg-primary text-primary-foreground px-4 py-3 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity whitespace-nowrap shrink-0 disabled:opacity-60 flex items-center gap-2"
              >
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</> : 'Send →'}
              </button>
            </form>
            {error && <p className="text-[13px] text-destructive mt-1.5">{error}</p>}
            <p className="text-[11px] text-muted-foreground/60 mt-2">
              No spam. See our{' '}
              <Link to="/privacy" className="underline hover:text-foreground transition-colors">Privacy Policy</Link>.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LetterGate;
