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
  onPaid?: (email?: string) => void;
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
    ? `Overpaying $${(increaseAmount * 12).toLocaleString()}/yr`
    : isFair
    ? 'You can still push back'
    : 'Paying less than neighbors — keep it that way';

  const subtext = isAboveMarket
    ? `Uses ${compsCount} rent${compsCount !== 1 ? 's' : ''} near you. Ready before you reply.`
    : isFair
    ? 'Your letter gives you exactly what to say.'
    : 'Ask for a longer lease or extra perks.';

  const ctaText = isAboveMarket
    ? 'Get the exact reply to send — $4.99'
    : isFair
    ? 'Get my reply — $4.99'
    : 'Keep my rent low — $4.99';

  const secondaryCtaText = 'Or pay with card — $4.99';

  return (
    <div
      ref={cardRef}
      className="w-full max-w-[540px] rounded-lg border border-border border-l-[3px] border-l-verdict-good bg-secondary/50 px-4 py-3 mt-4"
    >
      <p className="text-[18px] font-bold text-foreground text-left tracking-tight">{headline}</p>
      <p className="text-[13px] text-muted-foreground mt-1 text-left">{subtext}</p>
      {isAboveMarket && (
        <p className="text-[12px] text-muted-foreground italic mt-1 text-left">
          The worst they can say is no. The best? You save ${(increaseAmount * 12).toLocaleString()}.
        </p>
      )}
      <div className="mt-2 text-[11px] text-muted-foreground/60 text-left">
        <SocialProofLine />
      </div>

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
