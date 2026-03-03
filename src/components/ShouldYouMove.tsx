import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin } from 'lucide-react';
import { RentcastComparable } from '@/hooks/useRentcast';
import { BedroomType } from '@/data/rentData';

interface CompsListProps {
  proposedRent: number;
  comparables: RentcastComparable[];
  medianCompRent: number;
  brLabel: string;
  city: string;
  state: string;
  zip: string;
  bedrooms: BedroomType;
}

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

const brokerFeeStates = ['NJ', 'NY'];

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

/* ━━━ Section A: Comps Only ━━━ */
export const CompsList = ({
  proposedRent,
  comparables,
  medianCompRent,
  brLabel,
  city,
  state,
  zip,
  bedrooms,
}: CompsListProps) => {
  const isAboveMedian = proposedRent > medianCompRent;
  const isAtMedian = proposedRent === medianCompRent;
  const difference = Math.abs(proposedRent - medianCompRent);

  const belowComps = useMemo(() => {
    return comparables.filter(c => c.rent !== null && c.rent > 0 && c.rent < proposedRent);
  }, [comparables, proposedRent]);

  const belowMedian = useMemo(() => {
    if (belowComps.length === 0) return null;
    const rents = belowComps.map(c => c.rent!).sort((a, b) => a - b);
    const mid = Math.floor(rents.length / 2);
    return rents.length % 2 === 0 ? Math.round((rents[mid - 1] + rents[mid]) / 2) : rents[mid];
  }, [belowComps]);

  const browseLinks = buildBrowseLinks(zip, city, state, bedrooms);

  return (
    <div>
      {/* Summary callout */}
      {isAboveMedian ? (
        <div className="px-4 py-3 rounded-md border text-sm font-medium text-foreground bg-destructive/10 border-destructive/20">
          Your proposed rent of ${fmt(proposedRent)}/mo is{' '}
          <span className="font-bold text-destructive">${fmt(difference)} above</span>{' '}
          the area median of ${fmt(medianCompRent)} for similar units.
        </div>
      ) : isAtMedian ? (
        <div className="px-4 py-3 rounded-md border text-sm font-medium text-foreground bg-muted border-border">
          Your proposed rent of ${fmt(proposedRent)}/mo is <span className="font-bold">at the area median</span> for similar units.
        </div>
      ) : (
        <div className="px-4 py-3 rounded-md border text-sm font-medium text-foreground bg-verdict-good/10 border-verdict-good/20">
          Even after the increase, your proposed rent of ${fmt(proposedRent)}/mo is{' '}
          <span className="font-bold text-verdict-good">${fmt(difference)} below</span>{' '}
          the area median of ${fmt(medianCompRent)} for similar units.
        </div>
      )}

      {/* Below-rent anchor line */}
      {isAboveMedian && belowComps.length > 0 && belowMedian && (
        <p className="text-sm text-muted-foreground mt-3">
          {belowComps.length} comparable {belowComps.length === 1 ? 'unit' : 'units'} found below your proposed rent — median: <span className="font-semibold text-foreground">${fmt(belowMedian)}/mo</span>.
        </p>
      )}

      {/* Comp listings with orange line */}
      <div className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 text-center">
          Nearby Comparable Listings
        </p>
        <CompsWithRentLine comparables={comparables} proposedRent={proposedRent} />
      </div>

      {/* Browse more links */}
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

/* ━━━ Section B: Estimated Cost to Move (broker fee + moving expenses only) ━━━ */
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
  const hasBrokerFee = brokerFeeStates.includes(state);
  const movingExpenses = 2000;
  const brokerFee = hasBrokerFee ? medianCompRent : 0;
  const defaultTotal = brokerFee + movingExpenses;
  const [costOverride, setCostOverride] = useState<number | null>(null);
  const estimatedCost = costOverride ?? defaultTotal;

  return (
    <div>
      <div className="rounded-xl border border-border bg-card p-5 space-y-0">
        {hasBrokerFee && (
          <div className="context-row context-row-even">
            <div>
              <span className="context-label">Broker fee</span>
              <p className="text-[11px] text-muted-foreground mt-0.5">Common in {state} — typically 1 month's rent</p>
            </div>
            <span className="context-value">${fmt(brokerFee)}</span>
          </div>
        )}
        <div className={`context-row ${hasBrokerFee ? 'context-row-odd' : 'context-row-even'}`}>
          <div>
            <span className="context-label">Moving expenses</span>
            <p className="text-[11px] text-muted-foreground mt-0.5">Movers, supplies, utility setup</p>
          </div>
          <span className="context-value">${fmt(movingExpenses)}</span>
        </div>
        <div className="context-row border-t-2 border-border pt-3">
          <span className="context-label font-medium text-foreground">
            Estimated cost to move
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-muted-foreground">$</span>
            <input
              type="text"
              value={fmt(estimatedCost)}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^0-9]/g, '');
                if (raw === '') { setCostOverride(null); return; }
                setCostOverride(Number(raw));
              }}
              className="font-display text-lg tracking-tight text-foreground font-bold bg-transparent border-b border-dashed border-muted-foreground/30 focus:border-primary focus:outline-none w-[90px] text-right"
              style={{ letterSpacing: '-0.02em' }}
            />
          </div>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground/60 mt-3">
        {hasBrokerFee
          ? `Broker fee (common in ${state}) + moving expenses (~$2,000). Adjust based on your situation.`
          : `Moving expenses (~$2,000). Adjust based on your situation.`}
      </p>
    </div>
  );
};

export default ShouldYouMove;
