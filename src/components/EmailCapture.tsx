import { useState } from 'react';
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
const years = [currentYear, currentYear + 1, currentYear + 2];

const leaseOptions: { label: string; value: string }[] = [];
for (const year of years) {
  for (const month of months) {
    leaseOptions.push({ label: `${month} ${year}`, value: `${month} ${year}` });
  }
}

export interface LeadContext {
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  bedrooms?: number;
  currentRent?: number;
  proposedRent?: number;
  increasePct?: number;
  marketTrendPct?: number;
  fairCounterOffer?: number;
  compsPosition?: string;
  letterGenerated?: boolean;
}

interface EmailCaptureProps {
  city?: string;
  leadContext?: LeadContext;
}

const EmailCapture = ({ city, leadContext }: EmailCaptureProps) => {
  const [email, setEmail] = useState('');
  const [leaseMonth, setLeaseMonth] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    // Parse lease month/year
    let leaseExpirationMonth: string | null = null;
    let leaseExpirationYear: number | null = null;
    if (leaseMonth) {
      const parts = leaseMonth.split(' ');
      leaseExpirationMonth = parts[0] || null;
      leaseExpirationYear = parts[1] ? parseInt(parts[1], 10) : null;
    }

    // Store lead in database
    try {
      await supabase.from('leads').insert({
        email,
        address: leadContext?.address || null,
        city: leadContext?.city || null,
        state: leadContext?.state || null,
        zip: leadContext?.zip || null,
        bedrooms: leadContext?.bedrooms ?? null,
        current_rent: leadContext?.currentRent ?? null,
        proposed_rent: leadContext?.proposedRent ?? null,
        increase_pct: leadContext?.increasePct ?? null,
        market_trend_pct: leadContext?.marketTrendPct ?? null,
        fair_counter_offer: leadContext?.fairCounterOffer ?? null,
        comps_position: leadContext?.compsPosition || null,
        letter_generated: leadContext?.letterGenerated ?? false,
        lease_expiration_month: leaseExpirationMonth,
        lease_expiration_year: leaseExpirationYear,
      } as any);
    } catch {
      // Don't block UX on storage failure
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
          We'll send you updated market data{leaseMonth ? ` 60 days before your lease renews in ${leaseMonth}` : ' before your lease renews'}.
        </p>
      </motion.div>
    );
  }

  return (
    <div>
      <h2 className="font-display text-xl font-semibold text-foreground mb-1.5" style={{ letterSpacing: '-0.01em' }}>
        Get reminded before your lease is up
      </h2>
      <p className="text-sm text-muted-foreground mb-5">
        We'll send updated market data for {city || 'your area'} 60 days before your renewal.
      </p>
      <form onSubmit={handleSubmit} className="flex gap-2 max-w-[440px] mx-auto mb-2">
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
      <select
        value={leaseMonth}
        onChange={(e) => setLeaseMonth(e.target.value)}
        className="w-full max-w-[440px] mx-auto block px-4 py-3 text-sm border border-border rounded-lg bg-card text-muted-foreground outline-none focus:border-foreground focus:text-foreground transition-colors cursor-pointer appearance-none"
      >
        <option disabled value="">Lease expiration month & year</option>
        {leaseOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
};

export default EmailCapture;
