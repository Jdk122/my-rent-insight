import { useState, useCallback, useRef, useEffect, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { Check, Lock, RefreshCw } from 'lucide-react';
import { Elements, ExpressCheckoutElement, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { supabase } from '@/integrations/supabase/client';
import { stripePromise } from '@/lib/stripe';
import SocialProofLine from './SocialProofLine';
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
}

interface PaywallCheckoutInnerProps {
  checkoutLoading: boolean;
  ctaText: string;
  expressCheckoutProps: AnalysisPaywallProps['expressCheckoutProps'];
  onPaid?: (email?: string) => void;
}

const PAYMENT_AMOUNT_CENTS = 499;
const PAYMENT_AMOUNT_LABEL = '$4.99';
const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

function PaywallCheckoutInner({ checkoutLoading, ctaText, expressCheckoutProps, onPaid }: PaywallCheckoutInnerProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [walletAvailable, setWalletAvailable] = useState<boolean | null>(null);
  const [showCardForm, setShowCardForm] = useState(false);
  const [cardLoading, setCardLoading] = useState(false);

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
      placement: 'analysis_gate',
      verdict: expressCheckoutProps.verdict,
      zip: expressCheckoutProps.zip,
    });

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.href,
      },
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
    setShowCardForm(true);
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
      confirmParams: {
        return_url: window.location.href,
      },
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
    <>
      <div className="mt-5 flex justify-center">
        <button
          onClick={handleCardReveal}
          disabled={checkoutLoading || showCardForm}
          className="w-full max-w-[340px] py-4 rounded-xl text-[16px] sm:text-[17px] font-bold bg-primary text-primary-foreground hover:brightness-95 shadow-md shadow-primary/25 min-h-[56px] disabled:opacity-70 transition-all"
        >
          {checkoutLoading ? 'Opening checkout...' : ctaText}
        </button>
      </div>

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
                    address: {
                      country: 'US',
                    },
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
            onClick={() => setShowCardForm(false)}
            className="mt-2 text-[12px] text-muted-foreground underline w-full text-center"
          >
            Cancel
          </button>
        </motion.form>
      )}

      {walletAvailable !== false && (
        <div className="mt-3 min-h-[48px]">
          <ExpressCheckoutElement
            onReady={handleExpressReady}
            onConfirm={handleExpressConfirm}
            onCancel={handleExpressCancel}
            options={{
              buttonHeight: 40,
              buttonType: { applePay: 'buy', googlePay: 'buy' },
              emailRequired: true,
            }}
          />
        </div>
      )}
    </>
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
}: AnalysisPaywallProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [intentLoading, setIntentLoading] = useState(true);
  const [intentFailed, setIntentFailed] = useState(false);
  const [redirectLoading, setRedirectLoading] = useState(false);
  const ctaRef = useRef<HTMLDivElement>(null);
  const impressionTracked = useRef(false);

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

    return () => {
      cancelled = true;
    };
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

  const isAbove = verdict === 'above';
  const isFair = verdict === 'at-market';
  const isBelow = verdict === 'below';
  const badge = isAbove ? 'Your Counter-Offer Kit' : 'Your Rent Analysis Kit';
  const compsLabel = compsCount > 0 ? compsCount : 'several';

  const headline = isAbove
    ? `We found ${compsLabel} comparable units renting for less than you.`
    : isFair
      ? `It would cost your landlord $${fmt(turnoverCost || Math.round((currentRent || 1500) * 3))} to replace you.`
      : isBelow
        ? `You're getting a better deal than most renters in ${city}.`
        : `See how your rent stacks up against ${compsLabel} nearby listings.`;

  const agitation = isAbove && increaseAmount && increaseAmount > 0
    ? `That's $${fmt(increaseAmount)} every month your landlord keeps until you reply.`
    : isFair
      ? 'Most renters never reply. Landlords know that.'
      : null;

  const ctaText = isAbove
    ? `Unlock my counter-offer\u2009\u2014\u2009${PAYMENT_AMOUNT_LABEL}`
    : isFair
      ? `See my leverage\u2009\u2014\u2009${PAYMENT_AMOUNT_LABEL}`
      : isBelow
        ? `See my full breakdown\u2009\u2014\u2009${PAYMENT_AMOUNT_LABEL}`
        : `Unlock full analysis\u2009\u2014\u2009${PAYMENT_AMOUNT_LABEL}`;

  const valueStack = isAbove
    ? [
        { text: `Counter-offer range from ${compsLabel} nearby comps`, tag: '($200+ value)' },
        { text: 'Landlord turnover cost breakdown', tag: '(data they don\'t share)' },
        { text: 'Ready-to-send negotiation reply', tag: '($225+ if a lawyer wrote it)' },
        { text: 'Full market trends and evidence report', tag: '(hours of research, done)' },
      ]
    : [
        { text: `Full comp analysis with ${compsLabel} nearby listings`, tag: '($200+ value)' },
        { text: `Market trend breakdown for ${city}`, tag: '(hours of research, done)' },
        { text: 'Landlord turnover cost analysis', tag: '(your hidden leverage)' },
        { text: 'Ready-to-send reply letter', tag: '($225+ if a lawyer wrote it)' },
      ];

  const card1 = isAbove && counterOfferLow
    ? {
        label: 'YOUR COUNTER',
        value: counterOfferLow === counterOfferHigh
          ? `$${fmt(counterOfferLow)}/mo`
          : `$${fmt(counterOfferLow)}–$${fmt(counterOfferHigh || counterOfferLow)}/mo`,
        sub: `based on ${compsLabel} comps`,
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
    value: `${compsLabel} listings`,
    sub: medianCompRent ? `median $${fmt(medianCompRent)}/mo` : 'comparable units',
    color: 'text-foreground',
  };

  return (
    <motion.div
      ref={ctaRef}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-[480px] mx-auto mt-4 sm:mt-6 pt-3 sm:pt-6 px-4 min-w-0 overflow-hidden box-border"
    >
      <div className="text-center">
        <span className="inline-flex items-center px-3 py-1 rounded-full bg-primary/8 text-primary text-[10px] sm:text-[11px] font-semibold uppercase tracking-widest">
          {badge}
        </span>
      </div>

      <h2 className="font-display text-[22px] sm:text-[28px] tracking-tight text-foreground leading-tight text-center mt-3 sm:mt-4">
        {headline}
      </h2>

      {agitation && (
        <p className="mt-2 sm:mt-3 text-center text-[13px] sm:text-[14px] text-muted-foreground/80 italic">
          {agitation}
        </p>
      )}

      <div className="mt-4 sm:mt-5">
        <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 -mx-2 px-2 scrollbar-hide sm:grid sm:grid-cols-3 sm:overflow-visible sm:mx-0 sm:px-0 sm:pb-0" role="list">
          {[card1, card2, { label: 'YOUR REPLY', value: null, sub: 'ready to copy and send', color: '' }].map((card, i) => (
            <motion.div
              key={i}
              role="listitem"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 + i * 0.08 }}
              className="min-w-[140px] max-w-[160px] flex-shrink-0 snap-center sm:min-w-0 sm:max-w-none relative overflow-hidden rounded-xl border border-border/60 bg-card p-3 sm:p-4 min-h-[90px] sm:min-h-[100px]"
            >
              <div aria-hidden="true">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{card.label}</p>
                {card.value ? (
                  <p className={`font-display text-[18px] sm:text-[20px] font-bold mt-1 ${card.color}`}>{card.value}</p>
                ) : (
                  <div className="mt-2 space-y-2">
                    <div className="h-2 rounded-full bg-muted-foreground/12 w-full" />
                    <div className="h-2 rounded-full bg-muted-foreground/12 w-4/5" />
                    <div className="h-2 rounded-full bg-muted-foreground/12 w-3/5" />
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground mt-1">{card.sub}</p>
              </div>

              <div
                className="absolute inset-0 z-10 flex items-center justify-center bg-card/80 supports-[backdrop-filter]:backdrop-blur-[6px] supports-[backdrop-filter]:bg-card/60"
                aria-hidden="true"
              >
                <Lock className="h-3.5 w-3.5 text-muted-foreground/40" />
              </div>
            </motion.div>
          ))}
        </div>

        <div className="flex gap-1.5 justify-center mt-2 sm:hidden">
          <div className="w-1.5 h-1.5 rounded-full bg-primary/60" />
          <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/20" />
          <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/20" />
        </div>
      </div>

      {intentFailed ? (
        <div className="mt-5 flex justify-center">
          <button
            onClick={handleRedirectFallback}
            disabled={redirectLoading || checkoutLoading}
            className="w-full max-w-[340px] py-4 rounded-xl text-[16px] sm:text-[17px] font-bold bg-primary text-primary-foreground hover:brightness-95 shadow-md shadow-primary/25 min-h-[56px] disabled:opacity-70 transition-all"
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
          />
        </Elements>
      ) : (
        <div className="mt-5 flex justify-center">
          <button
            disabled
            className="w-full max-w-[340px] py-4 rounded-xl text-[16px] sm:text-[17px] font-bold bg-primary text-primary-foreground shadow-md shadow-primary/25 min-h-[56px] opacity-70"
          >
            <span className="inline-flex items-center justify-center gap-2">
              <RefreshCw className="h-4 w-4 animate-spin" />
              {intentLoading ? 'Loading secure checkout...' : ctaText}
            </span>
          </button>
        </div>
      )}

      <div className="mt-3 text-center">
        <SocialProofLine />
      </div>

      <p className="mt-2 text-center text-[11px] text-muted-foreground/60 italic">
        Analysis based on data pulled today. Rates shift weekly.
      </p>

      <p className="mt-3 text-center text-[12px] text-muted-foreground">
        Not useful? Email us. Full refund.
      </p>

      <p className="mt-2 text-center text-[11px] text-muted-foreground/50">
        One-time payment · Instant access · No account needed
      </p>
      <p className="text-center text-[11px] text-muted-foreground/50">
        Secured by Stripe
      </p>

      <div className="border-t border-border/40 pt-4 mt-5 space-y-2.5 pb-4">
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
