import { useState, useCallback, useRef, useEffect, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, RefreshCw } from 'lucide-react';
import { Elements, ExpressCheckoutElement, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { supabase } from '@/integrations/supabase/client';
import { stripePromise } from '@/lib/stripe';
import SocialProofLine from './SocialProofLine';
import stripeLogo from '@/assets/stripe-logo.png';
import { trackEvent } from '@/lib/analytics';
import { toast } from 'sonner';

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
  sampleComps?: Array<{ address: string; beds: number; baths: number }>;
}

interface PaywallCheckoutInnerProps {
  checkoutLoading: boolean;
  ctaText: string;
  expressCheckoutProps: AnalysisPaywallProps['expressCheckoutProps'];
  onPaid?: (email?: string) => void;
  onCardFormToggle?: (open: boolean) => void;
}

const PAYMENT_AMOUNT_CENTS = 499;
const PAYMENT_AMOUNT_LABEL = '$4.99';
const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

function PaywallCheckoutInner({ checkoutLoading, ctaText, expressCheckoutProps, onPaid, onCardFormToggle }: PaywallCheckoutInnerProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [walletAvailable, setWalletAvailable] = useState<boolean | null>(null);
  const [showCardForm, setShowCardForm] = useState(false);
  const [cardLoading, setCardLoading] = useState(false);

  const toggleCardForm = useCallback((open: boolean) => {
    setShowCardForm(open);
    onCardFormToggle?.(open);
  }, [onCardFormToggle]);

  const handleExpressReady = useCallback(({ availablePaymentMethods }: { availablePaymentMethods: Record<string, boolean> | null }) => {
    if (!availablePaymentMethods || Object.keys(availablePaymentMethods).length === 0) {
      setWalletAvailable(false);
      return;
    }
    setWalletAvailable(true);
  }, []);

  const handleExpressConfirm = useCallback(async (event: any) => {
    if (!stripe || !elements) return;

    const payerEmail = event?.billingDetails?.email || undefined;

    trackEvent('checkout_started', {
      method: 'express_checkout',
      express_type: event?.expressPaymentType || 'unknown',
      placement: 'analysis_gate',
      verdict: expressCheckoutProps.verdict,
      zip: expressCheckoutProps.zip,
    });

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: 'if_required',
    });

    if (error) {
      trackEvent('checkout_failed', {
        method: 'express_checkout',
        placement: 'analysis_gate',
        error: error.message || 'unknown',
      });
      event?.paymentFailed?.({ reason: 'fail' });
      toast.error(error.message || 'Payment failed. Please try again.');
      return;
    }

    onPaid?.(payerEmail);
  }, [elements, expressCheckoutProps.verdict, expressCheckoutProps.zip, onPaid, stripe]);

  const handleExpressCancel = useCallback(() => {
    trackEvent('checkout_cancelled', {
      method: 'express_checkout',
      placement: 'analysis_gate',
    });
  }, []);

  const handleCardReveal = useCallback(() => {
    trackEvent('checkout_started', {
      method: 'inline_card',
      placement: 'analysis_gate',
      verdict: expressCheckoutProps.verdict,
      zip: expressCheckoutProps.zip,
    });
    toggleCardForm(true);
  }, [expressCheckoutProps.verdict, expressCheckoutProps.zip]);

  const handleCardSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!stripe || !elements) return;

    setCardLoading(true);

    const submitResult = await elements.submit();
    if (submitResult.error) {
      trackEvent('checkout_failed', {
        method: 'inline_card',
        placement: 'analysis_gate',
        error: submitResult.error.message || 'validation_error',
      });
      toast.error(submitResult.error.message || 'Please check your payment details.');
      setCardLoading(false);
      return;
    }

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: 'if_required',
    });

    if (error) {
      trackEvent('checkout_failed', {
        method: 'inline_card',
        placement: 'analysis_gate',
        error: error.message || 'unknown',
      });
      toast.error(error.message || 'Payment failed. Please try again.');
      setCardLoading(false);
      return;
    }

    onPaid?.();
  }, [elements, onPaid, stripe]);

  return (
    <div className="flex flex-col">
      {/* Express checkout — PRIMARY, always first */}
      {walletAvailable !== false && (
        <div className="mt-4">
          <div className="min-h-[40px]">
            <ExpressCheckoutElement
              onReady={handleExpressReady}
              onConfirm={handleExpressConfirm}
              onCancel={handleExpressCancel}
              options={{
                buttonHeight: 48,
                buttonType: { applePay: 'buy', googlePay: 'buy' },
                emailRequired: true,
              }}
            />
          </div>
        </div>
      )}

      {/* "or pay with card" divider */}
      {walletAvailable && (
        <p className="text-[10px] sm:text-[11px] text-muted-foreground text-center mt-3 mb-2">or pay with card</p>
      )}

      {/* Card CTA — SECONDARY */}
      <div className="flex justify-center">
        <button
          onClick={handleCardReveal}
          disabled={checkoutLoading || showCardForm}
          className={`w-full max-w-[340px] rounded-xl transition-all disabled:opacity-70 ${
            walletAvailable
              ? 'py-3.5 text-[14px] sm:text-[16px] font-bold bg-foreground/80 text-background hover:bg-foreground/90 shadow-sm min-h-[48px]'
              : 'py-5 text-[16px] sm:text-[18px] font-extrabold bg-primary text-primary-foreground hover:brightness-95 shadow-md shadow-primary/25 min-h-[56px]'
          }`}
        >
          {checkoutLoading ? 'Opening checkout...' : ctaText}
        </button>
      </div>

      {/* Card form */}
      {showCardForm && (
        <motion.form
          onSubmit={handleCardSubmit}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          transition={{ duration: 0.24 }}
          className="mt-3 w-full max-w-[380px] mx-auto"
        >
          <div className="rounded-xl border border-border/60 bg-card p-4 text-left shadow-sm">
            <PaymentElement
              options={{
                layout: 'tabs',
                defaultValues: {
                  billingDetails: {
                    address: { country: 'US' },
                  },
                },
              }}
            />
            <button
              type="submit"
              disabled={cardLoading || !stripe}
              className="w-full mt-4 py-3.5 rounded-lg text-[15px] font-bold bg-primary text-primary-foreground hover:brightness-95 shadow-sm shadow-primary/25 min-h-[48px] disabled:opacity-70 transition-all"
            >
              {cardLoading ? 'Processing...' : `Pay ${PAYMENT_AMOUNT_LABEL}`}
            </button>
          </div>
          <button
            type="button"
            onClick={() => toggleCardForm(false)}
            className="mt-2 text-[12px] text-muted-foreground underline w-full text-center"
          >
            Cancel
          </button>
        </motion.form>
      )}
    </div>
  );
}


export default function AnalysisPaywall({
  verdict,
  compsCount,
  city,
  currentRent,
  checkoutLoading,
  onPaid,
  expressCheckoutProps,
  counterOfferLow,
  counterOfferHigh,
  medianCompRent,
  turnoverCost,
  increaseAmount,
  sampleComps,
}: AnalysisPaywallProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [intentLoading, setIntentLoading] = useState(true);
  const [intentFailed, setIntentFailed] = useState(false);
  const [redirectLoading, setRedirectLoading] = useState(false);
  const [cardFormOpen, setCardFormOpen] = useState(false);
  const [stickyVisible, setStickyVisible] = useState(false);
  const ctaRef = useRef<HTMLDivElement>(null);
  const ctaBtnRef = useRef<HTMLDivElement>(null);
  const ctaZoneRef = useRef<HTMLDivElement>(null);
  const mainCtaRef = useRef<HTMLDivElement>(null);
  const impressionTracked = useRef(false);
  const ctaVisibleTracked = useRef(false);
  const compsViewedTracked = useRef(false);

  const { analysisId, verdict: checkoutVerdict, zip, city: checkoutCity, savings } = expressCheckoutProps;

  useEffect(() => {
    const el = ctaRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !impressionTracked.current) {
          impressionTracked.current = true;
          trackEvent('analysis_paywall_impression', {
            verdict: checkoutVerdict,
            placement: 'analysis_gate',
            zip,
          });
          if (!compsViewedTracked.current && sampleComps && sampleComps.length > 0) {
            compsViewedTracked.current = true;
            trackEvent('paywall_comps_viewed', {
              verdict: checkoutVerdict,
              comps_shown: sampleComps.length,
              zip,
            });
          }
          observer.disconnect();
        }
      },
      { threshold: 0.5 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [checkoutVerdict, zip, sampleComps]);

  useEffect(() => {
    const el = ctaBtnRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !ctaVisibleTracked.current) {
          ctaVisibleTracked.current = true;
          trackEvent('paywall_cta_visible', {
            verdict: checkoutVerdict,
            zip,
          });
          observer.disconnect();
        }
      },
      { threshold: 0.5 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [checkoutVerdict, zip]);

  useEffect(() => {
    let cancelled = false;

    setIntentLoading(true);
    setIntentFailed(false);
    setClientSecret(null);

    supabase.functions.invoke('create-payment-intent', {
      body: {
        analysisId,
        verdict: checkoutVerdict,
        zip,
        city: checkoutCity,
        savings,
        priceCents: PAYMENT_AMOUNT_CENTS,
      },
    }).then(({ data, error }) => {
      if (cancelled) return;

      if (error || !data?.clientSecret) {
        setIntentFailed(true);
        setIntentLoading(false);
        return;
      }

      setClientSecret(data.clientSecret);
      setIntentLoading(false);
    }).catch((err) => {
      if (cancelled) return;
      console.error('[create-payment-intent] failed:', err);
      setIntentFailed(true);
      setIntentLoading(false);
    });

    return () => { cancelled = true; };
  }, [analysisId, checkoutCity, checkoutVerdict, savings, zip]);

  const handleRedirectFallback = useCallback(async () => {
    trackEvent('checkout_started', {
      method: 'card_fallback',
      placement: 'analysis_gate',
      verdict: checkoutVerdict,
      zip,
    });

    setRedirectLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: {
          analysisId,
          verdict: checkoutVerdict,
          zip,
          city: checkoutCity,
          savings,
          returnUrl: window.location.origin + window.location.pathname,
          priceCents: PAYMENT_AMOUNT_CENTS,
        },
      });

      if (error || !data?.url) {
        throw new Error(error?.message || 'No checkout URL returned');
      }

      window.location.href = data.url;
    } catch (err) {
      console.error('[create-checkout-session] failed:', err);
      toast.error('Something went wrong. Please try again.');
      setRedirectLoading(false);
    }
  }, [analysisId, checkoutCity, checkoutVerdict, savings, zip]);

  // Sticky bar: show when CTA zone scrolls out of view on mobile
  useEffect(() => {
    const el = mainCtaRef.current;
    if (!el) return;

    const mq = window.matchMedia('(max-width: 639px)');
    if (!mq.matches) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setStickyVisible(!entry.isIntersecting);
      },
      { threshold: 0 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleStickyClick = useCallback(() => {
    mainCtaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  const isAbove = verdict === 'above';
  const isFair = verdict === 'at-market';
  const isBelow = verdict === 'below';
  const compsLabel = compsCount > 0 ? compsCount : 'several';

  const headline = isAbove
    ? <>Your landlord is counting on you not knowing the number.{' '}<span className="whitespace-nowrap">$4.99 says you do.</span></>
    : isFair
      ? <>It would cost your landlord thousands to replace you.{' '}<span className="whitespace-nowrap">$4.99 shows you exactly how much.</span></>
      : isBelow
        ? `You're getting a better deal than most renters in ${city}. See the proof.`
        : `See how your rent stacks up against ${compsLabel} nearby listings.`;

  const subhead = isAbove
    ? 'Get the exact counter-offer number, backed by 6 data sources \u2014 not a guess.'
    : isFair
      ? 'See your leverage number and get a negotiation letter backed by 6 data sources.'
      : isBelow
        ? `Full breakdown with ${compsLabel} nearby comps and market evidence.`
        : `Full analysis with ${compsLabel} nearby comps and market data.`;

  const ctaText = isAbove
    ? `Get my counter-offer \u2014 ${PAYMENT_AMOUNT_LABEL}`
    : isFair
      ? `See my leverage \u2014 ${PAYMENT_AMOUNT_LABEL}`
      : isBelow
        ? `Get my full breakdown \u2014 ${PAYMENT_AMOUNT_LABEL}`
        : `Get full analysis \u2014 ${PAYMENT_AMOUNT_LABEL}`;

  const valueStack = isAbove
    ? [
        { text: 'The exact number to counter with', tag: '(from 6 data sources)' },
        { text: "Your landlord's cost to replace you", tag: "(they won't tell you this)" },
        { text: 'A reply letter you can send today \u2014 done', tag: '(no awkward emails)' },
        { text: 'The market evidence behind every dollar', tag: '(a weekend of research, finished)' },
      ]
    : [
        { text: `Full comp breakdown with ${compsLabel} nearby listings`, tag: '(from 6 data sources)' },
        { text: `Market trend data for ${city}`, tag: '(a weekend of research, finished)' },
        { text: "Your landlord's cost to replace you", tag: '(your hidden leverage)' },
        { text: 'A reply letter customized to your situation', tag: '(no awkward emails)' },
      ];


  return (
    <>
    <motion.div
      ref={ctaRef}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-[480px] mx-auto mt-2 sm:mt-4 pt-0 sm:pt-2 px-4 min-w-0 overflow-hidden box-border"
    >
      {/* Headline */}
      <h2 className="font-display text-[20px] sm:text-[28px] tracking-tight text-foreground leading-tight text-center mt-2 sm:mt-3">
        {headline}
      </h2>

      {/* Subhead */}
      <p className="text-[13px] sm:text-[15px] text-muted-foreground text-center mt-2">
        {subhead}
      </p>

      {/* Blurred comp cards */}
      {sampleComps && sampleComps.length >= 2 && (
        <div className="mt-4 sm:mt-5 space-y-2 max-w-[340px] mx-auto">
          {sampleComps.slice(0, 2).map((comp, i) => (
            <div key={i} className="rounded-lg border border-border/60 bg-card px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[12px] font-medium text-foreground leading-snug min-w-0 flex-1 truncate">{comp.address}</p>
                <span className="text-[10px] text-muted-foreground shrink-0">{comp.beds}bd/{comp.baths}ba</span>
                <div className="relative overflow-hidden rounded-md px-1.5 py-0.5 shrink-0">
                  <span className="text-[11px] font-bold text-foreground" aria-hidden="true">$X,XXX</span>
                  <div className="absolute inset-0 z-10 bg-card/80 supports-[backdrop-filter]:backdrop-blur-[5px] supports-[backdrop-filter]:bg-card/60" aria-hidden="true" />
                </div>
              </div>
            </div>
          ))}
          <p className="text-[10px] sm:text-[11px] text-muted-foreground text-center">+ {compsCount - 2} more comps inside</p>
        </div>
      )}

      {/* WHAT YOU GET value stack */}
      <div className="border-t border-border/40 pt-3 mt-4 sm:mt-5 space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">What you get</p>
        {valueStack.map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.5 + i * 0.05 }}
            className="flex items-start gap-2 text-[11px] sm:text-[13px]"
          >
            <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary shrink-0 mt-0.5" />
            <span className="text-foreground text-left flex-1">{item.text}</span>
            <span className="text-muted-foreground text-[9px] sm:text-[11px] whitespace-nowrap shrink-0 mt-0.5 hidden min-[360px]:inline">
              {item.tag}
            </span>
          </motion.div>
        ))}
      </div>

      {/* Urgency line */}
      <p className="text-[11px] sm:text-[12px] text-amber-600 dark:text-amber-400 font-medium text-center mt-3">
        This analysis uses data pulled today. Rates shift weekly — your counter-offer is strongest now.
      </p>

      {/* Refund guarantee */}
      <p className="mt-3 sm:mt-4 text-center text-[12px] font-medium text-muted-foreground">
        If this doesn't help, we'll refund every penny. No questions asked.
      </p>

      {/* CTA zone — observed for sticky bar */}
      <div ref={mainCtaRef}>
        <div ref={ctaZoneRef}>
          {intentFailed ? (
            <div ref={ctaBtnRef} className="mt-4 sm:mt-5 flex justify-center">
              <button
                onClick={handleRedirectFallback}
                disabled={redirectLoading || checkoutLoading}
                className="w-full max-w-[340px] py-5 rounded-xl text-[16px] sm:text-[18px] font-extrabold bg-primary text-primary-foreground hover:brightness-95 shadow-md shadow-primary/25 min-h-[56px] disabled:opacity-70 transition-all"
              >
                {redirectLoading || checkoutLoading ? 'Opening checkout...' : ctaText}
              </button>
            </div>
          ) : clientSecret ? (
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: { theme: 'stripe' },
              }}
            >
              <PaywallCheckoutInner
                checkoutLoading={checkoutLoading}
                ctaText={ctaText}
                expressCheckoutProps={expressCheckoutProps}
                onPaid={onPaid}
                onCardFormToggle={setCardFormOpen}
              />
            </Elements>
          ) : (
            <div className="mt-4 sm:mt-5 flex justify-center">
              <button
                disabled
                className="w-full max-w-[340px] py-5 rounded-xl text-[16px] sm:text-[18px] font-extrabold bg-primary text-primary-foreground shadow-md shadow-primary/25 min-h-[56px] opacity-70"
              >
                <span className="inline-flex items-center justify-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  {intentLoading ? 'Loading secure checkout...' : ctaText}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 text-center">
        <SocialProofLine />
      </div>

      <p className="mt-1.5 sm:mt-2 text-center text-[11px] text-muted-foreground/50 pb-4">
        One-time payment · Instant access · No account needed
      </p>
    </motion.div>

    {/* Sticky bottom CTA bar — mobile only */}
    <AnimatePresence>
      {stickyVisible && !cardFormOpen && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="fixed bottom-0 inset-x-0 z-50 sm:hidden border-t border-border/60 bg-card/80 supports-[backdrop-filter]:backdrop-blur-md supports-[backdrop-filter]:bg-card/60"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        >
          <div className="px-4 pt-3 flex flex-col items-center gap-1.5">
            <button
              onClick={handleStickyClick}
              className="w-full max-w-[340px] py-3.5 rounded-xl text-[15px] font-extrabold bg-primary text-primary-foreground hover:brightness-95 shadow-md shadow-primary/25 min-h-[48px] transition-all"
            >
              {ctaText}
            </button>
            <p className="text-[10px] text-muted-foreground">
              One-time · Instant access · Full refund if not useful
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
}
