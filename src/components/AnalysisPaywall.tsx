import { useState, useCallback, useRef, useEffect } from 'react';
import StripeExpressCheckout from './StripeExpressCheckout';
import { trackEvent } from '@/lib/analytics';

interface AnalysisPaywallProps {
  verdict: 'above' | 'at-market' | 'below';
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
  const isBelowMarket = verdict === 'below';

  const headline = isAboveMarket
    ? `Your detailed analysis is ready. See your counter-offer number, ${compsCount} nearby comps, and what it costs your landlord to replace you.`
    : isBelowMarket
    ? 'See exactly how good your deal is.'
    : 'See the comps and market evidence behind your verdict.';

  return (
    <div ref={ctaRef} className="border border-border rounded-lg p-6 mt-6 max-w-[480px] mx-auto text-center">
      <p className="text-[15px] font-semibold text-foreground leading-snug mb-4">
        {headline}
      </p>

      <div className="text-left text-[13px] text-muted-foreground space-y-1.5 max-w-[360px] mx-auto mb-5">
        <ul className="space-y-1.5">
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5">✓</span>
            <span>{compsCount} comparable rents near you</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5">✓</span>
            <span>Your exact counter-offer number and negotiation letter</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5">✓</span>
            <span>What it costs your landlord to replace you</span>
          </li>
        </ul>
      </div>

      <p className="text-[13px] text-muted-foreground mb-4">
        Less than a coffee. Could save you thousands this year.
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
        Your verdict is free. $1.99 unlocks everything.
      </p>
    </div>
  );
}
