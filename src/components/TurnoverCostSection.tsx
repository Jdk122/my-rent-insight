import { useMemo, useEffect, useState } from 'react';
import { fetchStateVacancyRate, type VacancyRateResult } from '@/data/dataLoader';
import { stateNameFromAbbr } from '@/data/cityStateUtils';

interface TurnoverCostSectionProps {
  currentRent: number;
  bedrooms: number; // 0=studio, 1, 2, 3+
  bedroomLabel: string;
  city: string;
  state: string; // state abbreviation
  annualSavings: number;
  proposedRentAboveMedian: boolean;
  onScrollToLetter: () => void;
}

const fmt = (n: number) =>
  '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });

function getVacancyMonths(rate: number): number {
  if (rate < 4.0) return 0.75;
  if (rate < 5.5) return 1.0;
  if (rate < 7.0) return 1.5;
  if (rate < 9.0) return 2.0;
  return 2.5;
}

function getPrepCost(currentRent: number, bedrooms: number) {
  let prepRate: number;
  if (bedrooms <= 0) prepRate = 0.25;
  else if (bedrooms === 1) prepRate = 0.28;
  else if (bedrooms === 2) prepRate = 0.32;
  else if (bedrooms === 3) prepRate = 0.35;
  else prepRate = 0.38;

  let cost = currentRent * prepRate;

  // Floors and ceilings by bedroom count
  if (bedrooms <= 1) {
    cost = Math.max(cost, 800);
    cost = Math.min(cost, 5000);
  } else if (bedrooms === 2) {
    cost = Math.max(cost, 1000);
    cost = Math.min(cost, 6500);
  } else {
    cost = Math.max(cost, 1200);
    cost = Math.min(cost, 8000);
  }

  return Math.round(cost);
}

function getLeasingCost(currentRent: number) {
  let cost = currentRent * 0.18;
  cost = Math.max(cost, 400);
  cost = Math.min(cost, 4000);
  return Math.round(cost);
}

const ADMIN_COST = 350;

const TurnoverCostSection = ({
  currentRent,
  bedrooms,
  bedroomLabel,
  city,
  state,
  annualSavings,
  proposedRentAboveMedian,
  onScrollToLetter,
}: TurnoverCostSectionProps) => {
  const [vacancy, setVacancy] = useState<VacancyRateResult | null>(null);
  const [showBreakdown, setShowBreakdown] = useState(false);

  useEffect(() => {
    const stateName = stateNameFromAbbr(state);
    fetchStateVacancyRate(state, stateName).then(setVacancy);
  }, [state]);

  const costs = useMemo(() => {
    const rate = vacancy?.rate ?? 7.0;
    const vacancyMonths = getVacancyMonths(rate);
    const vacancyCost = Math.round(currentRent * vacancyMonths);
    const prepCost = getPrepCost(currentRent, bedrooms);
    const leasingCost = getLeasingCost(currentRent);
    const total = vacancyCost + prepCost + leasingCost + ADMIN_COST;
    return { vacancyCost, vacancyMonths, prepCost, leasingCost, total };
  }, [currentRent, bedrooms, vacancy]);

  const version: 'A' | 'B' | 'C' =
    !proposedRentAboveMedian || annualSavings <= 0
      ? 'C'
      : annualSavings < costs.total
      ? 'A'
      : 'B';

  const stateName = vacancy?.stateName || stateNameFromAbbr(state);
  const vacancyRate = vacancy?.rate ?? 7.0;
  const dataYear = vacancy?.year || '2024';
  const isFallback = vacancy?.isFallback ?? true;

  const vacancySublabel = isFallback
    ? `Based on national average vacancy rate (${vacancyRate}%), estimated ${costs.vacancyMonths === 1 ? '1 month' : `${costs.vacancyMonths} months`} to re-rent`
    : `Based on ${stateName}'s ${vacancyRate}% vacancy rate, estimated ${costs.vacancyMonths === 1 ? '1 month' : `${costs.vacancyMonths} months`} to re-rent`;

  return (
    <div className="text-left">
      <h2 className="results-section-header mb-1">The Cost of Turnover</h2>
      <p className="text-[13px] text-muted-foreground mb-8">
        What it typically costs a landlord when a tenant moves out.
      </p>

      {/* Turnover cost summary — collapsible breakdown */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-medium text-foreground">
            Estimated cost to re-rent this unit
          </span>
          <span className="font-bold text-lg text-foreground">
            {fmt(costs.total)}
          </span>
        </div>

        <button
          onClick={() => setShowBreakdown(!showBreakdown)}
          className="text-[12px] text-primary mt-2 hover:underline min-h-11 flex items-center"
        >
          {showBreakdown ? 'Hide breakdown' : 'See breakdown'}
        </button>

        {showBreakdown && (
          <div className="mt-3 pt-3 border-t border-border space-y-0">
            <div className="context-row context-row-even">
              <div>
                <span className="context-label">Estimated lost rent during vacancy</span>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {vacancySublabel}
                </p>
              </div>
              <span className="context-value">{fmt(costs.vacancyCost)}</span>
            </div>
            <div className="context-row context-row-odd">
              <div>
                <span className="context-label">Unit turnover preparation</span>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Cleaning, painting, and minor repairs for a {bedroomLabel.toLowerCase()}
                </p>
              </div>
              <span className="context-value">{fmt(costs.prepCost)}</span>
            </div>
            <div className="context-row context-row-even">
              <div>
                <span className="context-label">Listing, marketing, and tenant screening</span>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Advertising, showings, application processing
                </p>
              </div>
              <span className="context-value">{fmt(costs.leasingCost)}</span>
            </div>
            <div className="context-row context-row-odd">
              <div>
                <span className="context-label">Administrative and processing costs</span>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Lease prep, inspections, key exchange, utility coordination
                </p>
              </div>
              <span className="context-value">{fmt(ADMIN_COST)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Conditional insight callout */}
      <div
        className="mt-6 p-6 rounded-xl border border-border/80"
        style={{ background: 'hsl(var(--highlight-bg))' }}
      >
        {version === 'C' && (
          <>
            <p className="text-sm text-foreground leading-relaxed">
              Replacing you would still cost your landlord an estimated <strong>{fmt(costs.total)}</strong>. Even when your increase is reasonable, a short reply gives them a reason to offer something better.
            </p>
            <p className="text-[13px] text-muted-foreground mt-3">
              A quick reply costs nothing to try.
            </p>
          </>
        )}
        {version === 'A' && (
          <>
            <p className="text-sm text-foreground leading-relaxed">
              Replacing you would cost your landlord an estimated <strong>{fmt(costs.total)}</strong>. That's why a short, data-backed reply works. They'd rather negotiate than pay to find someone new.
            </p>
            <p className="text-[13px] text-muted-foreground mt-3">
              That's your leverage.
            </p>
          </>
        )}
        {version === 'B' && (
          <>
            <p className="text-sm text-foreground leading-relaxed">
              Replacing you would cost your landlord an estimated <strong>{fmt(costs.total)}</strong>, and you're overpaying well beyond that. A reply gives them a reason to meet you halfway. If they won't budge, moving makes financial sense.
            </p>
            <p className="text-[13px] text-muted-foreground mt-3">
              Start with a reply. You can always move later.
            </p>
          </>
        )}

        <button
          onClick={onScrollToLetter}
          className="mt-4 text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
        >
          Get your reply ↓
        </button>
      </div>

      {/* Source citation */}
      <p className="text-[11px] text-muted-foreground mt-6 leading-relaxed">
        Sources: U.S. Census Bureau, National Apartment Association. General estimates, not specific to your building.
      </p>
    </div>
  );
};

export default TurnoverCostSection;
