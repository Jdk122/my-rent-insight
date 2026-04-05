import { useState, useCallback, useRef, useEffect } from 'react';
import StripeExpressCheckout from './StripeExpressCheckout';
import { trackEvent } from '@/lib/analytics';

interface AnalysisPaywallProps {
  verdict: 'above' | 'at-market' | 'below' | 'none';
  compsCount: number;
  city: string;
  onCheckout: () => void;
  checkoutLoading: boolean;
  onPaid?: (email?: string) => void;
  expressCheckoutProps: {
    analysisId?: string | null;
    verdict: string;
    zip: string;
    city: string;
    savings: number;
  };
}

export default function AnalysisPaywall({
  verdict,
  compsCount,
  city,
  onCheckout,
  checkoutLoading,
  onPaid,
  expressCheckoutProps,
}: AnalysisPaywallProps) {
  const [walletAvailable, setWalletAvailable] = useState<boolean | null>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const impressionTracked = useRef(false);

  useEffect(() => {
    const el = ctaRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !impressionTracked.current) {
          impressionTracked.current = true;
          trackEvent('analysis_paywall_impression', {
            verdict: expressCheckoutProps.verdict,
            placement: 'analysis_gate',
            zip: expressCheckoutProps.zip,
          });
          observer.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [expressCheckoutProps]);

  const handleFallback = useCallback(() => {
    setWalletAvailable(false);
  }, []);

  const handleWalletReady = useCallback(() => {
    setWalletAvailable(true);
  }, []);

  const handleWalletSuccess = useCallback((email?: string) => {
    onPaid?.(email);
  }, [onPaid]);

  const isAboveMarket = verdict === 'above';
  const isFair = verdict === 'at-market';
  const isBelowMarket = verdict === 'below';

  const headline = isAboveMarket
    ? 'Get the exact number to counter with.'
    : isFair
    ? 'See the evidence. Know for sure.'
    : isBelowMarket
    ? "See how much you're saving."
    : 'See how your rent compares.';

  const subtext = isAboveMarket
    ? `Counter-offer · ${compsCount} comps · Negotiation letter`
    : isFair
    ? `Market proof · ${compsCount} comps · Negotiation letter`
    : isBelowMarket
    ? `Full breakdown · ${compsCount} comps · Market comparison`
    : `Market data · ${compsCount} comps · Neighborhood trends`;

  const anchor = isAboveMarket || isFair
    ? 'Lawyers charge $225+/hr for lease help. This is $1.99.'
    : 'The full picture for less than a subway swipe.';

  return (
    <div ref={ctaRef} className="border border-border rounded-lg p-6 mt-6 max-w-[480px] mx-auto text-center">
      <p className="text-[15px] font-semibold text-foreground leading-snug">
        {headline}
      </p>

      <p className="text-[13px] text-muted-foreground mt-1.5 mb-4">
        {subtext}
      </p>

      <p className="text-[12px] text-muted-foreground/70 mb-5">
        {anchor}
      </p>

      {/* Express Checkout wallet buttons */}
      {walletAvailable !== false && (
        <div className="w-full max-w-[320px] mx-auto mb-3">
          <StripeExpressCheckout
            onSuccess={handleWalletSuccess}
            onFallbackToRedirect={handleFallback}
            onReady={handleWalletReady}
            analysisId={expressCheckoutProps.analysisId}
            verdict={expressCheckoutProps.verdict}
            zip={expressCheckoutProps.zip}
            city={expressCheckoutProps.city}
            savings={expressCheckoutProps.savings}
            placement="analysis_gate"
          />
        </div>
      )}

      {/* Card payment fallback */}
      <button
        onClick={() => {
          trackEvent('checkout_started', {
            method: 'card_fallback',
            placement: 'analysis_gate',
            verdict: expressCheckoutProps.verdict,
            zip: expressCheckoutProps.zip,
          });
          onCheckout();
        }}
        disabled={checkoutLoading}
        className={`w-full max-w-[320px] mx-auto py-3.5 rounded-lg text-[14px] font-semibold transition-all disabled:opacity-70 ${
          walletAvailable
            ? 'bg-foreground/80 text-background hover:bg-foreground/90 transition-colors'
            : 'bg-primary text-primary-foreground hover:brightness-95 shadow-sm shadow-primary/20'
        }`}
      >
        {checkoutLoading
          ? 'Opening checkout...'
          : walletAvailable
          ? 'Or pay with card — $1.99'
          : 'Unlock full analysis — $1.99'}
      </button>

      <p className="text-[11px] text-muted-foreground/60 text-center mt-3">
        One-time. Instant access.
      </p>
    </div>
  );
}
