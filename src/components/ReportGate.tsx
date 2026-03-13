import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { trackEvent, trackAdsConversion } from '@/lib/analytics';
import { getUtmParams } from '@/lib/utm';
import { sendConfirmationEmail } from '@/lib/sendConfirmationEmail';
import { generateSharedReport, SharedReportPayload } from '@/lib/generateSharedReport';
import type { LeadContext } from './EmailCapture';

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

interface ReportGateProps {
  /** 'renewal' or 'wsip' */
  toolType: 'renewal' | 'wsip';
  /** Number of comps available behind the gate */
  compsCount: number;
  /** Verdict for adaptive copy */
  verdictLabel: string;
  /** High pain = overpriced/above; low pain = fair/below */
  isHighPain: boolean;
  /** Granular verdict for copy control */
  verdict?: 'above' | 'at-market' | 'below' | 'none';
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
  /** Renewal tool: monthly $ the user is overpaying (newRent - counterOffer.counterLow). Only passed when evidence is solid. */
  monthlyOverpayment?: number | null;
  /** WSIP tool: monthly $ savings opportunity (askingRent - fairRangeHigh). Only passed when verdict is 'above'. */
  monthlySavings?: number | null;
  /** Renewal tool: true when rent is below FMR but increase rate is aggressively above trend */
  belowFmrHighIncrease?: boolean;
  /** Increase percentage for belowFmrHighIncrease copy */
  increasePct?: number;
}

function getGateCopy(
  toolType: 'renewal' | 'wsip',
  verdict: string | undefined,
  verdictLabel: string,
  compsCount: number,
  monthlyOverpayment?: number | null,
  monthlySavings?: number | null,
  belowFmrHighIncrease?: boolean,
  increasePct?: number,
) {
  if (toolType === 'renewal') {
    // Priority 1: belowFmrHighIncrease overrides normal verdict branching
    if (belowFmrHighIncrease) {
      return {
        heading: `Your rent is below market — but a ${increasePct ?? 0}% increase is still too aggressive.`,
        bulletA: 'See the comps showing where your rent falls',
        bulletB: 'Get a landlord-ready email to push back on the rate of increase',
        cta: 'Email me my negotiation plan →',
      };
    }
    switch (verdict) {
      case 'above':
        if (monthlyOverpayment && monthlyOverpayment > 0) {
          return {
            heading: `You're overpaying by ~$${fmt(monthlyOverpayment)}/month`,
            bulletA: compsCount > 0 ? `See the ${compsCount} comps behind that number` : 'See the comps behind that number',
            bulletB: 'Copy a send-ready email with your exact counter-offer',
            cta: 'Email me my counter-offer →',
          };
        }
        return {
          heading: 'Your increase exceeds the local market. Here\'s your plan.',
          bulletA: 'See the comps behind your analysis',
          bulletB: 'Get a landlord-ready response you can send this week',
          cta: 'Email me my negotiation plan →',
        };
      case 'at-market':
        return {
          heading: 'At-market doesn\'t mean non-negotiable. See the comps.',
          bulletA: 'See how your rent compares to nearby units',
          bulletB: 'Get a ready-to-send response before you reply',
          cta: 'Email me my full report →',
        };
      case 'below':
        return {
          heading: 'You\'re below market. Protect your position.',
          bulletA: 'See why your rent is favorable vs. nearby units',
          bulletB: 'Get a renewal response to lock in your rate — or ask for extras like repairs or a longer lease',
          cta: 'Email me my renewal strategy →',
        };
      default: // 'none' or fallback
        return {
          heading: 'Your landlord kept your rent flat. Here\'s what that\'s worth.',
          bulletA: 'See how your rent compares to nearby listings',
          bulletB: 'A market report to use at your next renewal',
          cta: 'Email me my market report →',
        };
    }
  }

  // WSIP tool
  switch (verdictLabel) {
    case 'above':
      if (monthlySavings && monthlySavings > 0) {
        return {
          heading: `This unit looks overpriced by ~$${fmt(monthlySavings)}/month`,
          bulletA: 'See the comps behind that estimate',
          bulletB: 'Get a data-backed plan before you negotiate',
          cta: 'Email me my negotiation plan →',
        };
      }
      return {
        heading: 'This asking rent is above market. Here\'s the proof.',
        bulletA: 'See the comps showing fair market rent',
        bulletB: 'Get a negotiation plan to get a better price',
        cta: 'Email me my negotiation plan →',
      };
    case 'fair':
      return {
        heading: 'Fair price confirmed. Get the full breakdown before you sign.',
        bulletA: 'See the nearby comps behind this result',
        bulletB: 'Get the full market context before you decide',
        cta: 'Email me the full breakdown →',
      };
    case 'below':
      return {
        heading: 'This looks like a good deal. See why before you move fast.',
        bulletA: 'See the comps showing your rent advantage',
        bulletB: 'Get the full market breakdown before you sign',
        cta: 'Email me the full breakdown →',
      };
    default: // 'none' or fallback
      return {
        heading: 'Your fair rent range is ready',
        bulletA: 'Comparable rentals near you',
        bulletB: 'A fair price range to negotiate with confidence',
        cta: 'Email me my market report →',
      };
  }
}

const ReportGate = ({
  toolType,
  compsCount,
  verdictLabel,
  isHighPain,
  verdict,
  leadContext,
  analysisId,
  zip,
  city,
  onEmailCaptured,
  prefilledEmail,
  shareReportPayload,
  onReportGenerated,
  marketYoy,
  monthlyOverpayment,
  monthlySavings,
  belowFmrHighIncrease,
  increasePct,
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
      // Re-notify with captured email so admin notification shows it
      supabase.functions.invoke('notify-submission', {
        body: {
          email: trimmed,
          zip: leadContext?.zip || zip,
          city: leadContext?.city || city,
          state: leadContext?.state || null,
          bedrooms: leadContext?.bedrooms ?? null,
          current_rent: leadContext?.currentRent ?? null,
          proposed_rent: leadContext?.proposedRent ?? null,
          increase_pct: leadContext?.increasePct ?? null,
          fairness_score: leadContext?.fairnessScore ?? null,
          verdict_label: verdictLabel || null,
          address: leadContext?.address || null,
          comp_median_rent: leadContext?.compMedianRent ?? null,
          hud_fmr_value: leadContext?.hudFmrValue ?? null,
          analysis_id: analysisId,
        },
      }).catch(() => {});
    })();
  };

  const copy = getGateCopy(toolType, verdict, verdictLabel, compsCount, monthlyOverpayment, monthlySavings, belowFmrHighIncrease, increasePct);

  return (
    <div ref={gateRef} className="rounded-xl border border-primary/20 px-5 sm:px-8 py-7 sm:py-9 text-center" style={{ background: 'hsl(var(--primary) / 0.04)' }}>
      <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground mb-3" style={{ letterSpacing: '-0.015em' }}>
        {copy.heading}
      </h2>
      <div className="text-sm text-muted-foreground mb-6 max-w-[440px] mx-auto text-left space-y-1.5">
        {[copy.bulletA, copy.bulletB].map((item, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="text-primary shrink-0 mt-0.5 font-semibold">✓</span>
            <span className="leading-relaxed font-medium">{item}</span>
          </div>
        ))}
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-[480px] mx-auto">
        <input
          type="email"
          placeholder="Your email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); if (error) setError(''); }}
          autoComplete="email"
          className={`w-full sm:flex-1 sm:min-w-0 h-12 sm:h-auto px-4 py-3.5 text-base sm:text-sm border rounded-lg bg-card text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 ${
            error ? 'border-destructive' : 'border-border focus:border-foreground'
          }`}
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full sm:w-auto bg-primary text-primary-foreground px-6 py-3.5 rounded-lg text-base sm:text-lg font-semibold hover:opacity-90 transition-opacity shadow-sm shadow-primary/20 whitespace-nowrap shrink-0 disabled:opacity-60"
        >
          {loading ? 'Unlocking…' : copy.cta}
        </button>
      </form>
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
      <p className="text-sm text-muted-foreground mt-3 font-medium">
        Free report · No spam · Instant delivery
      </p>
      <p className="text-[11px] text-muted-foreground/60 text-center mt-2">
        Unsubscribe anytime. See our{' '}
        <Link to="/privacy" className="underline hover:text-foreground transition-colors">Privacy Policy</Link>.
      </p>
    </div>
  );
};

export default ReportGate;
