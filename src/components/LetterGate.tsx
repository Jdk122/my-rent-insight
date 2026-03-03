import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { trackEvent } from '@/lib/analytics';
import { getUtmParams } from '@/lib/utm';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import type { LeadContext } from './EmailCapture';

interface LetterGateProps {
  children: React.ReactNode;
  leadContext?: LeadContext;
  onEmailCaptured?: (email: string) => void;
  prefilledEmail?: string;
}

const LetterGate = ({ children, leadContext, onEmailCaptured, prefilledEmail }: LetterGateProps) => {
  const [unlocked, setUnlocked] = useState(!!prefilledEmail);
  const [email, setEmail] = useState(prefilledEmail || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    const utm = getUtmParams();
    const verdict = 'above';

    try {
      await supabase.from('leads').upsert({
        email,
        analysis_id: leadContext?.analysisId || null,
        capture_source: 'letter_gate',
        address: leadContext?.address || null,
        city: leadContext?.city || null,
        state: leadContext?.state || null,
        zip: leadContext?.zip || null,
        bedrooms: leadContext?.bedrooms ?? null,
        current_rent: leadContext?.currentRent ?? null,
        proposed_rent: leadContext?.proposedRent ?? null,
        increase_pct: leadContext?.increasePct ?? null,
        market_trend_pct: leadContext?.marketTrendPct ?? null,
        fair_counter_offer: leadContext?.fairCounterOffer || null,
        comps_position: leadContext?.compsPosition || null,
        letter_generated: true,
        verdict,
        utm_source: utm.utm_source || null,
        utm_medium: utm.utm_medium || null,
        utm_campaign: utm.utm_campaign || null,
      } as any, { onConflict: 'email' });
    } catch {
      // Don't block UX
    }

    onEmailCaptured?.(email);
    trackEvent('email_captured', { verdict, source: 'letter_gate' });
    setUnlocked(true);
    toast.success('Letter unlocked!');
  };

  if (unlocked) {
    return <>{children}</>;
  }

  return (
    <div>
      <h2 className="section-title">Your Negotiation Letter</h2>

      {/* Blurred preview */}
      <div className="relative mt-4">
        <div
          className="select-none pointer-events-none"
          style={{ filter: 'blur(6px)', WebkitFilter: 'blur(6px)' }}
          aria-hidden="true"
        >
          {children}
        </div>
        {/* Overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-card/60 backdrop-blur-[2px] rounded-lg">
          <p className="font-display text-lg font-semibold text-foreground mb-1" style={{ letterSpacing: '-0.01em' }}>
            Your negotiation letter is ready
          </p>
          <p className="text-sm text-muted-foreground mb-4 max-w-[320px] text-center">
            Enter your email to unlock it — we'll also save a copy for you.
          </p>
          <form onSubmit={handleSubmit} className="flex gap-2 w-full max-w-[380px] px-4">
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="flex-1 min-w-0 px-4 py-3 text-sm border border-border rounded-lg bg-card text-foreground outline-none focus:border-foreground transition-colors placeholder:text-muted-foreground/50"
            />
            <button
              type="submit"
              className="bg-primary text-primary-foreground px-4 py-3 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm shadow-primary/20 whitespace-nowrap shrink-0"
            >
              Unlock my letter →
            </button>
          </form>
          <p className="text-[11px] text-muted-foreground/60 mt-2">
            No spam. See our{' '}
            <Link to="/privacy" className="underline hover:text-foreground transition-colors">Privacy Policy</Link>.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LetterGate;
