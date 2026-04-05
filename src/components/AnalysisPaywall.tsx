import { useState, useCallback, useRef, useEffect } from 'react';
import StripeExpressCheckout from './StripeExpressCheckout';
import SocialProofLine from './SocialProofLine';
import { trackEvent } from '@/lib/analytics';

interface AnalysisPaywallProps {
  verdict: 'above' | 'at-market' | 'below' | 'none';
  compsCount: number;
  city: string;
  annualSavings?: number;
  currentRent?: number;
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

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

export default function AnalysisPaywall({
  verdict,
  compsCount,
  city,
  annualSavings,
  currentRent,
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

  /* ── Dream outcome (biggest element) ── */
  const dreamHeadline = isAboveMarket && annualSavings && annualSavings > 0
    ? `Save $${fmt(annualSavings)} on your rent.`
    : isFair && currentRent
    ? `Your landlord would pay $${fmt(Math.round(currentRent * 3))} to replace you.`
    : isBelowMarket && annualSavings && annualSavings < 0
    ? `You're saving $${fmt(Math.abs(annualSavings))} vs. market.`
    : isBelowMarket
    ? 'See exactly how good your deal is.'
    : verdict === 'none'
    ? 'See how your rent compares.'
    : null;

  /* ── Mechanism subheadline ── */
  const mechanism = isAboveMarket
    ? 'Get the exact number to counter with.'
    : isFair
    ? 'See your leverage and get a negotiation letter.'
    : isBelowMarket
    ? `Full breakdown with ${compsCount} nearby comps.`
    : `Full analysis with ${compsCount} nearby comps.`;

  /* ── Value stack ── */
  const stackLine1 = isAboveMarket
    ? `Counter-offer · ${compsCount} comps · Market data`
    : isFair
    ? `${compsCount} comps · Market data · Leverage points`
    : isBelowMarket
    ? `${compsCount} comps · Market data · Full breakdown`
    : `${compsCount} comps · Market data · Trends`;

  const stackLine2 = isAboveMarket
    ? 'Landlord costs · Negotiation letter'
    : isFair
    ? 'Landlord costs · Negotiation letter'
    : isBelowMarket
    ? 'Market comparison · Extension letter'
    : 'Market position · Rent report';

  /* ── Anchor ── */
  const anchor = isAboveMarket || isFair
    ? 'Lawyers charge $225+/hr for lease help. This is $1.99.'
    : 'The full picture for less than a subway swipe.';

  return (
    <div ref={ctaRef} className="rounded-xl border border-border bg-card p-6 sm:p-8 mt-6 max-w-[440px] mx-auto text-center">
      {/* Dream outcome */}
      <p className="text-[22px] sm:text-[26px] font-extrabold text-foreground tracking-tight leading-tight">
        {dreamHeadline}
      </p>

      {/* Mechanism */}
      <p className="text-[14px] font-medium text-muted-foreground mt-1">
        {mechanism}
      </p>

      {/* Value stack */}
      <div className="text-[12px] text-muted-foreground/70 mt-4 space-y-0.5 text-center">
        <p>{stackLine1}</p>
        <p>{stackLine2}</p>
      </div>

      {/* Social proof */}
      <div className="mt-3">
        <SocialProofLine />
      </div>

      {/* Anchor */}
      <p className="text-[11px] text-muted-foreground/50 mt-3">
        {anchor}
      </p>

      {/* Express Checkout */}
      {walletAvailable !== false && (
        <div className="w-full max-w-[320px] mx-auto mt-4 mb-3">
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

      {/* Card fallback */}
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
          : isAboveMarket
          ? 'Get my counter-offer — $1.99'
          : isFair
          ? 'See my leverage — $1.99'
          : 'See my full analysis — $1.99'}
      </button>

      {/* Footer */}
      <p className="text-[11px] text-muted-foreground/50 mt-2">
        One-time. Instant access.
      </p>
    </div>
  );
}
