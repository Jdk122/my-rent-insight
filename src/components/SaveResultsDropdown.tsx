import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { trackEvent, trackAdsConversion } from '@/lib/analytics';
import { LeadContext } from './EmailCapture';
import { getUtmParams } from '@/lib/utm';

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const currentYear = new Date().getFullYear();
const years = Array.from({ length: 6 }, (_, i) => currentYear + i);

interface SaveResultsDropdownProps {
  prefilledEmail?: string;
  onEmailCaptured?: (email: string) => void;
  leadContext?: LeadContext;
}

const SaveResultsDropdown = ({ prefilledEmail, onEmailCaptured, leadContext }: SaveResultsDropdownProps) => {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(prefilledEmail || '');
  const [leaseMonth, setLeaseMonth] = useState('');
  const [leaseYear, setLeaseYear] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prefilledEmail && !email) setEmail(prefilledEmail);
  }, [prefilledEmail]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    const leaseMonthNum = leaseMonth ? months.indexOf(leaseMonth) + 1 : null;
    const leaseYearNum = leaseYear ? parseInt(leaseYear, 10) : null;

    const utm = getUtmParams();

    try {
      await supabase.rpc('upsert_lead', {
        p_email: email,
        p_analysis_id: leadContext?.analysisId || null,
        p_capture_source: 'save_results',
        p_address: null,
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
        p_lease_expiration_month: leaseMonthNum,
        p_lease_expiration_year: leaseYearNum,
        p_utm_source: utm.utm_source || null,
        p_utm_medium: utm.utm_medium || null,
        p_utm_campaign: utm.utm_campaign || null,
        p_fairness_score: leadContext?.fairnessScore ?? null,
        p_comp_median_rent: leadContext?.compMedianRent ?? null,
        p_hud_fmr_value: leadContext?.hudFmrValue ?? null,
      } as any);

      // Insert into lead_events for history
      await supabase.from('lead_events' as any).insert({
        email,
        analysis_id: leadContext?.analysisId || null,
        event_type: 'save_results',
        fairness_score: leadContext?.fairnessScore ?? null,
        address: null,
        zip: leadContext?.zip || null,
        current_rent: leadContext?.currentRent ?? null,
        proposed_rent: leadContext?.proposedRent ?? null,
        increase_pct: leadContext?.increasePct ?? null,
        verdict: 'unknown',
        comp_median_rent: leadContext?.compMedianRent ?? null,
        hud_fmr_value: leadContext?.hudFmrValue ?? null,
      } as any);
    } catch (err) {
      console.error('Lead save failed:', err);
      toast.error('Something went wrong. Please try again.');
    }

    onEmailCaptured?.(email);
    trackEvent('email_submitted', { verdict: 'unknown', zip_code: leadContext?.zip || '', source: 'save_results' });
    trackAdsConversion();
    setSubmitted(true);
    toast.success("Saved! We'll send updated data before your lease renews.");
    setTimeout(() => setOpen(false), 1500);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-[13px] font-semibold hover:brightness-90 transition-all duration-150 shadow-sm shadow-primary/20"
      >
        <span className="hidden sm:inline">Save your results →</span>
        <span className="sm:hidden">Save →</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] sm:w-[340px] max-w-[340px] bg-card border border-border rounded-xl p-5 z-[70]"
            style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
          >
            {submitted ? (
              <div className="text-center py-2">
                <p className="text-sm font-semibold text-foreground">You're all set ✓</p>
                <p className="text-xs text-muted-foreground mt-1">We'll email updated data before your renewal.</p>
              </div>
            ) : (
              <>
                <p className="text-sm font-medium text-foreground mb-1">
                  Save your analysis
                </p>
                <p className="text-xs text-muted-foreground mb-4">
                  We'll email you a summary and send updated market data before your lease renews.
                </p>
                <form onSubmit={handleSubmit} className="space-y-3">
                  <input
                    type="email"
                    placeholder="you@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 text-sm border border-border rounded-lg bg-card text-foreground outline-none focus:border-foreground transition-colors placeholder:text-muted-foreground/50"
                  />
                  <div className="flex gap-2">
                    <select
                      value={leaseMonth}
                      onChange={(e) => setLeaseMonth(e.target.value)}
                      className="flex-1 px-3 py-2.5 text-sm border border-border rounded-lg bg-card text-muted-foreground outline-none focus:border-foreground focus:text-foreground transition-colors cursor-pointer appearance-none"
                    >
                      <option disabled value="">Lease month</option>
                      {months.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <select
                      value={leaseYear}
                      onChange={(e) => setLeaseYear(e.target.value)}
                      className="w-[100px] px-3 py-2.5 text-sm border border-border rounded-lg bg-card text-muted-foreground outline-none focus:border-foreground focus:text-foreground transition-colors cursor-pointer appearance-none"
                    >
                      <option disabled value="">Year</option>
                      {years.map((y) => <option key={y} value={String(y)}>{y}</option>)}
                    </select>
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-semibold hover:brightness-90 transition-all duration-150 shadow-sm shadow-primary/20"
                  >
                    Send
                  </button>
                </form>
                <p className="text-[11px] text-muted-foreground/60 mt-3">
                  We'll only email you about your lease. <Link to="/privacy" className="underline hover:text-foreground transition-colors">Privacy Policy</Link>.
                </p>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SaveResultsDropdown;
