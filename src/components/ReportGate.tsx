import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { trackEvent, trackAdsConversion } from '@/lib/analytics';
import { getUtmParams } from '@/lib/utm';
import { sendConfirmationEmail } from '@/lib/sendConfirmationEmail';
import { generateSharedReport, SharedReportPayload } from '@/lib/generateSharedReport';
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
  /** Payload for auto-generating shared report */
  shareReportPayload?: SharedReportPayload;
  /** Callback when report link is generated */
  onReportGenerated?: (url: string) => void;
  /** Local market YoY trend percentage */
  marketYoy?: number;
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
  shareReportPayload,
  onReportGenerated,
  marketYoy,
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

    // Unlock immediately
    onEmailCaptured(trimmed);
    setLoading(false);
    trackEvent('report_gate_converted', { verdict: verdictLabel, zip_code: zip, tool: toolType });
    trackEvent('email_submitted', { verdict: verdictLabel, zip_code: zip, source: 'report_gate', tool_type: toolType });
    trackAdsConversion(toolType, trimmed);
    // Report Gate-specific Google Ads conversion
    window.gtag?.('event', 'conversion', {
      send_to: 'AW-17990530610/3GPLCIyp14YcELLsxoJD',
      value: 1.0,
      currency: 'USD',
    });

    // Generate report + send email in parallel (non-blocking)
    (async () => {
      let reportUrl: string | null = null;
      if (shareReportPayload) {
        reportUrl = await generateSharedReport(shareReportPayload, analysisId, trimmed);
        if (reportUrl) onReportGenerated?.(reportUrl);
      }
      sendConfirmationEmail({
        email: trimmed,
        city: leadContext?.city,
        state: leadContext?.state,
        zip: leadContext?.zip,
        bedrooms: leadContext?.bedrooms,
        toolType,
        fairnessScore: leadContext?.fairnessScore,
        verdictLabel,
        reportUrl,
      });
    })();
  };

  const heading = "Your negotiation package is ready.";

  const trendSign = (marketYoy ?? 0) > 0 ? '+' : '';
  const trendStr = marketYoy != null ? `${trendSign}${marketYoy}%` : '';

  const bulletA = toolType === 'renewal'
    ? `${compsCount} nearby comps + a ready-to-send negotiation letter`
    : `${compsCount} nearby comps + a copy-paste negotiation email`;
  const bulletB = trendStr
    ? `A data-backed counter-offer using the ${trendStr} local trend`
    : 'A data-backed counter-offer based on your actual market';

  return (
    <div ref={gateRef} className="rounded-xl border border-primary/20 px-5 sm:px-8 py-7 sm:py-9 text-center" style={{ background: 'hsl(var(--primary) / 0.04)' }}>
      <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground mb-3" style={{ letterSpacing: '-0.015em' }}>
        {heading}
      </h2>
      <p className="text-sm text-muted-foreground mb-5">
        Built from {compsCount} nearby listings and your local rent trend.
      </p>
      <div className="text-sm text-muted-foreground mb-6 max-w-[440px] mx-auto text-left space-y-1.5">
        {[bulletA, bulletB].map((item, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="text-primary shrink-0 mt-0.5 font-semibold">✓</span>
            <span className="leading-relaxed font-medium">{item}</span>
          </div>
        ))}
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2 max-w-[480px] mx-auto">
        <input
          type="email"
          placeholder="you@email.com"
          value={email}
          onChange={(e) => { setEmail(e.target.value); if (error) setError(''); }}
          autoComplete="email"
          className={`flex-1 min-w-0 px-4 py-3.5 text-sm border rounded-lg bg-card text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 ${
            error ? 'border-destructive' : 'border-border focus:border-foreground'
          }`}
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-primary text-primary-foreground px-6 py-3.5 rounded-lg text-base sm:text-lg font-semibold hover:opacity-90 transition-opacity shadow-sm shadow-primary/20 whitespace-nowrap shrink-0 disabled:opacity-60"
        >
          {loading ? 'Unlocking…' : 'Unlock my report →'}
        </button>
      </form>
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
      <p className="text-sm text-muted-foreground mt-3 font-medium">
        100% free. No account needed. No spam ever.
      </p>
      <p className="text-[11px] text-muted-foreground/60 text-center mt-2">
        Unsubscribe anytime. See our{' '}
        <Link to="/privacy" className="underline hover:text-foreground transition-colors">Privacy Policy</Link>.
      </p>
    </div>
  );
};

export default ReportGate;
