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
  onCheckout: () => void;
  checkoutLoading: boolean;
}

const LetterPitchCard = ({
  isAboveMarket,
  isFair,
  isBelowMarket,
  increaseAmount,
  compsCount,
  verdict,
  zip,
  onCheckout,
  checkoutLoading,
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
    ? `You're on track to overpay $${savings.toLocaleString()} this year`
    : isFair
    ? 'You can still push back on this increase'
    : "You're paying less than people nearby. Keep it that way.";

  const subtext = isAboveMarket
    ? `Your letter gives you exactly what to say, using ${compsCount} rent${compsCount !== 1 ? 's' : ''} near you.`
    : isFair
    ? 'Your letter gives you exactly what to say.'
    : 'Use this letter to ask for a longer renewal or extra perks.';

  const ctaText = isAboveMarket
    ? 'Lower my rent tonight — $4.99'
    : isFair
    ? 'Get my letter — $4.99'
    : 'Keep my rent low — $4.99';

  return (
    <div
      ref={cardRef}
      className="w-full max-w-[540px] rounded-lg border border-border border-l-[3px] border-l-green-500 bg-secondary/50 px-4 py-4 mt-4"
    >
      <p className="text-[15px] font-semibold text-foreground">{headline}</p>
      <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed">{subtext}</p>

      <button
        onClick={onCheckout}
        disabled={checkoutLoading}
        className="w-full mt-3 py-3.5 rounded-lg bg-primary text-primary-foreground text-[14px] font-semibold hover:brightness-95 transition-all disabled:opacity-70"
      >
        {checkoutLoading ? 'Opening checkout...' : ctaText}
      </button>

      <p className="text-[11px] text-muted-foreground/60 text-center mt-1.5">
        Apple Pay · Google Pay · Card
      </p>

      <p className="text-[11px] text-muted-foreground text-center mt-2">
        <button
          type="button"
          onClick={() => document.getElementById('section-evidence')?.scrollIntoView({ behavior: 'smooth' })}
          className="hover:underline cursor-pointer"
        >
          Continue with free verdict and comps
        </button>
      </p>

      <div className="mt-2">
        <SocialProofLine />
      </div>
    </div>
  );
};

export default LetterPitchCard;
