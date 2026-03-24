import { useState } from 'react';
import { Link } from 'react-router-dom';
import RenewalReminderModal from './RenewalReminderModal';
import { findDealsNeighborhoodByZip, findDealsNeighborhoodsByCity, findDealsNeighborhoodsByState } from '@/data/dealsMatch';

interface RenterToolsCTAProps {
  zip?: string;
  city?: string;
  stateName?: string;
  stateAbbr?: string;
  pageType?: 'zip' | 'city' | 'state' | 'tool';
}

const RenterToolsCTA = ({ zip, city, stateName, stateAbbr, pageType = 'tool' }: RenterToolsCTAProps) => {
  const [reminderOpen, setReminderOpen] = useState(false);
  const renewalLink = '/';
  const wsipLink = '/what-should-i-pay';

  type CardDef = { title: string; sub: string; cta: string; to?: string; scroll?: string; action?: 'reminder' };

  /** Resolve a contextual deals card. Returns null when there is no real match. */
  const getDealsCard = (): CardDef | null => {
    if (pageType === 'zip' && zip) {
      const match = findDealsNeighborhoodByZip(zip);
      if (match) return { title: `Deals in ${match.neighborhood || match.name}`, sub: `Apartments scored below market in ${match.neighborhood || match.name}.`, cta: 'Browse Deals →', to: `/deals/${match.slug}` };
    }
    if (pageType === 'city' && city && stateAbbr) {
      const matches = findDealsNeighborhoodsByCity(city, stateAbbr);
      if (matches.length === 1) return { title: `Deals in ${matches[0].neighborhood || matches[0].name}`, sub: 'See apartments scored below market.', cta: 'Browse Deals →', to: `/deals/${matches[0].slug}` };
      if (matches.length > 1) return { title: `Apartment Deals Near ${city}`, sub: `${matches.length} neighborhoods with scored listings.`, cta: 'Browse Deals →', to: '/deals' };
    }
    if (pageType === 'state' && stateAbbr) {
      const matches = findDealsNeighborhoodsByState(stateAbbr);
      if (matches.length > 0) return { title: `Apartment Deals in ${stateName || 'This State'}`, sub: `${matches.length} neighborhood${matches.length > 1 ? 's' : ''} with scored listings.`, cta: 'Browse Deals →', to: '/deals' };
    }
    return null;
  };

  const getCards = (): CardDef[] => {
    const dealsCard = getDealsCard();
    switch (pageType) {
      case 'zip':
        return [
          {
            title: 'Is This Listing Fair?',
            sub: 'Compare any asking rent to real market data.',
            cta: 'Check a Listing →',
            to: wsipLink,
          },
          {
            title: 'Got a Rent Increase?',
            sub: 'See if your landlord is overcharging. In 60 seconds.',
            cta: 'Check Your Increase →',
            to: renewalLink,
          },
          ...(dealsCard ? [dealsCard] : []),
        ];
      case 'city':
        return [
          {
            title: `Compare Rent in ${city || 'This City'}`,
            sub: 'See if an asking rent is fair based on local data.',
            cta: 'Check a Listing →',
            to: wsipLink,
          },
          {
            title: `Check a Rent Increase in ${city || 'This City'}`,
            sub: 'See if your landlord is overcharging.',
            cta: 'Check Your Increase →',
            to: renewalLink,
          },
          ...(dealsCard ? [dealsCard] : [{
            title: `Browse ${city || 'City'} ZIP Codes`,
            sub: 'See rent data by ZIP code in this city.',
            cta: 'View ZIP Codes ↓',
            scroll: 'section-zipcodes',
          }]),
        ];
      case 'state':
        return [
          ...(dealsCard ? [dealsCard] : []),
          {
            title: `Explore Cities in ${stateName || 'This State'}`,
            sub: 'Browse rent data by city.',
            cta: 'View Cities ↓',
            scroll: 'section-cities',
          },
          {
            title: 'Check Your Rent Increase',
            sub: 'See if your landlord is overcharging. In 60 seconds.',
            cta: 'Check Your Increase →',
            to: renewalLink,
          },
        ];
      default:
        return [
          {
            title: 'Got a Rent Increase?',
            sub: 'See if your landlord is overcharging. In 60 seconds.',
            cta: 'Check Your Increase →',
            to: renewalLink,
          },
          {
            title: 'Is This Listing Fair?',
            sub: 'Compare any asking rent to real market data.',
            cta: 'Check a Listing →',
            to: wsipLink,
          },
          {
            title: 'Set a Renewal Reminder',
            sub: 'Get market data emailed before your lease expires.',
            cta: 'Set Reminder →',
            action: 'reminder',
          },
        ];
    }
  };

  const cards = getCards();
  const gridCols = cards.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2';

  return (
    <section className="mb-12">
      <h2 className="font-display text-2xl text-foreground mb-5 tracking-tight">Renter Tools</h2>
      <div className={`grid grid-cols-1 ${gridCols} gap-4`}>
        {cards.map((t, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-5 flex flex-col shadow-sm">
            <h3 className="font-semibold text-foreground text-[15px] mb-1">{t.title}</h3>
            <p className="text-xs text-muted-foreground leading-relaxed mb-4 flex-1">{t.sub}</p>
            {t.action === 'reminder' ? (
              <button
                onClick={() => setReminderOpen(true)}
                className="inline-flex items-center justify-center bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-semibold hover:brightness-90 transition-all duration-150 shadow-sm shadow-primary/20"
              >
                {t.cta}
              </button>
            ) : t.scroll ? (
              <button
                onClick={() => document.getElementById(t.scroll!)?.scrollIntoView({ behavior: 'smooth' })}
                className="inline-flex items-center justify-center bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-semibold hover:brightness-90 transition-all duration-150 shadow-sm shadow-primary/20"
              >
                {t.cta}
              </button>
            ) : (
              <Link
                to={t.to!}
                className="inline-flex items-center justify-center bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-semibold hover:brightness-90 transition-all duration-150 shadow-sm shadow-primary/20"
              >
                {t.cta}
              </Link>
            )}
          </div>
        ))}
      </div>
      <RenewalReminderModal open={reminderOpen} onOpenChange={setReminderOpen} zip={zip} />
    </section>
  );
};

export default RenterToolsCTA;
