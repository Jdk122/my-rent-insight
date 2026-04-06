import { useState, useCallback, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check, Lock } from 'lucide-react';
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

  const handleCardCheckout = useCallback(() => {
    trackEvent('checkout_started', {
      method: 'card_fallback',
      placement: 'analysis_gate',
      verdict: expressCheckoutProps.verdict,
      zip: expressCheckoutProps.zip,
    });
    onCheckout();
  }, [expressCheckoutProps, onCheckout]);

  const isAbove = verdict === 'above';
  const isFair = verdict === 'at-market';
  const isBelow = verdict === 'below';

  // ── Badge ──
  const badge = isAbove ? 'Your Counter-Offer Kit' : 'Your Rent Analysis Kit';

  // ── Headline (NO dollar amounts for above/below — that's gated) ──
  const headline = isAbove
    ? "You're paying more than your neighbors."
    : isFair
    ? `It would cost your landlord $${fmt(turnoverCost || Math.round((currentRent || 1500) * 3))} to replace you.`
    : isBelow
    ? "You're paying less than your neighbors."
    : 'See how your rent stacks up.';

  // ── Subline ──
  const subline = isAbove
    ? 'The data is ready. So is your reply letter.'
    : isFair
    ? 'That number is your leverage. Your reply letter uses it.'
    : isBelow
    ? 'Lock this in before your landlord looks at the market.'
    : `Full market breakdown for ${city}. Ready in seconds.`;

  // ── Agitation (above + at-market only) ──
  const agitation = isAbove && increaseAmount
    ? `Every month you wait, that's another $${fmt(increaseAmount)} gone.`
    : isFair
    ? "Most renters never reply. Landlords know that."
    : null;

  // ── CTA text ──
  const ctaText = isAbove
    ? 'Unlock my counter-offer\u2009—\u2009$4.99'
    : isFair
    ? 'See my leverage\u2009—\u2009$4.99'
    : isBelow
    ? 'See my full breakdown\u2009—\u2009$4.99'
    : 'Unlock full analysis\u2009—\u2009$4.99';

  // ── Value stack ──
  const valueStack = isAbove
    ? [
        { text: `Counter-offer range from ${compsCount} nearby comps`, tag: '($200+ value)' },
        { text: 'Landlord turnover cost breakdown', tag: "(data they don't share)" },
        { text: 'Ready-to-send negotiation reply', tag: '($225+ if a lawyer wrote it)' },
        { text: 'Full market trends and evidence report', tag: '(hours of research, done)' },
      ]
    : [
        { text: `Full comp analysis with ${compsCount} nearby listings`, tag: '($200+ value)' },
        { text: `Market trend breakdown for ${city}`, tag: '(hours of research, done)' },
        { text: 'Landlord turnover cost analysis', tag: '(your hidden leverage)' },
        { text: 'Ready-to-send reply letter', tag: '($225+ if a lawyer wrote it)' },
      ];

  // ── Blurred card data ──
  const card1 = isAbove && counterOfferLow
    ? {
        label: 'YOUR COUNTER',
        value: counterOfferLow === counterOfferHigh
          ? `$${fmt(counterOfferLow)}/mo`
          : `$${fmt(counterOfferLow)}–$${fmt(counterOfferHigh || counterOfferLow)}/mo`,
        sub: `based on ${compsCount} comps`,
        color: 'text-verdict-good',
      }
    : {
        label: 'YOUR POSITION',
        value: currentRent ? `$${fmt(currentRent)}/mo` : '$—/mo',
        sub: medianCompRent ? `vs $${fmt(medianCompRent)} median` : 'vs area median',
        color: 'text-foreground',
      };

  const card2 = {
    label: 'NEARBY COMPS',
    value: `${compsCount} listings`,
    sub: medianCompRent ? `median $${fmt(medianCompRent)}/mo` : 'comparable units',
    color: 'text-foreground',
  };

  return (
    <motion.div
      ref={ctaRef}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="max-w-[480px] mx-auto mt-6 border-t-2 border-primary/20 pt-8"
    >
      {/* ── Badge ── */}
      <div className="text-center">
        <span className="inline-flex items-center px-3 py-1 rounded-full bg-primary/8 text-primary text-[10px] sm:text-[11px] font-semibold uppercase tracking-widest">
          {badge}
        </span>
      </div>

      {/* ── Headline ── */}
      <h2 className="font-display text-[22px] sm:text-[28px] tracking-tight text-foreground leading-tight text-center mt-4">
        {headline}
      </h2>

      {/* ── Subline ── */}
      <p className="text-[14px] sm:text-[15px] text-muted-foreground mt-2 text-center leading-relaxed">
        {subline}
      </p>

      {/* ── Blurred Preview Cards ── */}
      <div className="mt-5 sm:mt-6">
        <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 -mx-2 px-2 sm:grid sm:grid-cols-3 sm:overflow-visible sm:mx-0 sm:px-0 sm:pb-0" role="list">
          {[card1, card2, { label: 'YOUR REPLY', value: null, sub: 'ready to copy and send', color: '' }].map((card, i) => (
            <motion.div
              key={i}
              role="listitem"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 + i * 0.08 }}
              className="min-w-[140px] max-w-[160px] flex-shrink-0 snap-center sm:min-w-0 sm:max-w-none relative overflow-hidden rounded-xl border border-border/60 bg-card p-3 sm:p-4 min-h-[90px] sm:min-h-[100px]"
            >
              {/* Card content — no z-index, normal flow */}
              <div aria-hidden="true">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{card.label}</p>
                {card.value ? (
                  <p className={`font-display text-[20px] font-bold mt-1 ${card.color}`}>{card.value}</p>
                ) : (
                  <div className="mt-2 space-y-2">
                    <div className="h-2 rounded-full bg-muted-foreground/12 w-full" />
                    <div className="h-2 rounded-full bg-muted-foreground/12 w-4/5" />
                    <div className="h-2 rounded-full bg-muted-foreground/12 w-3/5" />
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground mt-1">{card.sub}</p>
              </div>

              {/* Blur overlay — SIBLING, absolute, z-10 on top */}
              <div
                className="absolute inset-0 z-10 flex items-center justify-center bg-card/80 supports-[backdrop-filter]:backdrop-blur-[6px] supports-[backdrop-filter]:bg-card/60"
                aria-hidden="true"
              >
                <Lock className="h-3.5 w-3.5 text-muted-foreground/40" />
              </div>
            </motion.div>
          ))}
        </div>

        {/* Mobile scroll dots */}
        <div className="flex gap-1.5 justify-center mt-2 sm:hidden">
          <div className="w-1.5 h-1.5 rounded-full bg-primary/60" />
          <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/20" />
          <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/20" />
        </div>
      </div>

      {/* ── Commitment hook ── */}
      <p className="mt-5 text-center text-[12px] sm:text-[13px] text-muted-foreground">
        {isAbove ? 'Your counter-offer is ready.' : 'Your analysis is ready.'}
      </p>

      {/* ── Social proof ── */}
      <div className="mt-3 text-center">
        <SocialProofLine />
      </div>

      {/* ── Express Checkout ── */}
      <div className="min-h-[48px] mt-5">
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

      {/* ── Card fallback CTA — ALWAYS visible, NO toggle ── */}
      <div className="mt-3 flex justify-center">
        <button
          onClick={handleCardCheckout}
          disabled={checkoutLoading}
          className={
            walletAvailable
              ? 'min-h-[44px] flex items-center justify-center text-[12px] text-muted-foreground underline'
              : 'w-full max-w-[340px] py-4 rounded-xl text-[15px] font-bold bg-primary text-primary-foreground hover:brightness-95 shadow-md shadow-primary/25 min-h-[48px] disabled:opacity-70'
          }
        >
          {checkoutLoading
            ? 'Opening checkout...'
            : walletAvailable
            ? 'Pay with card instead'
            : ctaText}
        </button>
      </div>

      {/* ── Risk reversal ── */}
      <p className="mt-3 text-center text-[12px] text-muted-foreground">
        Not useful? Email us. Full refund.
      </p>

      {/* ── Trust footer ── */}
      <p className="mt-2 text-center text-[11px] text-muted-foreground/50">
        One-time payment · Instant access · No account needed
      </p>
      <p className="text-center text-[11px] text-muted-foreground/50">
        Secured by Stripe
      </p>

      {/* ── Agitation (mobile: below trust as exit-scroll hook) ── */}
      {agitation && (
        <p className="mt-4 text-center text-[12px] sm:text-[13px] text-muted-foreground/70 italic">
          {agitation}
        </p>
      )}

      {/* ── Value stack (below the fold on mobile) ── */}
      <div className="border-t border-border/40 pt-4 mt-4 space-y-2 pb-4">
        {valueStack.map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.5 + i * 0.05 }}
            className="flex items-start gap-2.5 text-[12px] sm:text-[13px]"
          >
            <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <span className="text-foreground">{item.text}</span>
            <span className="text-muted-foreground/60 ml-auto text-[10px] sm:text-[11px] whitespace-nowrap hidden min-[360px]:inline">
              {item.tag}
            </span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
