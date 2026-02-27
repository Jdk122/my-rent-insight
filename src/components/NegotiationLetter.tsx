import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { BedroomType, bedroomLabels } from '@/data/rentData';
import { LandlordCostEstimate, LandlordInsights } from '@/data/landlordCosts';

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
  landlordCosts?: LandlordCostEstimate | null;
  landlordInsights?: LandlordInsights | null;
  increaseAmount?: number;
  counterLow: number;
  counterHigh: number;
  counterLowPercent: number;
  counterHighPercent: number;
}

type Tone = 'friendly' | 'firm';

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

const NegotiationLetter = ({
  currentRent, newRent, increasePct, marketYoy, fmr, censusMedian, medianIncome,
  zip, city, state, bedrooms, landlordCosts, landlordInsights, increaseAmount,
  counterLow, counterHigh, counterLowPercent, counterHighPercent,
}: NegotiationLetterProps) => {
  const [tone, setTone] = useState<Tone>('friendly');

  const brLabel = bedroomLabels[bedrooms];
  const increaseRatio = marketYoy > 0 ? Math.round((increasePct / marketYoy) * 10) / 10 : 0;

  // Only include cost data when we have enough data and profit is positive
  const showCostData = landlordCosts && landlordInsights && increaseAmount &&
    landlordInsights.hasEnoughData &&
    landlordInsights.costIncreaseMarkup !== null && landlordInsights.costIncreaseMarkup > 1 &&
    landlordInsights.profitMargin > 0;

  const friendlyCostLine = showCostData
    ? `I also looked into typical operating costs for a building like ours. Based on public records, the property was purchased in ${landlordCosts!.purchaseYear} for $${fmt(landlordCosts!.purchasePrice)}, and operating costs for a building at this price point likely increased around $${fmt(landlordCosts!.monthlyCostIncrease)}/month per unit this year — well below the $${fmt(increaseAmount!)}/month increase proposed.`
    : '';

  const firmCostBullets = showCostData
    ? `\n• Based on the ${landlordCosts!.purchaseYear} purchase price and current tax records, estimated operating cost increases for this building are ~$${fmt(landlordCosts!.monthlyCostIncrease)}/mo per unit — the proposed $${fmt(increaseAmount!)}/mo increase represents a ${landlordInsights!.costIncreaseMarkup}× markup on actual cost increases\n• At current rents, the estimated monthly profit on each unit already exceeds $${fmt(landlordInsights!.profitMargin)} before the proposed increase`
    : '';

  const letterHtml = useMemo(() => {
    if (tone === 'friendly') {
      return [
        `Hi [Landlord name],`,
        `Thanks for letting me know about the lease renewal. I'd like to stay and I appreciate the notice.`,
        `Before I sign, I looked into what rents have done in ${city} this year. The market-wide increase for a ${brLabel.toLowerCase()} was about ${marketYoy}%, and my proposed increase of ${increasePct}% is ${increaseRatio >= 1.8 ? 'nearly double that' : increaseRatio >= 1.4 ? 'well above that' : 'noticeably higher'}.`,
        `For context:\n• ${city} median rent (${brLabel}): $${fmt(censusMedian || fmr)}\n• Area-wide increase this year: ${marketYoy}%\n• My proposed increase: ${increasePct}%`,
        friendlyCostLine || null,
        `I'd love to find a number that works for both of us — something closer to ${counterLowPercent}–${counterHighPercent}%, which would put the rent around $${fmt(counterLow)}–$${fmt(counterHigh)}. Happy to discuss.`,
        `Best,\n[Your name]`,
      ].filter(Boolean);
    }

    return [
      `Dear [Landlord name],`,
      `I am writing regarding the proposed lease renewal at $${fmt(newRent)}/month — a ${increasePct}% increase from my current rent of $${fmt(currentRent)}/month.`,
      `I have reviewed current market data for ${city}, ${state} (${zip}):`,
      `• Typical ${brLabel.toLowerCase()} rent in ${city}: $${fmt(fmr)}\n${censusMedian ? `• ${city} median rent: $${fmt(censusMedian)}\n` : ''}• Rents in ${city} rose ${marketYoy}% this year\n• Proposed increase: ${increasePct}%${firmCostBullets}`,
      `The proposed increase of ${increasePct}% is ${increaseRatio >= 1.8 ? 'nearly double' : increaseRatio >= 1.4 ? 'well above' : 'noticeably above'} the rate at which rents are rising in ${city}.`,
      `I am prepared to renew at ${counterLowPercent}% ($${fmt(counterLow)}/month), in line with ${city}'s market trend.`,
      `Sincerely,\n[Your name]`,
    ].filter(Boolean);
  }, [tone, currentRent, newRent, increasePct, marketYoy, fmr, censusMedian, zip, city, state, brLabel, counterLow, counterHigh, counterLowPercent, counterHighPercent, friendlyCostLine, firmCostBullets, increaseRatio]);

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
      <div className="flex gap-3 mt-5">
        <button onClick={handleCopy} className="bg-primary text-primary-foreground px-7 py-3 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm shadow-primary/20">Copy letter</button>
        <button onClick={handleDownload} className="border border-border px-7 py-3 rounded-lg text-sm font-medium text-foreground hover:border-foreground transition-colors">Download</button>
      </div>
    </div>
  );
};

export default NegotiationLetter;
