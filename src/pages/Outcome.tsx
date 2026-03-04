import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import SEO from '@/components/SEO';
import SEOFooter from '@/components/SEOFooter';

const Outcome = () => {
  const [params] = useSearchParams();
  const leadId = params.get('id');
  const outcome = params.get('outcome');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!leadId || !outcome) { setError(true); return; }
    supabase
      .rpc('update_lead_outcome', { p_lead_id: leadId, p_outcome: outcome } as any)
      .then(({ error: err }) => {
        if (err) setError(true);
        else setSaved(true);
      });
  }, [leadId, outcome]);

  const messages: Record<string, string> = {
    agreed: "That's great news! Glad the letter helped. 🎉",
    countered: "A counter is progress! You have leverage — keep negotiating.",
    no_response: "No worries. Sometimes it takes a follow-up. Consider sending the letter again or calling your landlord directly.",
    unsubscribe: "You've been unsubscribed. You won't receive any more emails from us.",
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEO title="Your Outcome — RenewalReply" noindex />

      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <Link to="/" className="mb-8">
          <img src="/renewalreply-wordmark.png" alt="RenewalReply" className="h-7" width="150" height="28" />
        </Link>

        {error ? (
          <p className="text-muted-foreground">Something went wrong. Please try again.</p>
        ) : saved ? (
          <>
            <h1 className="font-display text-2xl text-foreground mb-4">Thanks for letting us know!</h1>
            <p className="text-muted-foreground max-w-md leading-relaxed">
              {messages[outcome || ''] || "We've recorded your response."}
            </p>
          </>
        ) : (
          <p className="text-muted-foreground">Saving your response…</p>
        )}

        <Link to="/" className="mt-8 text-sm text-primary hover:underline">
          ← Back to RenewalReply
        </Link>
      </div>

      <SEOFooter />
    </div>
  );
};

export default Outcome;
