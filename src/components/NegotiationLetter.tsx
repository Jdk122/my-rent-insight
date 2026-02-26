import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Copy, Download, Handshake, Shield } from 'lucide-react';
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
  const [name, setName] = useState('');
  const [landlordName, setLandlordName] = useState('');
  const [counterPct, setCounterPct] = useState(Math.max(Math.round(marketYoy * 10) / 10, 1));

  const counterRent = Math.round(currentRent * (1 + counterPct / 100));

  const letter = useMemo(() => {
    const ln = landlordName || '[Landlord Name]';
    const sn = name || '[Your Name]';
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const brLabel = bedroomLabels[bedrooms];
    const burdenLine = medianHouseholdIncome
      ? `\n• At $${fmt(newRent)}/mo, rent would be ${Math.round((newRent / (medianHouseholdIncome / 12)) * 100)}% of ${city} median household income (affordability limit: 30%)`
      : '';

    const costLine = landlordCosts && increaseAmount
      ? `\n\nFor reference, public records suggest this unit was purchased for $${fmt(landlordCosts.purchasePrice)} in ${landlordCosts.purchaseYear}. Based on typical carrying costs, the annual increase in ownership expenses is approximately $${fmt(landlordCosts.annualCostIncrease)} — significantly less than the $${fmt(increaseAmount * 12)} annual increase being proposed.`
      : '';

    if (tone === 'friendly') {
      return `Dear ${ln},

Thank you for the lease renewal offer. I received your notice of a rent increase from $${fmt(currentRent)} to $${fmt(newRent)} per month, which represents a ${increasePct}% increase.

I've been a reliable tenant and I'd like to continue living here. However, I wanted to share some data about rents in ${city} that suggests this increase may be above current trends.

Based on current rent data for ${city}, ${state} (${zip}):

• Rents in ${city} rose ${marketYoy > 0 ? '' : ''}${marketYoy}% this year
• My proposed increase: +${increasePct}%
• Typical ${brLabel} rent in ${city}: $${fmt(fmr)}${censusMedian ? `\n• ${city} median rent: $${fmt(censusMedian)}` : ''}${burdenLine}${costLine}

I'd love to discuss a renewal closer to what ${city} rents are actually doing — around ${counterPct}% ($${fmt(counterRent)}/month).

I've included my rent analysis from RentReply for your reference.

Thank you for your consideration.

Sincerely,
${sn}
${dateStr}`;
    }

    return `Dear ${ln},

I am writing in response to the proposed rent increase from $${fmt(currentRent)} to $${fmt(newRent)} per month — a ${increasePct}% increase effective with my lease renewal.

I have reviewed current rent data for ${city}, ${state} (${zip}):

• Typical ${brLabel} rent in ${city}: $${fmt(fmr)}${censusMedian ? `\n• ${city} median rent: $${fmt(censusMedian)}` : ''}${burdenLine}
• Rents in ${city} rose ${marketYoy > 0 ? '' : ''}${marketYoy}% this year
• Proposed increase: +${increasePct}%

The proposed increase of ${increasePct}% is ${(increasePct / marketYoy).toFixed(1)}× faster than rents are rising in ${city}.${costLine}

I am prepared to renew at ${counterPct}% ($${fmt(counterRent)}/month), in line with ${city}'s trend.

Sincerely,
${sn}
${dateStr}`;
  }, [tone, name, landlordName, counterPct, counterRent, currentRent, newRent, increasePct, marketYoy, fmr, censusMedian, medianHouseholdIncome, zip, city, state, bedrooms, landlordCosts, increaseAmount]);

  const handleCopy = () => {
    navigator.clipboard.writeText(letter);
    toast.success('Letter copied');
  };

  const handleDownload = () => {
    const blob = new Blob([letter], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rent-negotiation-${zip}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Downloaded');
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display text-2xl text-foreground mb-1">Your negotiation letter</h3>
        <p className="text-sm text-muted-foreground">
          Customize it, then copy or download. Ready to send.
        </p>
      </div>

      {/* Tone toggle — right here, no fuss */}
      <div className="flex gap-2">
        <button
          onClick={() => setTone('friendly')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg border text-xs font-mono transition-colors ${
            tone === 'friendly'
              ? 'border-primary bg-primary/5 text-primary'
              : 'border-border text-muted-foreground hover:bg-secondary'
          }`}
        >
          <Handshake className="w-3.5 h-3.5" />
          Friendly
        </button>
        <button
          onClick={() => setTone('firm')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg border text-xs font-mono transition-colors ${
            tone === 'firm'
              ? 'border-primary bg-primary/5 text-primary'
              : 'border-border text-muted-foreground hover:bg-secondary'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          Firm
        </button>
      </div>

      {/* Names + counter */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Your name</Label>
          <Input
            placeholder="Jane Doe"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-9 font-mono text-sm bg-background"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Landlord / management</Label>
          <Input
            placeholder="ABC Properties"
            value={landlordName}
            onChange={(e) => setLandlordName(e.target.value)}
            className="h-9 font-mono text-sm bg-background"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground">
          Your counter-offer: <span className="font-mono text-primary">{counterPct}%</span>
          <span className="text-muted-foreground ml-1">(${fmt(counterRent)}/mo)</span>
        </Label>
        <Slider
          value={[counterPct]}
          onValueChange={([v]) => setCounterPct(Math.round(v * 10) / 10)}
          min={0}
          max={increasePct}
          step={0.5}
        />
        <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
          <span>0%</span>
          <span>{increasePct}% (accept as-is)</span>
        </div>
      </div>

      {/* The letter itself */}
      <div className="rounded-lg border border-border bg-card p-5 md:p-6">
        <pre className="whitespace-pre-wrap font-mono text-[13px] text-foreground leading-relaxed">
          {letter}
        </pre>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button onClick={handleCopy} variant="default" className="flex-1 gap-1.5 h-10 text-sm rounded-lg">
          <Copy className="w-3.5 h-3.5" />
          Copy letter
        </Button>
        <Button onClick={handleDownload} variant="outline" className="flex-1 gap-1.5 h-10 text-sm rounded-lg">
          <Download className="w-3.5 h-3.5" />
          Download
        </Button>
      </div>
    </div>
  );
};

export default NegotiationLetter;
