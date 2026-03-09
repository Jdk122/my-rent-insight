import type { RentcastComparable } from '@/hooks/useRentcast';

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });
const fmtSqft = (n: number) => n.toFixed(2);

interface WsipCompsListProps {
  comparables: RentcastComparable[];
  askingRent?: number | null;
  medianCompRent: number | null;
  userSqft?: number | null;
}

const CompRow = ({ comp, idx, offset }: { comp: RentcastComparable; idx: number; offset: number }) => {
  const ppsf = comp.rent && comp.squareFootage && comp.squareFootage > 0
    ? comp.rent / comp.squareFootage
    : null;

  return (
    <div
      className={`flex items-start justify-between gap-4 px-4 py-3 rounded-md ${
        (idx + offset) % 2 === 0 ? 'bg-muted/40' : ''
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-foreground truncate">
            {comp.formattedAddress}
          </p>
          {comp.isSameUnitLine && (
            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
              Same line
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {comp.bedrooms !== null &&
            `${comp.bedrooms === 0 ? 'Studio' : `${comp.bedrooms}BR`}`}
          {comp.bathrooms !== null && ` · ${comp.bathrooms}BA`}
          {comp.squareFootage !== null && comp.squareFootage > 0 && ` · ${fmt(comp.squareFootage)} sqft`}
          {ppsf !== null && ` · $${fmtSqft(ppsf)}/sqft`}
          {comp.distance !== null && ` · ${comp.distance.toFixed(1)} mi`}
        </p>
      </div>
      {comp.rent !== null && (
        <span className="text-sm font-semibold text-foreground whitespace-nowrap">
          ${fmt(comp.rent)}/mo
        </span>
      )}
    </div>
  );
};

const WsipCompsList = ({ comparables, askingRent, medianCompRent, userSqft }: WsipCompsListProps) => {
  if (comparables.length === 0) return null;

  // Split into same-building vs nearby
  const inBuilding = comparables.filter(c => c.isSameBuilding);
  const nearby = comparables.filter(c => !c.isSameBuilding);

  // Calculate avg $/sqft across comps with sqft data
  const compsWithSqft = comparables.filter(c => c.rent && c.squareFootage && c.squareFootage > 0);
  const avgPpsf = compsWithSqft.length > 0
    ? compsWithSqft.reduce((sum, c) => sum + (c.rent! / c.squareFootage!), 0) / compsWithSqft.length
    : null;

  // User's $/sqft
  const userPpsf = askingRent && userSqft && userSqft > 0
    ? askingRent / userSqft
    : null;

  return (
    <div className="space-y-1">
      {/* Same-building comps */}
      {inBuilding.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center gap-2 px-4 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-verdict-good">In this building</span>
            <span className="flex-1 h-px bg-verdict-good/20" />
          </div>
          {inBuilding.map((comp, i) => (
            <CompRow key={`bldg-${i}`} comp={comp} idx={i} offset={0} />
          ))}
        </div>
      )}

      {/* Nearby comps */}
      {nearby.length > 0 && (
        <div>
          {inBuilding.length > 0 && (
            <div className="flex items-center gap-2 px-4 mb-1.5 mt-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Nearby</span>
              <span className="flex-1 h-px bg-border/50" />
            </div>
          )}
          {nearby.map((comp, i) => (
            <CompRow key={`nearby-${i}`} comp={comp} idx={i} offset={inBuilding.length} />
          ))}
        </div>
      )}

      {/* $/sqft comparison */}
      {userPpsf && avgPpsf && compsWithSqft.length >= 2 && (
        <p className="text-xs text-muted-foreground mt-3 px-4">
          This listing is{' '}
          <span className={userPpsf > avgPpsf ? 'text-destructive font-medium' : 'text-verdict-good font-medium'}>
            ${fmtSqft(userPpsf)}/sqft
          </span>
          {' — comps average '}
          <span className="font-medium text-foreground">${fmtSqft(avgPpsf)}/sqft</span>.
        </p>
      )}

      {/* Median comparison */}
      {askingRent && medianCompRent && (
        <p className="text-xs text-muted-foreground mt-3 px-4">
          The asking price of ${fmt(askingRent)} is{' '}
          <span className={askingRent > medianCompRent ? 'text-destructive font-medium' : 'text-verdict-good font-medium'}>
            {askingRent > medianCompRent
              ? `$${fmt(askingRent - medianCompRent)} above`
              : askingRent < medianCompRent
              ? `$${fmt(medianCompRent - askingRent)} below`
              : 'equal to'}
          </span>{' '}
          the comp median of ${fmt(medianCompRent)}.
        </p>
      )}
    </div>
  );
};

export default WsipCompsList;
