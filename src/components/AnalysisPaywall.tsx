import { useState, useCallback, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Lock, Check } from 'lucide-react';
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

/* ── Blurred Preview Card ── */
function BlurredCard({ children, delay }: { children: React.ReactNode; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-xl border border-border/60 bg-card p-3 sm:p-4 relative overflow-hidden min-h-[90px] sm:min-h-[100px] min-w-[140px] max-w-[160px] sm:max-w-none sm:min-w-0 flex-shrink-0 snap-center"
      role="listitem"
    >
      {children}
      {/* Blur overlay */}
      <motion.div
        aria-hidden="true"
        className="absolute inset-0 z-10 flex items-center justify-center bg-card/80 supports-[backdrop-filter]:backdrop-blur-[6px] supports-[backdrop-filter]:bg-card/60"
        animate={{ opacity: [0.55, 0.72, 0.55] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Lock size={14} className="text-muted-foreground/40" aria-hidden="true" />
      </motion.div>
    </motion.div>
  );
}

/* ── Value Stack Line ── */
function StackLine({ text, tag, delay }: { text: string; tag: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay, ease: [0.16, 1, 0.3, 1] }}
      className="flex items-center gap-2.5 text-[12px] sm:text-[13px]"
    >
      <Check size={16} className="text-primary shrink-0" />
      <span className="text-foreground">{text}</span>
      <span className="text-muted-foreground/60 ml-auto text-[10px] sm:text-[11px] whitespace-nowrap hidden min-[360px]:inline">{tag}</span>
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
  marketYoy,
  increasePct,
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

  // ── Offer badge ──
  const badgeText = isAboveMarket ? 'Your Counter-Offer Kit' : 'Your Rent Analysis Kit';

  // ── Headline ──
  const headline = (() => {
    if (isAboveMarket && annualSavings && annualSavings > 0) {
      return (
        <>You're paying <span className="text-destructive font-bold">${fmt(annualSavings)}/yr</span> more than the market supports.</>
      );
    }
    if (isAboveMarket) {
      return <>{compsCount} apartments near you rent for less than your proposed rent.</>;
    }
    if (isFair && turnoverCost) {
      return (
        <>It would cost your landlord <span className="font-bold text-foreground">${fmt(turnoverCost)}</span> to replace you.</>
      );
    }
    if (isBelowMarket && annualSavings) {
      return (
        <>You're paying <span className="text-verdict-good font-bold">${fmt(Math.abs(annualSavings))}</span> less than your neighbors this year.</>
      );
    }
    if (isBelowMarket) {
      return <>You're getting a better deal than most renters in {city}.</>;
    }
    return <>See how your rent compares to {compsCount} nearby listings.</>;
  })();

  // ── Subline ──
  const subline = isAboveMarket
    ? "Here's the data to negotiate it down — and the exact reply to send."
    : isFair
    ? "Here's how to use that as leverage in your renewal conversation."
    : isBelowMarket
    ? "Here's how to lock in this rate before your landlord catches on."
    : `Full market breakdown for ${city}, ready in seconds.`;

  // ── Agitation ──
  const agitationLine = isAboveMarket && increaseAmount
    ? `Every month without a reply is another $${fmt(increaseAmount)} your landlord keeps.`
    : isFair
    ? "Most renters don't reply. That's what landlords count on."
    : null;

  // ── Value stack ──
  const stackLines = isAboveMarket
    ? [
        { text: `Counter-offer range from ${compsCount} nearby comps`, tag: '($200+ value)' },
        { text: 'Landlord turnover cost breakdown', tag: "(data they don't share)" },
        { text: 'Ready-to-send negotiation reply', tag: '($225+ if a lawyer wrote it)' },
        { text: 'Full market trends + evidence report', tag: '(hours of research, done)' },
      ]
    : [
        { text: `Full comp analysis with ${compsCount} nearby listings`, tag: '($200+ value)' },
        { text: `Market trend breakdown for ${city}`, tag: '(hours of research, done)' },
        { text: 'Landlord turnover cost analysis', tag: '(your hidden leverage)' },
        { text: 'Ready-to-send reply letter', tag: '($225+ if a lawyer wrote it)' },
      ];

  // ── Commitment hook ──
  const commitmentText = isAboveMarket
    ? 'You've already done the hard part. Your counter-offer is ready.'
    : 'You've already done the hard part. Your analysis is ready.';

  // ── CTA text ──
  const ctaText = isAboveMarket
    ? 'Unlock my counter-offer — $1.99'
    : isFair
    ? 'See my leverage — $1.99'
    : isBelowMarket
    ? 'See my full breakdown — $1.99'
    : 'Unlock full analysis — $1.99';

  // Card stagger base delay
  const cardBase = 0.15;
  const stackBase = cardBase + 0.08 * 3 + 0.3;

  return (
    <motion.div
      ref={ctaRef}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="max-w-[480px] mx-auto mt-6 border-t-2 border-primary/20 pt-8"
    >
      {/* Badge */}
      <div className="text-center">
        <span className="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] sm:text-[11px] font-semibold uppercase tracking-widest">
          {badgeText}
        </span>
      </div>

      {/* Headline */}
      <p className="font-display text-[22px] sm:text-[28px] tracking-tight text-foreground leading-tight text-center mt-4">
        {headline}
      </p>

      {/* Subline */}
      <p className="text-[14px] sm:text-[15px] text-muted-foreground mt-2 text-center leading-relaxed">
        {subline}
      </p>

      {/* Agitation — desktop: here, mobile: after trust footer */}
      {agitationLine && (
        <p className="hidden sm:block text-[13px] text-muted-foreground/70 mt-4 text-center italic">
          {agitationLine}
        </p>
      )}

      {/* Blurred Preview Cards */}
      {/* Mobile: horizontal scroll */}
      <div className="sm:hidden mt-5" role="list">
        <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 -mx-2 px-2">
          <PreviewCard1
            verdict={verdict}
            counterOfferLow={counterOfferLow}
            counterOfferHigh={counterOfferHigh}
            compsCount={compsCount}
            currentRent={currentRent}
            medianCompRent={medianCompRent}
            delay={cardBase}
          />
          <PreviewCard2 compsCount={compsCount} medianCompRent={medianCompRent} delay={cardBase + 0.08} />
          <PreviewCard3 delay={cardBase + 0.16} />
        </div>
        {/* Scroll dots */}
        <div className="flex gap-1.5 justify-center mt-2">
          <div className="w-1.5 h-1.5 rounded-full bg-primary/60" />
          <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/20" />
          <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/20" />
        </div>
      </div>

      {/* Desktop: grid */}
      <div className="hidden sm:grid grid-cols-3 gap-3 mt-6" role="list">
        <PreviewCard1
          verdict={verdict}
          counterOfferLow={counterOfferLow}
          counterOfferHigh={counterOfferHigh}
          compsCount={compsCount}
          currentRent={currentRent}
          medianCompRent={medianCompRent}
          delay={cardBase}
        />
        <PreviewCard2 compsCount={compsCount} medianCompRent={medianCompRent} delay={cardBase + 0.08} />
        <PreviewCard3 delay={cardBase + 0.16} />
      </div>

      {/* Value Stack — desktop: here, mobile: below CTA */}
      <div className="hidden sm:block mt-6 space-y-2">
        {stackLines.map((line, i) => (
          <StackLine key={i} text={line.text} tag={line.tag} delay={stackBase + i * 0.05} />
        ))}
      </div>

      {/* Commitment hook */}
      <p className="mt-5 text-center text-[12px] sm:text-[13px] text-muted-foreground">
        {commitmentText}
      </p>

      {/* Social proof */}
      <div className="mt-3 text-center">
        <SocialProofLine />
      </div>

      {/* Express Checkout */}
      <div className="mt-5">
        {walletAvailable !== false && (
          <div className="w-full max-w-[340px] mx-auto min-h-[48px]">
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

        {/* Card fallback — mobile: text link when wallet available, button when not */}
        {walletAvailable ? (
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
            className="w-full sm:max-w-[340px] mx-auto block min-h-[44px] sm:min-h-0 sm:py-3.5 sm:mt-2 sm:rounded-xl sm:text-[15px] sm:font-bold sm:bg-foreground/80 sm:text-background sm:hover:bg-foreground/90 sm:transition-all sm:disabled:opacity-70
              text-[12px] text-muted-foreground underline flex items-center justify-center sm:no-underline"
          >
            <span className="sm:hidden">{checkoutLoading ? 'Opening checkout...' : 'Pay with card instead'}</span>
            <span className="hidden sm:inline">{checkoutLoading ? 'Opening checkout...' : `Or pay with card — $1.99`}</span>
          </button>
        ) : (
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
            className="w-full max-w-[340px] mx-auto block py-4 rounded-xl text-[15px] font-bold transition-all disabled:opacity-70 min-h-[48px]
              bg-primary text-primary-foreground hover:brightness-95 shadow-md shadow-primary/25"
          >
            {checkoutLoading ? 'Opening checkout...' : ctaText}
          </button>
        )}
      </div>

      {/* Risk reversal */}
      <p className="mt-3 text-center text-[12px] text-muted-foreground">
        Not useful? Reply to your receipt for a full refund.
      </p>

      {/* Trust footer */}
      <div className="mt-2 text-center text-[11px] text-muted-foreground/50 pb-4">
        <p>One-time payment · Instant access · No account needed</p>
        <p>Secured by Stripe</p>
      </div>

      {/* Agitation — mobile: below trust footer */}
      {agitationLine && (
        <p className="sm:hidden text-[12px] text-muted-foreground/70 mt-2 text-center italic">
          {agitationLine}
        </p>
      )}

      {/* Value stack — mobile: below fold */}
      <div className="sm:hidden border-t border-border/40 pt-4 mt-4 space-y-2">
        {stackLines.map((line, i) => (
          <StackLine key={i} text={line.text} tag={line.tag} delay={0} />
        ))}
      </div>
    </motion.div>
  );
}

/* ── Preview Card Sub-components ── */

function PreviewCard1({
  verdict, counterOfferLow, counterOfferHigh, compsCount, currentRent, medianCompRent, delay,
}: {
  verdict: string; counterOfferLow?: number; counterOfferHigh?: number;
  compsCount: number; currentRent?: number; medianCompRent?: number; delay: number;
}) {
  const isAbove = verdict === 'above';
  if (isAbove && counterOfferLow) {
    return (
      <BlurredCard delay={delay}>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">YOUR COUNTER</p>
        <p className="font-display text-[20px] text-verdict-good font-bold">${fmt(counterOfferLow)} – ${fmt(counterOfferHigh ?? counterOfferLow)}</p>
        <p className="text-[10px] text-muted-foreground">based on {compsCount} comps</p>
      </BlurredCard>
    );
  }
  return (
    <BlurredCard delay={delay}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">YOUR POSITION</p>
      <p className="font-display text-[20px] text-foreground font-bold">${currentRent ? fmt(currentRent) : '—'}/mo</p>
      <p className="text-[10px] text-muted-foreground">vs ${medianCompRent ? fmt(medianCompRent) : '—'} median</p>
    </BlurredCard>
  );
}

function PreviewCard2({ compsCount, medianCompRent, delay }: { compsCount: number; medianCompRent?: number; delay: number }) {
  return (
    <BlurredCard delay={delay}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">NEARBY COMPS</p>
      <p className="font-display text-[20px] text-foreground font-bold">{compsCount} listings</p>
      <p className="text-[10px] text-muted-foreground">median ${medianCompRent ? fmt(medianCompRent) : '—'}/mo</p>
    </BlurredCard>
  );
}

function PreviewCard3({ delay }: { delay: number }) {
  return (
    <BlurredCard delay={delay}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">YOUR REPLY</p>
      <div className="mt-2 space-y-2">
        <div className="h-2 rounded-full bg-muted-foreground/12 w-full" />
        <div className="h-2 rounded-full bg-muted-foreground/12 w-4/5" />
        <div className="h-2 rounded-full bg-muted-foreground/12 w-3/5" />
      </div>
      <p className="text-[10px] text-muted-foreground mt-1">ready to copy & send</p>
    </BlurredCard>
  );
}
