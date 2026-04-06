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

function BlurredCard({ children, delay }: { children: React.ReactNode; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] }}
      className="relative flex-shrink-0 snap-center overflow-hidden rounded-xl border border-border/60 bg-card p-3 sm:p-4 min-h-[90px] min-w-[124px] max-w-[138px] sm:min-h-[100px] sm:min-w-0 sm:max-w-none"
      role="listitem"
    >
      <div aria-hidden="true">
        {children}
      </div>
      <div
        aria-hidden="true"
        className="absolute inset-0 z-10 flex items-center justify-center bg-card/80 supports-[backdrop-filter]:backdrop-blur-[6px] supports-[backdrop-filter]:bg-card/60"
      >
        <Lock className="h-3.5 w-3.5 text-muted-foreground/40" />
      </div>
    </motion.div>
  );
}

function StackLine({ text, tag, delay }: { text: string; tag: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay, ease: [0.16, 1, 0.3, 1] }}
      className="flex min-w-0 items-start gap-2.5 text-[12px] sm:text-[13px]"
    >
      <Check size={16} className="mt-0.5 shrink-0 text-primary" />
      <span className="min-w-0 flex-1 leading-snug text-foreground">{text}</span>
      <span className="ml-auto hidden shrink-0 text-[10px] text-muted-foreground/60 min-[360px]:inline sm:text-[11px]">{tag}</span>
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

  const badgeText = isAboveMarket ? 'Your Counter-Offer Kit' : 'Your Rent Analysis Kit';

  const headline = (() => {
    if (isAboveMarket) {
      return <>You&apos;re paying <span className="font-bold text-destructive">more</span> than your neighbors.</>;
    }
    if (isFair && turnoverCost) {
      return (
        <>
          It would cost your landlord <span className="font-bold text-foreground">${fmt(turnoverCost)}</span> to replace you.
        </>
      );
    }
    if (isBelowMarket) {
      return <>You&apos;re paying less than your neighbors.</>;
    }
    return <>See how your rent stacks up.</>;
  })();

  const subline = isAboveMarket
    ? 'The data is ready. So is your reply letter.'
    : isFair
      ? 'That number is your leverage. Your reply letter uses it.'
      : isBelowMarket
        ? 'Lock this in before your landlord looks at the market.'
        : 'Full market breakdown. Ready in seconds.';

  const agitationLine = isAboveMarket && increaseAmount
    ? `Every month you wait, that's another $${fmt(increaseAmount)} gone.`
    : isFair
      ? 'Most renters never reply. Landlords know that.'
      : null;

  const stackLines = isAboveMarket
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

  const commitmentText = isAboveMarket
    ? 'Your counter-offer is ready.'
    : 'Your analysis is ready.';

  const ctaText = isAboveMarket
    ? 'Unlock my counter-offer — $4.99'
    : isFair
      ? 'See my leverage — $4.99'
      : isBelowMarket
        ? 'See my full breakdown — $4.99'
        : 'Unlock full analysis — $4.99';

  const cardBase = 0.15;
  const stackBase = cardBase + 0.08 * 3 + 0.3;

  return (
    <motion.div
      ref={ctaRef}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto mt-5 w-full min-w-0 max-w-[480px] border-t-2 border-primary/20 px-3 pt-6 sm:mt-6 sm:px-0 sm:pt-8"
    >
      <div className="text-center">
        <span className="inline-flex max-w-full items-center rounded-full bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-primary sm:text-[11px]">
          {badgeText}
        </span>
      </div>

      <p className="mt-3 max-w-full break-words px-1 text-center font-display text-[19px] leading-[1.12] tracking-tight text-foreground sm:mt-4 sm:px-0 sm:text-[28px] sm:leading-tight">
        {headline}
      </p>

      <p className="mt-2 max-w-full break-words px-1 text-center text-[13px] leading-relaxed text-muted-foreground sm:px-0 sm:text-[15px]">
        {subline}
      </p>

      {agitationLine && (
        <p className="mt-3 hidden max-w-full break-words px-1 text-center text-[13px] italic text-muted-foreground/70 sm:mt-4 sm:block sm:px-0">
          {agitationLine}
        </p>
      )}

      <div className="mt-4 sm:hidden" role="list">
        <div className="flex gap-2.5 overflow-x-auto pb-1 pr-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
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
        <div className="mt-1.5 flex gap-1.5 justify-center">
          <div className="h-1.5 w-1.5 rounded-full bg-primary/60" />
          <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/20" />
          <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/20" />
        </div>
      </div>

      <div className="mt-6 hidden grid-cols-3 gap-3 sm:grid" role="list">
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

      <div className="mt-6 hidden space-y-2 sm:block">
        {stackLines.map((line, i) => (
          <StackLine key={i} text={line.text} tag={line.tag} delay={stackBase + i * 0.05} />
        ))}
      </div>

      <p className="mx-auto mt-4 max-w-[22rem] break-words px-2 text-center text-[11px] leading-relaxed text-muted-foreground sm:mt-5 sm:max-w-none sm:px-0 sm:text-[13px] sm:leading-normal">
        {commitmentText}
      </p>

      <div className="mx-auto mt-2 max-w-[22rem] px-2 text-center sm:mt-3 sm:max-w-none sm:px-0">
        <SocialProofLine />
      </div>

      <div className="mt-4 sm:mt-5">
        {walletAvailable !== false && (
          <div className="mx-auto min-h-[48px] w-full max-w-[340px]">
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
          className={walletAvailable
            ? "mx-auto mt-2 flex min-h-[44px] items-center justify-center text-[12px] text-muted-foreground underline"
            : "mx-auto mt-3 block min-h-[48px] w-full max-w-[340px] rounded-xl bg-primary px-4 py-4 text-[15px] font-bold text-primary-foreground shadow-md shadow-primary/25 transition-all hover:brightness-95 disabled:opacity-70"
          }
        >
          {checkoutLoading
            ? 'Opening checkout...'
            : walletAvailable
              ? 'Pay with card instead'
              : ctaText}
        </button>
      </div>

      <p className="mt-2 max-w-full break-words px-2 text-center text-[11px] text-muted-foreground sm:mt-3 sm:px-0 sm:text-[12px]">
        Not useful? Email us. Full refund.
      </p>

      <div className="mt-1 px-2 pb-4 text-center text-[10px] leading-relaxed text-muted-foreground/50 sm:mt-2 sm:px-0 sm:text-[11px]">
        <p className="break-words">One-time payment · Instant access · No account needed</p>
        <p>Secured by Stripe</p>
      </div>

      {agitationLine && (
        <p className="mt-2 max-w-full break-words px-1 text-center text-[12px] italic text-muted-foreground/70 sm:hidden">
          {agitationLine}
        </p>
      )}

      <div className="mt-4 space-y-2 border-t border-border/40 pt-4 sm:hidden">
        {stackLines.map((line, i) => (
          <StackLine key={i} text={line.text} tag={line.tag} delay={0} />
        ))}
      </div>
    </motion.div>
  );
}

function PreviewCard1({
  verdict,
  counterOfferLow,
  counterOfferHigh,
  compsCount,
  currentRent,
  medianCompRent,
  delay,
}: {
  verdict: string;
  counterOfferLow?: number;
  counterOfferHigh?: number;
  compsCount: number;
  currentRent?: number;
  medianCompRent?: number;
  delay: number;
}) {
  const isAbove = verdict === 'above';

  if (isAbove && counterOfferLow) {
    return (
      <BlurredCard delay={delay}>
        <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground sm:text-[10px]">YOUR COUNTER</p>
        <p className="break-words font-display text-[18px] font-bold text-verdict-good sm:text-[20px]">
          {counterOfferLow === counterOfferHigh
            ? `$${fmt(counterOfferLow)}/mo`
            : `$${fmt(counterOfferLow)} – $${fmt(counterOfferHigh ?? counterOfferLow)}`}
        </p>
        <p className="text-[9px] text-muted-foreground sm:text-[10px]">based on {compsCount} comps</p>
      </BlurredCard>
    );
  }

  return (
    <BlurredCard delay={delay}>
      <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground sm:text-[10px]">YOUR POSITION</p>
      <p className="break-words font-display text-[18px] font-bold text-foreground sm:text-[20px]">${currentRent ? fmt(currentRent) : '—'}/mo</p>
      <p className="text-[9px] text-muted-foreground sm:text-[10px]">vs ${medianCompRent ? fmt(medianCompRent) : '—'} median</p>
    </BlurredCard>
  );
}

function PreviewCard2({ compsCount, medianCompRent, delay }: { compsCount: number; medianCompRent?: number; delay: number }) {
  return (
    <BlurredCard delay={delay}>
      <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground sm:text-[10px]">NEARBY COMPS</p>
      <p className="break-words font-display text-[18px] font-bold text-foreground sm:text-[20px]">{compsCount} listings</p>
      <p className="text-[9px] text-muted-foreground sm:text-[10px]">median ${medianCompRent ? fmt(medianCompRent) : '—'}/mo</p>
    </BlurredCard>
  );
}

function PreviewCard3({ delay }: { delay: number }) {
  return (
    <BlurredCard delay={delay}>
      <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground sm:text-[10px]">YOUR REPLY</p>
      <div className="mt-2 space-y-2">
        <div className="h-2 w-full rounded-full bg-muted-foreground/12" />
        <div className="h-2 w-4/5 rounded-full bg-muted-foreground/12" />
        <div className="h-2 w-3/5 rounded-full bg-muted-foreground/12" />
      </div>
      <p className="mt-1 text-[9px] text-muted-foreground sm:text-[10px]">ready to copy & send</p>
    </BlurredCard>
  );
}
