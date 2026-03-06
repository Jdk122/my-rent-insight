import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { trackEvent } from '@/lib/analytics';
import { getUtmParams } from '@/lib/utm';
import { toast } from 'sonner';
import { Check, Copy } from 'lucide-react';
import type { LeadContext } from './EmailCapture';
import type { RentFormData } from './RentForm';
import type { RentLookupResult } from '@/data/rentData';
import type { FairnessScoreResult } from '@/lib/fairnessScore';

interface EarlyCaptureBarProps {
  hasIncrease: boolean;
  isAboveMarket: boolean;
  isFair: boolean;
  capturedEmail: string;
  leadContext: LeadContext;
  verdictLabel: string;
  setCapturedEmail: (email: string) => void;
  formData: RentFormData;
  newRent: number;
  increasePct: number;
  marketYoy: number;
  fairnessScore: FairnessScoreResult | null;
  medianCompRent: number | null;
  rentData: RentLookupResult;
}

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

const EarlyCaptureBar = ({
  hasIncrease, isAboveMarket, isFair, capturedEmail, leadContext,
  verdictLabel, setCapturedEmail, formData, newRent, increasePct,
  marketYoy, fairnessScore, medianCompRent, rentData,
}: EarlyCaptureBarProps) => {
  const [showInput, setShowInput] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Hide entirely if email already captured externally
  if (capturedEmail && !submitted) return null;

  const hasLetter = hasIncrease;
  const buttonLabel = hasLetter ? 'Email me my letter →' : 'Email me this report →';
  const copyLabel = hasLetter ? 'Copy letter' : 'Copy analysis';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailVal = inputRef.current?.value;
    if (!emailVal) return;
    const utm = getUtmParams();
    try {
      await supabase.rpc('upsert_lead', {
        p_email: emailVal,
        p_analysis_id: leadContext?.analysisId || null,
        p_capture_source: 'early_capture',
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
        p_verdict: verdictLabel || null,
        p_utm_source: utm.utm_source || null,
        p_utm_medium: utm.utm_medium || null,
        p_utm_campaign: utm.utm_campaign || null,
        p_fairness_score: leadContext?.fairnessScore ?? null,
        p_comp_median_rent: leadContext?.compMedianRent ?? null,
        p_hud_fmr_value: leadContext?.hudFmrValue ?? null,
      } as any);
    } catch (err) {
      console.error('Early capture failed:', err);
    }
    trackEvent('email_submitted', { source: 'early_capture', verdict: verdictLabel });
    setCapturedEmail(emailVal);
    setSubmitted(true);
    toast.success("Sent!");
  };

  const handleCopy = () => {
    // Try to find letter content on the page
    const letterEl = document.querySelector('[data-letter-content]');
    if (letterEl) {
      navigator.clipboard.writeText(letterEl.textContent || '');
    } else {
      // Fallback: copy a text summary of the analysis
      const summary = [
        `Rent Analysis — ${verdictLabel}`,
        `Current rent: $${fmt(formData.currentRent)}`,
        hasIncrease ? `Proposed rent: $${fmt(newRent)} (+${increasePct}%)` : null,
        `Market trend: ${marketYoy > 0 ? '+' : ''}${marketYoy}%`,
        fairnessScore ? `Fairness score: ${fairnessScore.total}/100` : null,
        medianCompRent ? `Comp median: $${fmt(medianCompRent)}` : null,
        `Location: ${rentData.city}, ${rentData.state} ${rentData.zip}`,
        `Analysis by RenewalReply — renewalreply.com`,
      ].filter(Boolean).join('\n');
      navigator.clipboard.writeText(summary);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
    toast.success('Copied to clipboard');
    trackEvent('letter_copied', { source: 'early_capture' });
  };

  // Submitted state
  if (submitted) {
    return (
      <div className="w-full bg-card border-y border-border">
        <div className="max-w-[620px] mx-auto px-5 sm:px-6 py-4 flex items-center justify-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-sm text-verdict-good">
            <Check className="w-4 h-4" /> Sent!
          </span>
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 border border-border px-4 py-2 rounded-lg text-sm font-medium hover:bg-muted transition-colors"
          >
            {copied ? <><Check className="w-3.5 h-3.5" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> {copyLabel}</>}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-card border-y border-border">
      <div className="max-w-[620px] mx-auto px-5 sm:px-6 py-4">
        {!showInput ? (
          // Initial state: text + button only
          <div className="flex flex-col items-center gap-2.5">
            <p className="text-[13px] text-muted-foreground text-center">
              {isAboveMarket ? 'Get your negotiation letter emailed to you'
                : isFair ? 'Get your negotiation letter emailed to you'
                : hasIncrease ? 'Get your renewal strategy letter emailed to you'
                : 'Get this market report emailed to you'}
            </p>
            <button
              onClick={() => {
                setShowInput(true);
                setTimeout(() => inputRef.current?.focus(), 100);
              }}
              className="bg-primary text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity whitespace-nowrap"
            >
              {buttonLabel}
            </button>
          </div>
        ) : (
          // Expanded state: email input + submit
          <div className="flex flex-col items-center gap-2.5">
            <p className="text-[13px] text-muted-foreground text-center">
              {isAboveMarket ? 'Get your negotiation letter emailed to you'
                : isFair ? 'Get your negotiation letter emailed to you'
                : hasIncrease ? 'Get your renewal strategy letter emailed to you'
                : 'Get this market report emailed to you'}
            </p>
            <form onSubmit={handleSubmit} className="flex gap-2 max-w-[440px] w-full">
              <input
                ref={inputRef}
                name="early_email"
                type="email"
                required
                placeholder="you@email.com"
                className="flex-1 min-w-0 px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground outline-none focus:border-foreground transition-colors placeholder:text-muted-foreground/50"
              />
              <button
                type="submit"
                className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
              >
                Send →
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default EarlyCaptureBar;
