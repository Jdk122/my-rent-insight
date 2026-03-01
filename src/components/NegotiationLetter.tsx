import { useState, useMemo } from 'react';
import { toast } from 'sonner';

import { Link } from 'react-router-dom';
import { BedroomType, bedroomLabels } from '@/data/rentData';
import { supabase } from '@/integrations/supabase/client';
import { LeadContext } from './EmailCapture';

interface NegotiationLetterProps {
  currentRent: number;
  newRent: number;
  increasePct: number;
  marketYoy: number;
  fmr: number;
  censusMedian: number | null;
  medianIncome: number | null;
  zip: string;
  city: string;
  state: string;
  bedrooms: BedroomType;
  increaseAmount?: number;
  counterLow: number;
  counterHigh: number;
  counterLowPercent: number;
  counterHighPercent: number;
  analysisId?: string | null;
  prefilledEmail?: string;
  onEmailCaptured?: (email: string) => void;
  leadContext?: LeadContext;
}

type Tone = 'friendly' | 'firm';

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

const NegotiationLetter = ({
  currentRent, newRent, increasePct, marketYoy, fmr, censusMedian, medianIncome,
  zip, city, state, bedrooms, increaseAmount,
  counterLow, counterHigh, counterLowPercent, counterHighPercent,
  analysisId, prefilledEmail, onEmailCaptured, leadContext,
}: NegotiationLetterProps) => {
  const [tone, setTone] = useState<Tone>('friendly');
  const [unlocked, setUnlocked] = useState(!!prefilledEmail);
  const [gateEmail, setGateEmail] = useState(prefilledEmail || '');

  const brLabel = bedroomLabels[bedrooms];
  const increaseRatio = marketYoy > 0 ? Math.round((increasePct / marketYoy) * 10) / 10 : 0;

  const letterHtml = useMemo(() => {
    if (tone === 'friendly') {
      return [
        `Hi [Landlord name],`,
        `Thanks for letting me know about the lease renewal. I'd like to stay and I appreciate the notice.`,
        `Before I sign, I looked into what rents have done in ${city} this year. The market-wide increase for a ${brLabel.toLowerCase()} was about ${marketYoy}%, and my proposed increase of ${increasePct}% is ${increaseRatio >= 1.8 ? 'nearly double that' : increaseRatio >= 1.4 ? 'well above that' : 'noticeably higher'}.`,
        `For context:\n• ${city} median rent (${brLabel}): $${fmt(censusMedian || fmr)}\n• Area-wide increase this year: ${marketYoy}%\n• My proposed increase: ${increasePct}%`,
        `I'd love to find a number that works for both of us — something closer to ${counterLowPercent}–${counterHighPercent}%, which would put the rent around $${fmt(counterLow)}–$${fmt(counterHigh)}. Happy to discuss.`,
        `Best,\n[Your name]`,
      ].filter(Boolean);
    }

    return [
      `Dear [Landlord name],`,
      `I am writing regarding the proposed lease renewal at $${fmt(newRent)}/month — a ${increasePct}% increase from my current rent of $${fmt(currentRent)}/month.`,
      `I have reviewed current market data for ${city}, ${state} (${zip}):`,
      `• Typical ${brLabel.toLowerCase()} rent in ${city}: $${fmt(fmr)}\n${censusMedian ? `• ${city} median rent: $${fmt(censusMedian)}\n` : ''}• Rents in ${city} rose ${marketYoy}% this year\n• Proposed increase: ${increasePct}%`,
      `The proposed increase of ${increasePct}% is ${increaseRatio >= 1.8 ? 'nearly double' : increaseRatio >= 1.4 ? 'well above' : 'noticeably above'} the rate at which rents are rising in ${city}.`,
      `I am prepared to renew at ${counterLowPercent}% ($${fmt(counterLow)}/month), in line with ${city}'s market trend.`,
      `Sincerely,\n[Your name]`,
    ].filter(Boolean);
  }, [tone, currentRent, newRent, increasePct, marketYoy, fmr, censusMedian, zip, city, state, brLabel, counterLow, counterHigh, counterLowPercent, counterHighPercent, increaseRatio]);

  const letterText = letterHtml.join('\n\n');

  const handleCopy = () => {
    navigator.clipboard.writeText(letterText);
    toast.success('Letter copied to clipboard');
  };

  const handleDownload = () => {
    const blob = new Blob([letterText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rent-negotiation-${zip}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Downloaded');
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gateEmail) return;

    // Store lead
    try {
      await supabase.from('leads').upsert({
        email: gateEmail,
        analysis_id: leadContext?.analysisId || null,
        capture_source: 'letter_gate',
        address: leadContext?.address || null,
        city: leadContext?.city || null,
        state: leadContext?.state || null,
        zip: leadContext?.zip || null,
        bedrooms: leadContext?.bedrooms ?? null,
        current_rent: leadContext?.currentRent ?? null,
        proposed_rent: leadContext?.proposedRent ?? null,
        increase_pct: leadContext?.increasePct ?? null,
        market_trend_pct: leadContext?.marketTrendPct ?? null,
        fair_counter_offer: leadContext?.fairCounterOffer || null,
        comps_position: leadContext?.compsPosition || null,
        letter_generated: true,
      } as any, { onConflict: 'email' });
    } catch {
      // Don't block UX
    }

    // Update analysis record
    if (analysisId) {
      try {
        await supabase.from('analyses').update({ letter_generated: true } as any).eq('id', analysisId);
      } catch {}
    }

    onEmailCaptured?.(gateEmail);
    setUnlocked(true);
    toast.success('Letter unlocked!');
  };

  return (
    <div>
      <h2 className="section-title">Your negotiation letter</h2>
      <div className="tone-toggle">
        <button onClick={() => setTone('friendly')} className={`tone-option ${tone === 'friendly' ? 'active' : ''}`}>Friendly</button>
        <button onClick={() => setTone('firm')} className={`tone-option ${tone === 'firm' ? 'active' : ''}`}>Firm</button>
      </div>
      <div className="bg-card border border-border rounded-lg border-l-[3px] border-l-muted p-6 md:p-8 mt-4">
        <div className="text-xs text-muted-foreground mb-4 pb-4 border-b border-border flex gap-4">
          <span>To: Your landlord</span>
          <span>Re: Lease renewal</span>
        </div>
        <div className="space-y-4">
          {letterHtml.map((para, i) => (
            <p key={i} className="text-sm text-foreground/80 leading-[1.7] whitespace-pre-line">{para}</p>
          ))}
        </div>
      </div>

      {/* Soft gate: email to copy/download/email */}
      {!unlocked ? (
        <div className="mt-5">
          <form onSubmit={handleUnlock} className="flex gap-2 max-w-[440px]">
            <input
              type="email"
              placeholder="Enter your email to copy, download, or email this letter"
              value={gateEmail}
              onChange={(e) => setGateEmail(e.target.value)}
              required
              className="flex-1 px-4 py-3 text-sm border border-border rounded-lg bg-card text-foreground outline-none focus:border-foreground transition-colors placeholder:text-muted-foreground/50"
            />
            <button type="submit" className="bg-primary text-primary-foreground px-5 py-3 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm shadow-primary/20 whitespace-nowrap">
              Continue
            </button>
          </form>
          <p className="text-[12px] text-muted-foreground/70 mt-2 max-w-[440px]">
            We'll only email you about your lease. See our{' '}
            <Link to="/privacy" className="underline hover:text-foreground transition-colors">Privacy Policy</Link>.
          </p>
        </div>
      ) : (
        <div className="flex gap-3 mt-5">
          <button onClick={handleCopy} className="bg-primary text-primary-foreground px-7 py-3 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm shadow-primary/20">Copy letter</button>
          <button onClick={handleDownload} className="border border-border px-7 py-3 rounded-lg text-sm font-medium text-foreground hover:border-foreground transition-colors">Download</button>
          <button onClick={() => toast.info('Email delivery coming soon!')} className="border border-border px-7 py-3 rounded-lg text-sm font-medium text-foreground hover:border-foreground transition-colors">Email me this letter</button>
        </div>
      )}
    </div>
  );
};

export default NegotiationLetter;
