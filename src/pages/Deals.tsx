import { useState, useEffect, useMemo, useCallback } from 'react';
import { getRememberedEmail } from '@/lib/emailMemory';
import { useParams, Navigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { findDealCity } from '@/data/dealsCities';
import { scoreListing, normalizeBedrooms, computeBatchIQR } from '@/lib/dealScore';
import { calculateCompositeTrend, type CompositeTrendResult } from '@/lib/compositeTrend';
import { getRentData, getApartmentListData } from '@/data/dataLoader';
import SEO from '@/components/SEO';
import PageNav from '@/components/PageNav';
import DealCard from '@/components/deals/DealCard';
import DealGateModal from '@/components/deals/DealGateModal';
import DealAlerts from '@/components/deals/DealAlerts';
import DealsSidebar from '@/components/deals/DealsSidebar';
import type { DealListing } from '@/components/deals/DealCard';
import { trackEvent } from '@/lib/analytics';

const fmt = (n: number) => n.toLocaleString('en-US');

type BedFilter = 'All' | 'S' | '1' | '2' | '3';
type SortKey = 'score' | 'price' | 'sav' | 'new';

const Deals = () => {
  const { citySlug } = useParams<{ citySlug: string }>();
  const city = citySlug ? findDealCity(citySlug) : undefined;

  const [rawListings, setRawListings] = useState<any[]>([]);
  const [totalScanned, setTotalScanned] = useState(0);
  const [loading, setLoading] = useState(true);
  const [beds, setBeds] = useState<BedFilter>('All');
  const [sort, setSort] = useState<SortKey>('score');
  const [cleanOnly, setCleanOnly] = useState(false);
  const [selected, setSelected] = useState<DealListing | null>(null);

  // Gate state: first analysis free, gate on second distinct listing
  const [freeViewUsed, setFreeViewUsed] = useState(() => {
    try { return localStorage.getItem('rr_deals_free_used') === 'true'; } catch { return false; }
  });
  const [freeListingId, setFreeListingId] = useState<string | null>(() => {
    try { return localStorage.getItem('rr_deals_free_listing_id'); } catch { return null; }
  });
  const [emailCaptured, setEmailCaptured] = useState(() => !!getRememberedEmail());

  // Market context
  const [marketByZip, setMarketByZip] = useState<Record<string, any>>({});
  const [trendResult, setTrendResult] = useState<CompositeTrendResult | null>(null);
  const [stateVacancyRate, setStateVacancyRate] = useState<number | null>(null);

  // Enrichment signals
  const [walkScores, setWalkScores] = useState<Record<string, number>>({});
  const [stabilizedMap, setStabilizedMap] = useState<Record<string, boolean>>({});

  // NYC detection
  const NYC_ZIP_PREFIXES = ['100', '101', '102', '103', '104', '111', '112', '113', '114', '116'];
  const isNYCMarket = city?.zips.some(z => NYC_ZIP_PREFIXES.includes(z.substring(0, 3))) ?? false;

  const primaryZip = city?.zips[0] || '10003';

  // Fetch listings
  useEffect(() => {
    if (!city) return;
    setLoading(true);

    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('deals-listings', {
          body: { zips: city.zips },
        });
        if (error || !data?.listings) {
          console.error('deals-listings error:', error);
          setRawListings([]);
          setLoading(false);
          return;
        }
        setRawListings(data.listings);
        setTotalScanned(data.totalScanned || data.listings.length);
      } catch (err) {
        console.error('deals-listings fetch failed:', err);
        setRawListings([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [city?.slug]);

  // Fetch market data per unique ZIP across listings
  useEffect(() => {
    if (!rawListings.length || !city) return;

    (async () => {
      const listingZips = [...new Set(rawListings.map((l: any) => l.zipCode || primaryZip))];
      const results: Record<string, any> = {};

      await Promise.all(listingZips.map(async (zip) => {
        try {
          const { data } = await supabase.functions.invoke('rentcast-market', { body: { zip } });
          if (data) results[zip] = data;
        } catch (err) {
          console.error(`Market data failed for ${zip}:`, err);
        }
      }));

      setMarketByZip(results);
    })();
  }, [rawListings, primaryZip]);

  // Fetch composite trend from existing data sources (same pattern as RentByZip)
  useEffect(() => {
    if (!city) return;

    (async () => {
      try {
        const [allData, alData] = await Promise.all([
          getRentData(),
          getApartmentListData(),
        ]);

        const zipData = allData[primaryZip] || null;
        const al = alData[primaryZip] || null;

        const result = calculateCompositeTrend({
          alYoY: al?.aly ?? null,
          zoriYoY: zipData?.zy ?? null,
          zoriSource: zipData?.zy != null ? 'zip' : null,
          hudYoY: zipData?.y ?? null,
        });

        setTrendResult(result);
      } catch (err) {
        console.error('Trend fetch failed:', err);
      }
    })();
  }, [primaryZip]);

  // Fetch Walk Scores for listings with coordinates
  useEffect(() => {
    if (!rawListings.length) return;

    (async () => {
      const scores: Record<string, number> = {};
      const withCoords = rawListings
        .filter((l: any) => l.latitude != null && l.longitude != null)
        .slice(0, 20);

      for (let i = 0; i < withCoords.length; i += 5) {
        const batch = withCoords.slice(i, i + 5);
        await Promise.all(batch.map(async (l: any) => {
          try {
            const { data } = await supabase.functions.invoke('walkscore-lookup', {
              body: { address: l.formattedAddress, lat: l.latitude, lon: l.longitude },
            });
            if (data?.walkscore != null) {
              const key = (l.formattedAddress || '').toLowerCase().trim();
              scores[key] = data.walkscore;
            }
          } catch (err) {
            console.error('Walk score fetch failed:', err);
          }
        }));
      }

      setWalkScores(scores);
    })();
  }, [rawListings]);

  // Fetch DHCR rent stabilization data (NYC only)
  useEffect(() => {
    if (!rawListings.length || !isNYCMarket) return;

    (async () => {
      const addresses = rawListings
        .map((l: any) => l.formattedAddress)
        .filter(Boolean)
        .slice(0, 50);

      if (!addresses.length) return;

      try {
        const { data } = await supabase.functions.invoke('dhcr-batch-lookup', {
          body: { addresses },
        });
        if (data?.results) {
          setStabilizedMap(data.results);
        }
      } catch (err) {
        console.error('DHCR batch lookup failed:', err);
      }
    })();
  }, [rawListings, isNYCMarket]);

  // Fetch state vacancy rate
  useEffect(() => {
    if (!city) return;

    (async () => {
      try {
        const { data } = await supabase.functions.invoke('fred-vacancy', {
          body: { state: city.stateAbbr },
        });
        if (data?.rate != null) setStateVacancyRate(parseFloat(data.rate));
      } catch (err) {
        console.error('Vacancy fetch failed:', err);
      }
    })();
  }, [city?.stateAbbr]);

  // Precompute batch IQR per bedroom count ONCE
  const batchIQRByBed = useMemo(() => {
    if (!rawListings.length) return {};
    const allBedCounts = [...new Set(rawListings.map((l: any) => normalizeBedrooms(l.bedrooms)))];
    const lookup: Record<number, { median: number; p25: number | null; p75: number | null }> = {};
    for (const bc of allBedCounts) {
      lookup[bc] = computeBatchIQR(rawListings, bc);
    }
    return lookup;
  }, [rawListings]);

  // Score and filter listings
  const deals: DealListing[] = useMemo(() => {
    if (!rawListings.length || !Object.keys(batchIQRByBed).length) return [];

    return rawListings
      .map((l: any, idx: number) => {
        const bedCount = normalizeBedrooms(l.bedrooms);
        const listingZip = l.zipCode || primaryZip;
        const market = marketByZip[listingZip] || marketByZip[primaryZip] || null;
        const batchIQR = batchIQRByBed[bedCount] || { median: 0, p25: null, p75: null };

        // Get Rentcast median for this bedroom count
        const rcMedian = market?.medianRent ?? null;

        const addrKey = (l.formattedAddress || '').toLowerCase().trim();
        const walkScore = walkScores[addrKey] ?? null;
        const isRentStabilized = stabilizedMap[l.formattedAddress] ?? false;

        const result = scoreListing({
          rent: l.rent,
          bedrooms: bedCount,
          daysOnMarket: l.daysOnMarket ?? null,
          rcMedianRent: rcMedian,
          compositeTrend: trendResult?.compositeTrend ?? null,
          trendConfidence: trendResult?.confidenceScore ?? 0,
          batchMedian: batchIQR.median,
          batchP25: batchIQR.p25,
          batchP75: batchIQR.p75,
          stateVacancyRate,
          walkScore,
          isRentStabilized,
        });

        if (!result.verdict) return null;

        return {
          id: `deal-${idx}`,
          address: l.formattedAddress || 'Unknown',
          beds: bedCount,
          baths: l.bathrooms ?? 1,
          sqft: l.squareFootage || null,
          rent: l.rent,
          daysOnMarket: l.daysOnMarket,
          ...result,
          listingUrl: l.listingUrl || null,
          cleanBuilding: true, // TODO: integrate HPD violations data in v2
          issues: 0,
        } as DealListing;
      })
      .filter((d): d is DealListing => d !== null);
  }, [rawListings, batchIQRByBed, marketByZip, trendResult, stateVacancyRate, primaryZip, walkScores, stabilizedMap]);

  // Apply filters and sort
  const filteredDeals = useMemo(() => {
    let r = [...deals];
    if (beds !== 'All') {
      const bedNum = beds === 'S' ? 0 : parseInt(beds);
      r = r.filter(d => d.beds === bedNum);
    }
    if (cleanOnly) r = r.filter(d => d.cleanBuilding);

    if (sort === 'score') r.sort((a, b) => b.score - a.score);
    else if (sort === 'price') r.sort((a, b) => a.rent - b.rent);
    else if (sort === 'sav') r.sort((a, b) => b.savingsPerMonth - a.savingsPerMonth);
    else if (sort === 'new') r.sort((a, b) => (a.daysOnMarket ?? 999) - (b.daysOnMarket ?? 999));

    return r.slice(0, 15);
  }, [deals, beds, sort, cleanOnly]);

  const handleEmailCaptured = useCallback((email: string) => {
    setEmailCaptured(true);
    trackEvent('deals_email_captured', { city: city?.name || '', email });
  }, [city?.name]);

  const handleAlertEmailCaptured = useCallback((email: string) => {
    setEmailCaptured(true);
  }, []);

  // Invalid city → redirect
  if (!city) return <Navigate to="/rent-data" replace />;

  // Market context for hero
  const primaryMarket = marketByZip[primaryZip] || null;
  const heroMedian1BR = primaryMarket?.medianRent ?? batchIQRByBed[1]?.median ?? null;
  const heroTrend = trendResult?.compositeTrend ?? null;
  const displayName = city.neighborhood || city.name;

  const jsonLd = [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Deals', item: 'https://renewalreply.com/deals' },
          { '@type': 'ListItem', position: 2, name: city.stateAbbr, item: 'https://renewalreply.com/deals' },
          { '@type': 'ListItem', position: 3, name: displayName },
        ],
      },
      {
        '@type': 'WebPage',
        name: `Apartment Deals in ${displayName}, ${city.stateAbbr}`,
        description: `${deals.length} apartments in ${displayName} (${primaryZip}) scored below market rent.`,
        url: `https://renewalreply.com/deals/${city.slug}`,
      },
    ],
  };

  return (
    <div className="min-h-screen bg-background font-body">
      <SEO
        title={`Apartment Deals in ${displayName}, ${city.stateAbbr} — Scored Below Market`}
        description={`${deals.length || 'Top'} apartments in ${displayName} (${primaryZip}) scored below market rent. See how much you can save on 1BR, 2BR, and studio apartments. Updated daily.`}
        canonical={`/deals/${city.slug}`}
        jsonLd={jsonLd}
      />

      <style>{`
        @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes animate-fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes animate-scale-in { from { opacity: 0; transform: scale(0.96) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        .animate-fade-in { animation: animate-fade-in 0.15s ease; }
        .animate-scale-in { animation: animate-scale-in 0.2s ease; }
      `}</style>

      <PageNav ctaText="Check My Rent →" />

      {selected && (() => {
        const listingId = selected.address;
        const isFreeEligible = !freeViewUsed || listingId === freeListingId;
        const shouldSkipGate = emailCaptured || isFreeEligible;
        const isReopenedFree = freeViewUsed && listingId === freeListingId;

        return (
          <DealGateModal
            listing={selected}
            cityName={city.name}
            cityStateAbbr={city.stateAbbr}
            cityZip={primaryZip}
            onClose={() => setSelected(null)}
            onEmailCaptured={handleEmailCaptured}
            skipGate={shouldSkipGate}
            isFreeView={isFreeEligible && !emailCaptured}
            onAnalysisViewed={() => {
              if (!freeViewUsed) {
                setFreeViewUsed(true);
                setFreeListingId(listingId);
                try {
                  localStorage.setItem('rr_deals_free_used', 'true');
                  localStorage.setItem('rr_deals_free_listing_id', listingId);
                } catch {}
                trackEvent('deals_free_analysis_viewed', { address: selected.address, score: selected.score, gated: false });
              }
              if (!isReopenedFree && freeViewUsed && !emailCaptured && listingId !== freeListingId) {
                trackEvent('free_analysis_to_gate_attempt', { free_listing_id: freeListingId || '', gated_listing_id: listingId });
              }
            }}
          />
        );
      })()}

      {/* Hero */}
      <header className="max-w-[1020px] mx-auto px-5 pt-6 pb-5">
        <nav className="text-xs text-muted-foreground mb-3.5 flex items-center gap-1">
          <Link to="/deals" className="hover:text-foreground transition-colors">Deals</Link>
          <span className="opacity-30">/</span>
          <Link to="/deals" className="hover:text-foreground transition-colors">{city.stateAbbr}</Link>
          <span className="opacity-30">/</span>
          <span className="text-muted-foreground/80">{displayName}</span>
        </nav>

        <h1 className="font-display text-2xl font-normal text-foreground leading-tight mb-1.5">
          Apartment Deals in {displayName}
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-[540px]">
          {loading ? (
            'Scoring apartments in your area…'
          ) : (
            <>
              We scored {totalScanned} apartments and found{' '}
              <strong className="text-accent">{deals.length} priced below market</strong>.
            </>
          )}
        </p>

        {/* Hero market context */}
        {!loading && (heroMedian1BR || heroTrend != null || (stateVacancyRate != null && stateVacancyRate > 5)) && (
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
            {heroMedian1BR != null && heroMedian1BR > 0 && (
              <span>{displayName} median 1BR: <strong className="text-foreground">${fmt(heroMedian1BR)}</strong></span>
            )}
            {heroTrend != null && (
              <span className={heroTrend > 0 ? 'text-destructive' : 'text-accent'}>
                {heroTrend > 0 ? '+' : ''}{heroTrend}% YoY
              </span>
            )}
            {stateVacancyRate != null && stateVacancyRate > 5 && (
              <span>{city.stateAbbr} vacancy: {stateVacancyRate.toFixed(1)}%</span>
            )}
          </div>
        )}
      </header>

      {/* Main content */}
      <div className="max-w-[1020px] mx-auto px-5 pb-16 grid grid-cols-1 lg:grid-cols-[1fr_248px] gap-6 items-start">
        <main>
          {/* Filters */}
          <div className="flex items-center gap-1.5 flex-wrap mb-3">
            {([['All', 'All'], ['S', 'Studio'], ['1', '1BR'], ['2', '2BR'], ['3', '3BR']] as const).map(([k, l]) => (
              <button
                key={k}
                onClick={() => setBeds(k as BedFilter)}
                className={`px-3 py-1 rounded-md text-xs font-medium border transition-colors ${
                  beds === k
                    ? 'border-primary bg-primary/5 text-primary font-semibold'
                    : 'border-border bg-card text-muted-foreground hover:border-primary/50'
                }`}
              >
                {l}
              </button>
            ))}
            <div className="w-px h-4 bg-border mx-1" />
            <button
              onClick={() => setCleanOnly(!cleanOnly)}
              className={`px-3 py-1 rounded-md text-xs font-medium border transition-colors ${
                cleanOnly
                  ? 'border-primary bg-primary/5 text-primary font-semibold'
                  : 'border-border bg-card text-muted-foreground hover:border-primary/50'
              }`}
            >
              Clean buildings
            </button>
            <div className="flex-1" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="px-2 py-1 rounded-md border border-border text-xs text-muted-foreground bg-card cursor-pointer"
            >
              <option value="score">Best deals</option>
              <option value="sav">Biggest savings</option>
              <option value="price">Lowest price</option>
              <option value="new">Newest</option>
            </select>
          </div>

          {loading ? (
            <div className="flex flex-col gap-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-[72px] bg-muted/50 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              <p className="text-[11.5px] text-muted-foreground mb-2">
                {filteredDeals.length} deal{filteredDeals.length !== 1 && 's'} · Click any listing for the full analysis
              </p>

              <div className="flex flex-col gap-1.5">
                {filteredDeals.map((d, i) => (
                  <DealCard key={d.id} listing={d} index={i} onSelect={setSelected} />
                ))}
                {!filteredDeals.length && (
                  <div className="py-10 text-center text-muted-foreground text-sm">
                    No deals match that filter. Try another bedroom size.
                  </div>
                )}
              </div>

              <DealAlerts cityName={displayName} zip={primaryZip} onEmailCaptured={handleAlertEmailCaptured} />

              {/* SEO section */}
              <section className="mt-8">
                <h2 className="font-display text-base font-normal text-foreground mb-2">
                  How we find deals in {displayName}
                </h2>
                <div className="text-[13.5px] text-muted-foreground leading-relaxed space-y-2">
                  <p>
                    {heroMedian1BR
                      ? `The typical 1-bedroom in ${displayName} rents for $${fmt(heroMedian1BR)}/month${heroTrend != null ? `, ${heroTrend > 0 ? 'up' : 'down'} ${Math.abs(heroTrend)}% from last year` : ''}.`
                      : `We analyze every available listing in ${displayName}.`}
                    {' '}We score every listing against similar apartments nearby, factor in building quality and market conditions,
                    and only show the ones priced meaningfully below market.
                  </p>
                  <p>
                    Deals here typically rent within a week. Subscribe to get notified the day new ones are listed.
                  </p>
                </div>
              </section>
            </>
          )}

          {/* Mobile cross-sell — sidebar is hidden on mobile */}
          <div className="md:hidden space-y-3 mt-6 mb-8 px-1">
            <Link to="/" className="block rounded-xl border border-border bg-card p-4 hover:border-primary/40 transition-all">
              <p className="font-semibold text-foreground text-[14px]">Already renting here?</p>
              <p className="text-xs text-muted-foreground mt-0.5">Check if your rent increase is fair.</p>
              <span className="text-xs text-primary font-medium mt-1.5 inline-block">Check my increase →</span>
            </Link>
            <Link to="/what-should-i-pay" className="block rounded-xl border border-border bg-card p-4 hover:border-primary/40 transition-all">
              <p className="font-semibold text-foreground text-[14px]">Considering a listing?</p>
              <p className="text-xs text-muted-foreground mt-0.5">See if the asking rent is fair.</p>
              <span className="text-xs text-primary font-medium mt-1.5 inline-block">Check asking price →</span>
            </Link>
            <Link to={`/rent-data/zip/${primaryZip}`} className="block rounded-xl border border-border bg-card p-4 hover:border-primary/40 transition-all">
              <p className="font-semibold text-foreground text-[14px]">Rent data for {primaryZip}</p>
              <p className="text-xs text-muted-foreground mt-0.5">HUD benchmarks, trends, and nearby comparisons.</p>
            </Link>
          </div>
        </main>

        <DealsSidebar
          city={city}
          medianRent1BR={heroMedian1BR}
          yoyChange={heroTrend}
          activeListings={rawListings.length}
        />
      </div>

      {/* Footer */}
      <footer className="border-t border-border bg-muted/30 py-4 px-5">
        <div className="max-w-[1020px] mx-auto flex justify-between items-center">
          <span className="text-[11px] text-muted-foreground">© {new Date().getFullYear()} RenewalReply</span>
          <div className="flex gap-3 text-[11px]">
            <Link to="/methodology" className="text-muted-foreground hover:text-foreground transition-colors">Methodology</Link>
            <Link to="/about" className="text-muted-foreground hover:text-foreground transition-colors">About</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Deals;
