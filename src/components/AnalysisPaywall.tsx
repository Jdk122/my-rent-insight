import { useState, useCallback, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Lock } from 'lucide-react';
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
  // New optional props for blurred previews
  counterOfferLow?: number;
  counterOfferHigh?: number;
  medianCompRent?: number;
  newRent?: number;
  marketYoy?: number;
  increasePct?: number;
  turnoverCost?: number;
  increaseAmount?: number;
}

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

/* ── Blurred Preview Card ── */
function BlurredCard({
  label,
  sublabel,
  children,
  delay,
}: {
  label: string;
  sublabel: string;
  children: React.ReactNode;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-xl border border-border/60 bg-card p-3 sm:p-4 relative overflow-hidden"
    >
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <div className="mt-1">{children}</div>
      <p className="text-[11px] text-muted-foreground mt-1">{sublabel}</p>

      {/* Blur overlay with breathing pulse */}
      <motion.div
        aria-hidden="true"
        className="absolute inset-0 backdrop-blur-[6px] bg-card/60 z-10 flex items-center justify-center"
        animate={{ opacity: [0.55, 0.7, 0.55] }}
        transition={{ duration: 3, repeat: Infinity, repeatType: 'reverse' }}
      >
        <Lock size={14} className="text-muted-foreground/40" aria-hidden="true" />
      </motion.div>
    </motion.div>
  );
}

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
  counterOfferLow,
  counterOfferHigh,
  medianCompRent,
  newRent,
  turnoverCost,
  increaseAmount,
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

  /* ── Headlines ── */
  const annualExcess = annualSavings && annualSavings > 0 ? annualSavings : null;
  const headline = (() => {
    if (isAboveMarket && increaseAmount && increaseAmount > 0) {
      return (
        <>
          Your landlord is asking for{' '}
          <span className="text-destructive">${fmt(increaseAmount * 12)}/yr</span>{' '}
          more than the market supports.
        </>
      );
    }
    if (isFair && turnoverCost) {
      return (
        <>
          Your landlord would lose{' '}
          <span className="font-bold text-foreground">${fmt(turnoverCost)}</span>{' '}
          if you left.
        </>
      );
    }
    if (isBelowMarket && annualSavings && annualSavings < 0) {
      return (
        <>
          You're paying{' '}
          <span className="text-verdict-good">${fmt(Math.abs(annualSavings))}</span>{' '}
          less than your neighbors.
        </>
      );
    }
    return <>See exactly how your rent compares to {compsCount} nearby listings.</>;
  })();

  const subline = isAboveMarket
    ? "Here's the data to negotiate it down."
    : isFair
    ? "Here's how to use that as leverage."
    : isBelowMarket
    ? "Here's how to lock in this rate."
    : `Full market breakdown for ${city}.`;

  /* ── Button text ── */
  const ctaText = isAboveMarket
    ? 'Unlock my counter-offer — $1.99'
    : isFair
    ? 'See my leverage — $1.99'
    : isBelowMarket
    ? 'See my full breakdown — $1.99'
    : 'Unlock full analysis — $1.99';

  const showTurnoverCallout = (isAboveMarket || isFair) && turnoverCost && turnoverCost > 0;

  return (
    <motion.div
      ref={ctaRef}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="max-w-[480px] mx-auto mt-6 border-t-2 border-primary/20 pt-8"
    >
      {/* ── Headline ── */}
      <h3 className="font-display text-[24px] sm:text-[28px] tracking-tight text-foreground leading-tight">
        {headline}
      </h3>
      <p className="text-[15px] text-muted-foreground mt-2 leading-relaxed">
        {subline}
      </p>

      {/* ── Blurred Preview Cards ── */}
      <div className="grid grid-cols-1 min-[400px]:grid-cols-3 gap-2 min-[400px]:gap-3 mt-6">
        {/* Card 1 */}
        {isAboveMarket && counterOfferLow ? (
          <BlurredCard label="YOUR COUNTER" sublabel={`based on ${compsCount} comps`} delay={0}>
            <p className="font-display text-[22px] text-verdict-good font-bold">
              ${fmt(counterOfferLow)} – ${fmt(counterOfferHigh ?? counterOfferLow)}
            </p>
          </BlurredCard>
        ) : (
          <BlurredCard label="YOUR POSITION" sublabel={medianCompRent ? `vs $${fmt(medianCompRent)} median` : `${compsCount} comps`} delay={0}>
            <p className={`font-display text-[22px] font-bold ${isFair ? 'text-verdict-fair' : isBelowMarket ? 'text-verdict-good' : 'text-foreground'}`}>
              {currentRent ? `$${fmt(currentRent)}/mo` : '—'}
            </p>
          </BlurredCard>
        )}

        {/* Card 2 — Nearby Comps */}
        <BlurredCard label="NEARBY COMPS" sublabel={medianCompRent ? `median $${fmt(medianCompRent)}/mo` : 'local data'} delay={0.08}>
          <p className="font-display text-[22px] text-foreground font-bold">
            {compsCount} listings
          </p>
        </BlurredCard>

        {/* Card 3 — Reply Letter */}
        <BlurredCard label="YOUR REPLY" sublabel="ready to send" delay={0.16}>
          <div className="space-y-2 py-1">
            <div className="h-2.5 rounded-full bg-muted-foreground/15 w-full" />
            <div className="h-2.5 rounded-full bg-muted-foreground/15 w-4/5" />
            <div className="h-2.5 rounded-full bg-muted-foreground/15 w-3/5" />
          </div>
        </BlurredCard>
      </div>

      {/* ── Turnover Cost Callout ── */}
      {showTurnoverCallout && (
        <div className="mt-5 px-4 py-3 rounded-lg bg-[hsl(var(--highlight-bg))] border-l-[3px] border-l-primary/40">
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            Replacing you would cost your landlord an estimated{' '}
            <span className="font-semibold text-foreground">${fmt(turnoverCost!)}</span>.
            That's why a data-backed reply works: they'd rather negotiate than pay to find someone new.
          </p>
        </div>
      )}

      {/* ── Social Proof ── */}
      <div className="mt-5 text-center">
        <SocialProofLine />
      </div>

      {/* ── CTA Section ── */}
      <div className="mt-6">
        {/* Express Checkout */}
        {walletAvailable !== false && (
          <div className="w-full max-w-[340px] mx-auto mb-3">
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
          className={`w-full max-w-[340px] mx-auto block py-4 rounded-xl text-[15px] font-bold transition-all disabled:opacity-70 ${
            walletAvailable
              ? 'bg-foreground/80 text-background hover:bg-foreground/90 transition-colors'
              : 'bg-primary text-primary-foreground hover:brightness-95 shadow-md shadow-primary/25'
          }`}
        >
          {checkoutLoading ? 'Opening checkout...' : ctaText}
        </button>
      </div>

      {/* ── Trust Footer ── */}
      <div className="mt-3 text-center space-y-1">
        <p className="text-[12px] text-muted-foreground">
          One-time payment. Instant access. No account needed.
        </p>
        <p className="text-[11px] text-muted-foreground/50">
          Powered by Stripe. 100% secure.
        </p>
      </div>
    </motion.div>
  );
}
