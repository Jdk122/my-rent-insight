import { toast } from 'sonner';
import { Copy, Twitter, MessageCircle, Share2 } from 'lucide-react';
import { LandlordCostEstimate } from '@/data/landlordCosts';

interface ShareSectionProps {
  increasePct: number;
  marketPct: number;
  excessAnnual: number;
  multiplier: number;
  landlordCosts?: LandlordCostEstimate | null;
  increaseAmount?: number;
}

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

const ShareSection = ({ increasePct, marketPct, excessAnnual, multiplier, landlordCosts, increaseAmount }: ShareSectionProps) => {
  const shareText = landlordCosts && increaseAmount
    ? `My landlord's costs went up $${fmt(landlordCosts.monthlyCostIncrease)}/month but they're raising my rent $${fmt(increaseAmount)}/month. RentCheck showed me the math.`
    : `My landlord is raising my rent ${increasePct}% when the market only moved ${marketPct}%. That's ${multiplier}× the market rate — $${fmt(excessAnnual)}/year above market.`;
  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const fullText = `${shareText} Check yours: ${shareUrl}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(fullText);
    toast.success('Copied to clipboard');
  };

  const handleTwitter = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${shareText} Check yours:`)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(url, '_blank');
  };

  const handleReddit = () => {
    const url = `https://www.reddit.com/submit?title=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(url, '_blank');
  };

  const handleText = () => {
    const url = `sms:?body=${encodeURIComponent(fullText)}`;
    window.open(url);
  };

  const btnClass = "flex-1 flex items-center justify-center gap-2 h-10 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors";

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-3">
        Think others should see this?
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <button onClick={handleCopy} className={btnClass}>
          <Copy className="w-4 h-4" />
          Copy
        </button>
        <button onClick={handleTwitter} className={btnClass}>
          <Twitter className="w-4 h-4" />
          Post on X
        </button>
        <button onClick={handleReddit} className={btnClass}>
          <Share2 className="w-4 h-4" />
          Reddit
        </button>
        <button onClick={handleText} className={btnClass}>
          <MessageCircle className="w-4 h-4" />
          Text
        </button>
      </div>
    </div>
  );
};

export default ShareSection;
