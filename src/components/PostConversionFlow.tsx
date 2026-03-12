import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { trackEvent } from '@/lib/analytics';
import { getUtmParams } from '@/lib/utm';
import { toast } from 'sonner';
import { Check } from 'lucide-react';
import type { LeadContext } from './EmailCapture';

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 6 }, (_, i) => currentYear + i);

interface PostConversionFlowProps {
  email: string;
  leadContext?: LeadContext;
  verdictLabel: string;
  zip: string;
}

const PostConversionFlow = ({ email, leadContext, verdictLabel, zip }: PostConversionFlowProps) => {
  const [leaseMonth, setLeaseMonth] = useState('');
  const [leaseYear, setLeaseYear] = useState('');
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    const leaseMonthNum = leaseMonth ? months.indexOf(leaseMonth) + 1 : null;
    const leaseYearNum = leaseYear ? parseInt(leaseYear, 10) : null;

    if (!leaseMonthNum && !leaseYearNum) {
      toast('Please select a month and year');
      return;
    }

    const utm = getUtmParams();

    try {
      await supabase.rpc('upsert_lead', {
        p_email: email,
        p_analysis_id: leadContext?.analysisId || null,
        p_capture_source: 'post_conversion_lease',
        p_lease_expiration_month: leaseMonthNum,
        p_lease_expiration_year: leaseYearNum,
        p_partner_opt_in: false,
        p_verdict: verdictLabel || null,
        p_utm_source: utm.utm_source || null,
        p_utm_medium: utm.utm_medium || null,
        p_utm_campaign: utm.utm_campaign || null,
        p_fairness_score: leadContext?.fairnessScore ?? null,
        p_comp_median_rent: leadContext?.compMedianRent ?? null,
        p_hud_fmr_value: leadContext?.hudFmrValue ?? null,
      } as any);
    } catch (err) {
      console.error('Post-conversion save failed:', err);
    }

    trackEvent('post_conversion_lease_saved', { verdict: verdictLabel, zip_code: zip });
    setSaved(true);
    toast.success('Saved!');
  };

  if (saved) {
    return (
      <div className="flex items-center gap-2 py-3">
        <Check className="w-4 h-4 text-verdict-good" />
        <span className="text-sm text-muted-foreground">
          {leaseMonth && leaseYear
            ? `We'll send you a free market analysis 90 days before ${leaseMonth} ${leaseYear}.`
            : "You're all set."}
        </span>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-lg border border-border bg-card p-4 sm:p-5 space-y-4">
      <div className="space-y-1.5">
        <p className="text-sm font-semibold text-foreground">Never get caught off guard by a rent increase again.</p>
        <p className="text-[13px] text-muted-foreground leading-relaxed">
          Tell us when your lease renews and we'll send you a free updated market analysis 90 days before — so you're ready to negotiate before your landlord even sends the notice.
        </p>
      </div>
      <div className="flex gap-2 max-w-[360px]">
        <select
          value={leaseMonth}
          onChange={(e) => setLeaseMonth(e.target.value)}
          className="flex-1 px-3 py-2.5 text-sm border border-border rounded-lg bg-card text-muted-foreground outline-none focus:border-foreground focus:text-foreground transition-colors cursor-pointer appearance-none"
        >
          <option disabled value="">Month</option>
          {months.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <select
          value={leaseYear}
          onChange={(e) => setLeaseYear(e.target.value)}
          className="w-[90px] px-3 py-2.5 text-sm border border-border rounded-lg bg-card text-muted-foreground outline-none focus:border-foreground focus:text-foreground transition-colors cursor-pointer appearance-none"
        >
          <option disabled value="">Year</option>
          {years.map((y) => (
            <option key={y} value={String(y)}>{y}</option>
          ))}
        </select>
        <button
          onClick={handleSave}
          className="px-4 py-2.5 rounded-lg text-sm font-medium border border-border text-foreground hover:bg-muted transition-colors whitespace-nowrap"
        >
          Save
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground/50">
        We'll only email you once, 90 days before your renewal. No spam.
      </p>
    </div>
  );
};

export default PostConversionFlow;
