import React from 'react';
import { Link } from 'react-router-dom';
import { DEAL_CITIES } from '@/data/dealsCities';
import SEO from '@/components/SEO';
import PageNav from '@/components/PageNav';
import SEOFooter from '@/components/SEOFooter';
import { usePrerenderReady } from '@/hooks/usePrerenderReady';

const QUICK_PICKS = [
  'east-village', 'brickell', 'lincoln-park', 'mission-district',
  'chelsea-nyc', 'wicker-park', 'south-congress', 'astoria',
];

const METRO_ORDER: { key: string; label: string; sub: string }[] = [
  { key: 'NY', label: 'New York City', sub: 'Manhattan and Queens neighborhoods' },
  { key: 'NJ', label: 'New Jersey', sub: 'Hudson County waterfront' },
  { key: 'FL', label: 'Miami', sub: 'Brickell to Wynwood and beyond' },
  { key: 'IL', label: 'Chicago', sub: 'North Side neighborhoods' },
  { key: 'TX', label: 'Austin', sub: 'East side to South Congress' },
  { key: 'CA', label: 'San Francisco', sub: 'From the Mission to Pacific Heights' },
];

const DealsHub: React.FC = () => {
  usePrerenderReady(true);

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
        <section className="max-w-4xl mx-auto px-5 pt-10 pb-6 text-center md:text-left">
          <h1 className="font-display text-3xl md:text-4xl font-normal text-foreground leading-tight">
            Find where the deals actually are.
          </h1>
          <p className="mt-2 text-base text-muted-foreground max-w-xl mx-auto md:mx-0">
            Every listing scored against local market data. Pick your neighborhood.
          </p>
        </section>

        {/* Quick-pick chips */}
        <section className="max-w-4xl mx-auto px-5 pb-8">
          <div
            className="flex gap-2 overflow-x-auto pb-1"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            <style>{`.deals-chips::-webkit-scrollbar { display: none; }`}</style>
            <div className="deals-chips flex gap-2">
              {QUICK_PICKS.map(slug => {
                const c = DEAL_CITIES.find(d => d.slug === slug);
                if (!c) return null;
                return (
                  <Link
                    key={slug}
                    to={`/deals/${slug}`}
                    className="shrink-0 px-3.5 py-1.5 rounded-full border border-border text-[13px] font-medium text-foreground/80 hover:border-primary/50 hover:text-primary transition-colors"
                  >
                    {c.neighborhood || c.name}
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {/* Metro sections */}
        <section className="max-w-4xl mx-auto px-5 pb-12">
          <div className="space-y-10">
            {METRO_ORDER.map(metro => {
              const cities = DEAL_CITIES
                .filter(c => c.stateAbbr === metro.key)
                .sort((a, b) => a.name.localeCompare(b.name));
              if (!cities.length) return null;

              return (
                <div key={metro.key}>
                  <h2 className="text-lg font-medium text-foreground">{metro.label}</h2>
                  <p className="text-sm text-muted-foreground mt-0.5 mb-4">{metro.sub}</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {cities.map(city => (
                      <Link
                        key={city.slug}
                        to={`/deals/${city.slug}`}
                        className="group relative bg-card border border-border/60 rounded-lg px-4 py-3.5 hover:border-primary/40 hover:-translate-y-0.5 transition-all"
                      >
                        <span className="absolute top-2.5 right-3 text-[10px] font-medium text-muted-foreground/50 bg-muted/40 px-1.5 py-0.5 rounded">
                          {city.stateAbbr}
                        </span>
                        <span className="block font-medium text-sm text-foreground group-hover:text-primary transition-colors">
                          {city.neighborhood || city.name}
                        </span>
                        <span className="block text-xs text-muted-foreground mt-0.5">
                          Browse scored listings →
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Cross-sell */}
        <section className="border-t border-border bg-muted/30 py-10">
          <div className="max-w-4xl mx-auto px-5 text-center">
            <p className="text-lg font-medium text-foreground">Renewing instead of moving?</p>
            <p className="text-base text-muted-foreground mt-1">
              Check whether your rent increase is above market.
            </p>
            <Link to="/" className="inline-block mt-3 text-primary font-medium hover:underline">
              Check my rent increase →
            </Link>
          </div>
        </section>
      </main>

      <SEOFooter />
    </div>
  );
};

export default DealsHub;
