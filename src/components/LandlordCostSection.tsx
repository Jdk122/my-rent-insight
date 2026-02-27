import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { PropertyLookupResult, PropertyLookupError } from '@/hooks/usePropertyLookup';
import {
  LandlordCosts,
  LandlordInsights,
  calculateLandlordCosts,
  generateInsights,
  MORTGAGE_RATES,
} from '@/data/landlordCosts';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';

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
  // Default assumptions based on property data
  const saleYear = propertyData?.lastSaleDate ? new Date(propertyData.lastSaleDate).getFullYear() : 2020;
  const defaultRate = MORTGAGE_RATES[saleYear] || 0.055;
  const defaultDownPct = 25;

  const [downPaymentPct, setDownPaymentPct] = useState(defaultDownPct);
  const [mortgageRateInput, setMortgageRateInput] = useState((defaultRate * 100).toFixed(2));
  const [expanded, setExpanded] = useState(true); // Start expanded now

  const customRate = parseFloat(mortgageRateInput) / 100;
  const customDownPct = downPaymentPct / 100;

  const costs = useMemo(
    () => (propertyData ? calculateLandlordCosts(propertyData, customDownPct, isNaN(customRate) ? undefined : customRate) : null),
    [propertyData, customDownPct, customRate]
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

  // Error / missing data
  if (propertyError === 'RATE_LIMIT' || propertyError === 'NOT_FOUND' || propertyError === 'NETWORK' || !propertyData) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        Property cost data unavailable for this address — your market analysis above is still accurate.
      </p>
    );
  }

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

  const annualTaxForDisplay = propertyData.annualTax
    ?? Math.round(costs.propertyTax * 12 * Math.max(propertyData.units, 1));

  const loanAmount = Math.round(propertyData.lastSalePrice! * (1 - customDownPct));

  const costRows = [
    {
      label: 'Mortgage',
      value: `$${fmt(costs.mortgage)}`,
      sub: `$${fmt(loanAmount)} loan at ${mortgageRateInput}%, 30yr fixed`,
    },
    {
      label: 'Property taxes',
      value: `$${fmt(costs.propertyTax)}`,
      sub: `$${fmt(annualTaxForDisplay)}/yr${propertyData.annualTax ? ' public record' : ' estimated'}`,
    },
    {
      label: 'Insurance',
      value: `$${fmt(costs.insurance)}`,
      sub: 'Est. 0.5% of assessed value',
    },
    ...(costs.hoa > 0
      ? [
          {
            label: 'HOA / condo fee',
            value: `$${fmt(costs.hoa)}`,
            sub: costs.hoaEstimated ? `Est. $0.60/sqft` : 'From public records',
          },
        ]
      : []),
    {
      label: 'Maintenance & reserves',
      value: `$${fmt(costs.maintenance)}`,
      sub: `Est. based on building age (${insights.buildingAge ?? '~30'} yrs)`,
    },
  ];

  // Profit at different scenarios for range display
  const profitAtCurrent = currentRent - costs.total;
  const costsAt50Down = propertyData ? (() => {
    const c = calculateLandlordCosts(propertyData, 0.50, isNaN(customRate) ? undefined : customRate);
    return c ? currentRent - c.total : null;
  })() : null;
  const costsAtCash = propertyData ? (() => {
    const c = calculateLandlordCosts(propertyData, 1.0, isNaN(customRate) ? undefined : customRate);
    return c ? currentRent - c.total : null;
  })() : null;

  return (
    <div className="text-left">
      {/* Building Profile */}
      <h2 className="section-title">Your Landlord's Property</h2>
      <p className="text-sm text-muted-foreground">
        {propertyData.address}
        {propertyData.yearBuilt && ` · Built ${propertyData.yearBuilt}`}
        {` · ${propertyData.propertyType}`}
      </p>
      {saleDate && propertyData.lastSalePrice && (
        <p className="text-sm text-muted-foreground mt-0.5">
          Purchased {saleDate} for ${fmt(propertyData.lastSalePrice)}
        </p>
      )}

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

      {/* Wealth Built Card */}
      {insights.yearsOwned >= 2 && insights.yearsOwned <= 25 && (
        <div className="mt-6 p-5 rounded-lg border border-border bg-card">
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

      {/* Cost Breakdown */}
      <div className="mt-8">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          {expanded ? 'Hide' : 'Show'} estimated landlord costs per month
        </button>

        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            transition={{ duration: 0.3 }}
            className="mt-4"
          >
            {/* Editable assumptions */}
            <div className="p-4 rounded-lg border border-border bg-muted/30 mb-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Adjust assumptions
              </p>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-sm text-muted-foreground">Down payment</label>
                    <span className="text-sm font-semibold text-foreground">
                      {downPaymentPct === 100 ? 'All cash' : `${downPaymentPct}%`}
                    </span>
                  </div>
                  <Slider
                    value={[downPaymentPct]}
                    onValueChange={([v]) => setDownPaymentPct(v)}
                    min={0}
                    max={100}
                    step={5}
                    className="w-full"
                  />
                  <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
                    <span>0%</span>
                    <span>All cash</span>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-sm text-muted-foreground">Mortgage rate</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={mortgageRateInput}
                      onChange={(e) => setMortgageRateInput(e.target.value)}
                      className="w-24 h-8 text-sm"
                      step="0.1"
                      min="0"
                      max="15"
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                    <span className="text-[11px] text-muted-foreground ml-2">
                      Freddie Mac 30yr avg for {saleYear}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Line items */}
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

            {/* Profit range */}
            <div className="mt-5 p-4 rounded-lg border border-border bg-card">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                What your landlord might be making
              </p>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">With these assumptions:</span>
                  <span className={`font-semibold ${profitAtCurrent > 0 ? 'text-verdict-good' : 'text-muted-foreground'}`}>
                    {profitAtCurrent > 0 ? '+' : ''}${fmt(profitAtCurrent)}/mo
                    {profitAtCurrent <= 0 && ' (losing money)'}
                  </span>
                </div>
                {costsAt50Down !== null && downPaymentPct < 50 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">If they put 50% down:</span>
                    <span className={`font-semibold ${costsAt50Down > 0 ? 'text-verdict-good' : 'text-muted-foreground'}`}>
                      {costsAt50Down > 0 ? '+' : ''}${fmt(costsAt50Down)}/mo
                    </span>
                  </div>
                )}
                {costsAtCash !== null && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">If they paid all cash:</span>
                    <span className={`font-semibold ${costsAtCash > 0 ? 'text-verdict-good' : 'text-muted-foreground'}`}>
                      {costsAtCash > 0 ? '+' : ''}${fmt(costsAtCash)}/mo
                    </span>
                  </div>
                )}
              </div>
              {insights.costIncreaseMarkup !== null && insights.costIncreaseMarkup > 1 && (
                <p className="text-sm text-foreground mt-4 pt-3 border-t border-border">
                  Even with conservative estimates, your rent increase is{' '}
                  <span className="font-bold text-destructive">{insights.costIncreaseMarkup}×</span>{' '}
                  their cost increase.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </div>

      {/* Disclaimer */}
      <p className="text-[11px] text-muted-foreground mt-6">
        Property data from public records. Mortgage estimate uses the Freddie Mac 30-year fixed rate
        for the purchase date. Adjust assumptions above to match your landlord's likely terms. This is not financial or legal advice.
      </p>
    </div>
  );
};

export default LandlordCostSection;
