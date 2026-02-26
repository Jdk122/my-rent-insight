import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { BedroomType, bedroomLabels } from '@/data/rentData';
import { LandlordCostEstimate } from '@/data/landlordCosts';

interface NegotiationLetterProps {
  currentRent: number;
  newRent: number;
  increasePct: number;
  marketYoy: number;
  fmr: number;
  censusMedian: number | null;
  medianHouseholdIncome: number | null;
  zip: string;
  city: string;
  state: string;
  bedrooms: BedroomType;
  landlordCosts?: LandlordCostEstimate | null;
  increaseAmount?: number;
}

type Tone = 'friendly' | 'firm';

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

const NegotiationLetter = ({
  currentRent, newRent, increasePct, marketYoy, fmr, censusMedian, medianHouseholdIncome,
  zip, city, state, bedrooms, landlordCosts, increaseAmount,
}: NegotiationLetterProps) => {
  const [tone, setTone] = useState<Tone>('friendly');

  const counterPct = Math.max(Math.round(marketYoy * 10) / 10, 1);
  const counterRent = Math.round(currentRent * (1 + counterPct / 100));
  const counterHigh = Math.round(currentRent * (1 + (counterPct + 1) / 100));

  const brLabel = bedroomLabels[bedrooms];

  const costLine = landlordCosts && increaseAmount
    ? `\n\nFor reference, public records suggest this unit was purchased for $${fmt(landlordCosts.purchasePrice)} in ${landlordCosts.purchaseYear}. Based on typical carrying costs, the annual increase in ownership expenses is approximately $${fmt(landlordCosts.annualCostIncrease)} — significantly less than the $${fmt(increaseAmount * 12)} annual increase being proposed.`
    : '';

  const letterHtml = useMemo(() => {
    if (tone === 'friendly') {
      return [
        `Hi [Landlord],`,
        `Thanks for letting me know about the lease renewal. I'd like to stay and I appreciate the notice.`,
        `Before I sign, I looked into what rents have done in ${city} this year. The market-wide increase for a ${brLabel.toLowerCase()} was about ${marketYoy}%, and my proposed increase of ${increasePct}% is roughly ${(increasePct / marketYoy).toFixed(0)}× that.`,
        `For context:`,
        `• ${city} median rent (${brLabel}): $${fmt(censusMedian || fmr)}\n• Area-wide increase this year: ${marketYoy}%\n• My proposed increase: ${increasePct}%`,
        costLine ? costLine.trim() : null,
        `I'd love to find a number that works for both of us — something closer to ${counterPct}–${counterPct + 1}%, which would put the rent around $${fmt(counterRent)}–$${fmt(counterHigh)}. Happy to discuss.`,
        `Best,\n[Your name]`,
      ].filter(Boolean);
    }

    return [
      `Dear [Landlord],`,
      `I am writing regarding the proposed lease renewal at $${fmt(newRent)}/month — a ${increasePct}% increase from my current rent of $${fmt(currentRent)}/month.`,
      `I have reviewed current market data for ${city}, ${state} (${zip}):`,
      `• Typical ${brLabel.toLowerCase()} rent in ${city}: $${fmt(fmr)}\n${censusMedian ? `• ${city} median rent: $${fmt(censusMedian)}\n` : ''}• Rents in ${city} rose ${marketYoy}% this year\n• Proposed increase: ${increasePct}%`,
      `The proposed increase of ${increasePct}% is ${(increasePct / marketYoy).toFixed(1)}× faster than rents are rising in ${city}.`,
      costLine ? costLine.trim() : null,
      `I am prepared to renew at ${counterPct}% ($${fmt(counterRent)}/month), in line with ${city}'s market trend.`,
      `Sincerely,\n[Your name]`,
    ].filter(Boolean);
  }, [tone, currentRent, newRent, increasePct, marketYoy, fmr, censusMedian, zip, city, state, brLabel, counterPct, counterRent, counterHigh, costLine]);

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

      {/* Tone toggle — segmented control */}
      <div className="tone-toggle">
        <button
          onClick={() => setTone('friendly')}
          className={`tone-option ${tone === 'friendly' ? 'active' : ''}`}
        >
          Friendly
        </button>
        <button
          onClick={() => setTone('firm')}
          className={`tone-option ${tone === 'firm' ? 'active' : ''}`}
        >
          Firm
        </button>
      </div>

      {/* Letter preview */}
      <div className="bg-card border border-border rounded p-6 md:p-8 mt-4">
        <div className="text-xs text-muted-foreground mb-4 pb-4 border-b border-border flex gap-4">
          <span>To: Your landlord</span>
          <span>Re: Lease renewal</span>
        </div>
        <div className="space-y-4">
          {letterHtml.map((para, i) => (
            <p key={i} className="text-sm text-foreground/80 leading-[1.7] whitespace-pre-line">
              {para}
            </p>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 mt-5">
        <button onClick={handleCopy} className="bg-primary text-primary-foreground px-7 py-3 rounded text-sm font-semibold hover:opacity-90 transition-opacity">
          Copy letter
        </button>
        <button onClick={handleDownload} className="border border-border px-7 py-3 rounded text-sm font-medium text-foreground hover:border-foreground transition-colors">
          Download
        </button>
      </div>
    </div>
  );
};

export default NegotiationLetter;
