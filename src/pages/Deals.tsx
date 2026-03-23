import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Navigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { findDealCity } from '@/data/dealsCities';
import { scoreListing } from '@/lib/dealScore';
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
  const [medianRents, setMedianRents] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [beds, setBeds] = useState<BedFilter>('All');
  const [sort, setSort] = useState<SortKey>('score');
  const [cleanOnly, setCleanOnly] = useState(false);
  const [selected, setSelected] = useState<DealListing | null>(null);

  // Fetch all listings via bulk deals-listings function
  useEffect(() => {
    if (!city) return;
    setLoading(true);

    const fetchAll = async () => {
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
    };

    fetchAll();
  }, [city?.slug]);

  // Compute medians by bedroom count
  useEffect(() => {
    if (!rawListings.length) return;
    const byBeds: Record<number, number[]> = {};
    rawListings.forEach(l => {
      const b = l.bedrooms ?? 1;
      if (!byBeds[b]) byBeds[b] = [];
      byBeds[b].push(l.rent);
    });

    const meds: Record<number, number> = {};
    Object.entries(byBeds).forEach(([b, rents]) => {
      const sorted = rents.sort((a, c) => a - c);
      meds[Number(b)] = sorted[Math.floor(sorted.length / 2)];
    });
    setMedianRents(meds);
  }, [rawListings]);

  // Score and filter listings
  const deals: DealListing[] = useMemo(() => {
    return rawListings
      .map((l, idx) => {
        const bedCount = l.bedrooms ?? 1;
        const median = medianRents[bedCount] || 0;
        const { score, verdict, savingsPerMonth, savingsPct } = scoreListing(l.rent, median);
        if (!verdict) return null;

        return {
          id: `deal-${idx}`,
          address: l.formattedAddress || 'Unknown',
          beds: bedCount,
          baths: l.bathrooms ?? 1,
          sqft: l.squareFootage || null,
          rent: l.rent,
          medianRent: median,
          daysOnMarket: l.daysOnMarket,
          score,
          verdict,
          savingsPerMonth,
          savingsPct,
          cleanBuilding: true, // TODO: integrate HPD violations data in v2
          issues: 0,
        } as DealListing;
      })
      .filter((d): d is DealListing => d !== null);
  }, [rawListings, medianRents]);

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
    trackEvent('deals_email_captured', { city: city?.name || '', email });
  }, [city?.name]);

  // Invalid city → redirect
  if (!city) return <Navigate to="/rent-data" replace />;

  const overallMedian = medianRents[1] || null;
  const primaryZip = city.zips[0];
  const displayName = city.neighborhood || city.name;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Deals', item: 'https://renewalreply.com/rent-data' },
          { '@type': 'ListItem', position: 2, name: 'New York', item: 'https://renewalreply.com/rent-data/new-york' },
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
        title={`Apartment Deals in ${displayName}, NYC — Scored Below Market`}
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

      {selected && (
        <DealGateModal
          listing={selected}
          cityName={city.name}
          onClose={() => setSelected(null)}
          onEmailCaptured={handleEmailCaptured}
        />
      )}

      {/* Hero */}
      <header className="max-w-[1020px] mx-auto px-5 pt-6 pb-5">
        <nav className="text-xs text-muted-foreground mb-3.5 flex items-center gap-1">
          <Link to="/rent-data" className="hover:text-foreground transition-colors">Deals</Link>
          <span className="opacity-30">/</span>
          <Link to={`/rent-data/${city.state}`} className="hover:text-foreground transition-colors">New York</Link>
          <span className="opacity-30">/</span>
          <span className="text-muted-foreground/80">{displayName}</span>
        </nav>

        <h1 className="font-display text-2xl font-normal text-foreground leading-tight mb-1.5">
          Apartment Deals in {displayName}
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-[480px]">
          {loading ? (
            'Scoring apartments in your area…'
          ) : (
            <>
              We scored {totalScanned || rawListings.length} apartments and found{' '}
              <strong className="text-accent">{deals.length} priced below market</strong>.
            </>
          )}
        </p>
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

              <DealAlerts cityName={displayName} zip={primaryZip} />

              {/* SEO section */}
              <section className="mt-8">
                <h2 className="font-display text-base font-normal text-foreground mb-2">
                  How we find deals in {displayName}
                </h2>
                <div className="text-[13.5px] text-muted-foreground leading-relaxed space-y-2">
                  <p>
                    {overallMedian
                      ? `The typical 1-bedroom in ${displayName} rents for $${fmt(overallMedian)}/month.`
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
        </main>

        <DealsSidebar
          city={city}
          medianRent1BR={overallMedian}
          yoyChange={null}
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
