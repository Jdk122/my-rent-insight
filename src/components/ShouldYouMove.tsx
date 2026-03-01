import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { MapPin, ExternalLink } from 'lucide-react';
import { RentcastComparable } from '@/hooks/useRentcast';
import { BedroomType } from '@/data/rentData';

interface ShouldYouMoveProps {
  proposedRent: number;
  currentRent: number;
  comparables: RentcastComparable[];
  medianCompRent: number;
  brLabel: string;
  city: string;
  state: string;
  zip: string;
  bedrooms: BedroomType;
  counterOffer: number | null;
  isAboveMarket: boolean;
  onScrollToLetter: () => void;
}

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

const brokerFeeStates = ['NJ', 'NY', 'MA'];

const bedroomNum: Record<BedroomType, string> = {
  studio: '0', oneBr: '1', twoBr: '2', threeBr: '3', fourBr: '4',
};

function buildBrowseLinks(zip: string, city: string, state: string, bedrooms: BedroomType) {
  const citySlug = city.toLowerCase().replace(/\s+/g, '-');
  const stateSlug = state.toLowerCase();
  const beds = bedroomNum[bedrooms];
  const isNYC = state === 'NY' && ['New York', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island'].includes(city);

  const links: { name: string; url: string }[] = [];
  if (isNYC) {
    links.push({ name: 'StreetEasy', url: `https://streeteasy.com/for-rent/${citySlug}?bedrooms=${bedrooms === 'studio' ? 'studio' : beds}` });
  }
  links.push(
    { name: 'Zillow', url: `https://www.zillow.com/homes/for_rent/${zip}/${beds}-_beds/` },
    { name: 'Apartments.com', url: `https://www.apartments.com/${citySlug}-${stateSlug}-${zip}/${bedrooms === 'studio' ? 'studios' : beds + '-bedrooms'}/` },
    { name: 'Realtor.com', url: `https://www.realtor.com/apartments/${zip}/beds-${beds}` },
    { name: 'HotPads', url: `https://hotpads.com/${citySlug}-${stateSlug}/apartments-for-rent/${beds === '0' ? 'studio' : beds + '-beds'}` },
  );
  return links;
}

/** Comparable listings sorted by rent with the orange proposed-rent divider */
function CompsWithRentLine({
  comparables,
  proposedRent,
}: {
  comparables: RentcastComparable[];
  proposedRent: number;
}) {
  const sorted = useMemo(() => {
    return [...comparables]
      .filter(c => c.rent !== null && c.rent > 0)
      .sort((a, b) => (a.rent ?? 0) - (b.rent ?? 0))
      .slice(0, 6);
  }, [comparables]);

  // Find where proposed rent falls
  let refIndex = sorted.length;
  const idx = sorted.findIndex(c => (c.rent ?? 0) >= proposedRent);
  if (idx !== -1) refIndex = idx;

  const rentLine = (
    <div className="flex items-center gap-3 px-4 py-2">
      <div className="flex-1 h-px bg-destructive" />
      <span className="text-[13px] text-destructive font-semibold whitespace-nowrap">
        Your proposed rent: ${fmt(proposedRent)}/mo
      </span>
      <div className="flex-1 h-px bg-destructive" />
    </div>
  );

  return (
    <div className="space-y-1">
      {sorted.map((comp, i) => (
        <div key={i}>
          {i === refIndex && rentLine}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04, duration: 0.3 }}
            className={`flex items-start justify-between gap-4 px-4 py-3 rounded-md ${i % 2 === 0 ? 'bg-muted/40' : ''}`}
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate flex items-center gap-1.5">
                <MapPin className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                {comp.formattedAddress}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {comp.bedrooms !== null && `${comp.bedrooms === 0 ? 'Studio' : `${comp.bedrooms}BR`}`}
                {comp.bathrooms !== null && ` · ${comp.bathrooms}BA`}
                {comp.squareFootage !== null && ` · ${fmt(comp.squareFootage)} sqft`}
                {comp.distance !== null && ` · ${comp.distance.toFixed(1)} mi`}
              </p>
            </div>
            {comp.rent !== null && (
              <span className="text-sm font-semibold text-foreground whitespace-nowrap">
                ${fmt(comp.rent)}/mo
              </span>
            )}
          </motion.div>
        </div>
      ))}
      {refIndex === sorted.length && rentLine}
    </div>
  );
}

const ShouldYouMove = ({
  proposedRent,
  currentRent,
  comparables,
  medianCompRent,
  brLabel,
  city,
  state,
  zip,
  bedrooms,
  counterOffer,
  isAboveMarket,
  onScrollToLetter,
}: ShouldYouMoveProps) => {
  const isAboveMedian = proposedRent > medianCompRent;
  const isAtMedian = proposedRent === medianCompRent;
  const difference = Math.abs(proposedRent - medianCompRent);

  const hasBrokerFee = brokerFeeStates.includes(state);
  // Moving cost: first month + 1.5× security + broker (if applicable) + $1,500 moving
  const estimatedMovingCost = Math.round(
    medianCompRent + (medianCompRent * 1.5) + (hasBrokerFee ? medianCompRent : 0) + 1500
  );

  const percentileBelow = useMemo(() => {
    if (isAboveMedian) return null;
    const rents = comparables.map(c => c.rent).filter((r): r is number => r !== null && r > 0);
    if (rents.length < 3) return null;
    const higher = rents.filter(r => r > proposedRent).length;
    return Math.round((higher / rents.length) * 100);
  }, [comparables, proposedRent, isAboveMedian]);

  const browseLinks = buildBrowseLinks(zip, city, state, bedrooms);
  const negotiationSavings = counterOffer ? proposedRent - counterOffer : null;

  return (
    <div>
      {isAboveMedian ? (
        /* ━━━ SCENARIO 1: Above median ━━━ */
        <>
          <h2 className="section-title">Should You Move?</h2>

          <div className="mt-3 px-4 py-3 rounded-md border text-sm font-medium text-foreground bg-destructive/10 border-destructive/20">
            Your proposed rent of ${fmt(proposedRent)}/mo is{' '}
            <span className="font-bold text-destructive">${fmt(difference)} above</span>{' '}
            the area median of ${fmt(medianCompRent)} for similar units.
          </div>

          {/* Comp listings with orange line */}
          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 text-center">
              Nearby Comparable Listings
            </p>
            <CompsWithRentLine comparables={comparables} proposedRent={proposedRent} />
          </div>

          {/* Savings */}
          <div className="mt-6">
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-8">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Potential monthly savings
                </p>
                <p className="font-display text-[24px] tracking-tight text-foreground font-semibold" style={{ letterSpacing: '-0.02em' }}>
                  ${fmt(difference)}/mo
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Potential annual savings
                </p>
                <p className="font-display text-[24px] tracking-tight text-foreground font-semibold" style={{ letterSpacing: '-0.02em' }}>
                  ${fmt(difference * 12)}/yr
                </p>
              </div>
            </div>
          </div>

          {/* Secondary CTA: negotiate */}
          {isAboveMarket && negotiationSavings && negotiationSavings > 0 && counterOffer && (
            <div className="mt-6 p-5 rounded-lg bg-verdict-good/10 border border-verdict-good/20">
              <p className="text-xs font-semibold uppercase tracking-wider text-verdict-good mb-2">
                Or negotiate your current rent first
              </p>
              <p className="text-base font-medium text-foreground leading-relaxed">
                If you negotiate to the fair counter-offer (
                <span className="font-bold text-verdict-good text-lg">${fmt(counterOffer)}/mo</span>
                ), you save{' '}
                <span className="font-bold text-verdict-good text-lg">${fmt(negotiationSavings)}/mo</span>
                {' '}starting immediately — with zero upfront costs.
              </p>
              <button
                onClick={onScrollToLetter}
                className="text-sm font-semibold text-primary hover:underline mt-3"
              >
                Generate negotiation letter →
              </button>
            </div>
          )}
        </>
      ) : (
        /* ━━━ SCENARIO 2: At or below median ━━━ */
        <>
          <h2 className="section-title">Your Rent Is Competitive</h2>

          <div className={`mt-3 px-4 py-3 rounded-md border text-sm font-medium text-foreground ${isAtMedian ? 'bg-muted border-border' : 'bg-verdict-good/10 border-verdict-good/20'}`}>
            {isAtMedian ? (
              <>Your proposed rent of ${fmt(proposedRent)}/mo is <span className="font-bold">at the area median</span> for similar units.</>
            ) : (
              <>Even after the increase, your proposed rent of ${fmt(proposedRent)}/mo is{' '}
                <span className="font-bold text-verdict-good">${fmt(difference)} below</span>{' '}
                the area median of ${fmt(medianCompRent)} for similar units.</>
            )}
          </div>

          {/* Comp listings with orange line */}
          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 text-center">
              Nearby Comparable Listings
            </p>
            <CompsWithRentLine comparables={comparables} proposedRent={proposedRent} />
          </div>

          {/* Percentile callout */}
          {percentileBelow !== null && percentileBelow >= 40 && (
            <p className="text-sm text-verdict-good font-medium mt-4">
              Your rent is in the bottom {100 - percentileBelow}% of comparable units nearby.
            </p>
          )}

          {/* Cost of moving */}
          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              What it would cost to move
            </p>
            <p className="font-display text-[24px] tracking-tight text-foreground font-semibold" style={{ letterSpacing: '-0.02em' }}>
              ~${fmt(estimatedMovingCost)}
            </p>
            <p className="text-[12px] text-muted-foreground mt-1">
              First month + security deposit (1.5 mo) + moving expenses{hasBrokerFee ? ` + broker fee (common in ${state})` : ''}
            </p>
            <p className="text-sm text-muted-foreground mt-3">
              Moving would likely cost you more — plus you'd be paying a higher monthly rent at most nearby units.
            </p>
          </div>

        </>
      )}

      {/* Browse more links — both scenarios */}
      <p className="text-sm text-muted-foreground mt-6 text-center">
        Want to browse more?{' '}
        {browseLinks.map((link, i) => (
          <span key={link.name}>
            <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              {link.name} →
            </a>
            {i < browseLinks.length - 1 && <span className="mx-1.5">·</span>}
          </span>
        ))}
      </p>

      <p className="text-[10px] text-muted-foreground/60 mt-3 text-center">
        Market data sources include MLS, public records & proprietary datasets.
      </p>
    </div>
  );
};

export default ShouldYouMove;
