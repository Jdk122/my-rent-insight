import { toast } from 'sonner';
import { Copy, Twitter } from 'lucide-react';

interface ShareSectionProps {
  increasePct: number;
  marketPct: number;
  excessAnnual: number;
  multiplier: number;
}

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

const ShareSection = ({ increasePct, marketPct, excessAnnual, multiplier }: ShareSectionProps) => {
  const shareText = `My landlord is raising my rent ${increasePct}% when the market only moved ${marketPct}%. That's ${multiplier}× the market rate — $${fmt(excessAnnual)}/year above market.`;
  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

  const handleCopy = () => {
    navigator.clipboard.writeText(`${shareText} Check yours: ${shareUrl}`);
    toast.success('Copied to clipboard');
  };

  const handleTwitter = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${shareText} Check yours:`)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="flex items-center gap-3">
      <p className="text-xs text-muted-foreground italic flex-1 min-w-0 line-clamp-2 leading-relaxed">
        "{shareText}"
      </p>
      <div className="flex gap-1.5 shrink-0">
        <button
          onClick={handleCopy}
          className="h-8 w-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          title="Copy"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleTwitter}
          className="h-8 w-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          title="Share on X"
        >
          <Twitter className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default ShareSection;
