import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { PropertyLookupResult, PropertyLookupError } from '@/hooks/usePropertyLookup';
import {
  LandlordCosts,
  LandlordInsights,
  calculateLandlordCosts,
  generateInsights,
} from '@/data/landlordCosts';

interface LandlordCostSectionProps {
  propertyData: PropertyLookupResult | null;
  propertyLoading: boolean;
  propertyError: PropertyLookupError;
  currentRent: number;
  proposedRent: number;
  increaseAmount: number;
  hasAddress: boolean;
  onScrollToTop?: () => void;
}

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

const LandlordCostSection = ({
  propertyData,
  propertyLoading,
  propertyError,
  currentRent,
  proposedRent,
  increaseAmount,
  hasAddress,
  onScrollToTop,
}: LandlordCostSectionProps) => {
  const [expanded, setExpanded] = useState(false);

  const costs = useMemo(
    () => (propertyData ? calculateLandlordCosts(propertyData) : null),
    [propertyData]
  );

  const insights = useMemo(
    () =>
      propertyData && costs
        ? generateInsights(propertyData, costs, currentRent, proposedRent)
        : null,
    [propertyData, costs, currentRent, proposedRent]
  );

  // Loading state
  if (propertyLoading) {
    return (
      <div className="py-12 text-center">
        <div className="space-y-3 max-w-[400px] mx-auto">
          <div className="h-4 bg-muted/60 rounded animate-pulse w-full" />
          <div className="h-4 bg-muted/60 rounded animate-pulse w-4/5" />
          <div className="h-4 bg-muted/60 rounded animate-pulse w-3/5" />
        </div>
        <p className="text-sm text-muted-foreground mt-4 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Looking up property records…
        </p>
      </div>
    );
  }

  // No address entered — show teaser
  if (!hasAddress) {
    return (
      <div className="py-12 text-center">
        <div className="relative">
          {/* Blurred fake numbers */}
          <div className="blur-[6px] opacity-40 pointer-events-none select-none space-y-2 mb-6">
            <p className="text-sm">Mortgage: $1,0XX/mo</p>
            <p className="text-sm">Taxes: $XXX/mo</p>
            <p className="text-sm">Profit: $X,XXX/mo</p>
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-2xl mb-2">🔍</p>
            <h3 className="font-display text-lg font-semibold text-foreground mb-1">
              Want to see what your landlord actually pays?
            </h3>
            <p className="text-sm text-muted-foreground max-w-[320px] mb-4">
              Enter your address above to unlock landlord cost breakdown, profit margin, and more.
            </p>
            <button
              onClick={onScrollToTop}
              className="text-sm font-semibold text-primary hover:underline"
            >
              Enter my address ↑
            </button>
          </div>
        </div>
      </div>
    );
  }

  // FIX 5: Minimize failure states to a single quiet line
  if (propertyError === 'RATE_LIMIT' || propertyError === 'NOT_FOUND' || propertyError === 'NETWORK' || !propertyData) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        Property cost data unavailable for this address — your market analysis above is still accurate.
      </p>
    );
  }

  // No sale price or tax data — still show basic info but keep it quiet
  if (!costs || !insights) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        Property cost data unavailable for this address — your market analysis above is still accurate.
      </p>
    );
  }

  const saleDate = propertyData.lastSaleDate
    ? new Date(propertyData.lastSaleDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : null;

  const showKeyInsight = insights.costIncreaseMarkup !== null && insights.costIncreaseMarkup > 1;
  const showProfitCard = insights.profitMargin > 0;
  const showWealthCard = insights.yearsOwned >= 2 && insights.yearsOwned <= 25;
  const isNegativeProfit = insights.profitMargin <= 0;

  const costRows = [
    {
      label: 'Mortgage',
      value: `$${fmt(costs.mortgage)}`,
      sub: `Based on $${fmt(propertyData.lastSalePrice!)} purchase (${insights.saleYear}), ${insights.downPaymentPct}% down, ${insights.mortgageRate}% rate`,
    },
    {
      label: 'Property taxes',
      value: `$${fmt(costs.propertyTax)}`,
      sub: `$${fmt(propertyData.annualTax!)}/yr ÷ ${propertyData.units} unit${propertyData.units > 1 ? 's' : ''}`,
    },
    {
      label: 'Insurance',
      value: `$${fmt(costs.insurance)}`,
      sub: 'Estimated at 0.5% of assessed value',
    },
    {
      label: 'Maintenance & reserves',
      value: `$${fmt(costs.maintenance)}`,
      sub: `Based on building age (${insights.buildingAge ?? '~30'} years)`,
    },
  ];

  return (
    <div className="text-left">
      {/* Building Profile */}
      <h2 className="section-title">Your Building</h2>
      <p className="text-sm text-muted-foreground">
        {propertyData.address}
        {propertyData.yearBuilt && ` · Built ${propertyData.yearBuilt}`}
        {` · ${propertyData.propertyType}`}
      </p>
      {saleDate && propertyData.lastSalePrice && (
        <p className="text-sm text-muted-foreground mt-0.5">
          Last sold {saleDate} for ${fmt(propertyData.lastSalePrice)}
        </p>
      )}
      <p className="text-sm text-muted-foreground mt-0.5">
        {propertyData.isInvestor
          ? `Investment property${propertyData.ownerCity ? ` (owner in ${propertyData.ownerCity}, ${propertyData.ownerState})` : ''}`
          : 'Owner-occupied'}
      </p>

      {/* Key Insight Card */}
      {showKeyInsight && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="mt-6 p-6 rounded-lg"
          style={{ background: 'hsl(var(--highlight-bg))' }}
        >
          <p className="text-sm text-muted-foreground">
            Your landlord's costs went up ~${fmt(costs.totalCostChangePerMonth)}/mo this year.
            They're raising you ${fmt(increaseAmount)}/mo.
          </p>
          <p className="mt-3 text-foreground">
            That's a{' '}
            <span className="font-display text-3xl font-bold text-destructive">
              {insights.costIncreaseMarkup}×
            </span>{' '}
            markup on their actual cost increase.
          </p>
        </motion.div>
      )}

      {/* Negative profit note */}
      {isNegativeProfit && (
        <p className="text-sm text-muted-foreground mt-4 p-4 rounded bg-muted/40">
          Based on our estimates, this property's operating costs are close to or exceed the current rent.
          The landlord may have different financing terms.
        </p>
      )}

      {/* Insight Cards */}
      {!isNegativeProfit && (showProfitCard || showWealthCard) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          {showProfitCard && (
            <div className="p-5 rounded-lg border border-border bg-card">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Landlord Profit
              </p>
              <p className="text-sm text-muted-foreground">
                Your landlord makes an estimated{' '}
                <span className="font-semibold text-verdict-good text-base">
                  ${fmt(insights.profitMargin)}/mo
                </span>{' '}
                profit on your unit — even before this increase.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                After the increase:{' '}
                <span className="font-semibold text-foreground">
                  ${fmt(insights.profitAfterIncrease)}/mo
                </span>{' '}
                profit.
              </p>
            </div>
          )}

          {showWealthCard && (
            <div className="p-5 rounded-lg border border-border bg-card">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Wealth Built
              </p>
              <p className="text-sm text-muted-foreground">
                Your landlord has built ~
                <span className="font-semibold text-foreground">
                  ${fmt(insights.totalWealthBuilt)}
                </span>{' '}
                in wealth from this building.
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                ${fmt(insights.equityGained)} in appreciation + ${fmt(insights.principalPaid)} in mortgage paydown
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                This is on top of monthly rent profits.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Cost Breakdown (collapsible) */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mt-6"
      >
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        {expanded ? 'Hide' : 'Show'} cost breakdown
      </button>

      {expanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          transition={{ duration: 0.3 }}
          className="mt-4"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Estimated Costs Per Unit
          </p>
          {costRows.map((row, i) => (
            <div key={row.label} className={`context-row ${i % 2 === 0 ? 'context-row-even' : 'context-row-odd'}`}>
              <div>
                <span className="context-label">{row.label}</span>
                <p className="text-[11px] text-muted-foreground mt-0.5">{row.sub}</p>
              </div>
              <span className="context-value">{row.value}</span>
            </div>
          ))}
          <div className="context-row border-t-2 border-border pt-3">
            <span className="context-label font-medium text-foreground">Total estimated costs</span>
            <span className="context-value">${fmt(costs.total)}</span>
          </div>
          <div className="context-row">
            <span className="context-label font-medium text-foreground">Your current rent</span>
            <span className="context-value">${fmt(currentRent)}</span>
          </div>
          <div className="context-row">
            <span className="context-label font-medium text-foreground">Estimated profit margin</span>
            <span className={`context-value ${insights.profitMargin > 0 ? 'text-verdict-good' : 'text-destructive'}`}>
              ${fmt(insights.profitMargin)} ({insights.profitMarginPct}%)
            </span>
          </div>
        </motion.div>
      )}

      {/* Disclaimer */}
      <p className="text-[11px] text-muted-foreground mt-6">
        Property data from public records. Costs are estimates based on standard assumptions
        ({insights.downPaymentPct}% down payment, 30-year fixed mortgage at {insights.mortgageRate}% rate,
        0.5% insurance rate, standard maintenance reserves). Actual costs may vary. This is not financial or legal advice.
      </p>
    </div>
  );
};

export default LandlordCostSection;
