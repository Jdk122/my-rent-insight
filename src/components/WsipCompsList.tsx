import type { RentcastComparable } from '@/hooks/useRentcast';
import { compAgeLabel } from '@/lib/compDisplay';

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });
const fmtSqft = (n: number) => n.toFixed(2);

/** Trim city/state/zip from a full address, keeping only street + unit */
const trimAddress = (addr: string) => {
  // Match patterns like ", City, ST 12345" or ", City, ST"
  return addr.replace(/,\s*[A-Z][a-zA-Z\s]+,\s*[A-Z]{2}\s*\d{0,5}$/, '').trim();
};

interface WsipCompsListProps {
  comparables: RentcastComparable[];
  askingRent?: number | null;
  medianCompRent: number | null;
  userSqft?: number | null;
  sectionLabel?: string;
  hideMedianLine?: boolean;
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
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <p className="text-sm font-medium text-foreground truncate max-w-full sm:max-w-none">
            {trimAddress(comp.formattedAddress)}
          </p>
          {comp.isBedroomFallback && (
            <span className="shrink-0 text-[10px] font-medium tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
              Different BR count
            </span>
          )}
          {comp.isSameUnitLine && (
            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
              Same line
            </span>
          )}
          {comp.isSameBuilding && !comp.isSameUnitLine && (
            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-green-500/10 text-green-700 border border-green-500/20">
              Same building
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
          {(() => {
            const age = compAgeLabel(comp.daysOld);
            if (!age) return null;
            return (
              <>
                {' · '}<span className={age.className}>{age.text}</span>
                {comp.daysOld !== null && comp.daysOld > 90 && (
                  <span className="text-amber-600 ml-0.5" title="Older listing — pricing may have changed">⚠</span>
                )}
              </>
            );
          })()}
        </p>
      </div>
      {comp.rent !== null && (
        <div className="flex flex-col items-end shrink-0">
          <span className="text-sm font-semibold text-foreground whitespace-nowrap">
            ${fmt(comp.rent)}/mo
          </span>
          {comp.seasonallyAdjusted && comp.seasonalRent != null && (
            <span className="text-[10px] text-muted-foreground/70" title="Adjusted for seasonal pricing differences">
              adj. ${fmt(comp.seasonalRent)}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

const WsipCompsList = ({ comparables, askingRent, medianCompRent, userSqft, sectionLabel, hideMedianLine }: WsipCompsListProps) => {
  if (comparables.length === 0) return null;

  // Split into same-building vs nearby (legacy flag-based)
  const inBuilding = sectionLabel ? [] : comparables.filter(c => c.isSameBuilding);
  const nearby = sectionLabel ? comparables : comparables.filter(c => !c.isSameBuilding);

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
      {/* Section label when provided externally */}
      {sectionLabel && (
        <div className="flex items-center gap-2 px-4 mb-1.5">
          <span className={`text-[11px] font-semibold uppercase tracking-wider ${
            sectionLabel === 'In this building' ? 'text-verdict-good' : 'text-muted-foreground'
          }`}>{sectionLabel}</span>
          <span className={`flex-1 h-px ${sectionLabel === 'In this building' ? 'bg-verdict-good/20' : 'bg-border/50'}`} />
        </div>
      )}

      {/* Same-building comps (legacy path) */}
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
      {!hideMedianLine && askingRent && medianCompRent && (
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
