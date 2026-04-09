import { useRef, useEffect, useCallback } from 'react';
import { trackEvent } from '@/lib/analytics';
import { supabase } from '@/integrations/supabase/client';
import { AFFILIATE_LINKS } from '@/lib/affiliateConfig';

interface RentReportingCTAProps {
  zip?: string;
  city?: string;
  stateAbbr?: string;
  stateName?: string;
  pageType: 'zip' | 'city' | 'state' | 'guide' | 'calculator';
}

const RentReportingCTA = ({ zip, city, stateAbbr, stateName, pageType }: RentReportingCTAProps) => {
  const impressionFired = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const insuranceImpressionFired = useRef(false);
  const insuranceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !impressionFired.current) {
          impressionFired.current = true;
          trackEvent('affiliate_impression', {
            link_type: 'partner_rent_reporting',
            placement: `${pageType}_page_cta`,
            zip: zip || '',
            city: city || '',
            state_abbr: stateAbbr || '',
          });
          observer.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [zip, city, stateAbbr, pageType]);

  useEffect(() => {
    const el = insuranceRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !insuranceImpressionFired.current) {
          insuranceImpressionFired.current = true;
          trackEvent('affiliate_impression', {
            link_type: 'partner_renters_insurance',
            placement: 'seo_renters_insurance',
            page_type: pageType,
            city: city || '',
            state_abbr: stateAbbr || '',
          });
          observer.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [city, stateAbbr, pageType]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();

    trackEvent('affiliate_click', {
      link_type: 'partner_rent_reporting',
      placement: `${pageType}_page_cta`,
      zip: zip || '',
      city: city || '',
      state_abbr: stateAbbr || '',
    });

    supabase
      .from('referral_clicks')
      .insert({
        event_type: 'affiliate_click',
        link_type: 'partner_rent_reporting',
        placement: `${pageType}_page_cta`,
        zip: zip || null,
      } as any)
      .then(() => {});

    window.open(AFFILIATE_LINKS.rent_reporting, '_blank', 'noopener,noreferrer');
  }, [zip, city, stateAbbr, pageType]);

  const handleInsuranceClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();

    trackEvent('affiliate_click', {
      link_type: 'partner_renters_insurance',
      placement: 'seo_renters_insurance',
      page_type: pageType,
      city: city || '',
      state_abbr: stateAbbr || '',
    });

    supabase
      .from('referral_clicks')
      .insert({
        event_type: 'affiliate_click',
        link_type: 'partner_renters_insurance',
        placement: 'seo_renters_insurance',
        zip: zip || null,
      } as any)
      .then(() => {});

    window.open(AFFILIATE_LINKS.renters_insurance, '_blank', 'noopener,noreferrer');
  }, [zip, city, stateAbbr, pageType]);

  let locationLabel: string;
  if (pageType === 'state') {
    locationLabel = stateName || stateAbbr || 'your state';
  } else if (city && stateAbbr) {
    locationLabel = `${city}, ${stateAbbr}`;
  } else if (city) {
    locationLabel = city;
  } else if (zip) {
    locationLabel = `ZIP ${zip}`;
  } else {
    locationLabel = 'your area';
  }

  return (
    <div className="space-y-3">
      <div ref={containerRef} className="rounded-lg border border-border border-l-[3px] border-l-primary bg-secondary/50 px-4 py-4">
        <p className="text-[14px] font-medium text-foreground">
          Renting in {locationLabel}? Your rent could be building your credit.
        </p>
        <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed">
          Report your monthly rent payments to all 3 credit bureaus — the same ones your next landlord will check. Takes 2 minutes to set up.
        </p>
        <button
          onClick={handleClick}
          className="mt-2 inline-block rounded-md bg-primary/10 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/20 transition-colors"
        >
          Start reporting rent →
        </button>
        <p className="text-[10px] text-muted-foreground/40 mt-2">
          RenewalReply may earn a commission at no cost to you.{' '}
          <a href="/privacy" className="underline hover:text-muted-foreground">Learn more</a>
        </p>
      </div>

      <div ref={insuranceRef} className="rounded-lg border border-border border-l-[3px] border-l-primary bg-secondary/50 px-4 py-4">
        <p className="text-[14px] font-medium text-foreground">
          Renters insurance from $5/mo
        </p>
        <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed">
          Protect your belongings from theft, fire, and water damage. Takes 2 minutes and most landlords require it.
        </p>
        <button
          onClick={handleInsuranceClick}
          className="mt-2 inline-block rounded-md bg-primary/10 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/20 transition-colors"
        >
          Get a free quote →
        </button>
        <p className="text-[10px] text-muted-foreground/40 mt-2">
          RenewalReply may earn a commission at no cost to you.{' '}
          <a href="/privacy" className="underline hover:text-muted-foreground">Learn more</a>
        </p>
      </div>
    </div>
  );
};

export default RentReportingCTA;
