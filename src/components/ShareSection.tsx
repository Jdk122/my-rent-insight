import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Copy, Share2 } from 'lucide-react';

interface ShareSectionProps {
  diff: number;
  annualDiff: number;
  isOverpaying: boolean;
}

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

const ShareSection = ({ diff, annualDiff, isOverpaying }: ShareSectionProps) => {
  const shareText = isOverpaying
    ? `I just found out I'm overpaying $${fmt(Math.abs(annualDiff))}/year for my apartment.`
    : `I just found out I'm saving $${fmt(Math.abs(annualDiff))}/year on rent.`;

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
    <div className="flex items-center justify-between gap-4 px-1">
      <p className="text-sm text-muted-foreground italic flex-1 min-w-0 truncate">
        "{shareText}"
      </p>
      <div className="flex gap-2 shrink-0">
        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1.5 rounded-md border border-border hover:bg-secondary"
        >
          <Copy className="w-3 h-3" />
          Copy
        </button>
        <button
          onClick={handleTwitter}
          className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1.5 rounded-md border border-border hover:bg-secondary"
        >
          <Share2 className="w-3 h-3" />
          Share
        </button>
      </div>
    </div>
  );
};

export default ShareSection;
