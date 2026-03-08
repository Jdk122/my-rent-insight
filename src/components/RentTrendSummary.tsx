interface RentTrendSummaryProps {
  location: string;
  trendYoY: number | null;
  alYoY?: number | null;
  zoriYoY?: number | null;
  vacancyRate?: number | null;
  showHeadline?: boolean;
}

function fmt(n: number) {
  return (n > 0 ? '+' : '') + n.toFixed(1) + '%';
}

const RentTrendSummary = ({ location, trendYoY, alYoY, zoriYoY, vacancyRate, showHeadline = false }: RentTrendSummaryProps) => {
  const hasAl = alYoY !== undefined && alYoY !== null;
  const hasZori = zoriYoY !== undefined && zoriYoY !== null;
  const hasBoth = hasAl && hasZori;

  // Compute blended primary number
  let primary: number | null = null;
  let sources: string[] = [];

  if (hasBoth) {
    primary = Math.round(((alYoY! + zoriYoY!) / 2) * 10) / 10;
    sources = ['Apartment List', 'Zillow ZORI'];
  } else if (hasAl) {
    primary = alYoY!;
    sources = ['Apartment List'];
  } else if (hasZori) {
    primary = zoriYoY!;
    sources = ['Zillow ZORI'];
  } else if (trendYoY !== null) {
    primary = trendYoY;
    sources = ['HUD Fair Market Rent'];
  }

  if (primary === null) return null;

  const direction = primary > 0.5 ? 'rising' : primary < -0.5 ? 'cooling' : 'holding steady';
  const colorClass = direction === 'rising' ? 'text-destructive' : direction === 'cooling' ? 'text-accent' : 'text-foreground';

  // Range and divergence
  const spread = hasBoth ? Math.abs(alYoY! - zoriYoY!) : 0;
  const lo = hasBoth ? Math.min(alYoY!, zoriYoY!) : null;
  const hi = hasBoth ? Math.max(alYoY!, zoriYoY!) : null;
  const showDivergence = hasBoth && spread > 3;
  const rentersHaveLeverage = hasBoth && alYoY! < zoriYoY!;

  return (
    <div className="mt-3">
      {/* Headline number */}
      {showHeadline && (
        <p className={`text-3xl font-bold tabular-nums ${colorClass}`}>
          {fmt(primary)}
        </p>
      )}

      {/* Direction sentence */}
      <p className={`text-sm font-medium ${showHeadline ? 'mt-2' : ''} ${colorClass}`}>
        Rents in {location} are{' '}
        <span className="font-bold">{direction}</span>{' '}
        at <span className="font-bold tabular-nums">{fmt(primary)}</span> year-over-year.
      </p>

      {/* Range subtext when both sources available */}
      {hasBoth && lo !== null && hi !== null && (
        <p className="text-xs text-muted-foreground mt-1">
          Market sources range from {fmt(lo)} to {fmt(hi)}
        </p>
      )}

      {/* Divergence explanation */}
      {showDivergence && (
        <div className="mt-3 rounded-lg bg-muted/50 border border-border px-4 py-3">
          <p className="text-sm text-muted-foreground leading-relaxed">
            <span className="font-semibold text-foreground">Why the range?</span>{' '}
            Zillow ZORI tracks what landlords are <em>asking</em> for units ({fmt(zoriYoY!)}),
            while Apartment List tracks what renters actually <em>sign leases</em> at ({fmt(alYoY!)}).
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
        Sources: {sources.join(', ')}
      </p>
    </div>
  );
};

export default RentTrendSummary;
