import { type Hud50ZipRaw } from '@/data/dataLoader';

const BEDROOM_LABELS = ['Studio', '1-Bedroom', '2-Bedroom', '3-Bedroom', '4-Bedroom'];

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

interface WhatShouldRentCostProps {
  location: string;
  fmr: number[];            // HUD SAFMR [0..4]
  hud50?: number[] | null;  // HUD 50th percentile [0..4]
  censusMedianRent?: number | null;
}

const WhatShouldRentCost = ({ location, fmr, hud50, censusMedianRent }: WhatShouldRentCostProps) => {
  return (
    <section className="mb-12">
      <h2 className="font-display text-2xl text-foreground mb-2 tracking-tight">What Should Rent Cost in {location}?</h2>
      <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
        Typical rent ranges based on HUD benchmarks and market data. The floor is the 40th percentile (HUD FMR) and the ceiling is the 50th percentile or market median where available.
      </p>
      <div className="space-y-3">
        {BEDROOM_LABELS.map((label, i) => {
          if (fmr[i] === 0) return null;
          const floor = fmr[i];
          const ceiling = hud50?.[i] && hud50[i] > floor
            ? hud50[i]
            : (i === 1 && censusMedianRent && censusMedianRent > floor)
              ? censusMedianRent
              : Math.round(floor * 1.15);
          const top25 = Math.round(ceiling * 1.15);
          return (
            <div key={label} className="rounded-lg border border-border p-4 bg-card">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-foreground">{label}</span>
                <span className="text-sm font-bold tabular-nums text-foreground">{fmt(floor)} – {fmt(ceiling)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                A {label.toLowerCase()} in {location} typically rents for {fmt(floor)} – {fmt(ceiling)}.
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Rents above {fmt(top25)} are in the top 25% for this area.
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default WhatShouldRentCost;
