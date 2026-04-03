import { useRef, useEffect, useState, useCallback } from 'react';
import { trackEvent } from '@/lib/analytics';
import SocialProofLine from './SocialProofLine';
import StripeExpressCheckout from './StripeExpressCheckout';

interface LetterPitchCardProps {
  isAboveMarket: boolean;
  isFair: boolean;
  isBelowMarket: boolean;
  increaseAmount: number;
  compsCount: number;
  verdict: string;
  zip: string;
  city: string;
  onCheckout: () => void;
  checkoutLoading: boolean;
  onPaid?: () => void;
  analysisId?: string | null;
  savings: number;
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
  onCheckout,
  checkoutLoading,
  onPaid,
  analysisId,
  savings,
}: LetterPitchCardProps) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const impressionTracked = useRef(false);
  const [walletAvailable, setWalletAvailable] = useState<boolean | null>(null);

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

  const handleFallback = useCallback(() => {
    setWalletAvailable(false);
  }, []);

  const handleWalletSuccess = useCallback(() => {
    onPaid?.();
  }, [onPaid]);

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
    ? 'Lower my rent today — $4.99'
    : isFair
    ? 'Get my letter today — $4.99'
    : 'Keep my rent low — $4.99';

  const secondaryCtaText = 'Or pay with card — $4.99';

  return (
    <div
      ref={cardRef}
      className="w-full max-w-[540px] rounded-lg border border-border border-l-[3px] border-l-verdict-good bg-secondary/50 px-4 py-3 mt-4"
    >
      <p className="text-[17px] font-bold text-foreground text-left tracking-[-0.02em]">{headline}</p>
      <p className="text-[12px] text-muted-foreground mt-2 leading-relaxed text-left">
        {subtext}{' '}
        <span className="text-muted-foreground/60"><SocialProofLine inline /></span>
      </p>

      {/* Express Checkout (wallet buttons) */}
      {walletAvailable !== false && (
        <div className="mt-3">
          <StripeExpressCheckout
            onSuccess={handleWalletSuccess}
            onFallbackToRedirect={handleFallback}
            analysisId={analysisId}
            verdict={verdict}
            zip={zip}
            city={city}
            savings={savings}
          />
        </div>
      )}

      {/* Primary CTA when no wallets, secondary when wallets available */}
      <button
        onClick={onCheckout}
        disabled={checkoutLoading}
        className={`w-full mt-3 py-4 rounded-lg text-[14px] font-semibold transition-all disabled:opacity-70 ${
          walletAvailable === false
            ? 'bg-primary text-primary-foreground hover:brightness-95 shadow-sm shadow-primary/20'
            : walletAvailable === null
            ? 'bg-primary text-primary-foreground hover:brightness-95 shadow-sm shadow-primary/20'
            : 'border border-border bg-background text-foreground hover:bg-muted text-[13px]'
        }`}
      >
        {checkoutLoading
          ? 'Opening checkout...'
          : walletAvailable
          ? secondaryCtaText
          : ctaText}
      </button>

      <p className="text-[10px] text-muted-foreground/40 text-left mt-1.5">
        Apple Pay · Google Pay · Card
      </p>

      <p className="text-[11px] text-muted-foreground/50 text-left mt-1">
        <button
          type="button"
          onClick={() => document.getElementById('section-evidence')?.scrollIntoView({ behavior: 'smooth' })}
          className="hover:underline cursor-pointer"
        >
          Continue with free verdict and comps
        </button>
      </p>
    </div>
  );
};

export default LetterPitchCard;
