import React from 'react';
import { Link } from 'react-router-dom';

const CHIPS: { label: string; slug: string }[] = [
  { label: 'East Village', slug: 'east-village' },
  { label: 'Chelsea', slug: 'chelsea-nyc' },
  { label: 'Brickell', slug: 'brickell' },
  { label: 'Lincoln Park', slug: 'lincoln-park' },
  { label: 'Mission District', slug: 'mission-district' },
  { label: 'Wicker Park', slug: 'wicker-park' },
];

const BrowseDealsSection: React.FC = () => (
  <section className="max-w-[820px] mx-auto px-5 sm:px-6 pt-5 pb-14 sm:pb-16">
    <h2
      className="font-display text-[19px] sm:text-[22px] text-foreground tracking-tight text-center mb-2"
      style={{ letterSpacing: '-0.02em' }}
    >
      Browse Apartment Deals
    </h2>
    <p className="text-[15px] text-muted-foreground text-center max-w-[480px] mx-auto mb-6 leading-relaxed">
      Listings scored below market across NYC, Miami, Chicago, Austin, and San Francisco.
    </p>
    <div className="flex flex-wrap justify-center gap-2">
      {CHIPS.map(c => (
        <Link
          key={c.slug}
          to={`/deals/${c.slug}`}
          className="rounded-lg border border-border/60 bg-card px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
        >
          {c.label}
        </Link>
      ))}
    </div>
    <div className="mt-5 text-center">
      <Link to="/deals" className="text-sm text-primary hover:underline font-medium">View all neighborhoods →</Link>
    </div>
  </section>
);

export default BrowseDealsSection;
