import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { trackEvent, trackAdsConversion } from '@/lib/analytics';
import { getUtmParams } from '@/lib/utm';
import SocialProofLine from './SocialProofLine';
import type { LeadContext } from './EmailCapture';

interface ReportGateProps {
  /** 'renewal' or 'wsip' */
  toolType: 'renewal' | 'wsip';
  /** Number of comps available behind the gate */
  compsCount: number;
  /** Verdict for adaptive copy */
  verdictLabel: string;
  /** High pain = overpriced/above; low pain = fair/below */
  isHighPain: boolean;
  leadContext?: LeadContext;
  analysisId: string;
  zip: string;
  city: string;
  onEmailCaptured: (email: string) => void;
  /** Pre-filled email from form */
  prefilledEmail?: string;
}

const ReportGate = ({
  toolType,
  compsCount,
  verdictLabel,
  isHighPain,
  leadContext,
  analysisId,
  zip,
  city,
  onEmailCaptured,
  prefilledEmail,
}: ReportGateProps) => {
  const [email, setEmail] = useState(prefilledEmail || '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const gateRef = useRef<HTMLDivElement>(null);

  // Track gate visibility
  useEffect(() => {
    const el = gateRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          trackEvent('report_gate_shown', { verdict: verdictLabel, zip_code: zip, tool: toolType });
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [verdictLabel, zip, toolType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Please enter a valid email.');
      return;
    }
    setError('');
    setLoading(true);

    const utm = getUtmParams();
    try {
      const { error: rpcError } = await supabase.rpc('upsert_lead', {
        p_email: trimmed,
        p_analysis_id: analysisId,
        p_capture_source: 'report_gate',
        p_address: leadContext?.address || null,
        p_city: leadContext?.city || null,
        p_state: leadContext?.state || null,
        p_zip: leadContext?.zip || null,
        p_bedrooms: leadContext?.bedrooms ?? null,
        p_current_rent: leadContext?.currentRent ?? null,
        p_proposed_rent: leadContext?.proposedRent ?? null,
        p_increase_pct: leadContext?.increasePct ?? null,
        p_verdict: verdictLabel || null,
        p_utm_source: utm.utm_source || null,
        p_utm_medium: utm.utm_medium || null,
        p_utm_campaign: utm.utm_campaign || null,
        p_fairness_score: leadContext?.fairnessScore ?? null,
        p_comp_median_rent: leadContext?.compMedianRent ?? null,
        p_hud_fmr_value: leadContext?.hudFmrValue ?? null,
        p_tool_type: toolType === 'wsip' ? 'wsip' : 'renewal',
      } as any);
      if (rpcError) console.error('[lead] upsert_lead failed (report_gate):', rpcError.message);

      const { error: evtError } = await supabase.from('lead_events' as any).insert({
        email: trimmed,
        analysis_id: analysisId,
        event_type: 'report_gate',
        fairness_score: leadContext?.fairnessScore ?? null,
        address: leadContext?.address || null,
        zip: leadContext?.zip || null,
        current_rent: leadContext?.currentRent ?? null,
        proposed_rent: leadContext?.proposedRent ?? null,
        increase_pct: leadContext?.increasePct ?? null,
        verdict: verdictLabel || null,
        comp_median_rent: leadContext?.compMedianRent ?? null,
        hud_fmr_value: leadContext?.hudFmrValue ?? null,
      } as any);
      if (evtError) console.error('[lead] lead_events insert failed (report_gate):', evtError.message);
    } catch (err) {
      console.error('[lead] report_gate unexpected error:', err);
    }

    onEmailCaptured(trimmed);
    setLoading(false);
    trackEvent('report_gate_converted', { verdict: verdictLabel, zip_code: zip, tool: toolType });
    trackEvent('email_submitted', { verdict: verdictLabel, zip_code: zip, source: 'report_gate' });
    trackAdsConversion();
  };

  // Adaptive copy based on pain level and tool type
  const heading = isHighPain
    ? toolType === 'renewal'
      ? 'Unlock your Evidence & Action Kit'
      : 'Unlock your Full Market Report'
    : 'Save your analysis — get the full report emailed to you';

  const bullets = toolType === 'renewal'
    ? `Includes: ${compsCount} comparable listings with real addresses, full market analysis, your personalized negotiation letter, and recommended next steps.`
    : `Includes: ${compsCount} comparable listings with real addresses, full market analysis, negotiation playbook with copy-paste email template, and recommended next steps.`;

  return (
    <div ref={gateRef} className="rounded-xl border border-primary/20 px-5 sm:px-8 py-6 sm:py-8 text-center" style={{ background: 'hsl(var(--primary) / 0.04)' }}>
      <h2 className="font-display text-xl sm:text-2xl font-semibold text-foreground mb-2" style={{ letterSpacing: '-0.01em' }}>
        {heading}
      </h2>
      <p className="text-sm text-muted-foreground mb-5 max-w-[440px] mx-auto leading-relaxed">
        {bullets}
      </p>
      <form onSubmit={handleSubmit} className="flex gap-2 max-w-[440px] mx-auto">
        <input
          type="email"
          placeholder="you@email.com"
          value={email}
          onChange={(e) => { setEmail(e.target.value); if (error) setError(''); }}
          className={`flex-1 min-w-0 px-4 py-3 text-sm border rounded-lg bg-card text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 ${
            error ? 'border-destructive' : 'border-border focus:border-foreground'
          }`}
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-primary text-primary-foreground px-5 py-3 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm shadow-primary/20 whitespace-nowrap shrink-0 disabled:opacity-60"
        >
          {loading ? 'Unlocking…' : 'Unlock my report →'}
        </button>
      </form>
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
      <p className="text-[12px] text-muted-foreground/70 mt-3">Free. No account required.</p>
      <div className="mt-2">
        <SocialProofLine />
      </div>
      <p className="text-[11px] text-muted-foreground/60 text-center mt-3">
        No spam. Unsubscribe anytime. See our{' '}
        <Link to="/privacy" className="underline hover:text-foreground transition-colors">Privacy Policy</Link>.
      </p>
    </div>
  );
};

export default ReportGate;
