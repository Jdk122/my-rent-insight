import { useState, useEffect } from 'react';
import { X, BarChart3, Building2, Handshake } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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
import { Progress } from '@/components/ui/progress';

interface DealGateModalProps {
  listing: DealListing;
  cityName: string;
  cityStateAbbr?: string;
  cityZip?: string;
  onClose: () => void;
  onEmailCaptured: (email: string) => void;
  skipGate?: boolean;
  isFreeView?: boolean;
  onAnalysisViewed?: () => void;
}

const fmt = (n: number) => n.toLocaleString('en-US');

const COMPONENT_LABELS = [
  { key: 'position' as const, label: 'Price vs Market' },
  { key: 'range' as const, label: 'Fair Range Position' },
  { key: 'freshness' as const, label: 'Listing Freshness' },
  { key: 'momentum' as const, label: 'Market Direction' },
];

const DealGateModal = ({ listing, cityName, cityStateAbbr, cityZip, onClose, onEmailCaptured, skipGate, isFreeView, onAnalysisViewed }: DealGateModalProps) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [analysisShortId, setAnalysisShortId] = useState<string | null>(null);
  const beds = listing.beds === 0 ? 'Studio' : `${listing.beds}BR`;

  useEffect(() => {
    if (skipGate) {
      onAnalysisViewed?.();
      if (!submitted) {
        trackEvent('deals_free_analysis_viewed', { address: listing.address, score: listing.score, gated: false });
      }
    } else {
      trackEvent('gate_viewed', { source: 'deals_page', gated_listing_id: listing.address });
    }
  }, [skipGate]);

  const handleSubmit = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Please enter a valid email.');
      return;
    }
    setError('');
    setLoading(true);

    const utm = getUtmParams();

    // 1. Call create-deal-analysis Edge Function
    let analysisUrl: string | null = null;
    try {
      const { data: analysisData, error: analysisError } = await supabase.functions.invoke('create-deal-analysis', {
        body: {
          email: trimmed,
          address: listing.address,
          city: cityName,
          stateAbbr: cityStateAbbr || null,
          zip: cityZip || null,
          beds: listing.beds,
          baths: listing.baths,
          sqft: listing.sqft,
          rent: listing.rent,
          daysOnMarket: listing.daysOnMarket,
          listingUrl: listing.listingUrl,
          score: listing.score,
          verdict: listing.verdict,
          savingsPerMonth: listing.savingsPerMonth,
          savingsPct: listing.savingsPct,
          median: listing.median,
          isSuspicious: listing.isSuspicious,
          hasLeverage: listing.hasLeverage,
          leverageNote: listing.leverageNote,
          trendContext: listing.trendContext,
          walkScore: listing.walkScore,
          isRentStabilized: listing.isRentStabilized,
          components: listing.components,
          fairRange: listing.fairRange,
        },
      });

      if (!analysisError && analysisData?.shortId) {
        setAnalysisShortId(analysisData.shortId);
        analysisUrl = analysisData.analysisUrl;
      } else {
        console.error('[deals] create-deal-analysis failed:', analysisError);
      }
    } catch (err) {
      console.error('[deals] create-deal-analysis failed:', err);
    }

    // 2. Keep existing upsert_lead for CRM
    try {
      const leadParams = {
        p_email: trimmed,
        p_capture_source: 'deals_gate',
        p_address: listing.address,
        p_city: cityName,
        p_zip: cityZip || null,
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
    trackEvent('gate_to_email_submit', { address: listing.address, score: listing.score });
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
        analysisUrl: analysisUrl || undefined,
      });
      await notifySubmission({
        email: trimmed,
        city: cityName,
        address: listing.address,
        current_rent: listing.rent,
        fairness_score: listing.score,
        verdict_label: listing.verdict === 'great' ? 'Great Deal' : 'Good Deal',
        zip: cityZip || null,
        state: cityStateAbbr || null,
        bedrooms: listing.beds,
        proposed_rent: null,
        increase_pct: null,
        comp_median_rent: listing.median,
        hud_fmr_value: null,
        analysis_id: null,
      }, 'deals_gate_submit');
    })();
  };

  const listingHref = listing.listingUrl || zillowUrl(listing.address, listing.city || '', listing.state || '', listing.zipCode || '');

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

        {!(skipGate || submitted) ? (
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
                { icon: <BarChart3 className="w-4 h-4 text-primary" />, text: 'How this rent compares to similar apartments nearby' },
                { icon: <Building2 className="w-4 h-4 text-primary" />, text: 'Building complaint and violation history' },
                { icon: <Handshake className="w-4 h-4 text-primary" />, text: 'Whether you have room to negotiate the price' },
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
          <div className="p-7">
            {/* Success — analysis breakdown */}
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-sm text-accent font-bold">✓</div>
              <div>
                <h2 className="text-sm font-bold text-foreground">Your analysis for {listing.address}</h2>
              </div>
            </div>

            <div className="flex items-center gap-3 mb-4">
              <DealScoreRing score={listing.score} size={48} />
              <div>
                <div className="text-lg font-bold text-foreground">{listing.score}/100</div>
                <div className="text-xs text-muted-foreground">
                  {listing.verdict === 'great' ? 'Great Deal' : 'Good Deal'}
                </div>
              </div>
            </div>

            {/* Component bars */}
            {listing.components && (
              <div className="space-y-2 mb-4">
                {COMPONENT_LABELS.map(({ key, label }) => {
                  const comp = listing.components![key];
                  const pct = Math.round((comp.score / comp.max) * 100);
                  return (
                    <div key={key}>
                      <div className="flex justify-between text-[11px] text-muted-foreground mb-0.5">
                        <span>{label}</span>
                        <span className="font-semibold text-foreground">{comp.score}/{comp.max}</span>
                      </div>
                      <Progress value={pct} className="h-1.5" />
                    </div>
                  );
                })}
              </div>
            )}

            {/* Key stats */}
            <div className="text-xs text-muted-foreground space-y-1 mb-4">
              <p>
                <span className="font-semibold text-foreground">${fmt(listing.rent)}/mo</span> vs{' '}
                <span className="font-semibold text-foreground">${fmt(listing.median)}</span> median
                {listing.savingsPerMonth > 0 && (
                  <> — save <span className="text-accent font-semibold">${fmt(listing.savingsPerMonth)}/mo</span></>
                )}
              </p>
              {listing.daysOnMarket != null && (
                <p>Listed {listing.daysOnMarket} days{listing.trendContext ? ` · Market trend: ${listing.trendContext}` : ''}</p>
              )}
              {listing.hasLeverage && listing.leverageNote && (
                <p className="text-primary font-medium">{listing.leverageNote}</p>
              )}
              {listing.walkScore != null && (
                <p>
                  Walk Score: {listing.walkScore} — {
                    listing.walkScore >= 90 ? "Walker's Paradise" :
                    listing.walkScore >= 70 ? 'Very Walkable' :
                    listing.walkScore >= 50 ? 'Somewhat Walkable' :
                    'Car-Dependent'
                  }
                </p>
              )}
              {listing.isRentStabilized && (
                <p className="text-primary font-medium">🏛 Rent Stabilized</p>
              )}
            </div>

            {/* Two CTAs: View full analysis + View on listing site */}
            {analysisShortId ? (
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => {
                    onClose();
                    navigate(`/deals/analysis/${analysisShortId}`);
                  }}
                  className="block w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-bold text-center hover:brightness-90 transition-all"
                >
                  View full analysis →
                </button>
                <a
                  href={listingHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full py-2.5 rounded-lg border-[1.5px] border-primary text-primary text-sm font-bold text-center hover:bg-primary/5 transition-colors"
                >
                  View listing →
                </a>
              </div>
            ) : (
              <a
                href={listingHref}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-bold text-center hover:brightness-90 transition-all"
              >
                View listing →
              </a>
            )}
            {submitted ? (
              <p className="text-[11px] text-muted-foreground/60 text-center mt-2">
                Full report sent to your email.
              </p>
            ) : isFreeView ? (
              <>
                <p className="text-[11px] text-muted-foreground/60 text-center mt-2">
                  Want analysis for every listing? Enter your email on the next one.
                </p>
                <p className="text-[10px] text-muted-foreground/40 text-center mt-3">
                  1 of 1 free analysis used
                </p>
              </>
            ) : (
              <p className="text-[11px] text-muted-foreground/60 text-center mt-2">
                Want reports for every listing? Enter your email on the next one.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DealGateModal;
