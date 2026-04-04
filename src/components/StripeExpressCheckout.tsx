import { useState, useEffect, useCallback } from 'react';
import { Elements, ExpressCheckoutElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { stripePromise } from '@/lib/stripe';
import { supabase } from '@/integrations/supabase/client';
import { trackEvent } from '@/lib/analytics';
import { toast } from 'sonner';
import { RefreshCw } from 'lucide-react';

interface ExpressCheckoutProps {
  onSuccess: (email?: string) => void;
  onFallbackToRedirect: () => void;
  onReady?: () => void;
  analysisId?: string | null;
  verdict: string;
  zip: string;
  city: string;
  savings: number;
  placement?: string;
}

function ExpressCheckoutInner({ onSuccess, onFallbackToRedirect, onReady, verdict, zip, placement }: {
  onSuccess: (email?: string) => void;
  onFallbackToRedirect: () => void;
  onReady?: () => void;
  verdict: string;
  zip: string;
  placement: string;
}) {
  const stripe = useStripe();
  const elements = useElements();

  const handleReady = useCallback(({ availablePaymentMethods }: { availablePaymentMethods: Record<string, boolean> | null }) => {
    if (!availablePaymentMethods || Object.keys(availablePaymentMethods).length === 0) {
      onFallbackToRedirect();
    } else {
      onReady?.();
    }
  }, [onFallbackToRedirect, onReady]);

  const handleConfirm = useCallback(async (event: any) => {
    if (!stripe || !elements) return;

    const payerEmail = event?.billingDetails?.email || null;

    trackEvent('checkout_started', {
      method: 'express_checkout',
      placement,
      verdict,
      zip,
    });

    const { error } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    });

    if (error) {
      trackEvent('checkout_failed', {
        method: 'express_checkout',
        placement,
        error: error.message || 'unknown',
      });
      event?.paymentFailed?.({ reason: 'fail' });
      toast.error(error.message || 'Payment failed. Please try again.');
    } else {
      onSuccess(payerEmail || undefined);
    }
  }, [stripe, elements, onSuccess, verdict, zip, placement]);

  const handleCancel = useCallback(() => {
    trackEvent('checkout_cancelled', {
      method: 'express_checkout',
      placement,
    });
  }, [placement]);

  return (
    <ExpressCheckoutElement
      onReady={handleReady}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
      options={{
        buttonHeight: 40,
        buttonType: { applePay: 'buy', googlePay: 'buy' },
        emailRequired: true,
      }}
    />
  );
}

const StripeExpressCheckout = ({
  onSuccess,
  onFallbackToRedirect,
  onReady,
  analysisId,
  verdict,
  zip,
  city,
  savings,
  placement = 'locked_letter',
}: ExpressCheckoutProps) => {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    supabase.functions.invoke('create-payment-intent', {
      body: { analysisId, verdict, zip, city, savings },
    }).then(({ data, error }) => {
      if (cancelled) return;
      if (error || !data?.clientSecret) {
        setFailed(true);
        setLoading(false);
        onFallbackToRedirect();
        return;
      }
      setClientSecret(data.clientSecret);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [analysisId, verdict, zip, city, savings, onFallbackToRedirect]);

  if (failed) return null;

  if (loading || !clientSecret) {
    return (
      <div className="flex items-center justify-center py-3">
        <RefreshCw size={16} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: { theme: 'stripe' },
      }}
    >
      <ExpressCheckoutInner
        onSuccess={onSuccess}
        onFallbackToRedirect={onFallbackToRedirect}
        onReady={onReady}
        verdict={verdict}
        zip={zip}
        placement={placement}
      />
    </Elements>
  );
};

export default StripeExpressCheckout;
