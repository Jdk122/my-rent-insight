import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { trackEvent } from '@/lib/analytics';
import { Link } from 'react-router-dom';
import { BedroomType, bedroomLabels } from '@/data/rentData';
import { Check, Copy, Download } from 'lucide-react';
import ShareReportButton from '@/components/ShareReportButton';

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
  reportUrl?: string | null;
  onGenerateReport?: () => void;
  compMedian?: number | null;
  compCount?: number;
  compRadius?: string;
  trendSource?: string;
  trendArea?: string;
  rcMedianRent?: number | null;
  rcTotalListings?: number | null;
  rcAvgDaysOnMarket?: number | null;
  alVacancy?: number | null;
  f50Value?: number | null;
  shareReportPayload?: {
    zip: string;
    address: string | null;
    bedrooms: number;
    currentRent: number;
    proposedIncrease: number;
    increaseType: 'dollar' | 'percent';
    reportData: Record<string, any>;
  };
  onReportLinkGenerated?: (url: string) => void;
}

type Tone = 'friendly' | 'firm';

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

const NegotiationLetter = ({
  currentRent, newRent, increasePct, marketYoy, fmr, censusMedian, medianIncome,
  zip, city, state, bedrooms, increaseAmount,
  counterLow, counterHigh, counterLowPercent, counterHighPercent,
  analysisId, prefilledEmail, onEmailCaptured, leadContext, reportUrl, onGenerateReport,
  compMedian, compCount, compRadius, trendSource, trendArea,
  rcMedianRent, rcTotalListings, rcAvgDaysOnMarket, alVacancy, f50Value,
  shareReportPayload, onReportLinkGenerated,
}: NegotiationLetterProps) => {
  const [tone, setTone] = useState<Tone>('friendly');
  const [copied, setCopied] = useState(false);

  const brLabel = bedroomLabels[bedrooms];
  const increaseAmt = increaseAmount ?? Math.round(newRent - currentRent);

  const letterHtml = useMemo(() => {
    const paragraphs: string[] = [];
    const isFriendly = tone === 'friendly';

    // ── OPENING ──
    if (isFriendly) {
      paragraphs.push(`Hi [Landlord name],`);
      paragraphs.push(
        `Thank you for the lease renewal notice. I've enjoyed living here and would like to continue. ` +
        `I'd like to discuss the proposed increase of $${fmt(increaseAmt)}/month (${increasePct}%), ` +
        `which would bring my rent from $${fmt(currentRent)} to $${fmt(newRent)}/month. ` +
        `I've done some research on current market conditions and wanted to share what I found.`
      );
    } else {
      paragraphs.push(`Dear [Landlord name],`);
      paragraphs.push(
        `I am writing regarding the proposed lease renewal at $${fmt(newRent)}/month — ` +
        `a $${fmt(increaseAmt)}/month increase (${increasePct}%) from my current rent of $${fmt(currentRent)}/month. ` +
        `I have reviewed current market data for this area and believe an adjustment is warranted.`
      );
    }

    // ── MARKET EVIDENCE ──

    // Paragraph 1: Comparable rents
    if (compMedian && compCount && compCount > 0) {
      const position = newRent > compMedian
        ? `$${fmt(newRent - compMedian)} above`
        : newRent < compMedian
        ? `$${fmt(compMedian - newRent)} below`
        : 'in line with';
      paragraphs.push(
        `I reviewed ${compCount} comparable ${brLabel.toLowerCase()} rental${compCount !== 1 ? 's' : ''} currently listed near this address. ` +
        `The median asking rent for similar units is $${fmt(compMedian)}/month, ` +
        `which puts my proposed rent of $${fmt(newRent)} ${position} the local median.`
      );
    }

    // Paragraph 2: Market trends
    const trendAreaName = trendArea || city;
    const trendDirection = marketYoy > 0.5 ? 'increased' : marketYoy < -0.5 ? 'decreased' : 'remained essentially flat';
    const trendComparison = increasePct > marketYoy + 1
      ? `well above this market trend`
      : increasePct >= marketYoy - 1
      ? `roughly in line with this trend`
      : `below the area trend`;
    paragraphs.push(
      `According to recent rental market data, rents in ${trendAreaName} have ${trendDirection} by ${Math.abs(marketYoy)}% over the past year. ` +
      `My proposed increase of ${increasePct}% is ${trendComparison}.`
    );

    // Paragraph 3: Government benchmarks
    const benchmarkRent = rcMedianRent ?? f50Value ?? null;
    if (benchmarkRent && benchmarkRent > 0) {
      const pctDiff = Math.round(((newRent - benchmarkRent) / benchmarkRent) * 100);
      const aboveBelow = pctDiff > 0 ? `${pctDiff}% above` : pctDiff < 0 ? `${Math.abs(pctDiff)}% below` : 'at';
      const sourceLabel = rcMedianRent ? 'Current market data estimates' : 'Federal housing data estimates';
      paragraphs.push(
        `${sourceLabel} the median rent for a ${brLabel.toLowerCase()} in this area at $${fmt(benchmarkRent)}/month. ` +
        `My proposed rent of $${fmt(newRent)} is ${aboveBelow} this benchmark.`
      );
    }

    // Paragraph 4: Market conditions
    if (rcTotalListings && rcAvgDaysOnMarket) {
      const conditionLabel = rcAvgDaysOnMarket > 35 ? 'favorable' : rcAvgDaysOnMarket < 20 ? 'competitive' : 'moderate';
      let conditionSentence = `Current rental market conditions suggest ${conditionLabel} conditions for negotiation: ` +
        `${rcTotalListings} rental units are currently active in this area, ` +
        `with an average of ${Math.round(rcAvgDaysOnMarket)} days on market.`;
      if (alVacancy !== null && alVacancy !== undefined && alVacancy > 6) {
        conditionSentence += ` The local vacancy rate of ${alVacancy.toFixed(1)}% indicates elevated availability.`;
      }
      paragraphs.push(conditionSentence);
    }

    // Transparency line
    paragraphs.push(
      `I want to be transparent that this analysis draws on multiple public data sources including government rent benchmarks and current local listings. I'm happy to share the detailed breakdown if that would be helpful.`
    );

    // ── PROPOSAL ──
    const counterRange = counterLow === counterHigh
      ? `$${fmt(counterLow)}/month`
      : `$${fmt(counterLow)}–$${fmt(counterHigh)}/month`;
    const counterPctRange = counterLow === counterHigh
      ? `${counterLowPercent}%`
      : `${counterLowPercent}–${counterHighPercent}%`;

    if (isFriendly) {
      paragraphs.push(
        `Based on this research, I believe a renewal rate of ${counterRange} would better reflect current market conditions. ` +
        `This represents an increase of ${counterPctRange} over my current rent, ` +
        `which aligns with the ${Math.abs(marketYoy)}% trend in this market.`
      );
    } else {
      paragraphs.push(
        `Based on this analysis, I am requesting a renewal rate of ${counterRange}, ` +
        `representing an increase of ${counterPctRange} — consistent with the ${Math.abs(marketYoy)}% market trend in ${city}.`
      );
    }

    // Extra note if renter already above median
    if (compMedian && currentRent > compMedian) {
      paragraphs.push(
        `I'd also note that my current rent of $${fmt(currentRent)} already exceeds the area median of $${fmt(compMedian)} for comparable units, ` +
        `and I would appreciate consideration of this in the renewal terms.`
      );
    }

    // ── CLOSING ──
    if (isFriendly) {
      paragraphs.push(
        `I value my tenancy here and would like to continue our rental relationship on terms that reflect the current market. ` +
        `I'm happy to discuss this further at your convenience.`
      );
    } else {
      paragraphs.push(
        `I value this tenancy and hope we can reach terms that reflect current market conditions. ` +
        `I look forward to your response.`
      );
    }

    paragraphs.push(isFriendly ? `Best,\n[Your name]` : `Sincerely,\n[Your name]`);

    return paragraphs;
  }, [tone, currentRent, newRent, increasePct, marketYoy, city, brLabel,
    counterLow, counterHigh, counterLowPercent, counterHighPercent,
    increaseAmt, compMedian, compCount, trendArea,
    rcMedianRent, rcTotalListings, rcAvgDaysOnMarket, alVacancy, f50Value]);

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
        <p className="text-[10px] text-muted-foreground/50 mt-6 pt-4 border-t border-border/40 leading-relaxed">
          Analysis by RenewalReply — renewalreply.com
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3 mt-5">
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

      {/* Share Analysis — generates a link to the full report for landlord follow-up */}
      {shareReportPayload && (
        <div className="mt-5">
          <p className="text-xs text-muted-foreground mb-2">If your landlord asks for sources, share your full analysis:</p>
          <ShareReportButton
            reportPayload={shareReportPayload}
            onLinkGenerated={onReportLinkGenerated}
            analysisId={analysisId}
            leadEmail={prefilledEmail}
          />
        </div>
      )}

      {/* Legal disclaimer */}
      <p className="text-[11px] text-muted-foreground/70 mt-4 leading-relaxed max-w-[540px]">
        This letter is a template based on public housing data — not legal advice. Review and customize before sending. Rent regulations vary by location and lease terms.{' '}
        <Link to="/privacy" className="underline hover:text-foreground transition-colors">Privacy Policy</Link>
      </p>
    </div>
  );
};

export default NegotiationLetter;
