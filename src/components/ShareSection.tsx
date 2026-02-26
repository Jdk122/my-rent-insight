import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface ShareSectionProps {
  diff: number;
  annualDiff: number;
  isOverpaying: boolean;
}

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

const ShareSection = ({ diff, annualDiff, isOverpaying }: ShareSectionProps) => {
  const shareText = isOverpaying
    ? `I just found out I'm overpaying $${fmt(Math.abs(annualDiff))}/year for my apartment. Check yours:`
    : `I just found out I'm saving $${fmt(Math.abs(annualDiff))}/year on rent. Check yours:`;

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

  const handleCopy = () => {
    navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
    toast.success('Copied to clipboard!');
  };

  const handleTwitter = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(url, '_blank');
  };

  const handleFacebook = () => {
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="stat-card text-center space-y-4">
      <p className="text-sm text-muted-foreground italic">"{shareText}"</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button variant="outline" size="sm" onClick={handleCopy}>
          📋 Copy
        </Button>
        <Button variant="outline" size="sm" onClick={handleTwitter}>
          𝕏 Share on X
        </Button>
        <Button variant="outline" size="sm" onClick={handleFacebook}>
          📘 Share on Facebook
        </Button>
      </div>
    </div>
  );
};

export default ShareSection;
