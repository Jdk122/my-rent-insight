const SampleResultCard = () => {
  // Half-circle gauge SVG parameters
  const size = 64;
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = Math.PI * radius; // half circle
  const score = 72;
  const fillPct = score / 100;
  const dashFilled = circumference * fillPct;
  const dashGap = circumference - dashFilled;

  return (
    <div className="hidden lg:block max-w-[340px] border border-border rounded-lg bg-card px-5 py-4">
      {/* Gauge + verdict row */}
      <div className="flex items-center gap-4">
        {/* Half-circle gauge */}
        <div className="relative shrink-0" style={{ width: size, height: size / 2 + 4 }}>
          <svg width={size} height={size / 2 + 4} viewBox={`0 0 ${size} ${size / 2 + 4}`}>
            {/* Background arc */}
            <path
              d={`M ${strokeWidth / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`}
              fill="none"
              stroke="hsl(var(--border))"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />
            {/* Filled arc */}
            <path
              d={`M ${strokeWidth / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`}
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={`${dashFilled} ${dashGap}`}
            />
          </svg>
          <span className="absolute bottom-0 left-1/2 -translate-x-1/2 text-[15px] font-bold text-foreground tabular-nums">
            72
          </span>
        </div>

        {/* Verdict text */}
        <div>
          <p className="text-[14px] font-bold text-foreground leading-tight">At Market</p>
          <p className="text-[12px] text-muted-foreground leading-snug mt-0.5">
            Your 8% increase tracks the 4.7% area trend
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div className="mt-3 pt-3 border-t border-border/60 flex items-center gap-4">
        <span className="text-[13px] text-muted-foreground">Fair range: <strong className="text-foreground font-semibold">$2,580–$2,740</strong></span>
        <span className="text-[13px] text-muted-foreground">Nearby comps: <strong className="text-foreground font-semibold">6 matched</strong></span>
      </div>

      {/* Footer */}
      <p className="mt-2.5 text-[11px] text-muted-foreground/50">
        Sample result — Hoboken, NJ 07030
      </p>
    </div>
  );
};

export default SampleResultCard;
