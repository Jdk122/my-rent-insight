import { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import { trackEvent } from '@/lib/analytics';
import { Link } from 'react-router-dom';
import { BedroomType, bedroomLabels } from '@/data/rentData';
import { Check, Copy, Download, RefreshCw, Mail } from 'lucide-react';
import ShareReportButton from '@/components/ShareReportButton';
import { supabase } from '@/integrations/supabase/client';

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
  fairnessScore?: number | null;
  tierLabel?: string;
}

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

// ── Template fallback (used if AI generation fails) ──
function buildFallbackLetter(props: {
  currentRent: number; newRent: number; increasePct: number; marketYoy: number;
  city: string; brLabel: string; increaseAmt: number;
  counterLow: number; counterHigh: number; counterLowPercent: number; counterHighPercent: number;
  compMedian?: number | null; compCount?: number; trendArea?: string;
  rcMedianRent?: number | null; f50Value?: number | null;
  rcTotalListings?: number | null; rcAvgDaysOnMarket?: number | null;
  alVacancy?: number | null;
}): string {
  const {
    currentRent, newRent, increasePct, marketYoy, city, brLabel, increaseAmt,
    counterLow, counterHigh, counterLowPercent, counterHighPercent,
    compMedian, compCount, trendArea, rcMedianRent, f50Value,
    rcTotalListings, rcAvgDaysOnMarket, alVacancy,
  } = props;

  const paragraphs: string[] = [];

  paragraphs.push(`Dear Landlord,`);
  paragraphs.push(
    `Thank you for the lease renewal notice. I've enjoyed living here and would like to continue. ` +
    `I'd like to discuss the proposed increase of $${fmt(increaseAmt)}/month (${increasePct}%), ` +
    `which would bring my rent from $${fmt(currentRent)} to $${fmt(newRent)}/month. ` +
    `I've done some research on current market conditions and wanted to share what I found.`
  );

  if (compMedian && compCount && compCount > 0) {
    const currentAboveCompPct = ((currentRent - compMedian) / compMedian) * 100;
    if (currentAboveCompPct > 30) {
      paragraphs.push(
        `I've reviewed ${compCount} comparable ${brLabel.toLowerCase()} rental${compCount !== 1 ? 's' : ''} near this address. ` +
        `While my current rent reflects the premium nature of this unit, the proposed ${increasePct}% increase significantly ` +
        `exceeds the ${Math.abs(marketYoy)}% rate at which rents in this area have been growing.`
      );
    } else {
      const position = newRent > compMedian
        ? `$${fmt(newRent - compMedian)} above` : newRent < compMedian
        ? `$${fmt(compMedian - newRent)} below` : 'in line with';
      paragraphs.push(
        `I reviewed ${compCount} comparable ${brLabel.toLowerCase()} rental${compCount !== 1 ? 's' : ''} currently listed near this address. ` +
        `The median asking rent for similar units is $${fmt(compMedian)}/month, ` +
        `which puts my proposed rent of $${fmt(newRent)} ${position} the local median.`
      );
    }
  }

  const areaName = trendArea || city;
  const trendDir = marketYoy > 0.5 ? 'increased' : marketYoy < -0.5 ? 'decreased' : 'remained essentially flat';
  const trendCmp = increasePct > marketYoy + 1 ? `well above this market trend` : increasePct >= marketYoy - 1 ? `roughly in line with this trend` : `below the area trend`;
  paragraphs.push(
    `According to recent rental market data, rents in ${areaName} have ${trendDir} by ${Math.abs(marketYoy)}% over the past year. ` +
    `My proposed increase of ${increasePct}% is ${trendCmp}.`
  );

  const benchmark = rcMedianRent ?? f50Value ?? null;
  if (benchmark && benchmark > 0 && ((newRent - benchmark) / benchmark) * 100 <= 40) {
    const pctDiff = Math.round(((newRent - benchmark) / benchmark) * 100);
    const ab = pctDiff > 0 ? `${pctDiff}% above` : pctDiff < 0 ? `${Math.abs(pctDiff)}% below` : 'at';
    const src = rcMedianRent ? 'Current market data estimates' : 'Federal housing data estimates';
    paragraphs.push(`${src} the median rent for a ${brLabel.toLowerCase()} in this area at $${fmt(benchmark)}/month. My proposed rent of $${fmt(newRent)} is ${ab} this benchmark.`);
  }

  if (rcTotalListings && rcAvgDaysOnMarket) {
    const cond = rcAvgDaysOnMarket > 35 ? 'favorable' : rcAvgDaysOnMarket < 20 ? 'competitive' : 'moderate';
    let s = `Current rental market conditions suggest ${cond} conditions for negotiation: ${rcTotalListings} rental units are currently active in this area, with an average of ${Math.round(rcAvgDaysOnMarket)} days on market.`;
    if (alVacancy !== null && alVacancy !== undefined && alVacancy > 6) s += ` The local vacancy rate of ${alVacancy.toFixed(1)}% indicates elevated availability.`;
    paragraphs.push(s);
  }

  paragraphs.push(`I want to be transparent that this analysis draws on multiple public data sources including government rent benchmarks and current local listings. I'm happy to share the detailed breakdown if that would be helpful.`);

  const counterRange = counterLow === counterHigh ? `$${fmt(counterLow)}/month` : `$${fmt(counterLow)}–$${fmt(counterHigh)}/month`;
  const counterPctRange = counterLow === counterHigh ? `${counterLowPercent}%` : `${counterLowPercent}–${counterHighPercent}%`;
  paragraphs.push(
    `Based on this research, I believe a renewal rate of ${counterRange} would better reflect current market conditions. ` +
    `This represents an increase of ${counterPctRange} over my current rent, which aligns with the ${Math.abs(marketYoy)}% trend in this market.`
  );

  paragraphs.push(`I value my tenancy here and would like to continue our rental relationship on terms that reflect the current market. I'm happy to discuss this further at your convenience.`);
  paragraphs.push(`Sincerely,\n\n`);
  paragraphs.push(`Analysis by RenewalReply — renewalreply.com`);

  return paragraphs.join('\n\n');
}

const NegotiationLetter = (props: NegotiationLetterProps) => {
  const {
    currentRent, newRent, increasePct, marketYoy, fmr, censusMedian, medianIncome,
    zip, city, state, bedrooms, increaseAmount,
    counterLow, counterHigh, counterLowPercent, counterHighPercent,
    analysisId, prefilledEmail, onEmailCaptured, leadContext, reportUrl, onGenerateReport,
    compMedian, compCount, compRadius, trendSource, trendArea,
    rcMedianRent, rcTotalListings, rcAvgDaysOnMarket, alVacancy, f50Value,
    shareReportPayload, onReportLinkGenerated, fairnessScore, tierLabel,
  } = props;

  const [aiLetter, setAiLetter] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);

  const brLabel = bedroomLabels[bedrooms];
  const increaseAmt = increaseAmount ?? Math.round(newRent - currentRent);
  const bedroomNum = ['studio', '1br', '2br', '3br', '4br'].indexOf(bedrooms);

  const rentToIncomeRatio = medianIncome && medianIncome > 0
    ? Math.round(((newRent * 12) / medianIncome) * 100) : null;

  const analysisPayload = useMemo(() => ({
    currentRent,
    proposedRent: newRent,
    increasePct,
    increaseAmount: increaseAmt,
    bedroomCount: bedroomNum,
    bedroomLabel: brLabel,
    zipCode: zip,
    city,
    state,
    fairnessScore: fairnessScore ?? null,
    tierLabel: tierLabel ?? null,
    compMedian: compMedian ?? null,
    compCount: compCount ?? 0,
    marketYoY: marketYoy,
    marketYoYSource: trendSource ?? 'HUD',
    areaName: trendArea || city,
    rcMedianRent: rcMedianRent ?? null,
    rcTotalListings: rcTotalListings ?? null,
    rcAvgDaysOnMarket: rcAvgDaysOnMarket ?? null,
    alVacancy: alVacancy ?? null,
    medianIncome: medianIncome ?? null,
    rentToIncomeRatio,
    counterLow,
    counterHigh,
    counterLowPercent,
    counterHighPercent,
    f50Value: f50Value ?? null,
    fmr,
  }), [currentRent, newRent, increasePct, increaseAmt, bedroomNum, brLabel, zip, city, state,
    fairnessScore, tierLabel, compMedian, compCount, marketYoy, trendSource, trendArea,
    rcMedianRent, rcTotalListings, rcAvgDaysOnMarket, alVacancy, medianIncome, rentToIncomeRatio,
    counterLow, counterHigh, counterLowPercent, counterHighPercent, f50Value, fmr]);

  const generateLetter = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('generate-letter', {
        body: analysisPayload,
      });

      if (fnError) throw fnError;
      if (data?.letter) {
        setAiLetter(data.letter);
        trackEvent('ai_letter_generated', { zip });
      } else {
        throw new Error('No letter returned');
      }
    } catch (e) {
      console.error('AI letter generation failed:', e);
      setError(true);
      toast.error('Letter generation failed — showing template version.');
    } finally {
      setLoading(false);
    }
  }, [analysisPayload, zip]);

  // Auto-generate on mount
  useEffect(() => {
    if (!aiLetter && !loading && !error) {
      generateLetter();
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fallbackLetter = useMemo(() => buildFallbackLetter({
    currentRent, newRent, increasePct, marketYoy, city, brLabel, increaseAmt,
    counterLow, counterHigh, counterLowPercent, counterHighPercent,
    compMedian, compCount, trendArea, rcMedianRent, f50Value,
    rcTotalListings, rcAvgDaysOnMarket, alVacancy,
  }), [currentRent, newRent, increasePct, marketYoy, city, brLabel, increaseAmt,
    counterLow, counterHigh, counterLowPercent, counterHighPercent,
    compMedian, compCount, trendArea, rcMedianRent, f50Value,
    rcTotalListings, rcAvgDaysOnMarket, alVacancy]);

  const displayLetter = aiLetter || fallbackLetter;
  const isAi = !!aiLetter;

  const handleCopy = () => {
    navigator.clipboard.writeText(displayLetter);
    trackEvent('letter_copied', { ai: isAi });
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownload = () => {
    const blob = new Blob([displayLetter], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rent-negotiation-${zip}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Downloaded');
    trackEvent('letter_downloaded', { ai: isAi });
  };

  const handleEmail = () => {
    const subject = encodeURIComponent('Regarding my lease renewal');
    const body = encodeURIComponent(displayLetter);
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
    trackEvent('letter_emailed', { ai: isAi });
  };

  const handleRegenerate = () => {
    setAiLetter(null);
    generateLetter();
    trackEvent('letter_regenerated');
  };

  // ── Loading state ──
  if (loading) {
    return (
      <div className="mt-4">
        <div
          className="rounded-lg border border-border border-l-[3px] border-l-muted p-6 md:p-8"
          style={{ background: 'hsl(var(--letter-bg))', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
        >
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <RefreshCw size={24} className="animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Crafting your personalized letter...</p>
            <p className="text-xs text-muted-foreground/60">This takes a few seconds</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Letter container */}
      <div
        className="rounded-lg border border-border border-l-[3px] border-l-muted p-6 md:p-8 mt-4"
        style={{ background: 'hsl(var(--letter-bg))', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
      >
        <div className="text-xs text-muted-foreground mb-4 pb-4 border-b border-border flex items-center justify-between">
          <div className="flex gap-4">
            <span>To: Your landlord</span>
            <span>Re: Lease renewal</span>
          </div>
          {isAi && (
            <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
              AI-generated
            </span>
          )}
        </div>
        <div className="space-y-4">
          {displayLetter.split('\n\n').map((para, i) => (
            <p key={i} className="text-sm text-foreground/80 leading-[1.7] whitespace-pre-line">{para}</p>
          ))}
        </div>
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
          onClick={handleEmail}
          className="inline-flex items-center gap-2 border border-border px-7 py-3 rounded-lg text-sm font-medium text-foreground hover:border-foreground transition-colors"
        >
          <Mail size={16} /> Open in email
        </button>
        <button
          onClick={handleDownload}
          className="inline-flex items-center gap-2 border border-border px-5 py-3 rounded-lg text-sm font-medium text-muted-foreground hover:border-foreground hover:text-foreground transition-colors"
        >
          <Download size={16} />
        </button>
        <button
          onClick={handleRegenerate}
          disabled={loading}
          className="inline-flex items-center gap-2 border border-border px-5 py-3 rounded-lg text-sm font-medium text-muted-foreground hover:border-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          <RefreshCw size={16} /> Regenerate
        </button>
      </div>

      {/* Share Analysis */}
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
        This letter is generated using AI and public housing data — not legal advice. Review and customize before sending. Rent regulations vary by location and lease terms.{' '}
        <Link to="/privacy" className="underline hover:text-foreground transition-colors">Privacy Policy</Link>
      </p>
    </div>
  );
};

export default NegotiationLetter;
