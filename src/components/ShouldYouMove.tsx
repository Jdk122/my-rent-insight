import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { RentcastComparable } from '@/hooks/useRentcast';
import { BedroomType } from '@/data/rentData';
import { compAgeLabel } from '@/lib/compDisplay';

/** Trim city/state/zip from a full address, keeping only street + unit */
const trimAddress = (addr: string) =>
  addr.replace(/,\s*[A-Z][a-zA-Z\s]+,\s*[A-Z]{2}\s*\d{0,5}$/, '').trim();


interface UserUnit {
  address?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  squareFootage?: number | null;
}

interface CompsListProps {
  proposedRent: number;
  comparables: RentcastComparable[];
  furnishedComps?: RentcastComparable[];
  medianCompRent: number;
  hudFmr?: number;
  brLabel: string;
  city: string;
  state: string;
  zip: string;
  bedrooms: BedroomType;
  userUnit?: UserUnit | null;
  gated?: boolean;
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

const brokerFeeStates = ['NJ', 'MA'];

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

/** Comparable listings sorted by rent with the user's unit + proposed rent divider */
function CompsWithRentLine({
  comparables,
  proposedRent,
  userUnit,
  hideRentLine = false,
}: {
  comparables: RentcastComparable[];
  proposedRent: number;
  userUnit?: UserUnit | null;
  hideRentLine?: boolean;
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
    <div className="relative my-2">
      <div className="border-t border-border" />
      <div className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2">
        <span className="text-[11px] font-medium text-muted-foreground bg-background px-3 py-1 rounded-full border border-border/60">
          Your rent: ${fmt(proposedRent)}/mo
        </span>
      </div>
    </div>
  );

  // User's unit row (highlighted)
  const userUnitRow = userUnit && (userUnit.bedrooms != null || userUnit.squareFootage != null) ? (
    <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-medium text-foreground truncate">
            Your unit{userUnit.address ? ` — ${userUnit.address.split(',')[0]}` : ''}
          </p>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            {userUnit.bedrooms !== null && userUnit.bedrooms !== undefined && `${userUnit.bedrooms === 0 ? 'Studio' : `${userUnit.bedrooms}BR`}`}
            {userUnit.bathrooms !== null && userUnit.bathrooms !== undefined && ` · ${userUnit.bathrooms}BA`}
            {userUnit.squareFootage !== null && userUnit.squareFootage !== undefined && ` · ${fmt(userUnit.squareFootage)} sqft`}
          </p>
        </div>
        <span className="text-[16px] font-semibold text-foreground whitespace-nowrap tabular-nums">
          ${fmt(proposedRent)}
        </span>
      </div>
    </div>
  ) : null;

  return (
    <div className="space-y-2">
      {userUnitRow && <div className="mb-1">{userUnitRow}</div>}
      {sorted.map((comp, i) => {
        const isBuildingComp = comp.isSameBuilding || comp.isSameUnitLine;
        const age = compAgeLabel(comp.daysOld);

        return (
          <div key={i}>
            {!hideRentLine && i === refIndex && rentLine}
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.3 }}
              className={`rounded-lg border bg-card px-4 py-3 ${
                isBuildingComp
                  ? 'border-l-2 border-l-primary/40 border-t-border/60 border-r-border/60 border-b-border/60'
                  : 'border-border/60'
              }`}
            >
              {/* Line 1: Address + Rent */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0 flex flex-wrap items-center gap-1.5">
                  <p className="text-[14px] font-medium text-foreground truncate">
                    {trimAddress(comp.formattedAddress)}
                  </p>
                  {comp.isSameUnitLine && (
                    <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                      Same unit
                    </span>
                  )}
                  {comp.isSameBuilding && !comp.isSameUnitLine && (
                    <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                      Building
                    </span>
                  )}
                </div>
                {comp.rent !== null && (
                  <span className="text-[16px] font-semibold text-foreground whitespace-nowrap tabular-nums shrink-0">
                    ${fmt(comp.rent)}
                  </span>
                )}
              </div>

              {/* Line 2: Metadata */}
              <p className="text-[12px] text-muted-foreground mt-1">
                {comp.bedrooms !== null && `${comp.bedrooms === 0 ? 'Studio' : `${comp.bedrooms}BR`}`}
                {comp.bathrooms !== null && ` · ${comp.bathrooms}BA`}
                {comp.squareFootage !== null && comp.squareFootage > 0 && ` · ${fmt(comp.squareFootage)} sqft`}
                {comp.rent != null && comp.squareFootage != null && comp.squareFootage > 0 && (
                  <span className="hidden sm:inline"> · ${(comp.rent / comp.squareFootage).toFixed(2)}/sqft</span>
                )}
                {comp.distance !== null && ` · ${comp.distance.toFixed(1)} mi`}
              </p>

              {/* Freshness */}
              {age && (
                <p className={`text-[11px] mt-0.5 ${
                  comp.daysOld !== null && comp.daysOld <= 30
                    ? 'text-accent-green'
                    : 'text-muted-foreground/60'
                }`}>
                  {age.text}
                  {comp.daysOld !== null && comp.daysOld > 90 && (
                    <span className="text-accent-amber ml-1" title="Older listing — pricing may have changed">⚠</span>
                  )}
                </p>
              )}
            </motion.div>
          </div>
        );
      })}
      {!hideRentLine && refIndex === sorted.length && rentLine}
    </div>
  );
}

/* ━━━ Section A: Comps Only ━━━ */
export const CompsList = ({
  proposedRent,
  comparables,
  furnishedComps = [],
  medianCompRent,
  hudFmr,
  brLabel,
  city,
  state,
  zip,
  bedrooms,
  userUnit,
  gated = false,
}: CompsListProps) => {
  const isAboveMedian = proposedRent > medianCompRent;
  const isAtMedian = proposedRent === medianCompRent;
  const difference = Math.abs(proposedRent - medianCompRent);

  const browseLinks = buildBrowseLinks(zip, city, state, bedrooms);

  // SAFMR context note: show when comp median is 50%+ above HUD SAFMR
  const showSafmrNote = hudFmr && hudFmr > 0 && medianCompRent > hudFmr * 1.5;

  return (
    <div>
      {/* Summary callout */}
      {isAboveMedian ? (
        <div className="px-4 py-3 rounded-lg border text-sm font-medium text-foreground bg-destructive/10 border-destructive/20">
          Your proposed rent of ${fmt(proposedRent)}/mo is{' '}
          <span className="font-bold text-destructive">${fmt(difference)} above</span>{' '}
          the area median of ${fmt(medianCompRent)} for similar units.
        </div>
      ) : isAtMedian ? (
        <div className="px-4 py-3 rounded-lg border text-sm font-medium text-foreground bg-muted border-border">
          Your proposed rent of ${fmt(proposedRent)}/mo is <span className="font-bold">at the area median</span> for similar units.
        </div>
      ) : (
        <div className="px-4 py-3 rounded-lg border text-sm font-medium text-foreground bg-verdict-good/10 border-verdict-good/20">
          Even after the increase, your proposed rent of ${fmt(proposedRent)}/mo is{' '}
          <span className="font-bold text-verdict-good">${fmt(difference)} below</span>{' '}
          the area median of ${fmt(medianCompRent)} for similar units.
        </div>
      )}

      {/* Comp listings */}
      <div className="mt-6">
        <CompsWithRentLine comparables={comparables} proposedRent={proposedRent} userUnit={userUnit} hideRentLine={gated} />

        {/* Furnished comps (excluded from median, shown for transparency) */}
        {furnishedComps.length > 0 && (
          <div className="mt-3 space-y-2">
            {furnishedComps.map((comp, i) => (
              <div
                key={`furnished-${i}`}
                className="rounded-lg border border-border/40 bg-card px-4 py-3 opacity-60"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0 flex flex-wrap items-center gap-1.5">
                    <p className="text-[14px] font-medium text-muted-foreground truncate">
                      {trimAddress(comp.formattedAddress)}
                    </p>
                    <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                      Furnished
                    </span>
                  </div>
                  {comp.rent !== null && (
                    <span className="text-[16px] font-semibold text-muted-foreground whitespace-nowrap tabular-nums shrink-0">
                      ${fmt(comp.rent)}
                    </span>
                  )}
                </div>
                <p className="text-[12px] text-muted-foreground/60 mt-1">
                  {comp.bedrooms !== null && `${comp.bedrooms === 0 ? 'Studio' : `${comp.bedrooms}BR`}`}
                  {comp.bathrooms !== null && ` · ${comp.bathrooms}BA`}
                  {comp.distance !== null && ` · ${comp.distance.toFixed(1)} mi`}
                  <span className="ml-1">· Not directly comparable</span>
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SAFMR context note */}
      {showSafmrNote && (
        <p className="text-xs text-muted-foreground mt-4 px-4 py-3 rounded-lg bg-muted/50 border border-border">
          Note: Nearby listings are significantly above the federal rent benchmark for this area. This is common in high-cost neighborhoods where local market rents exceed national standards.
        </p>
      )}

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
