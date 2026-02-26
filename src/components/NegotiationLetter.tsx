import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Copy, Download, FileText, Handshake, Shield, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { BedroomType, bedroomLabels } from '@/data/rentData';

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
}

type Tone = 'friendly' | 'firm';

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

const NegotiationLetter = ({
  currentRent, newRent, increasePct, marketYoy, fmr, censusMedian, medianHouseholdIncome,
  zip, city, state, bedrooms,
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
    const burdenLine = medianHouseholdIncome
      ? `\n• Rent-to-income ratio at new rent: ${Math.round((newRent / (medianHouseholdIncome / 12)) * 100)}% of area median (HUD threshold: 30%)`
      : '';

    if (tone === 'friendly') {
      return `Dear ${ln},

Thank you for the lease renewal offer. I received your notice of a rent increase from $${fmt(currentRent)} to $${fmt(newRent)} per month, which represents a ${increasePct}% increase.

I've been a reliable tenant and I'd like to continue living here. However, I wanted to share some market data that suggests this increase may be above current trends.

According to HUD Fair Market Rent data and Census Bureau estimates for ${zip} (${city}, ${state}):

• Market-wide annual rent increase: ${marketYoy > 0 ? '+' : ''}${marketYoy}%
• My proposed increase: +${increasePct}%
• Federal Fair Market Rent (${brLabel}): $${fmt(fmr)}${censusMedian ? `\n• Census Median Gross Rent: $${fmt(censusMedian)}` : ''}${burdenLine}

I'd love to discuss a renewal closer to market conditions — around ${counterPct}% ($${fmt(counterRent)}/month).

I've included my rent analysis from RentCheck for your reference.

Thank you for your consideration.

Sincerely,
${sn}
${dateStr}`;
    }

    return `Dear ${ln},

I am writing in response to the proposed rent increase from $${fmt(currentRent)} to $${fmt(newRent)} per month — a ${increasePct}% increase effective with my lease renewal.

I have reviewed current market data for ${zip} (${city}, ${state}):

• HUD Fair Market Rent (${brLabel}, FY2025): $${fmt(fmr)}${censusMedian ? `\n• Census Median Gross Rent (ACS 2022): $${fmt(censusMedian)}` : ''}${burdenLine}
• Market-wide annual rent change: ${marketYoy > 0 ? '+' : ''}${marketYoy}%
• Proposed increase: +${increasePct}%

The proposed increase of ${increasePct}% is ${(increasePct / marketYoy).toFixed(1)}× the market rate of increase in this zip code.

I am prepared to renew at ${counterPct}% ($${fmt(counterRent)}/month), in line with the area's trend.

Sincerely,
${sn}
${dateStr}`;
  }, [tone, name, landlordName, counterPct, counterRent, currentRent, newRent, increasePct, marketYoy, fmr, censusMedian, medianHouseholdIncome, zip, city, state, bedrooms]);

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

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="w-full text-left rounded-lg p-5 border-2 border-primary/20 bg-primary/[0.03] hover:border-primary/40 hover:bg-primary/[0.06] transition-all group"
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-11 h-11 rounded-lg bg-primary/10 shrink-0">
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-display text-lg text-foreground mb-0.5 group-hover:text-primary transition-colors">
              Generate Your Negotiation Letter
            </h2>
            <p className="text-sm text-muted-foreground">
              Pre-written with your data — customize tone, counter-offer, and send
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-primary/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
        </div>
      </button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      <div>
        <h2 className="font-display text-xl text-foreground mb-1">Negotiation Letter</h2>
        <p className="text-sm text-muted-foreground">Send this to your landlord</p>
      </div>

      {/* Name inputs */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Your Name</Label>
          <Input
            placeholder="Jane Doe"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-9 font-mono text-sm bg-background"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Landlord / Mgmt</Label>
          <Input
            placeholder="ABC Properties"
            value={landlordName}
            onChange={(e) => setLandlordName(e.target.value)}
            className="h-9 font-mono text-sm bg-background"
          />
        </div>
      </div>

      {/* Tone */}
      <div className="flex gap-2">
        <button
          onClick={() => setTone('friendly')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md border text-xs font-mono transition-colors ${
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
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md border text-xs font-mono transition-colors ${
            tone === 'firm'
              ? 'border-primary bg-primary/5 text-primary'
              : 'border-border text-muted-foreground hover:bg-secondary'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          Firm
        </button>
      </div>

      {/* Counter slider */}
      <div className="space-y-2">
        <Label className="text-xs font-medium">
          Counter: <span className="font-mono text-primary">{counterPct}%</span>
          <span className="text-muted-foreground font-normal ml-1">(${fmt(counterRent)}/mo)</span>
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
          <span>{increasePct}% (accept)</span>
        </div>
      </div>

      {/* Preview */}
      <div className="rounded-md bg-secondary/50 border border-border p-4 max-h-64 overflow-y-auto">
        <pre className="whitespace-pre-wrap font-mono text-xs text-foreground leading-relaxed">
          {letter}
        </pre>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button onClick={handleCopy} variant="default" className="flex-1 gap-1.5 h-9 text-xs rounded-md">
          <Copy className="w-3.5 h-3.5" />
          Copy
        </Button>
        <Button onClick={handleDownload} variant="outline" className="flex-1 gap-1.5 h-9 text-xs rounded-md">
          <Download className="w-3.5 h-3.5" />
          Download
        </Button>
      </div>
    </motion.div>
  );
};

export default NegotiationLetter;
