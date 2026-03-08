interface RentTrendSummaryProps {
  location: string;
  trendYoY: number | null;
  alYoY?: number | null;
  zoriYoY?: number | null;
}

function fmt(n: number) {
  return (n > 0 ? '+' : '') + n.toFixed(1) + '%';
}

const RentTrendSummary = ({ location, trendYoY, alYoY, zoriYoY }: RentTrendSummaryProps) => {
  const hasAl = alYoY !== undefined && alYoY !== null;
  const hasZori = zoriYoY !== undefined && zoriYoY !== null;
  const hasBoth = hasAl && hasZori;

  // Compute blended primary number
  let primary: number | null = null;
  let sourceLabel = '';
  let rangeText = '';

  if (hasBoth) {
    primary = Math.round(((alYoY! + zoriYoY!) / 2) * 10) / 10;
    const lo = Math.min(alYoY!, zoriYoY!);
    const hi = Math.max(alYoY!, zoriYoY!);
    rangeText = `Market sources range from ${fmt(lo)} to ${fmt(hi)}`;
    sourceLabel = 'Sources: Apartment List, Zillow ZORI';
    // Divergence warning
    const spread = Math.abs(alYoY! - zoriYoY!);
    if (spread > 4) {
      rangeText += ' — sources diverge significantly';
    }
  } else if (hasAl) {
    primary = alYoY!;
    sourceLabel = 'Source: Apartment List';
  } else if (hasZori) {
    primary = zoriYoY!;
    sourceLabel = 'Source: Zillow ZORI';
  } else if (trendYoY !== null) {
    primary = trendYoY;
    sourceLabel = 'Source: HUD Fair Market Rent';
  }

  if (primary === null) return null;

  const direction = primary > 0.5 ? 'rising' : primary < -0.5 ? 'cooling' : 'holding steady';
  const colorClass = direction === 'rising' ? 'text-destructive' : direction === 'cooling' ? 'text-accent' : 'text-foreground';

  return (
    <div className="mt-3">
      <p className={`text-sm font-medium ${colorClass}`}>
        Rents in {location} are{' '}
        <span className="font-bold">{direction}</span>{' '}
        at <span className="font-bold tabular-nums">{fmt(primary)}</span> year-over-year.
      </p>
      {rangeText && (
        <p className="text-xs text-muted-foreground mt-1">{rangeText}</p>
      )}
      {sourceLabel && (
        <p className="text-xs text-muted-foreground/70 mt-1">{sourceLabel}</p>
      )}
    </div>
  );
};

export default RentTrendSummary;
