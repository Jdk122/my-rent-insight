import { useState, useEffect, useCallback } from 'react';
import { Elements, ExpressCheckoutElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { stripePromise } from '@/lib/stripe';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { RefreshCw } from 'lucide-react';

interface ExpressCheckoutProps {
  onSuccess: () => void;
  onFallbackToRedirect: () => void;
  analysisId?: string | null;
  verdict: string;
  zip: string;
  city: string;
  savings: number;
}

function ExpressCheckoutInner({ onSuccess, onFallbackToRedirect }: {
  onSuccess: () => void;
  onFallbackToRedirect: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();

  const handleReady = useCallback(({ availablePaymentMethods }: { availablePaymentMethods: Record<string, boolean> | null }) => {
    if (!availablePaymentMethods || Object.keys(availablePaymentMethods).length === 0) {
      onFallbackToRedirect();
    }
  }, [onFallbackToRedirect]);

  const handleConfirm = useCallback(async () => {
    if (!stripe || !elements) return;

    const { error } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    });

    if (error) {
      toast.error(error.message || 'Payment failed. Please try again.');
    } else {
      onSuccess();
    }
  }, [stripe, elements, onSuccess]);

  return (
    <ExpressCheckoutElement
      onReady={handleReady}
      onConfirm={handleConfirm}
      options={{
        buttonHeight: 48,
        buttonType: { applePay: 'buy', googlePay: 'buy' },
      }}
    />
  );
}

const StripeExpressCheckout = ({
  onSuccess,
  onFallbackToRedirect,
  analysisId,
  verdict,
  zip,
  city,
  savings,
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
      />
    </Elements>
  );
};

export default StripeExpressCheckout;
