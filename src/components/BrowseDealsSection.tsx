import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

const NEIGHBORHOODS: { label: string; slug: string; sub: string }[] = [
  { label: 'East Village', slug: 'east-village', sub: 'NYC · Manhattan' },
  { label: 'Chelsea', slug: 'chelsea-nyc', sub: 'NYC · Manhattan' },
  { label: 'Brickell', slug: 'brickell', sub: 'Miami · Downtown' },
  { label: 'Lincoln Park', slug: 'lincoln-park', sub: 'Chicago · North Side' },
  { label: 'Mission District', slug: 'mission-district', sub: 'San Francisco' },
  { label: 'Wicker Park', slug: 'wicker-park', sub: 'Chicago · West Side' },
];

const cardClass = "group flex items-center gap-4 rounded-xl border border-border/60 border-l-[3px] border-l-primary bg-card px-5 py-4 hover:bg-primary/[0.03] hover:shadow-md hover:shadow-primary/[0.06] transition-all duration-200";

const BrowseDealsSection: React.FC = () => (
  <section className="max-w-[820px] mx-auto px-5 sm:px-6 pt-6 pb-8 border-t border-border/40">
    <h2
      className="font-display text-[22px] sm:text-[26px] text-foreground tracking-tight text-center mb-2"
      style={{ letterSpacing: '-0.02em' }}
    >
      Browse Apartment Deals
    </h2>
    <p className="text-[15px] text-muted-foreground text-center max-w-[480px] mx-auto mb-6 leading-relaxed">
      Listings scored below market across NYC, Miami, Chicago, Austin, and San Francisco.
    </p>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {NEIGHBORHOODS.map(n => (
        <Link key={n.slug} to={`/deals/${n.slug}`} className={cardClass}>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground text-[15px] group-hover:text-primary transition-colors">{n.label}</h3>
            <p className="text-[13px] text-muted-foreground leading-relaxed mt-0.5">Browse scored listings</p>
          </div>
          <ChevronRight className="text-primary/50 group-hover:text-primary shrink-0 transition-all duration-200 group-hover:translate-x-0.5" size={18} />
        </Link>
      ))}
    </div>
    <div className="mt-5 text-center">
      <Link to="/deals" className="text-sm text-primary hover:underline font-medium">View all neighborhoods →</Link>
    </div>
  </section>
);

export default BrowseDealsSection;
