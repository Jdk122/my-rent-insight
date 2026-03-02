import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { trackEvent } from '@/lib/analytics';
import { Link } from 'react-router-dom';
import { BedroomType, bedroomLabels } from '@/data/rentData';
import { Check, Copy, Download } from 'lucide-react';

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
  leadContext?: any;
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
  const [copied, setCopied] = useState(false);

  const brLabel = bedroomLabels[bedrooms];
  const increaseRatio = marketYoy > 0 ? Math.round((increasePct / marketYoy) * 10) / 10 : 0;

  const letterHtml = useMemo(() => {
    if (tone === 'friendly') {
      const severityLabel = increaseRatio >= 4 ? 'several times that' : increaseRatio >= 2.5 ? 'more than double that' : increaseRatio >= 1.8 ? 'nearly double that' : increaseRatio >= 1.4 ? 'well above that' : 'noticeably higher';
      const counterRange = counterLow === counterHigh
        ? `around ${counterLowPercent}%, which would put the rent around $${fmt(counterLow)}`
        : `closer to ${counterLowPercent}–${counterHighPercent}%, which would put the rent around $${fmt(counterLow)}–$${fmt(counterHigh)}`;
      return [
        `Hi [Landlord name],`,
        `Thanks for letting me know about the lease renewal. I'd like to stay and I appreciate the notice.`,
        `Before I sign, I looked into what rents have done in ${city} this year. The market-wide increase for a ${brLabel.toLowerCase()} was about ${marketYoy}%, and my proposed increase of ${increasePct}% is ${severityLabel}.`,
        `For context:\n• Area-wide rent increase this year: ${marketYoy}%\n• My proposed increase: ${increasePct}%`,
        `I'd love to find a number that works for both of us — something ${counterRange}. Happy to discuss.`,
        `Best,\n[Your name]`,
      ].filter(Boolean);
    }

    const firmSeverity = increaseRatio >= 4 ? 'several times' : increaseRatio >= 2.5 ? 'more than double' : increaseRatio >= 1.8 ? 'nearly double' : increaseRatio >= 1.4 ? 'well above' : 'noticeably above';
    return [
      `Dear [Landlord name],`,
      `I am writing regarding the proposed lease renewal at $${fmt(newRent)}/month — a ${increasePct}% increase from my current rent of $${fmt(currentRent)}/month.`,
      `I have reviewed current market data for ${city}, ${state} (${zip}):`,
      `• Rents in ${city} rose ${marketYoy}% this year\n• Proposed increase: ${increasePct}%`,
      `The proposed increase of ${increasePct}% is ${firmSeverity} the rate at which rents are rising in ${city}.`,
      `I am prepared to renew at ${counterLowPercent}% ($${fmt(counterLow)}/month), in line with ${city}'s market trend.`,
      `Sincerely,\n[Your name]`,
    ].filter(Boolean);
  }, [tone, currentRent, newRent, increasePct, marketYoy, fmr, censusMedian, zip, city, state, brLabel, counterLow, counterHigh, counterLowPercent, counterHighPercent, increaseRatio]);

  const letterText = letterHtml.join('\n\n');

  const handleCopy = () => {
    navigator.clipboard.writeText(letterText);
    trackEvent('letter_copied');
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
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
    trackEvent('letter_downloaded');
  };

  return (
    <div>
      <h2 className="section-title">Your Negotiation Letter</h2>

      <div className="tone-toggle mt-4">
        <button onClick={() => { setTone('friendly'); trackEvent('letter_tone_toggled', { tone: 'friendly' }); }} className={`tone-option ${tone === 'friendly' ? 'active' : ''}`}>Friendly</button>
        <button onClick={() => { setTone('firm'); trackEvent('letter_tone_toggled', { tone: 'firm' }); }} className={`tone-option ${tone === 'firm' ? 'active' : ''}`}>Firm</button>
      </div>
      <div
        className="rounded-lg border border-border border-l-[3px] border-l-muted p-6 md:p-8 mt-4"
        style={{
          background: 'hsl(var(--letter-bg))',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        }}
      >
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

      {/* Action buttons — no gate */}
      <div className="flex gap-3 mt-5">
        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-7 py-3 rounded-lg text-sm font-semibold hover:brightness-90 transition-all duration-150 shadow-sm shadow-primary/20"
        >
          {copied ? <><Check size={16} /> Copied!</> : <><Copy size={16} /> Copy letter</>}
        </button>
        <button
          onClick={handleDownload}
          className="inline-flex items-center gap-2 border border-border px-7 py-3 rounded-lg text-sm font-medium text-foreground hover:border-foreground transition-colors"
        >
          <Download size={16} /> Download
        </button>
      </div>

      {/* Legal disclaimer — below actions */}
      <p className="text-[11px] text-muted-foreground/70 mt-4 leading-relaxed max-w-[540px]">
        This is a template based on public housing data — not legal advice. Review and customize before sending. Rent regulations vary by location and lease terms.{' '}
        <Link to="/privacy" className="underline hover:text-foreground transition-colors">Privacy Policy</Link>
      </p>
    </div>
  );
};

export default NegotiationLetter;
