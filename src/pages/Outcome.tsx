import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { trackEvent } from '@/lib/analytics';
import SEO from '@/components/SEO';
import SEOFooter from '@/components/SEOFooter';
import { Check } from 'lucide-react';

type Result = 'agreed' | 'countered' | 'no_response' | 'moving' | 'unsubscribe';

const Outcome = () => {
  const [params] = useSearchParams();
  const leadId = params.get('id');
  const result = (params.get('result') || params.get('outcome')) as Result | null;

  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(false);
  const [phase, setPhase] = useState<'loading' | 'form' | 'done'>('loading');

  // Agreed state
  const [testimonial, setTestimonial] = useState('');

  // Countered state
  const [counterAmount, setCounterAmount] = useState('');

  // Moving state
  const [budget, setBudget] = useState('');
  const [neighborhoods, setNeighborhoods] = useState('');
  const [timeline, setTimeline] = useState('');
  const [email, setEmail] = useState('');

  // Save initial outcome
  useEffect(() => {
    if (!leadId || !result) { setError(true); return; }

    if (result === 'unsubscribe') {
      supabase
        .rpc('update_lead_outcome', { p_lead_id: leadId, p_outcome: 'unsubscribe' } as any)
        .then(({ error: err }) => {
          if (err) setError(true);
          else { setSaved(true); setPhase('done'); }
        });
      trackEvent('followup_unsubscribe', { lead_id: leadId });
      return;
    }

    // For agreed/countered/no_response/moving — record outcome, then show form
    supabase
      .rpc('update_lead_outcome', { p_lead_id: leadId, p_outcome: result } as any)
      .then(({ error: err }) => {
        if (err) { setError(true); return; }
        setSaved(true);
        setPhase('form');
      });

    const eventMap: Record<string, string> = {
      agreed: 'followup_agreed',
      countered: 'followup_countered',
      no_response: 'followup_no_response',
      moving: 'followup_moving',
    };
    trackEvent(eventMap[result] || result, { lead_id: leadId });
  }, [leadId, result]);

  const handleTestimonialSubmit = async () => {
    if (!testimonial.trim()) return;
    await supabase.rpc('update_lead_outcome', {
      p_lead_id: leadId,
      p_outcome: 'agreed',
      p_testimonial: testimonial.trim(),
    } as any);
    trackEvent('followup_agreed_testimonial', { lead_id: leadId! });
    setPhase('done');
  };

  const handleCounterSubmit = async () => {
    if (!counterAmount.trim()) return;
    // Store counter offer amount in fair_counter_offer via upsert
    // We update via update_lead_outcome + note the counter
    await supabase.rpc('update_lead_outcome', {
      p_lead_id: leadId,
      p_outcome: 'countered',
      p_testimonial: `Counter offer: $${counterAmount}`,
    } as any);
    trackEvent('followup_countered_amount', { lead_id: leadId!, counter: counterAmount });
    setPhase('done');
  };

  const handleMovingSubmit = async () => {
    if (!budget.trim() && !neighborhoods.trim()) return;
    // Insert as agent lead
    await supabase.from('agent_leads').insert({
      name: email || 'Followup lead',
      email: email || `followup-${leadId}@unknown.com`,
      neighborhoods: neighborhoods.trim() || null,
      bedrooms: budget.trim() || null, // store budget in bedrooms field as text
      move_date: timeline || null,
      zip: null,
    } as any);

    // Also update lead capture_source
    await supabase.rpc('update_lead_outcome', {
      p_lead_id: leadId,
      p_outcome: 'moving',
      p_testimonial: `Budget: $${budget}, Neighborhoods: ${neighborhoods}, Timeline: ${timeline}`,
    } as any);

    trackEvent('followup_moving_submitted', {
      lead_id: leadId!,
      budget,
      timeline,
    });
    setPhase('done');
  };

  const handleNoResponseDone = () => {
    setPhase('done');
  };

  if (error) {
    return (
      <Shell>
        <p className="text-muted-foreground">Something went wrong. Please try again.</p>
      </Shell>
    );
  }

  if (phase === 'loading') {
    return (
      <Shell>
        <p className="text-muted-foreground">Saving your response…</p>
      </Shell>
    );
  }

  if (phase === 'done') {
    const doneMessages: Record<string, string> = {
      agreed: "That's great news! Glad the letter helped. 🎉",
      countered: "Thanks! A counter is progress — you have leverage.",
      no_response: "Got it. We'll keep you posted with tips.",
      moving: "Thanks! We'll connect you with a local specialist soon.",
      unsubscribe: "You've been unsubscribed. You won't receive any more emails from us.",
    };
    return (
      <Shell>
        <div className="flex items-center gap-2 mb-4">
          <Check className="w-5 h-5 text-verdict-good" />
          <h1 className="font-display text-2xl text-foreground">Thanks for letting us know!</h1>
        </div>
        <p className="text-muted-foreground max-w-md leading-relaxed">
          {doneMessages[result || ''] || "We've recorded your response."}
        </p>
        {result === 'countered' && (
          <p className="text-sm text-muted-foreground mt-4 max-w-md">
            Want to regenerate your letter with the new number?{' '}
            <Link to="/" className="text-primary hover:underline">Run a new analysis →</Link>
          </p>
        )}
        {result === 'no_response' && (
          <p className="text-sm text-muted-foreground mt-4 max-w-md">
            Consider sending the letter again or calling your landlord directly.{' '}
            <Link to="/" className="text-primary hover:underline">Generate a fresh letter →</Link>
          </p>
        )}
      </Shell>
    );
  }

  // ── Form phase ──
  return (
    <Shell>
      {result === 'agreed' && (
        <div className="w-full max-w-md space-y-4">
          <h1 className="font-display text-2xl text-foreground">That's great! 🎉</h1>
          <p className="text-muted-foreground leading-relaxed">
            We'd love to hear what happened. One sentence is fine — your story helps other renters.
          </p>
          <textarea
            value={testimonial}
            onChange={(e) => setTestimonial(e.target.value)}
            placeholder="e.g. My landlord agreed to keep the rent the same after I showed the data."
            rows={3}
            className="w-full px-3 py-2.5 text-sm border border-border rounded-lg bg-card text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors resize-none"
          />
          <div className="flex gap-3">
            <button
              onClick={handleTestimonialSubmit}
              disabled={!testimonial.trim()}
              className="px-5 py-2.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              Share my story
            </button>
            <button
              onClick={() => setPhase('done')}
              className="px-5 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Skip
            </button>
          </div>
        </div>
      )}

      {result === 'countered' && (
        <div className="w-full max-w-md space-y-4">
          <h1 className="font-display text-2xl text-foreground">A counter is progress!</h1>
          <p className="text-muted-foreground leading-relaxed">
            What did your landlord counter with? We can help you decide your next move.
          </p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
              <input
                type="number"
                value={counterAmount}
                onChange={(e) => setCounterAmount(e.target.value)}
                placeholder="2,400"
                className="w-full pl-7 pr-3 py-2.5 text-sm border border-border rounded-lg bg-card text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors"
              />
            </div>
            <button
              onClick={handleCounterSubmit}
              disabled={!counterAmount.trim()}
              className="px-5 py-2.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              Save
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Want to regenerate your letter with the counter?{' '}
            <Link to="/" className="text-primary hover:underline">Run a new analysis →</Link>
          </p>
        </div>
      )}

      {result === 'no_response' && (
        <div className="w-full max-w-md space-y-4">
          <h1 className="font-display text-2xl text-foreground">No response yet?</h1>
          <p className="text-muted-foreground leading-relaxed">
            That's common. Here are your options:
          </p>
          <ul className="text-sm text-muted-foreground space-y-2 list-disc pl-5">
            <li>Resend your negotiation letter — sometimes it takes a second try</li>
            <li>Follow up with a phone call referencing the letter</li>
            <li>Set a 14-day deadline and mention you're exploring alternatives</li>
          </ul>
          <div className="flex gap-3">
            <Link
              to="/"
              className="px-5 py-2.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity inline-block"
            >
              Generate a fresh letter
            </Link>
            <button
              onClick={handleNoResponseDone}
              className="px-5 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Got it, thanks
            </button>
          </div>
        </div>
      )}

      {result === 'moving' && (
        <div className="w-full max-w-md space-y-4">
          <h1 className="font-display text-2xl text-foreground">Thinking about moving?</h1>
          <p className="text-muted-foreground leading-relaxed">
            Share a few details and we'll connect you with a local rental specialist — free, no obligation.
          </p>
          <div className="space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your email"
              className="w-full px-3 py-2.5 text-sm border border-border rounded-lg bg-card text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors"
            />
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
              <input
                type="number"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="Target monthly budget"
                className="w-full pl-7 pr-3 py-2.5 text-sm border border-border rounded-lg bg-card text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors"
              />
            </div>
            <input
              type="text"
              value={neighborhoods}
              onChange={(e) => setNeighborhoods(e.target.value)}
              placeholder="Preferred neighborhoods (e.g. Park Slope, Astoria)"
              className="w-full px-3 py-2.5 text-sm border border-border rounded-lg bg-card text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors"
            />
            <select
              value={timeline}
              onChange={(e) => setTimeline(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-border rounded-lg bg-card text-muted-foreground outline-none focus:border-primary focus:text-foreground transition-colors cursor-pointer appearance-none"
            >
              <option disabled value="">Timeline</option>
              <option value="ASAP">ASAP</option>
              <option value="1-3 months">1–3 months</option>
              <option value="3-6 months">3–6 months</option>
            </select>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleMovingSubmit}
              disabled={!budget.trim() && !neighborhoods.trim()}
              className="px-5 py-2.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              Connect me
            </button>
            <button
              onClick={() => setPhase('done')}
              className="px-5 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Skip
            </button>
          </div>
        </div>
      )}
    </Shell>
  );
};

// Layout wrapper
const Shell = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen bg-background flex flex-col">
    <SEO title="Your Outcome — RenewalReply" noindex />
    <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
      <Link to="/" className="mb-8">
        <img src="/renewalreply-wordmark.png" alt="RenewalReply" className="h-7 w-auto object-contain" />
      </Link>
      {children}
      <Link to="/" className="mt-8 text-sm text-primary hover:underline">
        ← Back to RenewalReply
      </Link>
    </div>
    <SEOFooter />
  </div>
);

export default Outcome;
