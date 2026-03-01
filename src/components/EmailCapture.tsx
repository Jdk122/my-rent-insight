import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

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
}

const EmailCapture = ({ city, captureSource = 'lease_reminder', prefilledEmail, onEmailCaptured, leadContext }: EmailCaptureProps) => {
  const [email, setEmail] = useState(prefilledEmail || '');
  const [leaseMonth, setLeaseMonth] = useState('');
  const [leaseYear, setLeaseYear] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (prefilledEmail && !email) setEmail(prefilledEmail);
  }, [prefilledEmail]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    const leaseMonthNum = leaseMonth ? months.indexOf(leaseMonth) + 1 : null;
    const leaseYearNum = leaseYear ? parseInt(leaseYear, 10) : null;

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
      } as any, { onConflict: 'email' });
    } catch {
      // Don't block UX on storage failure
    }

    onEmailCaptured?.(email);
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
        Get Reminded Before Your Lease Is Up
      </h2>
      <p className="text-sm text-muted-foreground mb-5">
        We'll send updated market data for {city || 'your area'} 60 days before your renewal.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 max-w-[440px] mx-auto mb-2">
        <input
          type="email"
          placeholder="you@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="flex-1 px-4 py-3 text-sm border border-border rounded-lg bg-card text-foreground outline-none focus:border-foreground transition-colors placeholder:text-muted-foreground/50"
        />
        <button type="submit" className="bg-primary text-primary-foreground px-5 py-3 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm shadow-primary/20 whitespace-nowrap">
          Remind me
        </button>
      </form>
      <p className="text-[12px] text-muted-foreground/70 text-center mb-4 max-w-[440px] mx-auto">
        We'll only email you about your lease. See our{' '}
        <Link to="/privacy" className="underline hover:text-foreground transition-colors">Privacy Policy</Link>.
      </p>
      <div className="flex gap-2 max-w-[440px] mx-auto">
        <select
          value={leaseMonth}
          onChange={(e) => setLeaseMonth(e.target.value)}
          className="flex-1 px-4 py-3 text-sm border border-border rounded-lg bg-card text-muted-foreground outline-none focus:border-foreground focus:text-foreground transition-colors cursor-pointer appearance-none"
        >
          <option disabled value="">Month</option>
          {months.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <select
          value={leaseYear}
          onChange={(e) => setLeaseYear(e.target.value)}
          className="w-[120px] px-4 py-3 text-sm border border-border rounded-lg bg-card text-muted-foreground outline-none focus:border-foreground focus:text-foreground transition-colors cursor-pointer appearance-none"
        >
          <option disabled value="">Year</option>
          {years.map((y) => (
            <option key={y} value={String(y)}>{y}</option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default EmailCapture;
