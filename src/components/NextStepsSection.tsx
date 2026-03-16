import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Truck, Key, Shield, Share2, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';
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

/* ── ActionCard (reused for Moving / Mortgage / Insurance / Share) ── */

interface ActionCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  stats: { label: string; value: string }[];
  actionLabel: string;
  actionHref?: string;
  onAction?: () => void;
  recommended?: boolean;
  delay: number;
}

const ActionCard = ({ icon, title, description, stats, actionLabel, actionHref, onAction, recommended, delay }: ActionCardProps) => (
  <motion.div
    {...fade(delay)}
    className={`rounded-xl border bg-card p-5 transition-shadow duration-200 hover:shadow-md ${
      recommended ? 'border-primary/40 shadow-sm' : 'border-border'
    }`}
  >
    <div className="flex items-start gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
        recommended ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground'
      }`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-[15px] font-semibold text-foreground leading-tight">{title}</h3>
          {recommended && (
            <span className="text-[10px] font-semibold uppercase tracking-wider text-primary bg-primary/10 rounded-full px-2 py-0.5 shrink-0">
              Recommended
            </span>
          )}
        </div>
        <p className="text-[13px] text-muted-foreground leading-relaxed mb-3">{description}</p>

        {stats.length > 0 && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3">
            {stats.map((s, i) => (
              <div key={i} className="flex items-baseline gap-1.5">
                <span className="text-[11px] text-muted-foreground/70">{s.label}:</span>
                <span className="text-[13px] font-semibold text-foreground">{s.value}</span>
              </div>
            ))}
          </div>
        )}

        {actionHref ? (
          <a
            href={actionHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onAction?.()}
            className={`inline-flex items-center gap-1.5 text-[13px] font-semibold transition-colors ${
              recommended
                ? 'text-primary hover:text-primary/80'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {actionLabel} <ArrowRight className="w-3.5 h-3.5" />
          </a>
        ) : (
          <button
            onClick={() => onAction?.()}
            className={`inline-flex items-center gap-1.5 text-[13px] font-semibold transition-colors ${
              recommended
                ? 'text-primary hover:text-primary/80'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {actionLabel} <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  </motion.div>
);

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
            Save ${fmt(savings)}/mo
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
}

const ListingsBlock = ({ listings, listingsLoading, proposedRent, zip, capturedEmail, compAddresses }: ListingsBlockProps) => {
  const [expanded, setExpanded] = useState(false);

  // Don't render anything if gate not unlocked
  if (!capturedEmail) return null;

  // Loading skeleton
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

  // Deduplicate against comps
  const compSet = new Set(
    (compAddresses ?? [])
      .filter(Boolean)
      .map(a => a.toLowerCase().replace(/\s+/g, ' ').trim())
  );
  const dedupedListings = listings.filter(
    l => !!l.formattedAddress && !compSet.has(l.formattedAddress.toLowerCase().replace(/\s+/g, ' ').trim())
  );

  // Empty state: no listings OR none cheaper than proposed rent
  const hasAnyCheaper = dedupedListings.some(l => l.rent < proposedRent);
  if (!dedupedListings.length || !hasAnyCheaper) {
    return (
      <motion.div {...fade(0.24)}>
        <p className="text-[13px] text-muted-foreground">No active listings found in your area right now. New apartments are listed daily — check back soon.</p>
        <BrowseLinks zip={zip} />
      </motion.div>
    );
  }

  // Sort: below proposedRent first (cheapest first), then above (cheapest first)
  const sorted = [...dedupedListings].sort((a, b) => {
    const aBelow = a.rent < proposedRent ? 0 : 1;
    const bBelow = b.rent < proposedRent ? 0 : 1;
    if (aBelow !== bBelow) return aBelow - bBelow;
    return a.rent - b.rent;
  });

  const firstIsBestValue = sorted.length > 0 && sorted[0].rent < proposedRent;
  const visible = expanded ? sorted : sorted.slice(0, 3);
  const hasMore = sorted.length > 3;

  return (
    <motion.div {...fade(0.24)} className="space-y-2">
      <h3 className="text-[15px] font-semibold text-foreground">Available apartments nearby that could save you money</h3>
      {visible.map((l, i) => (
        <ListingCard key={i} listing={l} proposedRent={proposedRent} zip={zip} isBestValue={i === 0 && firstIsBestValue} />
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
  fairnessScore,
  verdictLabel,
  zip,
  bedrooms,
  currentRent,
  proposedRent,
  propertyType,
  city,
  state,
  compMedianRent,
  dollarOverpayment,
  brLabel,
  onShareClick,
  analysisId,
  capturedEmail,
  listings,
  listingsLoading,
  compAddresses,
}: NextStepsSectionProps) => {
  const logReferralClick = useCallback((linkType: string) => {
    supabase.from('referral_clicks').insert({
      analysis_id: analysisId ?? null,
      email: capturedEmail || null,
      link_type: linkType,
      zip: zip || null,
    } as any).then(() => {});
  }, [analysisId, capturedEmail, zip]);

  const estimatedHomePrice = Math.round(currentRent * 200);
  const overpaymentDisplay = dollarOverpayment && dollarOverpayment > 0 ? dollarOverpayment : null;

  const heading = isAboveMarket
    ? overpaymentDisplay
      ? `You're paying ~$${fmt(overpaymentDisplay)}/mo above market — here are your options`
      : `Your rent is above market — here are your options`
    : `Your rent looks fair — here's how to stay protected`;

  return (
    <motion.section id="section-next-steps" {...fade(0.22)} className="pt-10 pb-6">
      <div className="border-t border-border/60 pt-8 mb-6">
        <h2 className="text-xl font-semibold text-foreground tracking-tight">{heading}</h2>
      </div>

      <div className="space-y-3">
        {isAboveMarket ? (
          <>
            {/* Real listings block (replaces old "See Apartments" placeholder) */}
            <ListingsBlock
              listings={listings ?? []}
              listingsLoading={!!listingsLoading}
              proposedRent={proposedRent}
              zip={zip}
              capturedEmail={capturedEmail}
              compAddresses={compAddresses}
            />

            <ActionCard
              icon={<Truck className="w-5 h-5" />}
              title="Get Free Moving Quotes"
              description="Compare vetted movers before you commit to a renewal."
              stats={[
                { label: `Typical move in ${state}`, value: '$1,200–$2,500' },
                { label: 'Quote turnaround', value: 'Often same day' },
              ]}
              actionLabel="Compare Movers"
              actionHref="https://www.moving.com/movers/"
              onAction={() => { trackEvent('referral_clicked', { partner: 'moving' }); logReferralClick('moving_quotes'); }}
              delay={0.28}
            />

            <ActionCard
              icon={<Key className="w-5 h-5" />}
              title="Could You Buy Instead?"
              description="Run a quick affordability check with current mortgage assumptions."
              stats={[
                { label: 'Estimated buying power', value: `$${fmt(estimatedHomePrice)}` },
                { label: 'Based on current rent', value: `$${fmt(currentRent)}/mo` },
              ]}
              actionLabel="Check Rates"
              actionHref="https://www.bankrate.com/mortgages/mortgage-calculator/"
              onAction={() => { trackEvent('referral_clicked', { partner: 'mortgage' }); logReferralClick('mortgage_check'); }}
              delay={0.32}
            />
          </>
        ) : (
          <>
            <ActionCard
              icon={<Shield className="w-5 h-5" />}
              title="Protect Your Home"
              description="Renters insurance can cover theft, accidental damage, and liability."
              stats={[
                { label: 'Typical starting cost', value: 'From $5/mo' },
                { label: 'Setup time', value: 'A few minutes' },
              ]}
              actionLabel="Get a Free Quote"
              actionHref="https://www.lemonade.com/renters"
              onAction={() => { trackEvent('referral_clicked', { partner: 'insurance' }); logReferralClick('renters_insurance'); }}
              recommended
              delay={0.24}
            />

            <ActionCard
              icon={<Share2 className="w-5 h-5" />}
              title="Share With Your Neighbors"
              description="Know someone dealing with a rent increase? Send them this tool."
              stats={[]}
              actionLabel="Share Results"
              onAction={() => {
                trackEvent('report_shared', { method: 'share_button' });
                onShareClick?.();
              }}
              delay={0.28}
            />
          </>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between rounded-xl border border-border bg-secondary/60 px-4 py-3">
        <span className="text-[13px] text-muted-foreground">At ${fmt(currentRent)}/mo in rent, you might be able to own.</span>
        <a
          href="https://www.bankrate.com/mortgages/mortgage-calculator/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[13px] font-medium text-primary hover:underline inline-flex items-center gap-1 shrink-0"
          onClick={() => { trackEvent('referral_clicked', { partner: 'mortgage_banner' }); logReferralClick('mortgage_banner'); }}
        >
          See if you qualify <ArrowRight className="w-3 h-3" />
        </a>
      </div>
    </motion.section>
  );
};

export default NextStepsSection;
