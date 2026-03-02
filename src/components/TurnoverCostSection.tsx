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
    ? `Based on national average vacancy rate (${vacancyRate}%) — estimated ${costs.vacancyMonths === 1 ? '1 month' : `${costs.vacancyMonths} months`} to re-rent`
    : `Based on ${stateName}'s ${vacancyRate}% vacancy rate — estimated ${costs.vacancyMonths === 1 ? '1 month' : `${costs.vacancyMonths} months`} to re-rent`;

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
        <div className="context-row border-t-2 border-border pt-3">
          <span className="context-label font-medium text-foreground">
            Estimated total cost to re-rent this unit
          </span>
          <span className="context-value font-bold text-lg">
            {fmt(costs.total)}
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
              Your proposed rent is competitive with nearby units. Turnover on a {bedroomLabel.toLowerCase()} in {city} typically costs a property owner an estimated <strong>{fmt(costs.total)}</strong> before accounting for any rent adjustment on the new lease. With your rent already in line with the market, there's a strong case for both sides to continue the tenancy.
            </p>
            <p className="text-[13px] text-muted-foreground mt-3">
              If you'd still like to negotiate, even a modest reduction adds up over a full lease term.
            </p>
          </>
        )}
        {version === 'A' && (
          <>
            <p className="text-sm text-foreground leading-relaxed">
              Turnover on a {bedroomLabel.toLowerCase()} in {city} typically costs a property owner an estimated <strong>{fmt(costs.total)}</strong> before accounting for any rent adjustment on the new lease. Your estimated savings from moving would be <strong>{fmt(annualSavings)}/yr</strong>. In most cases, a reasonable compromise on renewal terms costs both sides less than turnover — especially when factoring in your moving costs too.
            </p>
            <p className="text-[13px] text-muted-foreground mt-3">
              This is one reason experienced property managers prefer to retain good tenants at a fair rate.
            </p>
          </>
        )}
        {version === 'B' && (
          <>
            <p className="text-sm text-foreground leading-relaxed">
              Turnover on a {bedroomLabel.toLowerCase()} in {city} typically costs a property owner an estimated <strong>{fmt(costs.total)}</strong> before accounting for any rent adjustment on the new lease. Your estimated savings from moving — <strong>{fmt(annualSavings)}/yr</strong> — are significant. Whether moving makes financial sense depends on your specific moving costs and how your unit compares to what's available, but the numbers suggest it's worth serious consideration.
            </p>
            <p className="text-[13px] text-muted-foreground mt-3">
              Either way, negotiating first costs nothing and takes five minutes.
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

      {/* Source citation */}
      <p className="text-[11px] text-muted-foreground mt-6 leading-relaxed">
        {isFallback
          ? `Vacancy estimate based on the national average rental vacancy rate (${vacancyRate}%, U.S. Census Bureau via FRED). `
          : `Vacancy estimate based on ${stateName} rental vacancy rate (${vacancyRate}%, U.S. Census Bureau via FRED, ${dataYear}). `}
        Turnover and marketing costs estimated from industry benchmarks (National Apartment Association; Zego 2023 Turnover Cost Report, avg. $3,872/unit). These are general estimates, not specific to your building.
      </p>
    </div>
  );
};

export default TurnoverCostSection;
