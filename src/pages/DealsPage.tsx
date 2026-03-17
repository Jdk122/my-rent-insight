import { useParams, Navigate, Link } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, ArrowRight } from 'lucide-react';
import SEO from '@/components/SEO';
import { SEOFooter } from '@/components/SEOFooter';
import { NoIndexMeta } from '@/components/NoIndexMeta';
import { usePrerenderReady } from '@/hooks/usePrerenderReady';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { getHud50Data, Hud50ZipRaw } from '@/data/dataLoader';
import { DEALS_CITIES } from '@/lib/dealsCities';
import { scoreListing, DealScore } from '@/lib/dealScore';
import { trackEvent } from '@/lib/analytics';

/* ── Types ── */
interface RawListing {
  formattedAddress: string;
  city: string;
  state: string;
  zipCode: string;
  rent: number;
  bedrooms: number | null;
  bathrooms: number | null;
  squareFootage: number | null;
  daysOnMarket: number | null;
  listingUrl: string | null;
}

interface ScoredListing extends RawListing {
  score: DealScore;
  normalizedAddr: string;
}

/* ── Helpers ── */
const normalizeAddr = (a: string) => a.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

const BEDROOM_FILTERS = [
  { label: 'All', value: -1 },
  { label: 'Studio', value: 0 },
  { label: '1 BR', value: 1 },
  { label: '2 BR', value: 2 },
] as const;

const verdictConfig = {
  'good-deal': { label: 'Good Deal', icon: CheckCircle2, badgeCls: 'bg-emerald-500 text-white', rowCls: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300' },
  'fair-price': { label: 'Fair Price', icon: AlertTriangle, badgeCls: 'bg-amber-500 text-black', rowCls: 'bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300' },
  'overpriced': { label: 'Overpriced', icon: XCircle, badgeCls: 'bg-red-500 text-white', rowCls: 'bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-300' },
} as const;

/* ── Component ── */
const DealsPage = () => {
  const { citySlug } = useParams<{ citySlug: string }>();
  const city = citySlug ? DEALS_CITIES[citySlug] : undefined;

  const [listings, setListings] = useState<ScoredListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [bedroomFilter, setBedroomFilter] = useState(-1);
  const [successfulEmpty, setSuccessfulEmpty] = useState(false);

  usePrerenderReady(!loading);

  // Redirect unknown cities
  if (!city) return <Navigate to="/rent-data" replace />;

  /* ── Data fetch ── */
  useEffect(() => {
    if (!city) return;
    let cancelled = false;
    setLoading(true);
    setError(false);
    setSuccessfulEmpty(false);

    (async () => {
      try {
        const bedroomTypes = [0, 1, 2];

        // Fire ALL listing calls + market calls in parallel
        const listingPromises: Promise<{ listings: RawListing[] }>[] = [];
        const marketPromises: Promise<{ zip: string; data: any }>[] = [];

        for (const zip of city.zips) {
          for (const br of bedroomTypes) {
            listingPromises.push(
              supabase.functions.invoke('rentcast-listings', { body: { zip, bedrooms: br } })
                .then(r => ({ listings: Array.isArray(r.data?.listings) ? r.data.listings : [] }))
                .catch(() => ({ listings: [] }))
            );
          }
          marketPromises.push(
            supabase.functions.invoke('rentcast-market', { body: { zip } })
              .then(r => ({ zip, data: r.data }))
              .catch(() => ({ zip, data: null }))
          );
        }

        const [listingResults, marketResults, hudData] = await Promise.all([
          Promise.all(listingPromises),
          Promise.all(marketPromises),
          getHud50Data(),
        ]);

        if (cancelled) return;

        // Build market baselines map: zip → bedroom → median
        const marketMap: Record<string, Record<number, number>> = {};
        for (const { zip, data } of marketResults) {
          if (!data) continue;
          marketMap[zip] = {};
          const byBr = data.detailedByBedroom;
          if (byBr && typeof byBr === 'object') {
            for (const [brKey, stats] of Object.entries(byBr)) {
              const brNum = parseInt(brKey, 10);
              const med = (stats as any)?.medianRent;
              if (!isNaN(brNum) && typeof med === 'number' && med > 0) {
                marketMap[zip][brNum] = med;
              }
            }
          }
          // Also use the overall medianRent as a fallback key -1
          if (typeof data.medianRent === 'number' && data.medianRent > 0) {
            marketMap[zip][-1] = data.medianRent;
          }
        }

        // Build HUD map: zip → number[]
        const hudMap: Record<string, number[]> = {};
        for (const zip of city.zips) {
          const h = (hudData as Record<string, Hud50ZipRaw>)[zip];
          if (h?.f50) hudMap[zip] = h.f50;
        }

        // Merge + deduplicate listings
        const allRaw: RawListing[] = listingResults.flatMap(r => r.listings);
        const seen = new Set<string>();
        const deduped: RawListing[] = [];
        for (const l of allRaw) {
          if (!l.formattedAddress || !l.rent || l.rent <= 0) continue;
          const norm = normalizeAddr(l.formattedAddress);
          if (seen.has(norm)) continue;
          seen.add(norm);
          deduped.push(l);
        }

        // Score each listing
        const scored: ScoredListing[] = [];
        for (const l of deduped) {
          const br = l.bedrooms ?? 1;
          const score = scoreListing(l.rent, br, l.zipCode, marketMap, hudMap);
          if (score) {
            scored.push({ ...l, score, normalizedAddr: normalizeAddr(l.formattedAddress) });
          }
        }

        // Sort by best deal first
        scored.sort((a, b) => a.score.sortScore - b.score.sortScore);

        if (cancelled) return;
        setListings(scored);
        setSuccessfulEmpty(scored.length === 0);

        // Analytics
        trackEvent('deals_page_view', { city: citySlug!, listing_count: scored.length });
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [citySlug]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    if (bedroomFilter === -1) return listings;
    return listings.filter(l => (l.bedrooms ?? 1) === bedroomFilter);
  }, [listings, bedroomFilter]);

  const handleFilterChange = (val: number) => {
    setBedroomFilter(val);
    trackEvent('deals_filter_change', { city: citySlug!, bedrooms: val === -1 ? 'all' : val });
  };

  /* ── Render ── */
  return (
    <main id="main-content" className="min-h-screen bg-background">
      <SEO
        title={`Apartment Deals in ${city.displayName} — Scored by Value | RenewalReply`}
        description={`Browse ${listings.length || ''} apartments in ${city.displayName} scored by value. See which listings are good deals, fairly priced, or overpriced — based on local market rent data.`}
        canonical={`/deals/${citySlug}`}
      />
      {successfulEmpty && <NoIndexMeta />}

      <div className="max-w-6xl mx-auto px-4 py-10 md:py-14">
        {/* ── Header ── */}
        <header className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">
            Apartment Deals in {city.displayName}
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mt-3">
            We scored every listing against local market rent data for this area.
            See which apartments are good deals — and which ones are overpriced.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            {!loading && <>{filtered.length} apartments · </>}Updated daily · Sorted by best deal first
          </p>
          <p className="text-xs text-muted-foreground/70 mt-2">
            Rentcast Market Data · HUD SAFMR · Updated March 2026
          </p>
        </header>

        {/* ── Filter Pills ── */}
        <div className="flex flex-wrap gap-2 mb-6">
          {BEDROOM_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => handleFilterChange(f.value)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                bedroomFilter === f.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* ── Loading skeleton ── */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="p-5 space-y-3">
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-8 w-28" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-10 w-full" />
              </Card>
            ))}
          </div>
        )}

        {/* ── Error state ── */}
        {!loading && error && (
          <div className="text-center py-16">
            <p className="text-muted-foreground">Something went wrong loading listings. Try refreshing the page.</p>
          </div>
        )}

        {/* ── Empty state ── */}
        {!loading && !error && successfulEmpty && (
          <div className="text-center py-16 max-w-md mx-auto">
            <p className="text-muted-foreground mb-3">
              We don't have active listings in {city.displayName} right now. Check back soon — listings refresh daily.
            </p>
            <Link to="/what-should-i-pay" className="text-primary hover:underline font-medium">
              Meanwhile, check what rent should cost here →
            </Link>
          </div>
        )}

        {/* ── Listings grid ── */}
        {!loading && !error && filtered.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((l, idx) => {
              const vc = verdictConfig[l.score.verdict];
              const Icon = vc.icon;
              const brLabel = l.bedrooms === 0 ? 'Studio' : l.bedrooms != null ? `${l.bedrooms} BR` : '1 BR';
              const baLabel = l.bathrooms != null ? `${l.bathrooms} BA` : null;
              const sqftLabel = l.squareFootage ? `${l.squareFootage.toLocaleString()} sqft` : null;
              const specs = [brLabel, baLabel, sqftLabel].filter(Boolean).join(' · ');

              return (
                <Card key={`${l.normalizedAddr}-${idx}`} className="p-5 flex flex-col gap-3">
                  {/* Verdict badge */}
                  <Badge className={`w-fit text-sm px-3 py-1 ${vc.badgeCls}`}>
                    <Icon className="h-3.5 w-3.5 mr-1.5" />
                    {vc.label}
                  </Badge>

                  {/* Address */}
                  <div>
                    <p className="font-semibold text-foreground">{l.formattedAddress}</p>
                    <p className="text-sm text-muted-foreground">{l.city}, {l.state} {l.zipCode}</p>
                  </div>

                  {/* Rent price */}
                  <p className="text-2xl font-bold text-foreground">
                    ${l.rent.toLocaleString()}<span className="text-sm font-normal text-muted-foreground">/mo</span>
                  </p>

                  {/* Specs */}
                  <p className="text-sm text-muted-foreground">{specs}</p>
                  {l.daysOnMarket != null && (
                    <p className="text-xs text-muted-foreground/70">
                      Listed {l.daysOnMarket} {l.daysOnMarket === 1 ? 'day' : 'days'} ago
                    </p>
                  )}

                  {/* Explanation */}
                  <div className={`rounded-md px-3 py-2 text-sm ${vc.rowCls}`}>
                    "{l.score.explanation}"
                  </div>

                  {/* CTA */}
                  {l.listingUrl ? (
                    <Button
                      variant="outline"
                      className="w-full mt-auto"
                      onClick={() => {
                        trackEvent('deals_listing_click', {
                          city: citySlug!,
                          address: l.formattedAddress,
                          rent: l.rent,
                          verdict: l.score.verdict,
                          bedrooms: l.bedrooms ?? -1,
                        });
                        window.open(l.listingUrl!, '_blank', 'noopener');
                      }}
                    >
                      View Details <ArrowRight className="h-4 w-4 ml-1.5" />
                    </Button>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-auto text-center">Contact landlord directly</p>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {/* ── Below-listings section ── */}
        {!loading && !error && listings.length > 0 && (
          <div className="mt-14 space-y-6 max-w-xl">
            <div className="space-y-3">
              <Link
                to="/"
                onClick={() => trackEvent('deals_tool_click', { city: citySlug!, destination: 'renewal' })}
                className="flex items-center gap-2 text-primary hover:underline font-medium"
              >
                Already renting in {city.name}? Check if your rent increase is fair <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/what-should-i-pay"
                onClick={() => trackEvent('deals_tool_click', { city: citySlug!, destination: 'wsip' })}
                className="flex items-center gap-2 text-primary hover:underline font-medium"
              >
                Wondering what you should pay? Use our What Should I Pay tool <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">How we score listings</p>
              <p>
                Every apartment is compared against the market median rent for its ZIP code and bedroom count,
                using Rentcast market data with HUD Fair Market Rent as a secondary benchmark. Listings priced
                significantly below the market baseline are flagged as Good Deals. Listings refresh daily.{' '}
                <Link to="/methodology" className="text-primary hover:underline">Learn more about our methodology →</Link>
              </p>
            </div>
          </div>
        )}
      </div>

      <SEOFooter />
    </main>
  );
};

export default DealsPage;
