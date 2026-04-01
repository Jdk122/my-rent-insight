import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { BarChart3, TrendingUp, CalendarDays, Footprints, Landmark } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import SEO from '@/components/SEO';
import PageNav from '@/components/PageNav';
import DealScoreRing from '@/components/deals/DealScoreRing';
import { Progress } from '@/components/ui/progress';
import { zillowUrl } from '@/lib/dealScore';
import { Skeleton } from '@/components/ui/skeleton';

const fmt = (n: number) => n.toLocaleString('en-US');

const COMPONENT_LABELS = [
  { key: 'position' as const, label: 'Price vs Market', max: 50 },
  { key: 'range' as const, label: 'Fair Range Position', max: 20 },
  { key: 'freshness' as const, label: 'Listing Freshness', max: 15 },
  { key: 'momentum' as const, label: 'Market Direction', max: 15 },
];

const DealAnalysis = () => {
  const { shortId } = useParams<{ shortId: string }>();
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!shortId) return;
    (async () => {
      const { data, error } = await supabase
        .from('deal_analyses' as any)
        .select('short_id, created_at, expires_at, address, city, state_abbr, zip, beds, baths, sqft, rent, days_on_market, listing_url, score, verdict, savings_per_month, savings_pct, median, is_suspicious, has_leverage, leverage_note, trend_context, walk_score, is_rent_stabilized, components, fair_range')
        .eq('short_id', shortId)
        .maybeSingle();

      if (error || !data) {
        setNotFound(true);
      } else if ((data as any).expires_at && new Date((data as any).expires_at) < new Date()) {
        setNotFound(true);
      } else {
        setAnalysis(data);
      }
      setLoading(false);
    })();
  }, [shortId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background font-body">
        <PageNav ctaText="Check My Rent →" />
        <div className="max-w-[680px] mx-auto px-5 pt-8">
          <Skeleton className="h-8 w-3/4 mb-2" />
          <Skeleton className="h-5 w-1/2 mb-6" />
          <Skeleton className="h-16 w-full mb-4" />
          <Skeleton className="h-32 w-full mb-4" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  if (notFound || !analysis) {
    return (
      <div className="min-h-screen bg-background font-body">
        <SEO title="Analysis Not Found | RenewalReply" description="This analysis is no longer available." noindex />
        <PageNav ctaText="Check My Rent →" />
        <div className="max-w-[480px] mx-auto px-5 pt-20 text-center">
          <div className="text-4xl mb-4">📊</div>
          <h1 className="font-display text-xl font-normal text-foreground mb-3">
            This analysis is no longer available
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed mb-6">
            Listings are scored in real-time and may change as the market updates.
          </p>
          <Link
            to="/"
            className="inline-block bg-primary text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-bold hover:brightness-90 transition-all"
          >
            Check your rent →
          </Link>
        </div>
      </div>
    );
  }

  const a = analysis;
  const beds = a.beds === 0 ? 'Studio' : `${a.beds}BR`;
  const verdictLabel = a.verdict === 'great' ? 'Great Deal' : 'Good Deal';
  const verdictClass = a.verdict === 'great'
    ? 'bg-accent/10 text-accent border-accent/30'
    : 'bg-primary/10 text-primary border-primary/30';
  const components = a.components as Record<string, { score: number; max: number }> | null;
  const fairRange = a.fair_range as { low: number; high: number } | null;

  // Fair range bar math
  let rangeMarkerPct = 50;
  if (fairRange) {
    const span = fairRange.high - fairRange.low;
    if (span > 0) {
      rangeMarkerPct = Math.max(0, Math.min(100, ((a.rent - fairRange.low) / span) * 100));
    }
  }
  const rentBelowMidpoint = fairRange ? a.rent < (fairRange.low + fairRange.high) / 2 : true;

  const listingHref = a.listing_url || zillowUrl(a.address, a.zip || '10003');

  return (
    <div className="min-h-screen bg-background font-body">
      <SEO
        title={`Apartment Analysis: ${a.address} | RenewalReply`}
        description={`${beds} at ${a.address} scored ${a.score}/100. ${verdictLabel} — $${fmt(a.savings_per_month)}/mo below market.`}
        noindex
      />
      <PageNav ctaText="Check My Rent →" />

      <div className="max-w-[680px] mx-auto px-5 pt-6 pb-16">
        {/* Section 1: Hero */}
        <section className="mb-8">
          <nav className="text-xs text-muted-foreground mb-3 flex items-center gap-1">
            <Link to="/deals/east-village" className="hover:text-foreground transition-colors">Deals</Link>
            <span className="opacity-30">/</span>
            <span className="text-muted-foreground/80">Analysis</span>
          </nav>

          <h1 className="font-display text-xl font-semibold text-foreground leading-tight mb-1">
            {a.address}
          </h1>
          <p className="text-sm text-muted-foreground mb-4">
            {a.city}{a.state_abbr ? `, ${a.state_abbr}` : ''} · {beds}
            {a.baths ? ` / ${a.baths}ba` : ''}
            {a.sqft ? ` / ${a.sqft}ft²` : ''}
          </p>

          <div className="flex items-center gap-4 mb-3">
            <DealScoreRing score={a.score} size={56} />
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-2xl font-bold text-foreground">{a.score}/100</span>
                <span className={`px-2 py-0.5 rounded text-xs font-bold border ${verdictClass}`}>
                  {verdictLabel}
                </span>
              </div>
              <p className="text-lg font-semibold text-accent">
                ${fmt(a.savings_per_month)}/mo below market
              </p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            ${fmt(a.rent)}/mo vs ${fmt(a.median)} median
            {a.savings_pct > 0 && ` · ${a.savings_pct}% savings`}
          </p>
        </section>

        {/* Section 2: Score breakdown */}
        {components && (
          <section className="mb-8">
            <h2 className="font-display text-base font-normal text-foreground mb-3">Score breakdown</h2>
            <div className="space-y-3 bg-card rounded-lg border border-border p-4">
              {COMPONENT_LABELS.map(({ key, label, max }) => {
                const comp = components[key];
                if (!comp) return null;
                const pct = Math.round((comp.score / max) * 100);
                return (
                  <div key={key}>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>{label}</span>
                      <span className="font-semibold text-foreground">{comp.score}/{max}</span>
                    </div>
                    <Progress value={pct} className="h-2" />
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Section 3: Fair range */}
        {fairRange && (
          <section className="mb-8">
            <h2 className="font-display text-base font-normal text-foreground mb-3">Fair range</h2>
            <div className="bg-card rounded-lg border border-border p-4">
              <div className="relative h-3 bg-muted rounded-full mb-2">
                <div
                  className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-background ${
                    rentBelowMidpoint ? 'bg-accent' : 'bg-amber-500'
                  }`}
                  style={{ left: `${rangeMarkerPct}%`, transform: `translateX(-50%) translateY(-50%)` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>${fmt(fairRange.low)}</span>
                <span className="font-semibold text-foreground">${fmt(a.rent)} (this listing)</span>
                <span>${fmt(fairRange.high)}</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                Fair range: ${fmt(fairRange.low)} – ${fmt(fairRange.high)}
              </p>
            </div>
          </section>
        )}

        {/* Section 4: Market context */}
        <section className="mb-8">
          <h2 className="font-display text-base font-normal text-foreground mb-3">Market context</h2>
          <div className="bg-card rounded-lg border border-border p-4 space-y-2 text-sm text-muted-foreground">
            {a.trend_context && (
              <p>📈 Market trend: <span className="font-semibold text-foreground">{a.trend_context}</span></p>
            )}
            {a.days_on_market != null && (
              <p>📅 Listed <span className="font-semibold text-foreground">{a.days_on_market} days ago</span></p>
            )}
            {a.walk_score != null && (
              <p>
                🚶 Walk Score: <span className="font-semibold text-foreground">{a.walk_score}</span>
                {' '}{a.walk_score >= 90 ? "— Walker's Paradise" :
                  a.walk_score >= 70 ? '— Very Walkable' :
                  a.walk_score >= 50 ? '— Somewhat Walkable' :
                  '— Car-Dependent'}
              </p>
            )}
            {a.is_rent_stabilized && (
              <p className="text-primary font-medium">🏛 Rent Stabilized Building</p>
            )}
          </div>
        </section>

        {/* Section 5: Negotiation leverage */}
        {a.has_leverage && a.leverage_note && (
          <section className="mb-8">
            <h2 className="font-display text-base font-normal text-foreground mb-3">Your negotiation leverage</h2>
            <div className="bg-primary/5 rounded-lg border border-primary/20 p-4">
              <p className="text-sm text-foreground">{a.leverage_note}</p>
              <p className="text-xs text-muted-foreground mt-1.5">
                This listing has been on the market long enough that the landlord may accept a lower offer.
              </p>
            </div>
          </section>
        )}

        {/* Section 6: Action buttons */}
        <section className="mb-8 flex flex-col sm:flex-row gap-3">
          <a
            href={listingHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-3 rounded-lg bg-primary text-primary-foreground text-sm font-bold text-center hover:brightness-90 transition-all"
          >
            View listing →
          </a>
          <Link
            to={`/rent/${a.zip || ''}`}
            className="flex-1 py-3 rounded-lg border-[1.5px] border-primary text-primary text-sm font-bold text-center hover:bg-primary/5 transition-colors"
          >
            Check your current rent →
          </Link>
        </section>

        {/* Footer */}
        <footer className="border-t border-border pt-4">
          <div className="flex justify-between items-center">
            <span className="text-[11px] text-muted-foreground">© {new Date().getFullYear()} RenewalReply</span>
            <div className="flex gap-3 text-[11px]">
              <Link to="/methodology" className="text-muted-foreground hover:text-foreground transition-colors">Methodology</Link>
              <Link to="/about" className="text-muted-foreground hover:text-foreground transition-colors">About</Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default DealAnalysis;
