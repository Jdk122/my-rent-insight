import { useState, useEffect } from 'react';
import { trackEvent } from '@/lib/analytics'; // GA4
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getUtmParams } from '@/lib/utm';

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 6 }, (_, i) => currentYear + i);

export interface LeadContext {
  analysisId?: string | null;
  address?: string | null;
  city?: string;
  state?: string;
  zip?: string;
  bedrooms?: number;
  currentRent?: number;
  proposedRent?: number;
  increasePct?: number;
  marketTrendPct?: number;
  fairCounterOffer?: string;
  compsPosition?: string;
  letterGenerated?: boolean;
}

interface EmailCaptureProps {
  city?: string;
  captureSource?: string;
  prefilledEmail?: string;
  onEmailCaptured?: (email: string) => void;
  leadContext?: LeadContext;
  heading?: string;
  subtext?: string;
  verdict?: string;
}

const EmailCapture = ({ city, captureSource = 'lease_reminder', prefilledEmail, onEmailCaptured, leadContext, heading, subtext, verdict }: EmailCaptureProps) => {
  const [email, setEmail] = useState(prefilledEmail || '');
  const [leaseMonth, setLeaseMonth] = useState('');
  const [leaseYear, setLeaseYear] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [dateError, setDateError] = useState('');
  const [partnerOptIn, setPartnerOptIn] = useState(false);

  useEffect(() => {
    if (prefilledEmail && !email) setEmail(prefilledEmail);
  }, [prefilledEmail]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    if (!leaseMonth || !leaseYear) {
      setDateError('Please select both month and year so we can time your reminder.');
      return;
    }
    setDateError('');

    const leaseMonthNum = months.indexOf(leaseMonth) + 1;
    const leaseYearNum = parseInt(leaseYear, 10);

    const utm = getUtmParams();

    try {
      await supabase.from('leads').upsert({
        email,
        analysis_id: leadContext?.analysisId || null,
        capture_source: captureSource,
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
        letter_generated: leadContext?.letterGenerated ?? false,
        lease_expiration_month: leaseMonthNum,
        lease_expiration_year: leaseYearNum,
        partner_opt_in: partnerOptIn,
        verdict: verdict || null,
        utm_source: utm.utm_source || null,
        utm_medium: utm.utm_medium || null,
        utm_campaign: utm.utm_campaign || null,
      } as any, { onConflict: 'email' });
    } catch {
      // Don't block UX on storage failure
    }

    onEmailCaptured?.(email);
    trackEvent('email_captured', { verdict: verdict || 'unknown', source: captureSource });
    trackEvent('email_submitted', { verdict: verdict || 'unknown', zip_code: leadContext?.zip || '', source: captureSource });
    if (captureSource === 'lease_reminder') {
      trackEvent('lease_reminder_signup');
    }
    setSubmitted(true);
    toast.success("You're on the list.");
  };

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="py-4"
      >
        <div className="inline-flex items-center justify-center w-8 h-8 rounded-full mb-3" style={{ background: 'hsl(var(--accent-green) / 0.1)' }}>
          <Check className="w-4 h-4 text-verdict-good" />
        </div>
        <h3 className="font-display text-lg font-semibold text-foreground">You're all set</h3>
        <p className="text-xs text-muted-foreground mt-1.5 max-w-xs mx-auto">
          We'll send you updated market data{leaseMonth && leaseYear ? ` 60 days before your lease renews in ${leaseMonth} ${leaseYear}` : ' before your lease renews'}.
        </p>
      </motion.div>
    );
  }

  return (
    <div>
      <h2 className="font-display text-xl font-semibold text-foreground mb-1.5" style={{ letterSpacing: '-0.01em' }}>
        {heading || 'Get Reminded Before Your Lease Is Up'}
      </h2>
      <p className="text-sm text-foreground/70 mb-5">
        {subtext || `We'll send you updated market data for ${city || 'your area'} before your next renewal.`}
      </p>
      <form onSubmit={handleSubmit} className="max-w-[440px] mx-auto space-y-2">
        {/* Lease date row */}
        <div className="flex gap-2">
          <select
            value={leaseMonth}
            onChange={(e) => { setLeaseMonth(e.target.value); setDateError(''); }}
            className="flex-1 px-4 py-3 text-sm border border-border rounded-lg bg-card text-muted-foreground outline-none focus:border-foreground focus:text-foreground transition-colors cursor-pointer appearance-none"
          >
            <option disabled value="">Lease renewal month</option>
            {months.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <select
            value={leaseYear}
            onChange={(e) => { setLeaseYear(e.target.value); setDateError(''); }}
            className="w-[100px] px-4 py-3 text-sm border border-border rounded-lg bg-card text-muted-foreground outline-none focus:border-foreground focus:text-foreground transition-colors cursor-pointer appearance-none"
          >
            <option disabled value="">Year</option>
            {years.map((y) => (
              <option key={y} value={String(y)}>{y}</option>
            ))}
          </select>
        </div>
        {dateError && (
          <p className="text-[12px] text-destructive">{dateError}</p>
        )}
        {/* Email + button row */}
        <div className="flex gap-2">
          <input
            type="email"
            placeholder="you@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="flex-1 min-w-0 px-4 py-3 text-sm border border-border rounded-lg bg-card text-foreground outline-none focus:border-foreground transition-colors placeholder:text-muted-foreground/50"
          />
          <button type="submit" className="bg-primary text-primary-foreground px-4 sm:px-5 py-3 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm shadow-primary/20 whitespace-nowrap shrink-0">
            Alert me next year →
          </button>
        </div>
      </form>
      <div className="max-w-[440px] mx-auto mt-2 space-y-1.5">
        <p className="text-[12px] text-muted-foreground/70 text-center">
          We'll email you about your lease and relevant housing info. See our{' '}
          <Link to="/privacy" className="underline hover:text-foreground transition-colors">Privacy Policy</Link>.
        </p>
        <label className="flex items-start gap-2 justify-center cursor-pointer select-none">
          <input type="checkbox" checked={partnerOptIn} onChange={(e) => setPartnerOptIn(e.target.checked)} className="mt-[3px] accent-primary" />
          <span className="text-[13px] text-muted-foreground/70 leading-snug">
            I'm open to hearing from trusted partners about housing-related services.
          </span>
        </label>
      </div>
    </div>
  );
};

export default EmailCapture;
