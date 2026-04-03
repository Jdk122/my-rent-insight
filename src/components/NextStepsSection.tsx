import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';
import { trackEvent } from '@/lib/analytics';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import type { ActiveListing } from '@/hooks/useRentcastListings';

interface NextStepsSectionProps {
  isAboveMarket: boolean;
  fairnessScore: number | null;
  verdictLabel: string;
  zip: string;
  bedrooms: number;
  currentRent: number;
  proposedRent: number;
  propertyType?: string;
  city: string;
  state: string;
  compMedianRent: number | null;
  dollarOverpayment: number | null;
  brLabel: string;
  onShareClick?: () => void;
  analysisId?: string | null;
  capturedEmail?: string;
  listings?: ActiveListing[];
  listingsLoading?: boolean;
  compAddresses?: string[];
}

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

const fade = (delay: number) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, delay, ease: [0.16, 1, 0.3, 1] as const },
});

/* ── Listing card ── */

interface ListingCardProps {
  listing: ActiveListing;
  proposedRent: number;
  zip: string;
  isBestValue?: boolean;
  onLogReferral?: () => void;
}

const ListingCard = ({ listing, proposedRent, zip, isBestValue, onLogReferral }: ListingCardProps) => {
  const savings = proposedRent - listing.rent;
  const hasSavings = savings > 0;

  const meta: string[] = [];
  if (listing.bedrooms != null) meta.push(`${listing.bedrooms === 0 ? 'Studio' : `${listing.bedrooms} bed`}`);
  if (listing.bathrooms != null) meta.push(`${listing.bathrooms} bath`);
  if (listing.squareFootage != null) meta.push(`${fmt(listing.squareFootage)} sqft`);
  if (listing.daysOnMarket != null) meta.push(`Listed ${listing.daysOnMarket} ${listing.daysOnMarket === 1 ? 'day' : 'days'} ago`);

  const ctaUrl = listing.listingUrl || `https://www.zillow.com/homes/${encodeURIComponent(listing.formattedAddress)}`;
  const ctaLabel = listing.listingUrl ? 'View listing' : 'Search on Zillow';

  const handleClick = () => {
    trackEvent('listing_clicked', {
      zip,
      listing_address: listing.formattedAddress,
      listing_rent: listing.rent,
      savings: Math.max(0, savings),
      had_direct_url: !!listing.listingUrl,
    });
    onLogReferral?.();
  };

  return (
    <div className={`rounded-xl border bg-card p-4 transition-all duration-200 hover:shadow-md hover:border-primary/20 ${
      hasSavings ? 'border-l-4 border-l-emerald-400 border-t border-r border-b border-border' : 'border-border'
    }`}>
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <p className="text-[15px] font-semibold text-foreground leading-tight">{listing.formattedAddress}</p>
        {isBestValue && (
          <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5 shrink-0">
            Best Value
          </span>
        )}
      </div>
      {meta.length > 0 && (
        <p className="text-[13px] text-muted-foreground mb-3">{meta.join(' · ')}</p>
      )}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[15px] font-semibold text-foreground">${fmt(listing.rent)}/mo</span>
        {hasSavings && (
          <span className="text-[13px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2.5 py-1">
            Save ${fmt(savings)}/mo vs your renewal
          </span>
        )}
      </div>
      <a
        href={ctaUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        className="inline-flex items-center gap-1 text-[13px] font-semibold text-primary hover:text-primary/80 transition-colors"
      >
        {ctaLabel} <ArrowRight className="w-3.5 h-3.5" />
      </a>
    </div>
  );
};

/* ── Browse links ── */

const BrowseLinks = ({ zip }: { zip: string }) => (
  <p className="text-[13px] text-muted-foreground mt-3">
    Browse more:{' '}
    <a href={`https://www.zillow.com/homes/for_rent/${zip}_rb/`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Zillow</a>
    {' · '}
    <a href={`https://www.apartments.com/${zip}/`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Apartments.com</a>
  </p>
);

/* ── Listings block ── */

interface ListingsBlockProps {
  listings: ActiveListing[];
  listingsLoading: boolean;
  proposedRent: number;
  zip: string;
  capturedEmail?: string;
  compAddresses?: string[];
  onLogReferral?: (linkType: string) => void;
  isAboveMarket?: boolean;
}

export const ListingsBlock = ({ listings, listingsLoading, proposedRent, zip, capturedEmail, compAddresses, onLogReferral, isAboveMarket = true }: ListingsBlockProps) => {
  const [expanded, setExpanded] = useState(false);

  if (!capturedEmail) return null;

  if (listingsLoading) {
    return (
      <motion.div {...fade(0.24)} className="space-y-2">
        <p className="text-[14px] font-semibold text-muted-foreground animate-pulse">Finding available apartments near you...</p>
        {[0, 1, 2].map(i => (
          <Skeleton key={i} className="h-[100px] w-full rounded-xl" />
        ))}
      </motion.div>
    );
  }

  const compSet = new Set(
    (compAddresses ?? [])
      .filter(Boolean)
      .map(a => a.toLowerCase().replace(/\s+/g, ' ').trim())
  );
  const dedupedListings = listings.filter(
    l => !!l.formattedAddress && !compSet.has(l.formattedAddress.toLowerCase().replace(/\s+/g, ' ').trim())
  );

  const filteredListings = isAboveMarket
    ? dedupedListings.filter(l => l.rent < proposedRent)
    : dedupedListings;

  if (!filteredListings.length) {
    return (
      <motion.div {...fade(0.24)}>
        <p className="text-[13px] text-muted-foreground">No active listings found in your area right now. New apartments are listed daily — check back soon.</p>
        <BrowseLinks zip={zip} />
      </motion.div>
    );
  }

  const sorted = [...filteredListings].sort((a, b) => {
    const aBelow = a.rent < proposedRent ? 0 : 1;
    const bBelow = b.rent < proposedRent ? 0 : 1;
    if (aBelow !== bBelow) return aBelow - bBelow;
    return a.rent - b.rent;
  });

  const firstIsBestValue = sorted.length > 0 && sorted[0].rent < proposedRent;
  const visible = expanded ? sorted : sorted.slice(0, 3);
  const hasMore = sorted.length > 3;

  const header = isAboveMarket
    ? 'Available apartments nearby that could save you money'
    : 'See what else is available in your area';

  return (
    <motion.div {...fade(0.24)} className="space-y-2">
      <h3 className="text-[15px] font-semibold text-foreground">{header}</h3>
      {visible.map((l, i) => (
        <ListingCard key={i} listing={l} proposedRent={proposedRent} zip={zip} isBestValue={i === 0 && firstIsBestValue} onLogReferral={() => onLogReferral?.('listing_click')} />
      ))}
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="inline-flex items-center gap-1 text-[13px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          {expanded ? (
            <>Show fewer <ChevronUp className="w-3.5 h-3.5" /></>
          ) : (
            <>Show more apartments <ChevronDown className="w-3.5 h-3.5" /></>
          )}
        </button>
      )}
      <BrowseLinks zip={zip} />
    </motion.div>
  );
};

/* ── Main section ── */

const NextStepsSection = ({
  isAboveMarket,
  zip,
  proposedRent,
  capturedEmail,
  listings,
  listingsLoading,
  compAddresses,
  analysisId,
  dollarOverpayment,
  currentRent,
}: NextStepsSectionProps) => {
  const logReferralClick = useCallback((linkType: string) => {
    supabase.from('referral_clicks').insert({
      analysis_id: analysisId ?? null,
      email: capturedEmail || null,
      link_type: linkType,
      zip: zip || null,
    } as any).then(() => {});
  }, [analysisId, capturedEmail, zip]);

  const noListings = (() => {
    if (listingsLoading) return false;
    const compSet = new Set(
      (compAddresses ?? [])
        .filter(Boolean)
        .map(a => a.toLowerCase().replace(/\s+/g, ' ').trim())
    );
    const dedupedListings = (listings ?? []).filter(
      l => !!l.formattedAddress && !compSet.has(l.formattedAddress.toLowerCase().replace(/\s+/g, ' ').trim())
    );
    const filteredListings = isAboveMarket
      ? dedupedListings.filter(l => l.rent < proposedRent)
      : dedupedListings;
    return filteredListings.length === 0;
  })();

  if (noListings && !isAboveMarket) return null;

  const overpaymentDisplay = dollarOverpayment && dollarOverpayment > 0 ? dollarOverpayment : null;

  const heading = isAboveMarket
    ? overpaymentDisplay
      ? `You're paying about $${fmt(overpaymentDisplay)}/mo more than similar places nearby. Here's what's available.`
      : `Your rent is above market. Here's what's available nearby.`
    : `See what else is available in your area`;

  return (
    <motion.section id="section-next-steps" {...fade(0.22)} className="pt-10 pb-6">
      <div className="border-t border-border/60 pt-8 mb-6">
        <h2 className="text-xl font-semibold text-foreground tracking-tight">{heading}</h2>
      </div>

      <div className="space-y-3">
        <ListingsBlock
          listings={listings ?? []}
          listingsLoading={!!listingsLoading}
          proposedRent={proposedRent}
          zip={zip}
          capturedEmail={capturedEmail}
          compAddresses={compAddresses}
          onLogReferral={logReferralClick}
          isAboveMarket={isAboveMarket}
        />
      </div>
    </motion.section>
  );
};

export default NextStepsSection;
