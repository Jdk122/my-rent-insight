import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import RenewalReminderModal from './RenewalReminderModal';
import { findDealsNeighborhoodByZip, findDealsNeighborhoodsByCity, findDealsNeighborhoodsByState } from '@/data/dealsMatch';
import { AFFILIATE_LINKS } from '@/lib/affiliateConfig';
import { trackEvent } from '@/lib/analytics';
import { supabase } from '@/integrations/supabase/client';

interface RenterToolsCTAProps {
  zip?: string;
  city?: string;
  stateName?: string;
  stateAbbr?: string;
  pageType?: 'zip' | 'city' | 'state' | 'tool';
  showAffiliate?: boolean;
}

const RenterToolsCTA = ({ zip, city, stateName, stateAbbr, pageType = 'tool', showAffiliate = false }: RenterToolsCTAProps) => {
  const [reminderOpen, setReminderOpen] = useState(false);
  const renewalLink = '/';
  const wsipLink = '/what-should-i-pay';

  const affiliateRef = useRef<HTMLDivElement>(null);
  const impressionFired = useRef(false);

  useEffect(() => {
    if (!showAffiliate) return;
    const el = affiliateRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !impressionFired.current) {
          impressionFired.current = true;
          trackEvent('affiliate_impression', {
            link_type: 'partner_rent_reporting',
            placement: 'seo_renter_tools',
            page_type: pageType,
            city: city || '',
            state_abbr: stateAbbr || '',
            experiment: 'seo_renter_tools_rr_v1',
          });
          observer.disconnect();
        }
      },
      { threshold: 0.25 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [showAffiliate, pageType, city, stateAbbr]);

  type CardDef = { title: string; sub: string; cta: string; to?: string; scroll?: string; action?: 'reminder'; href?: string; isAffiliate?: boolean };

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
    let baseCards: CardDef[];

    switch (pageType) {
      case 'zip':
        baseCards = [
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
        break;
      case 'city':
        baseCards = [
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
        break;
      case 'state':
        baseCards = [
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
        break;
      default:
        baseCards = [
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
        break;
    }

    if (showAffiliate) {
      return [
        ...baseCards,
        {
          title: 'Build Credit With Rent',
          sub: "Your monthly rent payments may help build your credit. Most renters don't know this is an option.",
          cta: 'Start Reporting Rent →',
          href: AFFILIATE_LINKS.rent_reporting,
          isAffiliate: true,
        },
      ];
    }

    return baseCards;
  };

  const cards = getCards();
  const hasAffiliateCard = cards.some(c => c.isAffiliate);
  const gridCols = cards.length === 3 ? 'sm:grid-cols-3' : cards.length === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2';

  const handleAffiliateClick = (e: React.MouseEvent) => {
    e.preventDefault();

    trackEvent('affiliate_click', {
      link_type: 'partner_rent_reporting',
      placement: 'seo_renter_tools',
      page_type: pageType,
      city: city || '',
      state_abbr: stateAbbr || '',
    });

    supabase
      .from('referral_clicks')
      .insert({
        event_type: 'affiliate_click',
        link_type: 'partner_rent_reporting',
        placement: 'seo_renter_tools',
        zip: zip || null,
      } as any)
      .then(() => {});

    window.open(AFFILIATE_LINKS.rent_reporting, '_blank', 'noopener,noreferrer');
  };

  return (
    <section className="mb-12">
      <h2 className="font-display text-2xl text-foreground mb-5 tracking-tight">Renter Tools</h2>
      <div className={`grid grid-cols-1 ${gridCols} gap-4`}>
        {cards.map((t, i) => (
          <div
            key={i}
            ref={t.isAffiliate ? affiliateRef : undefined}
            className="rounded-xl border border-border bg-card p-5 flex flex-col shadow-sm"
          >
            <h3 className="font-semibold text-foreground text-[15px] mb-1">{t.title}</h3>
            <p className="text-xs text-muted-foreground leading-relaxed mb-4 flex-1">{t.sub}</p>
            {t.href ? (
              <a
                href={t.href}
                target="_blank"
                rel="sponsored noopener noreferrer"
                onClick={handleAffiliateClick}
                className="inline-flex items-center justify-center bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-semibold hover:brightness-90 transition-all duration-150 shadow-sm shadow-primary/20"
              >
                {t.cta}
              </a>
            ) : t.action === 'reminder' ? (
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
      {hasAffiliateCard && (
        <p className="text-[10px] text-muted-foreground/60 mt-2">
          RenewalReply may earn a commission from some links at no cost to you.{' '}
          <Link to="/privacy" className="underline hover:text-muted-foreground">Privacy</Link>
        </p>
      )}
      <RenewalReminderModal open={reminderOpen} onOpenChange={setReminderOpen} zip={zip} />
    </section>
  );
};

export default RenterToolsCTA;
