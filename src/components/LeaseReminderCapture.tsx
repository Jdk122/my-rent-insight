import { useState, useRef, useEffect } from 'react';
import { CalendarDays, Check } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { trackEvent, trackAdsConversion } from '@/lib/analytics';
import { getUtmParams } from '@/lib/utm';
import { sendConfirmationEmail } from '@/lib/sendConfirmationEmail';
import { generateSharedReport, SharedReportPayload } from '@/lib/generateSharedReport';
import { notifySubmission } from '@/lib/notifySubmission';
import { rememberEmail } from '@/lib/emailMemory';
import { GATE_VARIANT } from '@/lib/featureFlags';
import type { LeadContext } from './EmailCapture';

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 6 }, (_, i) => currentYear + i);

interface LeaseReminderCaptureProps {
  leadContext?: LeadContext;
  verdictLabel: string;
  zip: string;
  city: string;
  onEmailCaptured: (email: string) => void;
  toolType: 'renewal' | 'wsip';
  shareReportPayload?: SharedReportPayload;
  onReportGenerated?: (url: string) => void;
}

const LeaseReminderCapture = ({
  leadContext,
  verdictLabel,
  zip,
  city,
  onEmailCaptured,
  toolType,
  shareReportPayload,
  onReportGenerated,
}: LeaseReminderCaptureProps) => {
  const [email, setEmail] = useState('');
  const [leaseMonth, setLeaseMonth] = useState('');
  const [leaseYear, setLeaseYear] = useState('');
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const impressionFired = useRef(false);

  useEffect(() => {
    if (!impressionFired.current) {
      impressionFired.current = true;
      trackEvent('lease_reminder_shown', {
        gate_variant: GATE_VARIANT,
        placement: 'bottom_universal',
        tool: toolType,
      });
    }
  }, [toolType]);

  const handleSubmit = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast('Please enter a valid email');
      return;
    }
    if (!leaseMonth) {
      toast('Please select a month');
      return;
    }

    setSubmitting(true);
    const leaseMonthNum = months.indexOf(leaseMonth) + 1;
    const leaseYearNum = leaseYear ? parseInt(leaseYear, 10) : null;
    const utm = getUtmParams();

    try {
      await supabase.rpc('upsert_lead', {
        p_email: trimmed,
        p_analysis_id: leadContext?.analysisId || null,
        p_capture_source: 'lease_reminder',
        p_lease_expiration_month: leaseMonthNum,
        p_lease_expiration_year: leaseYearNum,
        p_partner_opt_in: false,
        p_verdict: verdictLabel || null,
        p_zip: zip || null,
        p_city: city || null,
        p_state: leadContext?.state || null,
        p_address: leadContext?.address || null,
        p_bedrooms: leadContext?.bedrooms ?? null,
        p_current_rent: leadContext?.currentRent ?? null,
        p_proposed_rent: leadContext?.proposedRent ?? null,
        p_increase_pct: leadContext?.increasePct ?? null,
        p_market_trend_pct: leadContext?.marketTrendPct ?? null,
        p_fair_counter_offer: leadContext?.fairCounterOffer || null,
        p_comps_position: leadContext?.compsPosition || null,
        p_letter_generated: leadContext?.letterGenerated ?? false,
        p_fairness_score: leadContext?.fairnessScore ?? null,
        p_comp_median_rent: leadContext?.compMedianRent ?? null,
        p_hud_fmr_value: leadContext?.hudFmrValue ?? null,
        p_utm_source: utm.utm_source || null,
        p_utm_medium: utm.utm_medium || null,
        p_utm_campaign: utm.utm_campaign || null,
        p_tool_type: toolType,
      } as any);

      await supabase.from('lead_events').insert({
        email: trimmed,
        event_type: 'lease_reminder',
        analysis_id: leadContext?.analysisId || null,
        zip: zip || null,
        verdict: verdictLabel || null,
        fairness_score: leadContext?.fairnessScore ?? null,
        comp_median_rent: leadContext?.compMedianRent ?? null,
        hud_fmr_value: leadContext?.hudFmrValue ?? null,
      } as any);
    } catch (err) {
      console.error('[LeaseReminderCapture] save failed:', err);
    }

    rememberEmail(trimmed);
    onEmailCaptured(trimmed);

    trackEvent('lease_reminder_set', {
      gate_variant: GATE_VARIANT,
      had_email: 'false',
      placement: 'bottom_universal',
      tool: toolType,
    });
    trackEvent('email_captured', {
      gate: 'lease_reminder',
      gate_variant: GATE_VARIANT,
      tool: toolType,
    });
    trackAdsConversion(toolType, trimmed);

    setSaved(true);
    setSubmitting(false);
    toast.success('Report sent — and we\'ll remind you 90 days before your renewal.');

    // Non-blocking: generate report + send email + notify
    (async () => {
      let reportUrl: string | null = null;
      if (shareReportPayload) {
        reportUrl = await generateSharedReport(shareReportPayload, leadContext?.analysisId, trimmed);
        if (reportUrl) onReportGenerated?.(reportUrl);
      }
      sendConfirmationEmail({
        email: trimmed,
        city: city || null,
        state: leadContext?.state || null,
        zip: zip || null,
        bedrooms: leadContext?.bedrooms ?? null,
        toolType,
        fairnessScore: leadContext?.fairnessScore ?? null,
        verdictLabel: verdictLabel || null,
        reportUrl,
      }).catch(() => {});
      notifySubmission({
        email: trimmed,
        zip,
        city,
        capture_source: 'lease_reminder',
        verdict: verdictLabel,
        tool_type: toolType,
        analysis_id: leadContext?.analysisId || null,
      }, 'lease_reminder').catch(() => {});
    })();
  };

  if (saved) {
    return (
      <div className="rounded-lg border border-verdict-good/30 bg-verdict-good/5 px-4 py-3 flex items-center gap-3">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-verdict-good/10 shrink-0">
          <Check className="w-4 h-4 text-verdict-good" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">Report sent — and we'll remind you 90 days before your renewal.</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {leaseMonth && leaseYear
              ? `Fresh market data will arrive before ${leaseMonth} ${leaseYear}.`
              : leaseMonth
              ? `Fresh market data will arrive before ${leaseMonth}.`
              : "You're all set."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 sm:p-5 space-y-4">
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-primary shrink-0" />
          <p className="text-sm font-semibold text-foreground">Save your report and set a renewal reminder</p>
        </div>
        <p className="text-[13px] text-muted-foreground leading-relaxed">
          We'll email you this full report now, and send a fresh market update 90 days before your lease ends.
        </p>
      </div>
      <div className="flex flex-wrap gap-2 max-w-[520px]">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          className="flex-1 min-w-[160px] px-3 py-2.5 text-base md:text-sm border border-border rounded-lg bg-card text-foreground placeholder:text-muted-foreground outline-none focus:border-foreground transition-colors"
        />
        <select
          value={leaseMonth}
          onChange={(e) => setLeaseMonth(e.target.value)}
          className="w-[110px] px-3 py-2.5 text-sm border border-border rounded-lg bg-card text-muted-foreground outline-none focus:border-foreground focus:text-foreground transition-colors cursor-pointer appearance-none"
        >
          <option disabled value="">Month</option>
          {months.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <select
          value={leaseYear}
          onChange={(e) => setLeaseYear(e.target.value)}
          className="w-[80px] px-3 py-2.5 text-sm border border-border rounded-lg bg-card text-muted-foreground outline-none focus:border-foreground focus:text-foreground transition-colors cursor-pointer appearance-none"
        >
          <option disabled value="">Year</option>
          {years.map((y) => (
            <option key={y} value={String(y)}>{y}</option>
          ))}
        </select>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="px-4 py-2.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity whitespace-nowrap disabled:opacity-50 shadow-sm shadow-primary/20"
        >
          {submitting ? 'Saving…' : 'Send & remind me'}
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground/50">
        One report now. One reminder later. No spam.
      </p>
    </div>
  );
};

export default LeaseReminderCapture;
