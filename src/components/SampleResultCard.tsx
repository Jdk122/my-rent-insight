/**
 * Static miniature replica of the FairnessScoreGauge + verdict,
 * used as a decorative "product screenshot" on the desktop hero.
 * All values are hardcoded — no live data.
 */

const W = 120;
const STROKE = 11;
const R = 47;
const CX = W / 2;
const CY = R + STROKE / 2 + 3;
const SVG_H = CY + 4;

function scoreToPoint(s: number, radius: number) {
  const a = Math.PI * (1 - s / 100);
  return { x: CX + radius * Math.cos(a), y: CY - radius * Math.sin(a) };
}

const arcL = scoreToPoint(0, R);
const arcR = scoreToPoint(100, R);
const ARC_D = `M ${arcL.x} ${arcL.y} A ${R} ${R} 0 0 1 ${arcR.x} ${arcR.y}`;

function markerPath(s: number): string {
  const a = Math.PI * (1 - s / 100);
  const outerR = R + STROKE / 2 + 5;
  const tipR = R + STROKE / 2 - 4;
  const spread = 0.11;
  const tip = { x: CX + tipR * Math.cos(a), y: CY - tipR * Math.sin(a) };
  const left = { x: CX + outerR * Math.cos(a + spread), y: CY - outerR * Math.sin(a + spread) };
  const right = { x: CX + outerR * Math.cos(a - spread), y: CY - outerR * Math.sin(a - spread) };
  return `M ${tip.x} ${tip.y} L ${left.x} ${left.y} L ${right.x} ${right.y} Z`;
}

const SCORE = 47;
const MARKER_D = markerPath(SCORE);

const SampleResultCard = () => (
  <div className="hidden lg:block max-w-[360px] border border-border rounded-xl bg-card px-5 pt-5 pb-4">
    {/* Gauge section — centered */}
    <div className="flex flex-col items-center">
      {/* Header label */}
      <p className="text-[7px] font-semibold uppercase tracking-[0.14em] text-muted-foreground text-center mb-1.5">
        RenewalReply Fairness Score™
      </p>

      {/* Gauge */}
      <div className="relative" style={{ width: W, height: SVG_H + 22 }}>
        <svg width={W} height={SVG_H} viewBox={`0 0 ${W} ${SVG_H}`} className="overflow-visible">
          <defs>
            <linearGradient id="sample-fsg-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="hsl(0, 72%, 50%)" />
              <stop offset="18%" stopColor="hsl(15, 85%, 50%)" />
              <stop offset="38%" stopColor="hsl(38, 92%, 50%)" />
              <stop offset="55%" stopColor="hsl(48, 96%, 50%)" />
              <stop offset="78%" stopColor="hsl(80, 60%, 48%)" />
              <stop offset="100%" stopColor="hsl(142, 71%, 42%)" />
            </linearGradient>
          </defs>
          <path d={ARC_D} fill="none" stroke="url(#sample-fsg-grad)" strokeWidth={STROKE} strokeLinecap="round" />
          <path d={MARKER_D} fill="hsl(var(--foreground) / 0.8)" />
        </svg>

        {/* Endpoint labels */}
        <span
          className="absolute text-[7px] font-semibold text-foreground/60 tracking-wide"
          style={{ left: arcL.x, top: CY + 5, transform: 'translateX(-50%)' }}
        >
          Overpaying
        </span>
        <span
          className="absolute text-[7px] font-semibold text-foreground/60 tracking-wide whitespace-nowrap"
          style={{ left: arcR.x, top: CY + 5, transform: 'translateX(-50%)' }}
        >
          Good Deal
        </span>

        {/* Score + /100 centered inside arc */}
        <div className="absolute inset-x-0 flex flex-col items-center" style={{ top: CY - 36 }}>
          <span
            className="font-display text-[30px] leading-none font-bold tracking-tight"
            style={{ letterSpacing: '-0.03em', color: 'hsl(var(--accent-amber))' }}
          >
            {SCORE}
          </span>
          <span className="text-[8px] text-foreground/40 font-semibold mt-0.5">/ 100</span>
        </div>
      </div>

      {/* Tier label */}
      <p
        className="font-display text-[12px] font-semibold tracking-tight text-center -mt-1"
        style={{ letterSpacing: '-0.01em', color: 'hsl(var(--accent-amber))' }}
      >
        Above Trend
      </p>
    </div>

    {/* Verdict headline */}
    <h3
      className="font-display text-[18px] font-bold text-foreground text-center leading-tight mt-2"
      style={{ letterSpacing: '-0.02em' }}
    >
      Your rent increase is{' '}
      <span style={{ color: 'hsl(var(--accent-red))' }}>above market.</span>
    </h3>

    {/* Subtitle */}
    <p className="text-[12px] text-muted-foreground text-center leading-relaxed mt-1.5">
      Rents near you moved 3% but your landlord wants 17.5%.
      <br />
      That's $4,200 more per year.
    </p>

    {/* Footer */}
    <p className="text-[11px] text-muted-foreground/40 text-center mt-3 pt-3 border-t border-border/40">
      Sample result — Hoboken, NJ 07030
    </p>
  </div>
);

export default SampleResultCard;
