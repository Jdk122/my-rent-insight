import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getRentData, type RentZipRaw } from '@/data/dataLoader';
import { slugify, STATE_NAMES } from '@/data/cityStateUtils';
import { Input } from '@/components/ui/input';
import SEO from '@/components/SEO';
import SEOFooter from '@/components/SEOFooter';
import ContactModal from '@/components/ContactModal';
import { Skeleton } from '@/components/ui/skeleton';

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

// STATE_NAMES moved to cityStateUtils

// Top 25 cities by renter population (representative zip for each)
const TOP_CITIES: { city: string; state: string; zip: string }[] = [
  { city: 'New York', state: 'NY', zip: '10001' },
  { city: 'Los Angeles', state: 'CA', zip: '90001' },
  { city: 'Chicago', state: 'IL', zip: '60601' },
  { city: 'Houston', state: 'TX', zip: '77001' },
  { city: 'Phoenix', state: 'AZ', zip: '85001' },
  { city: 'Philadelphia', state: 'PA', zip: '19101' },
  { city: 'San Antonio', state: 'TX', zip: '78201' },
  { city: 'San Diego', state: 'CA', zip: '92101' },
  { city: 'Dallas', state: 'TX', zip: '75201' },
  { city: 'San Jose', state: 'CA', zip: '95101' },
  { city: 'Austin', state: 'TX', zip: '78701' },
  { city: 'Jacksonville', state: 'FL', zip: '32099' },
  { city: 'San Francisco', state: 'CA', zip: '94102' },
  { city: 'Columbus', state: 'OH', zip: '43201' },
  { city: 'Charlotte', state: 'NC', zip: '28201' },
  { city: 'Indianapolis', state: 'IN', zip: '46201' },
  { city: 'Seattle', state: 'WA', zip: '98101' },
  { city: 'Denver', state: 'CO', zip: '80201' },
  { city: 'Washington', state: 'DC', zip: '20001' },
  { city: 'Nashville', state: 'TN', zip: '37201' },
  { city: 'Boston', state: 'MA', zip: '02101' },
  { city: 'Portland', state: 'OR', zip: '97201' },
  { city: 'Atlanta', state: 'GA', zip: '30301' },
  { city: 'Miami', state: 'FL', zip: '33101' },
  { city: 'Minneapolis', state: 'MN', zip: '55401' },
];

// slugify moved to cityStateUtils

// Force rebuild for chunk cache invalidation
const RentData = () => {
  const navigate = useNavigate();
  const [allData, setAllData] = useState<Record<string, RentZipRaw> | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchZip, setSearchZip] = useState('');
  const [contactOpen, setContactOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const data = await getRentData();
      setAllData(data);
      setLoading(false);
    })();
  }, []);

  // Group zips by state
  const stateGroups = useMemo(() => {
    if (!allData) return {};
    const groups: Record<string, number> = {};
    for (const r of Object.values(allData)) {
      if (r.s) {
        groups[r.s] = (groups[r.s] || 0) + 1;
      }
    }
    return groups;
  }, [allData]);

  // Get FMR for top cities
  const topCityData = useMemo(() => {
    if (!allData) return [];
    return TOP_CITIES.map(tc => {
      const raw = allData[tc.zip];
      return { ...tc, fmr1br: raw?.f[1] ?? null };
    }).filter(tc => tc.fmr1br !== null);
  }, [allData]);

  const sortedStates = useMemo(() => {
    return Object.keys(stateGroups)
      .filter(s => STATE_NAMES[s])
      .sort((a, b) => (STATE_NAMES[a] || a).localeCompare(STATE_NAMES[b] || b));
  }, [stateGroups]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEO
        title="Free U.S. Rent Data — Fair Market Rent for 40,000+ Zip Codes | RenewalReply"
        description="Look up HUD fair market rent benchmarks, median rents, and year-over-year rent trends for any U.S. zip code. Free rent data from HUD, Census, and FRED."
        canonical="/rent-data"
        jsonLd={[
          {
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: 'U.S. Rent Data by Location',
            description: 'Free fair market rent data for over 40,000 U.S. zip codes from HUD, Census, and FRED.',
            url: 'https://www.renewalreply.com/rent-data',
            publisher: { '@type': 'Organization', name: 'RenewalReply', url: 'https://www.renewalreply.com' },
          },
          {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.renewalreply.com/' },
              { '@type': 'ListItem', position: 2, name: 'Rent Data', item: 'https://www.renewalreply.com/rent-data' },
            ],
          },
        ]}
      />

      <noscript>
        <div style={{ maxWidth: 800, margin: '0 auto', padding: 24, fontFamily: 'sans-serif' }}>
          <h1>U.S. Rent Data by Location</h1>
          <p>RenewalReply provides free fair market rent data for over 40,000 U.S. zip codes, sourced from HUD, the U.S. Census Bureau, and FRED.</p>
          <h2>Browse by State</h2>
          <ul>
            {Object.keys(STATE_NAMES).sort((a, b) => STATE_NAMES[a].localeCompare(STATE_NAMES[b])).map(s => (
              <li key={s}><a href={`#${slugify(STATE_NAMES[s])}`}>{STATE_NAMES[s]}</a></li>
            ))}
          </ul>
        </div>
      </noscript>

      {/* Nav */}
      <nav className="sticky top-0 z-[60] flex items-center justify-between px-6 py-4 bg-card" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <Link to="/" className="font-display text-xl font-bold text-primary tracking-tight" style={{ letterSpacing: '-0.02em' }}>
          Renewal<span className="font-normal text-accent">Reply</span>
        </Link>
        <Link
          to="/"
          className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-[13px] font-semibold hover:brightness-90 transition-all duration-150 shadow-sm shadow-primary/20"
        >
          Check your rent →
        </Link>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-12 md:py-16 flex-1 w-full">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted-foreground">
          <ol className="flex items-center gap-1">
            <li><Link to="/" className="hover:text-foreground transition-colors">Home</Link></li>
            <li className="before:content-['›'] before:mx-1"><span aria-current="page">Rent Data</span></li>
          </ol>
        </nav>

        <section className="mb-12">
          <h1 className="font-display text-3xl md:text-4xl text-foreground leading-tight tracking-tight" style={{ letterSpacing: '-0.02em' }}>
            U.S. Rent Data by Location
          </h1>
          <p className="mt-3 text-muted-foreground leading-relaxed" style={{ fontSize: '1.05rem' }}>
            RenewalReply provides free fair market rent data for over 40,000 U.S. zip codes, sourced from HUD, the U.S. Census Bureau, and FRED. Look up HUD fair market rent benchmarks, median rents, and year-over-year rent trends for any zip code in the United States.
          </p>

          {/* Search */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const trimmed = searchZip.trim();
              if (trimmed.length === 5 && /^\d{5}$/.test(trimmed)) {
                navigate(`/rent/${trimmed}`);
              }
            }}
            className="mt-6 flex items-center gap-2"
          >
            <Input
              type="text"
              inputMode="numeric"
              pattern="\d{5}"
              maxLength={5}
              placeholder="Enter zip code…"
              value={searchZip}
              onChange={(e) => setSearchZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
              className="h-11 w-40"
            />
            <button
              type="submit"
              disabled={!/^\d{5}$/.test(searchZip)}
              className="bg-primary text-primary-foreground px-5 h-11 rounded-lg text-sm font-semibold hover:brightness-90 transition-all duration-150 shadow-sm shadow-primary/20 disabled:opacity-40"
            >
              Look up →
            </button>
          </form>
        </section>

        {loading ? (
          <div className="space-y-4">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
          </div>
        ) : (
          <>
            {/* Top Cities */}
            <section className="mb-12">
              <h2 className="font-display text-2xl text-foreground mb-4 tracking-tight">Top Cities</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {topCityData.map(tc => (
                  <Link
                    key={tc.zip}
                    to={`/rent-data/${slugify(STATE_NAMES[tc.state] || tc.state)}/${slugify(tc.city)}`}
                    className="flex items-center justify-between rounded-lg border border-border p-4 bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div>
                      <span className="font-semibold text-foreground">{tc.city}, {tc.state}</span>
                      <span className="ml-2 text-sm text-muted-foreground">{tc.zip}</span>
                    </div>
                    <span className="tabular-nums text-sm text-muted-foreground">1-BR: {fmt(tc.fmr1br!)}</span>
                  </Link>
                ))}
              </div>
            </section>

            {/* Browse by State */}
            <section className="mb-12">
              <h2 className="font-display text-2xl text-foreground mb-4 tracking-tight">Browse by State</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {sortedStates.map(s => (
                  <Link
                    key={s}
                    to={`/rent-data/${slugify(STATE_NAMES[s])}`}
                    className="text-sm text-primary hover:text-primary/80 underline"
                  >
                    {STATE_NAMES[s]} <span className="text-muted-foreground no-underline">({stateGroups[s]})</span>
                  </Link>
                ))}
              </div>
            </section>

            {/* Data Sources */}
            <section className="mb-12">
              <h2 className="font-display text-2xl text-foreground mb-4 tracking-tight">Data Sources</h2>
              <p className="text-muted-foreground leading-relaxed text-sm">
                Six data sources: HUD Fair Market Rents and 50th Percentile Rents for government benchmarks, Apartment List for rent trends from actual lease transactions, Zillow ZORI and ZHVI for market momentum, and Rentcast for real-time comparable listings and market statistics. Data reflects FY2026 federal housing benchmarks.
              </p>
            </section>

            {/* Bottom CTA */}
            <section className="text-center py-10">
              <h2 className="font-display text-2xl text-foreground mb-3 tracking-tight">
                Got a rent increase?
              </h2>
              <p className="text-muted-foreground mb-6">Check if it's fair — it's free.</p>
              <Link
                to="/"
                className="inline-block bg-primary text-primary-foreground px-8 py-3 rounded-lg font-semibold hover:brightness-90 transition-all duration-150 shadow-sm shadow-primary/20"
              >
                Check my rent →
              </Link>
            </section>
          </>
        )}
      </main>

      <SEOFooter onContactClick={() => setContactOpen(true)} />
      <ContactModal open={contactOpen} onOpenChange={setContactOpen} />
    </div>
  );
};

export default RentData;
