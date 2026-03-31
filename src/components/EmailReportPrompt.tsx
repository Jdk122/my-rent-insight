import { useState, useEffect, useRef } from 'react';
import { Mail, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { trackEvent, trackAdsConversion } from '@/lib/analytics';
import { getUtmParams } from '@/lib/utm';
import { sendConfirmationEmail } from '@/lib/sendConfirmationEmail';
import { generateSharedReport, SharedReportPayload } from '@/lib/generateSharedReport';
import { notifySubmission } from '@/lib/notifySubmission';
import { rememberEmail } from '@/lib/emailMemory';
import type { LeadContext } from './EmailCapture';
import { GATE_VARIANT } from '@/lib/featureFlags';

interface EmailReportPromptProps {
  analysisId: string;
  leadContext: LeadContext;
  verdictLabel: string;
  zip: string;
  city: string;
  onEmailCaptured: (email: string) => void;
  toolType: 'renewal' | 'wsip';
  shareReportPayload?: SharedReportPayload;
  onReportGenerated?: (url: string) => void;
  placement: 'post_evidence' | 'post_letter';
}

const EmailReportPrompt = ({
  analysisId,
  leadContext,
  verdictLabel,
  zip,
  city,
  onEmailCaptured,
  toolType,
  shareReportPayload,
  onReportGenerated,
  placement,
}: EmailReportPromptProps) => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const shownRef = useRef(false);

  // Track impression once
  useEffect(() => {
    if (shownRef.current) return;
    shownRef.current = true;
    trackEvent('soft_capture_shown', { placement, gate_variant: GATE_VARIANT, tool: toolType });
  }, []);

  const isCompact = placement === 'post_evidence';

  const heading = isCompact ? 'Save your analysis?' : 'Want a copy of this report?';
  const subtext = isCompact
    ? "Get this report emailed to you for your next conversation with your landlord."
    : "We'll send you the full report so you have your comps, letter, and market data ready.";

  const captureSource = `soft_${placement}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Enter a valid email');
      return;
    }
    setError('');
    setLoading(true);

    const utm = getUtmParams();

    try {
      const leadParams = {
        p_email: trimmed,
        p_analysis_id: leadContext?.analysisId || null,
        p_capture_source: captureSource,
        p_address: leadContext?.address || null,
        p_city: leadContext?.city || null,
        p_state: leadContext?.state || null,
        p_zip: leadContext?.zip || null,
        p_bedrooms: leadContext?.bedrooms ?? null,
        p_current_rent: leadContext?.currentRent ?? null,
        p_proposed_rent: leadContext?.proposedRent ?? null,
        p_increase_pct: leadContext?.increasePct ?? null,
        p_market_trend_pct: leadContext?.marketTrendPct ?? null,
        p_fair_counter_offer: leadContext?.fairCounterOffer || null,
        p_comps_position: leadContext?.compsPosition || null,
        p_letter_generated: leadContext?.letterGenerated ?? false,
        p_verdict: verdictLabel || null,
        p_utm_source: utm.utm_source || null,
        p_utm_medium: utm.utm_medium || null,
        p_utm_campaign: utm.utm_campaign || null,
        p_fairness_score: leadContext?.fairnessScore ?? null,
        p_comp_median_rent: leadContext?.compMedianRent ?? null,
        p_hud_fmr_value: leadContext?.hudFmrValue ?? null,
        p_tool_type: toolType,
      } as any;

      let { error: rpcError } = await supabase.rpc('upsert_lead', leadParams);
      if (rpcError && leadContext?.analysisId) {
        ({ error: rpcError } = await supabase.rpc('upsert_lead', { ...leadParams, p_analysis_id: null }));
      }
      if (rpcError) console.error('[soft-capture] upsert_lead failed:', rpcError.message);

      const evtPayload = {
        email: trimmed,
        analysis_id: leadContext?.analysisId || null,
        event_type: captureSource,
        fairness_score: leadContext?.fairnessScore ?? null,
        address: leadContext?.address || null,
        zip: leadContext?.zip || null,
        current_rent: leadContext?.currentRent ?? null,
        proposed_rent: leadContext?.proposedRent ?? null,
        increase_pct: leadContext?.increasePct ?? null,
        verdict: verdictLabel || null,
        comp_median_rent: leadContext?.compMedianRent ?? null,
        hud_fmr_value: leadContext?.hudFmrValue ?? null,
      } as any;
      let { error: evtError } = await supabase.from('lead_events' as any).insert(evtPayload);
      if (evtError && leadContext?.analysisId) {
        ({ error: evtError } = await supabase.from('lead_events' as any).insert({ ...evtPayload, analysis_id: null }));
      }
    } catch (err) {
      console.error('[soft-capture] save failed:', err);
    }

    rememberEmail(trimmed);
    onEmailCaptured(trimmed);
    trackEvent('soft_capture_converted', { placement, gate_variant: GATE_VARIANT, tool: toolType, zip });
    trackEvent('email_captured', { gate: captureSource, tool: toolType, verdict: verdictLabel || 'unknown', zip, gate_variant: GATE_VARIANT });
    trackAdsConversion(toolType, trimmed);
    setSubmitted(true);
    setLoading(false);
    toast.success('Report saved — check your inbox.');

    // Non-blocking: generate report + send email + notify
    (async () => {
      let reportUrl: string | null = null;
      if (shareReportPayload) {
        reportUrl = await generateSharedReport(shareReportPayload, leadContext?.analysisId, trimmed);
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
      await notifySubmission({
        email: trimmed,
        zip: leadContext?.zip || null,
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
        analysis_id: leadContext?.analysisId || null,
      }, captureSource);
    })();
  };

  if (submitted) {
    return (
      <div className={`rounded-lg border border-verdict-good/30 bg-verdict-good/5 ${isCompact ? 'px-4 py-3' : 'px-5 py-4'} flex items-center gap-3`}>
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-verdict-good/10 shrink-0">
          <Check className="w-4 h-4 text-verdict-good" />
        </div>
        <div>
          <p className={`${isCompact ? 'text-sm' : 'text-base'} font-medium text-foreground`}>Report sent — check your inbox.</p>
          <p className="text-xs text-muted-foreground mt-0.5">We sent your full analysis to {email}.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg border border-border/60 bg-card ${isCompact ? 'px-4 py-3' : 'px-5 py-4'}`}
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
    >
      <div className="flex items-start gap-3">
        <div className={`flex items-center justify-center rounded-full bg-primary/10 shrink-0 ${isCompact ? 'w-8 h-8' : 'w-10 h-10'}`}>
          <Mail className={`text-primary ${isCompact ? 'w-4 h-4' : 'w-5 h-5'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`font-semibold text-foreground ${isCompact ? 'text-sm' : 'text-base'}`}>{heading}</p>
          <p className={`text-muted-foreground mt-0.5 ${isCompact ? 'text-xs' : 'text-sm'}`}>{subtext}</p>
          <form onSubmit={handleSubmit} className={`flex gap-2 ${isCompact ? 'mt-2' : 'mt-3'}`}>
            <input
              type="email"
              placeholder="you@email.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); }}
              required
              autoComplete="email"
              className={`flex-1 min-w-0 px-3 border border-border rounded-lg bg-card text-foreground outline-none focus:border-foreground transition-colors placeholder:text-muted-foreground/50 ${isCompact ? 'py-2 text-sm' : 'py-2.5 text-sm'}`}
            />
            <button
              type="submit"
              disabled={loading}
              className={`bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 transition-opacity shadow-sm shadow-primary/20 whitespace-nowrap shrink-0 ${isCompact ? 'px-3 py-2 text-sm' : 'px-4 py-2.5 text-sm'}`}
            >
              {loading ? '...' : 'Send'}
            </button>
          </form>
          {error && <p className="text-xs text-destructive mt-1">{error}</p>}
          <p className={`text-muted-foreground/60 ${isCompact ? 'text-[10px] mt-1.5' : 'text-[11px] mt-2'}`}>
            No spam, ever.{' '}
            <Link to="/privacy" className="underline hover:text-muted-foreground transition-colors">Privacy policy</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default EmailReportPrompt;
