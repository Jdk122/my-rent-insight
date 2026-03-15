const SampleResultCard = () => {
  // Mini rainbow gauge matching the real Fairness Score gauge
  const size = 80;
  const stroke = 7;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2 + 2; // shift down slightly for half-circle
  const score = 47;

  // Arc from 180° (left) to 0° (right) — half circle
  // Score 0 = 180°, Score 100 = 0°
  const markerAngle = Math.PI - (score / 100) * Math.PI;
  const mx = cx + r * Math.cos(markerAngle);
  const my = cy - r * Math.sin(markerAngle);

  // Triangle marker pointing inward
  const triSize = 6;
  const inwardAngle = markerAngle + Math.PI; // point toward center
  const t1x = mx + triSize * Math.cos(inwardAngle - 0.4);
  const t1y = my - triSize * Math.sin(inwardAngle - 0.4);
  const t2x = mx + triSize * Math.cos(inwardAngle + 0.4);
  const t2y = my - triSize * Math.sin(inwardAngle + 0.4);
  // Tip extends outward
  const tipx = mx - triSize * 0.7 * Math.cos(inwardAngle);
  const tipy = my + triSize * 0.7 * Math.sin(inwardAngle);

  return (
    <div className="hidden lg:block max-w-[340px] border border-border rounded-lg bg-card px-5 py-4">
      {/* Gauge + verdict row */}
      <div className="flex items-center gap-4">
        {/* Mini rainbow gauge */}
        <div className="relative shrink-0" style={{ width: size, height: size / 2 + 8 }}>
          <svg width={size} height={size / 2 + 8} viewBox={`0 0 ${size} ${size / 2 + 8}`}>
            <defs>
              <linearGradient id="sample-gauge-grad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#d32f2f" />
                <stop offset="25%" stopColor="#ef6c00" />
                <stop offset="50%" stopColor="#f9a825" />
                <stop offset="75%" stopColor="#7cb342" />
                <stop offset="100%" stopColor="#2e7d32" />
              </linearGradient>
            </defs>
            {/* Rainbow arc */}
            <path
              d={`M ${stroke / 2} ${cy} A ${r} ${r} 0 0 1 ${size - stroke / 2} ${cy}`}
              fill="none"
              stroke="url(#sample-gauge-grad)"
              strokeWidth={stroke}
              strokeLinecap="round"
            />
            {/* Triangle marker */}
            <polygon
              points={`${tipx},${tipy} ${t1x},${t1y} ${t2x},${t2y}`}
              fill="hsl(var(--foreground))"
            />
          </svg>
          {/* Score inside */}
          <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
            <span className="text-[18px] font-bold text-foreground tabular-nums leading-none">{score}</span>
            <span className="text-[9px] text-muted-foreground/60 leading-none">/ 100</span>
          </div>
        </div>

        {/* Verdict text */}
        <div>
          <p className="text-[13px] font-bold text-[hsl(var(--accent-amber))] leading-tight">Above Trend</p>
          <p className="text-[18px] font-display font-bold text-foreground leading-snug mt-0.5">
            Above <span className="text-[hsl(var(--accent-red))]">market.</span>
          </p>
          <p className="text-[11px] text-muted-foreground leading-snug mt-1">
            Area trend is 3% — your landlord wants 17.5%.
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div className="mt-3 pt-3 border-t border-border/60 flex items-center gap-4">
        <span className="text-[12px] text-muted-foreground">Fair range: <strong className="text-foreground font-semibold">$2,180–$2,340</strong></span>
        <span className="text-[12px] text-muted-foreground">Nearby comps: <strong className="text-foreground font-semibold">6 matched</strong></span>
      </div>

      {/* Footer */}
      <p className="mt-2 text-[11px] text-muted-foreground/40">
        Sample result — Hoboken, NJ 07030
      </p>
    </div>
  );
};

export default SampleResultCard;
