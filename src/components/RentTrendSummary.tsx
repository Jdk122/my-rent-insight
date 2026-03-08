interface RentTrendSummaryProps {
  location: string;
  trendYoY: number | null;
  alYoY?: number | null;
  zoriYoY?: number | null;
  vacancyRate?: number | null;
  showHeadline?: boolean;
}

function fmtPct(n: number) {
  return (n > 0 ? '+' : '') + n.toFixed(1) + '%';
}

/**
 * Priority waterfall: AL (signed leases) > ZORI (listing prices) > HUD FMR.
 * When both exist and agree (<= 3pp): show AL with "Confirmed by multiple sources."
 * When both exist and diverge (> 3pp): show AL with divergence explanation.
 */
const RentTrendSummary = ({ location, trendYoY, alYoY, zoriYoY, vacancyRate, showHeadline = false }: RentTrendSummaryProps) => {
  const hasAl = alYoY !== undefined && alYoY !== null;
  const hasZori = zoriYoY !== undefined && zoriYoY !== null;
  const hasBoth = hasAl && hasZori;

  // Waterfall: AL > ZORI > HUD
  let primary: number | null = null;
  let sourceLabel = '';

  if (hasAl) {
    primary = alYoY!;
    sourceLabel = hasBoth ? 'Sources: Apartment List, Zillow ZORI' : 'Source: Apartment List (signed leases)';
  } else if (hasZori) {
    primary = zoriYoY!;
    sourceLabel = 'Source: Zillow ZORI (listing prices)';
  } else if (trendYoY !== null) {
    primary = trendYoY;
    sourceLabel = 'Source: HUD Fair Market Rent';
  }

  if (primary === null) {
    return <p className="mt-3 text-sm text-muted-foreground">No market trend data available for this area.</p>;
  }

  const direction = primary > 0.5 ? 'rising' : primary < -0.5 ? 'cooling' : 'holding steady';
  const colorClass = direction === 'rising' ? 'text-destructive' : direction === 'cooling' ? 'text-accent' : 'text-foreground';

  // Divergence logic
  const spread = hasBoth ? Math.abs(alYoY! - zoriYoY!) : 0;
  const sourcesAgree = hasBoth && spread <= 3;
  const sourcesDiverge = hasBoth && spread > 3;
  const rentersHaveLeverage = hasBoth && alYoY! < zoriYoY!;

  return (
    <div className="mt-3">
      {/* Headline number */}
      {showHeadline && (
        <p className={`text-3xl font-bold tabular-nums ${colorClass}`}>
          {fmtPct(primary)}
        </p>
      )}

      {/* Direction sentence */}
      <p className={`text-sm font-medium ${showHeadline ? 'mt-2' : ''} ${colorClass}`}>
        Rents in {location} are{' '}
        <span className="font-bold">{direction}</span>{' '}
        at <span className="font-bold tabular-nums">{fmtPct(primary)}</span> year-over-year.
      </p>

      {/* Confirmed by multiple sources */}
      {sourcesAgree && (
        <p className="text-xs text-accent font-medium mt-1">
          ✓ Confirmed by multiple sources
        </p>
      )}

      {/* Range subtext when both available */}
      {hasBoth && (
        <p className="text-xs text-muted-foreground mt-1">
          Market sources range from {fmtPct(Math.min(alYoY!, zoriYoY!))} to {fmtPct(Math.max(alYoY!, zoriYoY!))}
        </p>
      )}

      {/* Divergence note */}
      {sourcesDiverge && (
        <p className="text-xs text-muted-foreground mt-1">
          Note: Listing prices (Zillow) suggest a different trend ({fmtPct(zoriYoY!)}). Our primary figure reflects actual lease transactions.
        </p>
      )}

      {/* Divergence explanation box */}
      {sourcesDiverge && (
        <div className="mt-3 rounded-lg bg-muted/50 border border-border px-4 py-3">
          <p className="text-sm text-muted-foreground leading-relaxed">
            <span className="font-semibold text-foreground">Why the range?</span>{' '}
            Zillow ZORI tracks what landlords are <em>asking</em> for units ({fmtPct(zoriYoY!)}),
            while Apartment List tracks what renters actually <em>sign leases</em> at ({fmtPct(alYoY!)}).
            {rentersHaveLeverage ? (
              <span className="block mt-1.5 font-medium text-foreground">
                Landlords are asking more than renters are paying — this suggests renters may have negotiating leverage in {location} right now.
              </span>
            ) : (
              <span className="block mt-1.5">
                When signed-lease rents outpace asking rents, it typically signals strong demand and limited room to negotiate.
              </span>
            )}
          </p>
        </div>
      )}

      {/* Vacancy callout */}
      {vacancyRate !== null && vacancyRate !== undefined && vacancyRate > 0 && (
        <p className="text-xs text-muted-foreground mt-2">
          Local vacancy rate: <span className="font-semibold tabular-nums">{vacancyRate.toFixed(1)}%</span>
        </p>
      )}

      {/* Source attribution */}
      <p className="text-xs text-muted-foreground/70 mt-1.5">
        {sourceLabel}
      </p>
    </div>
  );
};

export default RentTrendSummary;

/**
 * Shared waterfall logic for hero sections.
 * Returns the primary YoY number and its source label, matching RentTrendSummary.
 */
export function getDisplayTrend(
  alYoY: number | null,
  zoriYoY: number | null,
  hudYoY: number | null
): { yoy: number | null; source: string } {
  if (alYoY !== null) {
    const hasZori = zoriYoY !== null;
    return {
      yoy: alYoY,
      source: hasZori ? 'Apartment List, Zillow ZORI' : 'Apartment List (signed leases)',
    };
  }
  if (zoriYoY !== null) {
    return { yoy: zoriYoY, source: 'Zillow ZORI (listing prices)' };
  }
  if (hudYoY !== null) {
    return { yoy: hudYoY, source: 'HUD Fair Market Rent' };
  }
  return { yoy: null, source: '' };
}
