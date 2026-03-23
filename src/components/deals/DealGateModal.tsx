import { useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { trackEvent, trackAdsConversion } from '@/lib/analytics';
import { getUtmParams } from '@/lib/utm';
import { sendConfirmationEmail } from '@/lib/sendConfirmationEmail';
import { notifySubmission } from '@/lib/notifySubmission';
import { zillowUrl } from '@/lib/dealScore';
import { toast } from 'sonner';
import DealScoreRing from './DealScoreRing';
import type { DealListing } from './DealCard';
import { Link } from 'react-router-dom';

interface DealGateModalProps {
  listing: DealListing;
  cityName: string;
  onClose: () => void;
  onEmailCaptured: (email: string) => void;
}

const fmt = (n: number) => n.toLocaleString('en-US');

const DealGateModal = ({ listing, cityName, onClose, onEmailCaptured }: DealGateModalProps) => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const beds = listing.beds === 0 ? 'Studio' : `${listing.beds}BR`;

  const handleSubmit = async () => {
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
        p_capture_source: 'deals_gate',
        p_address: listing.address,
        p_city: cityName,
        p_zip: null as string | null,
        p_bedrooms: listing.beds,
        p_current_rent: listing.rent,
        p_fairness_score: listing.score,
        p_verdict: listing.verdict === 'great' ? 'Great Deal' : 'Good Deal',
        p_utm_source: utm.utm_source || null,
        p_utm_medium: utm.utm_medium || null,
        p_utm_campaign: utm.utm_campaign || null,
        p_tool_type: 'wsip',
      } as any;

      let { error: rpcError } = await supabase.rpc('upsert_lead', leadParams);
      if (rpcError) console.error('[deals] upsert_lead failed:', rpcError.message);

      const evtPayload = {
        email: trimmed,
        event_type: 'deals_gate',
        address: listing.address,
        current_rent: listing.rent,
        fairness_score: listing.score,
        verdict: listing.verdict === 'great' ? 'Great Deal' : 'Good Deal',
      } as any;
      const { error: evtError } = await supabase.from('lead_events' as any).insert(evtPayload);
      if (evtError) console.error('[deals] lead_events insert failed:', evtError.message);
    } catch (err) {
      console.error('[deals] lead save failed:', err);
    }

    onEmailCaptured(trimmed);
    trackEvent('email_captured', { gate: 'deals_gate', tool: 'wsip', verdict: listing.verdict, address: listing.address });
    trackAdsConversion('wsip', trimmed);
    setSubmitted(true);
    setLoading(false);
    toast.success('Check your inbox!');

    // Non-blocking follow-ups
    (async () => {
      sendConfirmationEmail({
        email: trimmed,
        city: cityName,
        bedrooms: listing.beds,
        toolType: 'wsip',
        verdictLabel: listing.verdict === 'great' ? 'Great Deal' : 'Good Deal',
      });
      await notifySubmission({
        email: trimmed,
        city: cityName,
        address: listing.address,
        current_rent: listing.rent,
        fairness_score: listing.score,
        verdict_label: listing.verdict === 'great' ? 'Great Deal' : 'Good Deal',
        zip: null,
        state: null,
        bedrooms: listing.beds,
        proposed_rent: null,
        increase_pct: null,
        comp_median_rent: listing.medianRent,
        hud_fmr_value: null,
        analysis_id: null,
      }, 'deals_gate_submit');
    })();

    // Open Zillow listing and close after delay
    setTimeout(() => {
      window.open(zillowUrl(listing.address), '_blank');
      onClose();
    }, 2000);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4 animate-fade-in"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-[420px] bg-card rounded-xl border border-border shadow-2xl overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md w-7 h-7 flex items-center justify-center transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {!submitted ? (
          <div className="p-7">
            {/* Listing preview */}
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg mb-5">
              <DealScoreRing score={listing.score} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-foreground mb-0.5 truncate">{listing.address}</div>
                <div className="text-xs text-muted-foreground">
                  {beds} · ${fmt(listing.rent)}/mo · <span className="text-accent font-semibold">${fmt(listing.savingsPerMonth)}/mo savings</span>
                </div>
              </div>
            </div>

            <h2 className="font-display text-lg font-normal text-foreground mb-1.5">
              Get the full analysis
            </h2>
            <p className="text-[13.5px] text-muted-foreground leading-relaxed mb-4">
              We'll send you everything you need for this apartment:
            </p>

            <div className="flex flex-col gap-2 mb-5">
              {[
                { icon: '📊', text: 'How this rent compares to similar apartments nearby' },
                { icon: '🏢', text: 'Building complaint and violation history' },
                { icon: '🤝', text: 'Whether you have room to negotiate the price' },
              ].map((item, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <span className="text-sm shrink-0 mt-0.5">{item.icon}</span>
                  <span className="text-[13px] text-foreground/80 leading-snug">{item.text}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-2 mb-2.5">
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (error) setError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                placeholder="you@email.com"
                autoFocus
                autoComplete="email"
                className={`flex-1 min-w-0 px-3.5 py-3 rounded-lg text-sm outline-none bg-muted/30 transition-colors placeholder:text-muted-foreground/50 ${
                  error ? 'border-2 border-destructive' : 'border-[1.5px] border-border focus:border-primary'
                }`}
              />
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="bg-primary text-primary-foreground px-5 py-3 rounded-lg text-sm font-bold hover:brightness-90 transition-all whitespace-nowrap shadow-sm shadow-primary/20 disabled:opacity-60"
              >
                {loading ? 'Sending…' : 'Get Report'}
              </button>
            </div>
            {error && <p className="text-xs text-destructive mb-1">{error}</p>}

            <p className="text-[11px] text-muted-foreground/60 text-center">
              Free · No spam · <Link to="/privacy" className="underline hover:text-foreground transition-colors">Privacy Policy</Link>
            </p>
          </div>
        ) : (
          <div className="p-10 text-center">
            <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-3.5 text-xl">
              ✓
            </div>
            <h2 className="text-base font-bold text-foreground mb-1.5">Check your inbox</h2>
            <p className="text-[13.5px] text-muted-foreground leading-relaxed">
              Your full analysis for {listing.address} is on the way.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DealGateModal;
