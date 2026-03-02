import { toast } from 'sonner';
import { LandlordCostEstimate } from '@/data/landlordCosts';

interface ShareSectionProps {
  increasePct: number;
  marketPct: number;
  excessAnnual: number;
  multiplier: number;
  landlordCosts?: LandlordCostEstimate | null;
  increaseAmount?: number;
  isPath1?: boolean;
  marketMultiple?: number;
}

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

const ShareSection = ({ increasePct, marketPct, excessAnnual, multiplier, landlordCosts, increaseAmount, isPath1 = true, marketMultiple }: ShareSectionProps) => {
  const shareText = isPath1 && landlordCosts && increaseAmount
    ? `My landlord's costs went up $${fmt(landlordCosts.monthlyCostIncrease)}/month but they're raising my rent $${fmt(increaseAmount)}/month. RenewalReply showed me the math.`
    : !isPath1 && marketMultiple
    ? `My landlord is asking for ${marketMultiple}× the market rate increase. The market moved ${marketPct}% but they want ${increasePct}%. Check yours at RenewalReply.`
    : `My landlord is raising my rent ${increasePct}% when the market only moved ${marketPct}%. That's $${fmt(excessAnnual)}/year above what the market justifies.`;
  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const fullText = `${shareText} Check yours: ${shareUrl}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(fullText);
    toast.success('Copied to clipboard');
  };

  return (
    <div>
      <p className="text-[13px] text-muted-foreground mb-1">Know a friend dealing with a rent increase?</p>
      <p className="text-[13px] text-muted-foreground mb-3">Send them their free negotiation letter.</p>
      <button
        onClick={handleCopy}
        className="inline-flex items-center gap-2 px-5 py-2.5 border border-border rounded text-[13px] font-medium text-muted-foreground hover:border-foreground hover:text-foreground transition-colors"
      >
        📋 Copy link to share
      </button>
    </div>
  );
};

export default ShareSection;
