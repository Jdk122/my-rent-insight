import { useRef, useEffect } from 'react';
import { trackEvent } from '@/lib/analytics';
import SocialProofLine from './SocialProofLine';

interface LetterPitchCardProps {
  isAboveMarket: boolean;
  isFair: boolean;
  isBelowMarket: boolean;
  increaseAmount: number;
  compsCount: number;
  verdict: string;
  zip: string;
  city: string;
}

const LetterPitchCard = ({
  isAboveMarket,
  isFair,
  isBelowMarket,
  increaseAmount,
  compsCount,
  verdict,
  zip,
  city,
}: LetterPitchCardProps) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const impressionTracked = useRef(false);

  const savings = increaseAmount * 12;

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !impressionTracked.current) {
          impressionTracked.current = true;
          trackEvent('toolkit_impression', { verdict, savings, zip });
          observer.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [verdict, savings, zip]);

  const headline = isAboveMarket
    ? `Your landlord wants $${(increaseAmount * 12).toLocaleString()} more this year`
    : isFair
    ? 'Your increase tracks the market — but you can still negotiate'
    : 'You\'re paying less than your neighbors';

  const subtext = isAboveMarket
    ? 'See the evidence below — then get the exact reply to send.'
    : isFair
    ? 'See what other renters near you are paying.'
    : 'See how your rent compares — and how to keep it that way.';

  return (
    <div
      ref={cardRef}
      className="w-full max-w-[540px] rounded-lg border border-border border-t-[2px] border-t-primary/30 bg-secondary/50 px-4 py-3 mt-4"
    >
      <p className="text-[18px] font-bold text-foreground text-left tracking-tight">{headline}</p>
      <p className="text-[13px] text-muted-foreground mt-1 text-left">{subtext}</p>

      <div className="mt-2 text-[11px] text-muted-foreground/60 text-left">
        <SocialProofLine />
      </div>

      <button
        onClick={() => document.getElementById('section-evidence')?.scrollIntoView({ behavior: 'smooth' })}
        className="w-full mt-3 py-3.5 rounded-lg bg-primary text-primary-foreground text-[14px] font-semibold hover:brightness-95 transition-all shadow-sm shadow-primary/20"
      >
        See the evidence ↓
      </button>

    </div>
  );
};

export default LetterPitchCard;
