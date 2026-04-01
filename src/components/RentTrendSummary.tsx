import { calculateCompositeTrend, type CompositeTrendResult } from '@/lib/compositeTrend';


interface RentTrendSummaryProps {
  location: string;
  trendYoY: number | null;
  alYoY?: number | null;
  zoriYoY?: number | null;
  zoriSource?: 'zip' | 'county' | 'metro' | null;
  vacancyRate?: number | null;
  showHeadline?: boolean;
  precomputedResult?: CompositeTrendResult | null;
}

function fmtPct(n: number) {
  return (n > 0 ? '+' : '') + n.toFixed(1) + '%';
}

const RentTrendSummary = ({ location, trendYoY, alYoY, zoriYoY, zoriSource, vacancyRate, showHeadline = false }: RentTrendSummaryProps) => {
  const result = calculateCompositeTrend({
    alYoY: alYoY ?? null,
    zoriYoY: zoriYoY ?? null,
    zoriSource,
    hudYoY: trendYoY,
  });

  const { compositeTrend, badgeTier, badgeLabel, sourceCount, spreadLow, spreadHigh, sources } = result;

  if (result.yoy === null) {
    return <p className="mt-3 text-sm text-muted-foreground">No market trend data available for this area.</p>;
  }

  const direction = compositeTrend > 0.5 ? 'rising' : compositeTrend < -0.5 ? 'cooling' : 'holding steady';
  const colorClass = direction === 'rising' ? 'text-destructive' : direction === 'cooling' ? 'text-accent' : 'text-foreground';

  const spread = spreadHigh - spreadLow;
  const showRange = sourceCount >= 2;
  const showDivergenceBox = spread > 2 && sourceCount >= 2;

  // Check if renters have leverage (listing prices > transaction prices)
  const alSource = sources.find(s => s.type === 'transaction');
  const zoriSourceObj = sources.find(s => s.type === 'listing');
  const rentersHaveLeverage = alSource && zoriSourceObj && alSource.value < zoriSourceObj.value;

  return (
    <div className="mt-3">
      {showHeadline && (
        <p className={`text-3xl font-bold tabular-nums ${colorClass}`}>
          {fmtPct(compositeTrend)}
        </p>
      )}

      <p className={`text-sm font-medium ${showHeadline ? 'mt-2' : ''} ${colorClass}`}>
        Rents in {location} are{' '}
        <span className="font-bold">{direction}</span>{' '}
        at <span className="font-bold tabular-nums">{fmtPct(compositeTrend)}</span> year-over-year.
      </p>

      {/* Trend confidence badge */}
      {badgeTier === 'verified' && (
        <p className="text-xs text-accent font-medium mt-1">✓ {badgeLabel}</p>
      )}
      {badgeTier === 'estimated' && (
        <p className="text-xs text-accent-amber font-medium mt-1">− {badgeLabel}</p>
      )}
      {badgeTier === 'mixed' && (
        <p className="text-xs text-destructive/80 font-medium mt-1">⚠ {badgeLabel}</p>
      )}
      {badgeTier === 'limited' && (
        <p className="text-xs text-muted-foreground font-medium mt-1">ℹ {badgeLabel}</p>
      )}

      {/* Range subtext when 2+ sources */}
      {showRange && (
        <p className="text-xs text-muted-foreground mt-1">
          Market sources range from {fmtPct(spreadLow)} to {fmtPct(spreadHigh)}
        </p>
      )}

      {/* Divergence explanation box */}
      {showDivergenceBox && alSource && zoriSourceObj && (
        <div className="mt-3 rounded-lg bg-muted/50 border border-border px-4 py-3">
          <p className="text-sm text-muted-foreground leading-relaxed">
            <span className="font-semibold text-foreground">Why the range?</span>{' '}
            Zillow ZORI tracks what landlords are <em>asking</em> for units ({fmtPct(zoriSourceObj.value)}),
            while Apartment List tracks what renters actually <em>sign leases</em> at ({fmtPct(alSource.value)}).
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
        {sources.length > 0 ? `Source${sources.length > 1 ? 's' : ''}: ${sources.map(s => s.label).join(', ')}` : ''}
      </p>
    </div>
  );
};

export default RentTrendSummary;

/**
 * Shared composite trend for hero sections.
 * Returns CompositeTrendResult which includes backward-compat { yoy, source, heroSource }.
 */
export function getDisplayTrend(
  alYoY: number | null,
  zoriYoY: number | null,
  hudYoY: number | null,
  zoriSource?: 'zip' | 'county' | 'metro' | null
): CompositeTrendResult {
  return calculateCompositeTrend({ alYoY, zoriYoY, zoriSource, hudYoY });
}
