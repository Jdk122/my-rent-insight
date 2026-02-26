import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Copy, Download, FileText, Handshake, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { RentData, getFmrForBedrooms, BedroomType, bedroomLabels } from '@/data/rentData';

interface NegotiationLetterProps {
  currentRent: number;
  newRent: number;
  increasePct: number;
  marketYoy: number;
  fmr: number;
  censusMedian: number | null;
  zip: string;
  city: string;
  state: string;
  bedrooms: BedroomType;
}

type Tone = 'friendly' | 'firm';

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

const NegotiationLetter = ({
  currentRent,
  newRent,
  increasePct,
  marketYoy,
  fmr,
  censusMedian,
  zip,
  city,
  state,
  bedrooms,
}: NegotiationLetterProps) => {
  const [isOpen, setIsOpen] = useState(false);
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

    if (tone === 'friendly') {
      return `Dear ${ln},

Thank you for the lease renewal offer. I received your notice of a rent increase from $${fmt(currentRent)} to $${fmt(newRent)} per month, which represents a ${increasePct}% increase.

I've been a reliable tenant and I'd like to continue living here. However, I wanted to share some market data I found that suggests this increase may be above current market trends.

According to HUD Fair Market Rent data and Census Bureau estimates for ${zip} (${city}, ${state}):

• Market-wide annual rent increase: ${marketYoy > 0 ? '+' : ''}${marketYoy}%
• My proposed increase: +${increasePct}%
• Federal Fair Market Rent (${brLabel}): $${fmt(fmr)}${censusMedian ? `\n• Census Median Gross Rent: $${fmt(censusMedian)}` : ''}

Rents in our area increased approximately ${Math.abs(marketYoy)}% year-over-year, while the proposed increase of ${increasePct}% is significantly above that trend.

I'd love to discuss a renewal at an increase closer to market conditions — around ${counterPct}% ($${fmt(counterRent)}/month). I believe this is fair for both of us and reflects the current rental market.

I've included my rent analysis from RentCheck for your reference.

Thank you for your consideration.

Sincerely,
${sn}
${dateStr}`;
    }

    return `Dear ${ln},

I am writing in response to the proposed rent increase from $${fmt(currentRent)} to $${fmt(newRent)} per month — a ${increasePct}% increase effective with my lease renewal.

I have reviewed current market data from federal and census sources for ${zip} (${city}, ${state}):

• HUD Fair Market Rent (${brLabel}, FY2025): $${fmt(fmr)}${censusMedian ? `\n• Census Median Gross Rent (ACS 2022): $${fmt(censusMedian)}` : ''}
• Market-wide annual rent change: ${marketYoy > 0 ? '+' : ''}${marketYoy}%
• Proposed increase: +${increasePct}%

The proposed increase of ${increasePct}% is ${(increasePct / marketYoy).toFixed(1)}× the market rate of increase in this zip code. This is not consistent with prevailing market conditions.

I am prepared to renew at an increase of ${counterPct}% ($${fmt(counterRent)}/month), which is in line with the area's year-over-year trend. I have been a consistent, on-time tenant and would prefer to continue this arrangement at a fair rate.

Please let me know if you'd like to discuss. I have attached supporting data from RentCheck.

Sincerely,
${sn}
${dateStr}`;
  }, [tone, name, landlordName, counterPct, counterRent, currentRent, newRent, increasePct, marketYoy, fmr, censusMedian, zip, city, state, bedrooms]);

  const handleCopy = () => {
    navigator.clipboard.writeText(letter);
    toast.success('Letter copied to clipboard');
  };

  const handleDownload = () => {
    const blob = new Blob([letter], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rent-negotiation-letter-${zip}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Letter downloaded');
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="w-full brand-card group cursor-pointer hover:border-accent/40 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-accent/10 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5 text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-display text-xl text-foreground group-hover:text-accent transition-colors">
              Generate your negotiation letter
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Pre-written with your data. Copy it, send it, save money.
            </p>
          </div>
        </div>
      </button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="brand-card space-y-6"
    >
      <div>
        <p className="data-label mb-1">Negotiation Letter</p>
        <h3 className="font-display text-2xl text-foreground">Send this to your landlord</h3>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Your Name</Label>
          <Input
            placeholder="Jane Doe"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-10 font-mono bg-background"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">Landlord / Management</Label>
          <Input
            placeholder="ABC Properties"
            value={landlordName}
            onChange={(e) => setLandlordName(e.target.value)}
            className="h-10 font-mono bg-background"
          />
        </div>
      </div>

      {/* Tone toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setTone('friendly')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md border text-sm font-mono transition-colors ${
            tone === 'friendly'
              ? 'border-accent bg-accent/10 text-accent'
              : 'border-border text-muted-foreground hover:bg-secondary'
          }`}
        >
          <Handshake className="w-4 h-4" />
          Friendly
        </button>
        <button
          onClick={() => setTone('firm')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md border text-sm font-mono transition-colors ${
            tone === 'firm'
              ? 'border-accent bg-accent/10 text-accent'
              : 'border-border text-muted-foreground hover:bg-secondary'
          }`}
        >
          <Shield className="w-4 h-4" />
          Firm
        </button>
      </div>

      {/* Counter-offer slider */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">
          Your counter-offer: <span className="font-mono text-accent">{counterPct}%</span>
          <span className="text-muted-foreground font-normal"> (${fmt(counterRent)}/mo)</span>
        </Label>
        <Slider
          value={[counterPct]}
          onValueChange={([v]) => setCounterPct(Math.round(v * 10) / 10)}
          min={0}
          max={increasePct}
          step={0.5}
        />
        <div className="flex justify-between text-xs font-mono text-muted-foreground">
          <span>0% (no increase)</span>
          <span>{increasePct}% (accept as-is)</span>
        </div>
      </div>

      {/* Letter preview */}
      <div className="rounded-md bg-secondary/50 border border-border p-5 max-h-80 overflow-y-auto">
        <pre className="whitespace-pre-wrap font-mono text-sm text-foreground leading-relaxed">
          {letter}
        </pre>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button onClick={handleCopy} variant="default" className="flex-1 gap-2">
          <Copy className="w-4 h-4" />
          Copy Letter
        </Button>
        <Button onClick={handleDownload} variant="outline" className="flex-1 gap-2">
          <Download className="w-4 h-4" />
          Download
        </Button>
      </div>
    </motion.div>
  );
};

export default NegotiationLetter;
