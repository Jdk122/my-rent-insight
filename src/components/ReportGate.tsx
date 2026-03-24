import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { trackEvent, trackAdsConversion } from '@/lib/analytics';
import { getUtmParams } from '@/lib/utm';
import { sendConfirmationEmail } from '@/lib/sendConfirmationEmail';
import { generateSharedReport, SharedReportPayload } from '@/lib/generateSharedReport';
import { notifySubmission } from '@/lib/notifySubmission';
import SocialProofCounter from './SocialProofCounter';
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
  marketYoy?: number,
) {
  if (toolType === 'renewal') {
    // Priority 1: belowFmrHighIncrease overrides normal verdict branching
    if (belowFmrHighIncrease) {
      const hasValidIncrease = typeof increasePct === 'number' && increasePct > 0;
      const rawMultiple =
        typeof marketYoy === 'number' && marketYoy > 0 && hasValidIncrease
          ? increasePct / marketYoy
          : null;
      const trendMultiple = rawMultiple ? Math.round(rawMultiple) : null;

      const displayIncreasePct = hasValidIncrease ? Number(increasePct!.toFixed(1)) : null;

      const heading =
        hasValidIncrease && rawMultiple && rawMultiple >= 2
          ? `Your rent is below market, but a ${displayIncreasePct}% increase is ${trendMultiple}x the area trend.`
          : hasValidIncrease
            ? `Your rent is below market, but a ${displayIncreasePct}% increase is still too aggressive.`
            : `Your rent is below market, but the increase is still too aggressive.`;

      return {
        heading,
        bulletA: 'See the comps showing your rent is already fair and why the increase isn\'t',
        bulletB: 'Get a landlord-ready letter that says yes to renewing but no to the increase',
        bulletC: 'See available apartments nearby that could save you money',
        cta: 'Email me my negotiation plan →',
      };
    }
    switch (verdict) {
      case 'above':
        if (monthlyOverpayment && monthlyOverpayment > 0) {
          return {
    heading: `Your landlord is asking ~$${fmt(monthlyOverpayment)}/month above market. Here's the evidence.`,
            bulletA: compsCount > 0 ? `${compsCount} comparable units showing your landlord is charging above market` : 'Comparable units showing your landlord is charging above market',
            bulletB: 'A send-ready negotiation letter with your exact counter-offer built in',
            bulletC: 'See available apartments nearby that could save you money',
            cta: 'Email me my counter-offer →',
            valueAnchor: `This could help you save ~$${fmt(monthlyOverpayment * 12)}/year on your renewal.`,
          };
        }
        // Only use the specific % headline if both values are valid numbers
        if (typeof increasePct === 'number' && typeof marketYoy === 'number' && increasePct > 0) {
          const increaseText = increasePct >= 10 ? Math.round(increasePct).toString() : increasePct.toFixed(1);
          const marketText = Math.abs(marketYoy) < 1 ? marketYoy.toFixed(1) : Math.round(marketYoy).toString();
          return {
            heading: `Your landlord wants ${increaseText}% — the market moved ${marketText}%. Here's what to send them.`,
            bulletA: compsCount > 0 ? `${compsCount} comparable units showing what your neighbors actually pay` : 'Comparable units showing what your neighbors actually pay',
            bulletB: 'A landlord-ready negotiation letter you can send this week',
            bulletC: 'See available apartments nearby that could save you money',
            cta: 'Email me my counter-offer →',
          };
        }
        return {
          heading: 'Your increase exceeds the local market. Here\'s what to send your landlord.',
          bulletA: compsCount > 0 ? `${compsCount} comparable units showing what your neighbors actually pay` : 'Comparable units showing what your neighbors actually pay',
          bulletB: 'A landlord-ready negotiation letter you can send this week',
          bulletC: 'See available apartments nearby that could save you money',
          cta: 'Email me my counter-offer →',
        };
      case 'at-market':
        return {
          heading: 'Your rent is fair, but you still have leverage. Here\'s the proof.',
          bulletA: compsCount > 0 ? `${compsCount} comparable units showing exactly where you stand` : 'Comparable units showing exactly where you stand',
          bulletB: 'A ready-to-send renewal response that protects your position',
          bulletC: 'Browse available apartments in your area',
          cta: 'Email me my full report →',
        };
      case 'below':
        return {
          heading: 'Your rent is a good deal. Here\'s what to ask for at renewal.',
          bulletA: compsCount > 0 ? `See how much less you pay than ${compsCount} nearby units` : 'See how much less you pay than nearby units',
          bulletB: 'Get a renewal response to lock in your rate or ask for extras like repairs, upgrades, or a lease extension',
          cta: 'Email me my renewal plan →',
        };
      default: // 'none' or fallback
        return {
          heading: 'Your rent isn\'t going up — do you know what you\'d pay if you moved?',
          bulletA: compsCount > 0 ? `See how your current rent stacks up against ${compsCount} nearby listings` : 'See how your current rent stacks up against nearby listings',
          bulletB: 'A market snapshot to keep in your back pocket for next year\'s renewal',
          bulletC: 'Browse available apartments in your area',
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
          bulletC: 'See available apartments nearby that could save you money',
          cta: 'Email me my negotiation plan →',
          valueAnchor: `This could help you save ~$${fmt(monthlySavings * 12)}/year on your renewal.`,
        };
      }
      return {
        heading: 'This asking rent is above market. Here\'s the proof.',
        bulletA: 'See the comps showing fair market rent',
        bulletB: 'Get a negotiation plan to get a better price',
        bulletC: 'See available apartments nearby that could save you money',
        cta: 'Email me my negotiation plan →',
      };
    case 'fair':
      return {
        heading: 'Fair price confirmed. Get the full breakdown before you sign.',
        bulletA: 'See the nearby comps behind this result',
        bulletB: 'Get the full market context before you decide',
        bulletC: 'Browse available apartments in your area',
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
        bulletC: 'Browse available apartments in your area',
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
          trackEvent('prompt_shown', { prompt: 'report_gate', tool: toolType, verdict: verdictLabel, zip });
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
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Please enter a valid email.');
      return;
    }
    setError('');
    setLoading(true);

    const utm = getUtmParams();
    try {
      const leadParams = {
        p_email: trimmed,
        p_analysis_id: analysisId || null,
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
      } as any;

      let { error: rpcError } = await supabase.rpc('upsert_lead', leadParams);
      // Retry without analysis_id on FK violation
      if (rpcError && analysisId) {
        console.warn('[lead] upsert_lead FK retry without analysis_id:', rpcError.message);
        ({ error: rpcError } = await supabase.rpc('upsert_lead', { ...leadParams, p_analysis_id: null }));
      }
      if (rpcError) console.error('[lead] upsert_lead failed (report_gate):', rpcError.message);

      let { error: evtError } = await supabase.from('lead_events' as any).insert({
        email: trimmed,
        analysis_id: analysisId || null,
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
      // Retry without analysis_id on FK violation
      if (evtError && analysisId) {
        ({ error: evtError } = await supabase.from('lead_events' as any).insert({
          email: trimmed,
          analysis_id: null,
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
        } as any));
      }
      if (evtError) console.error('[lead] lead_events insert failed (report_gate):', evtError.message);
    } catch (err) {
      console.error('[lead] report_gate unexpected error:', err);
    }

    // Unlock immediately
    onEmailCaptured(trimmed);
    setLoading(false);
    trackEvent('email_captured', { gate: 'report_gate', tool: toolType, verdict: verdictLabel, zip });
    trackAdsConversion(toolType, trimmed);

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
      await notifySubmission({
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
      }, 'report_gate_email_capture');
    })();
  };

  const copy = getGateCopy(toolType, verdict, verdictLabel, compsCount, monthlyOverpayment, monthlySavings, belowFmrHighIncrease, increasePct, marketYoy);

  return (
    <div ref={gateRef} className="rounded-xl border border-primary/20 px-5 sm:px-8 py-5 sm:py-9 text-center" style={{ background: 'hsl(var(--primary) / 0.04)' }}>
      {toolType === 'renewal' && <SocialProofCounter />}
      <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground mb-2 sm:mb-3" style={{ letterSpacing: '-0.015em' }}>
        {copy.heading}
      </h2>
      <div className="text-sm text-muted-foreground mb-4 sm:mb-6 max-w-[440px] mx-auto text-left space-y-0.5 sm:space-y-1.5">
        {[copy.bulletA, copy.bulletB, copy.bulletC].filter(Boolean).map((item, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="text-primary shrink-0 mt-0.5 font-semibold">✓</span>
            <span className="leading-relaxed font-medium">{item}</span>
          </div>
        ))}
      </div>
      <p className="text-sm text-muted-foreground mb-3 sm:mb-4 -mt-2 sm:-mt-3">
        {copy.valueAnchor ?? 'See the market data behind your result.'}
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 sm:gap-3 max-w-[480px] mx-auto">
        <input
          type="email"
          placeholder="Your email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); if (error) setError(''); }}
          autoComplete="email"
          className={`w-full sm:flex-1 sm:min-w-0 h-12 sm:h-auto px-4 py-3 sm:py-3.5 text-base sm:text-sm border rounded-lg bg-card text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 ${
            error ? 'border-destructive' : 'border-border focus:border-foreground'
          }`}
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full sm:w-auto bg-primary text-primary-foreground px-6 py-3 sm:py-3.5 rounded-lg text-base sm:text-lg font-semibold hover:opacity-90 transition-opacity shadow-sm shadow-primary/20 whitespace-nowrap shrink-0 disabled:opacity-60"
        >
          {loading ? 'Unlocking…' : copy.cta}
        </button>
      </form>
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
      <p className="text-xs sm:text-sm text-muted-foreground mt-2 sm:mt-3 font-medium">
        Free · Instant delivery · Unsubscribe anytime
      </p>
      <p className="text-[10px] sm:text-[11px] text-muted-foreground/60 text-center mt-1 sm:mt-2">
        Unsubscribe anytime. See our{' '}
        <Link to="/privacy" className="underline hover:text-foreground transition-colors">Privacy Policy</Link>.
      </p>
    </div>
  );
};

export default ReportGate;
