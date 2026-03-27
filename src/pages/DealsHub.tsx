import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { DEAL_CITIES } from '@/data/dealsCities';
import SEO from '@/components/SEO';
import PageNav from '@/components/PageNav';
import SEOFooter from '@/components/SEOFooter';
import { usePrerenderReady } from '@/hooks/usePrerenderReady';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Search } from 'lucide-react';

const QUICK_PICKS = [
  'east-village', 'brickell', 'lincoln-park', 'mission-district',
  'chelsea-nyc', 'wicker-park', 'south-congress', 'astoria',
];

const METRO_ORDER: { key: string; label: string }[] = [
  { key: 'NY', label: 'New York City' },
  { key: 'NJ', label: 'New Jersey' },
  { key: 'FL', label: 'Miami' },
  { key: 'IL', label: 'Chicago' },
  { key: 'TX', label: 'Austin' },
  { key: 'CA', label: 'San Francisco' },
];

const METRO_CONTEXT: Record<string, string> = {
  'NY': 'Manhattan, NY',
  'NJ': 'Hudson County, NJ',
  'FL': 'Miami, FL',
  'IL': 'North Side, Chicago',
  'TX': 'Austin, TX',
  'CA': 'San Francisco, CA',
};

const METRO_ACCENT: Record<string, string> = {
  'NY': 'border-l-blue-500',
  'NJ': 'border-l-teal-500',
  'FL': 'border-l-orange-400',
  'IL': 'border-l-purple-500',
  'TX': 'border-l-amber-500',
  'CA': 'border-l-green-500',
};

const METRO_CHIP_ACCENT: Record<string, string> = {
  'NY': 'bg-blue-500',
  'NJ': 'bg-teal-500',
  'FL': 'bg-orange-400',
  'IL': 'bg-purple-500',
  'TX': 'bg-amber-500',
  'CA': 'bg-green-500',
};

const DealsHub: React.FC = () => {
  usePrerenderReady(true);
  const [search, setSearch] = useState('');

  const filteredCities = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase().trim();
    return DEAL_CITIES.filter(
      c => c.name.toLowerCase().includes(q) || (c.neighborhood ?? '').toLowerCase().includes(q)
    );
  }, [search]);

  // Find metro accent for a city in quick picks
  const chipCity = (slug: string) => DEAL_CITIES.find(d => d.slug === slug);

  return (
    <div className="min-h-screen bg-background font-body flex flex-col">
      <SEO
        title="Apartment Deals by Neighborhood — Scored Below Market | RenewalReply"
        description="Browse apartment deals across curated neighborhoods in NYC, Miami, Chicago, Austin, and San Francisco. Every listing scored against local market data."
        canonical="/deals"
      />

      <PageNav ctaText="Check My Rent →" />

      <main id="main-content" className="flex-1">
        {/* Hero */}
        <section className="max-w-4xl mx-auto px-5 pt-12 pb-4">
          <h1 className="font-display text-3xl md:text-4xl font-normal text-foreground leading-tight tracking-tight">
            Find where the deals actually are.
          </h1>
          <p className="mt-3 text-[15px] text-muted-foreground max-w-xl leading-relaxed">
            Every listing scored against local market data. We track what's overpriced, what's fair, and what's a steal.
          </p>

          {/* Search */}
          <div className="relative mt-6 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" size={16} />
            <Input
              placeholder="Search neighborhoods..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
        </section>

        {/* Search results */}
        {filteredCities !== null ? (
          <section className="max-w-4xl mx-auto px-5 pt-4 pb-12">
            {filteredCities.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No neighborhoods match "{search}"</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {filteredCities.map(city => (
                  <NeighborhoodCard key={city.slug} city={city} />
                ))}
              </div>
            )}
          </section>
        ) : (
          <>
            {/* Quick picks */}
            <section className="max-w-4xl mx-auto px-5 pt-4 pb-6">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2.5">Popular neighborhoods</p>
              <div className="flex gap-2 flex-wrap">
                {QUICK_PICKS.map(slug => {
                  const c = chipCity(slug);
                  if (!c) return null;
                  const dotColor = METRO_CHIP_ACCENT[c.stateAbbr] ?? 'bg-muted-foreground';
                  return (
                    <Link
                      key={slug}
                      to={`/deals/${slug}`}
                      className="flex items-center gap-1.5 shrink-0 px-3.5 py-1.5 rounded-full border border-border text-[13px] font-medium text-foreground/80 hover:border-primary/50 hover:text-primary transition-colors"
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                      {c.neighborhood || c.name}
                    </Link>
                  );
                })}
              </div>
            </section>

            {/* Metro sections */}
            <section className="max-w-4xl mx-auto px-5 pb-12">
              <div className="space-y-0">
                {METRO_ORDER.map((metro, idx) => {
                  const cities = DEAL_CITIES
                    .filter(c => c.stateAbbr === metro.key)
                    .sort((a, b) => a.name.localeCompare(b.name));
                  if (!cities.length) return null;

                  return (
                    <div key={metro.key}>
                      {idx > 0 && <Separator className="my-8" />}
                      <h2 className="text-xl font-semibold text-foreground">{metro.label}</h2>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-4">
                        {cities.map(city => (
                          <NeighborhoodCard key={city.slug} city={city} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}

        {/* Cross-sell */}
        <section className="max-w-4xl mx-auto px-5 pb-12">
          <p className="text-sm text-muted-foreground">
            Not moving?{' '}
            <Link to="/" className="text-primary font-medium hover:underline">
              Check if your rent increase is above market →
            </Link>
          </p>
        </section>
      </main>

      <SEOFooter />
    </div>
  );
};

/* ── Card ── */

interface CardProps {
  city: typeof DEAL_CITIES[number];
}

const NeighborhoodCard: React.FC<CardProps> = ({ city }) => {
  const accent = METRO_ACCENT[city.stateAbbr] ?? 'border-l-border';
  const metroLabel = METRO_CONTEXT[city.stateAbbr] ?? city.stateAbbr;
  const zipCount = city.zips.length;

  return (
    <Link
      to={`/deals/${city.slug}`}
      className={`group bg-card border border-border/60 border-l-[3px] ${accent} rounded-lg px-5 py-5 hover:border-primary/40 hover:-translate-y-0.5 transition-all`}
    >
      <span className="block font-semibold text-[15px] text-foreground group-hover:text-primary transition-colors">
        {city.neighborhood || city.name}
      </span>
      <span className="block text-xs text-muted-foreground mt-1">
        {metroLabel}
      </span>
      <span className="block text-[11px] text-muted-foreground/60 mt-0.5">
        {zipCount} ZIP{zipCount !== 1 ? ' codes' : ' code'}
      </span>
      <span className="block text-xs text-primary font-medium mt-3 group-hover:underline">
        Browse deals →
      </span>
    </Link>
  );
};

export default DealsHub;
