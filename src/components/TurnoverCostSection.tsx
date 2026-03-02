import { useMemo } from 'react';

interface TurnoverCostSectionProps {
  currentRent: number;
  bedrooms: number; // 0=studio, 1, 2, 3+
  bedroomLabel: string;
  city: string;
  annualSavings: number; // from Should You Move section; 0 or negative if rent is competitive
  proposedRentAboveMedian: boolean; // true if proposed rent > median
  onScrollToLetter: () => void;
}

const fmt = (n: number) =>
  n.toLocaleString('en-US', { maximumFractionDigits: 0 });

const TurnoverCostSection = ({
  currentRent,
  bedrooms,
  bedroomLabel,
  city,
  annualSavings,
  proposedRentAboveMedian,
  onScrollToLetter,
}: TurnoverCostSectionProps) => {
  const costs = useMemo(() => {
    const vacancyCost = Math.round(currentRent * 1.5);
    const prepCost = bedrooms <= 1 ? 2000 : bedrooms === 2 ? 2750 : 3500;
    const leasingCost = 1500;
    const total = vacancyCost + prepCost + leasingCost;
    return { vacancyCost, prepCost, leasingCost, total };
  }, [currentRent, bedrooms]);

  // Determine version
  const version: 'A' | 'B' | 'C' =
    !proposedRentAboveMedian || annualSavings <= 0
      ? 'C'
      : annualSavings < costs.total
      ? 'A'
      : 'B';

  return (
    <div className="text-left">
      <h2 className="results-section-header mb-1">The Cost of Turnover</h2>
      <p className="text-[13px] text-muted-foreground mb-8">
        What it typically costs when a tenant moves out — and what that means for your decision.
      </p>

      {/* Turnover cost breakdown */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-0">
        <div className="context-row context-row-even">
          <div>
            <span className="context-label">Estimated lost rent</span>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Avg. 1–2 months vacancy
            </p>
          </div>
          <span className="context-value">${fmt(costs.vacancyCost)}</span>
        </div>
        <div className="context-row context-row-odd">
          <div>
            <span className="context-label">Typical turnover costs</span>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Cleaning, paint, repairs
            </p>
          </div>
          <span className="context-value">${fmt(costs.prepCost)}</span>
        </div>
        <div className="context-row context-row-even">
          <div>
            <span className="context-label">Listing, marketing, and screening</span>
          </div>
          <span className="context-value">${fmt(costs.leasingCost)}</span>
        </div>
        <div className="context-row border-t-2 border-border pt-3">
          <span className="context-label font-medium text-foreground">
            Estimated cost to re-rent this unit
          </span>
          <span className="context-value font-bold text-lg">
            ${fmt(costs.total)}
          </span>
        </div>
      </div>

      {/* Conditional insight callout */}
      <div
        className="mt-6 p-6 rounded-xl border border-border/80"
        style={{ background: 'hsl(var(--highlight-bg))' }}
      >
        {version === 'C' && (
          <>
            <p className="text-sm text-foreground leading-relaxed">
              Your proposed rent is competitive with nearby units, and turnover on a {bedroomLabel.toLowerCase()} in {city} typically costs a property owner an estimated <strong>${fmt(costs.total)}</strong>. You're in a solid position — your property owner has every reason to keep you.
            </p>
            <p className="text-[13px] text-muted-foreground mt-3">
              If you'd still like to negotiate, even a modest reduction can add up over a full lease term.
            </p>
          </>
        )}
        {version === 'A' && (
          <>
            <p className="text-sm text-foreground leading-relaxed">
              A {bedroomLabel.toLowerCase()} in {city} turning over typically costs a property owner an estimated <strong>${fmt(costs.total)}</strong>. Your estimated savings from moving would be <strong>${fmt(annualSavings)}/yr</strong> — less than the cost of replacing you. A reasonable rent compromise likely saves both sides money compared to the alternative.
            </p>
            <p className="text-[13px] text-muted-foreground mt-3">
              This is one reason experienced property managers prefer to retain good tenants at a fair rate.
            </p>
          </>
        )}
        {version === 'B' && (
          <>
            <p className="text-sm text-foreground leading-relaxed">
              A {bedroomLabel.toLowerCase()} in {city} turning over typically costs a property owner an estimated <strong>${fmt(costs.total)}</strong>. But your estimated savings from moving — <strong>${fmt(annualSavings)}/yr</strong> — exceed that amount. If your property owner isn't willing to negotiate meaningfully, moving may be the stronger financial decision.
            </p>
            <p className="text-[13px] text-muted-foreground mt-3">
              You can still try negotiating first — it costs nothing and takes five minutes.
            </p>
          </>
        )}

        <button
          onClick={onScrollToLetter}
          className="mt-4 text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
        >
          Generate negotiation letter →
        </button>
      </div>

      {/* Disclaimer */}
      <p className="text-[11px] text-muted-foreground mt-6">
        These are general estimates based on typical market conditions, not specific to your building. Actual costs vary by property and management company.
      </p>
    </div>
  );
};

export default TurnoverCostSection;
