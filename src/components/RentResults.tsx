import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { RentFormData } from './RentForm';
import { RentLookupResult, bedroomLabels, calculateResults } from '@/data/rentData';
import ShareSection from './ShareSection';
import EmailCapture from './EmailCapture';
import CompLinks from './CompLinks';
import NegotiationLetter from './NegotiationLetter';
import { PropertyLookupResult, PropertyLookupError } from '@/hooks/usePropertyLookup';
import { calculateLandlordCosts, generateInsights, toLegacyCostEstimate, LandlordCostEstimate } from '@/data/landlordCosts';
import LandlordCostSection from './LandlordCostSection';
import RentcastCard from './RentcastCard';
import { useRentcast } from '@/hooks/useRentcast';

interface RentResultsProps {
  formData: RentFormData;
  rentData: RentLookupResult;
  propertyData: PropertyLookupResult | null;
  propertyLoading: boolean;
  propertyError: PropertyLookupError;
  onReset: () => void;
  onScrollToTop: () => void;
}

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

const fade = (delay: number) => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] as const },
});

const RentResults = ({ formData, rentData, propertyData, propertyLoading, propertyError, onReset, onScrollToTop }: RentResultsProps) => {
  const increaseAmount = formData.rentIncrease
    ? formData.increaseIsPercent
      ? Math.round(formData.currentRent * (formData.rentIncrease / 100))
      : formData.rentIncrease
    : 0;

  const increasePct = formData.rentIncrease
    ? formData.increaseIsPercent
      ? formData.rentIncrease
      : Math.round((formData.rentIncrease / formData.currentRent) * 1000) / 10
    : 0;

  const hasIncrease = increaseAmount > 0;

  const calc = useMemo(() => {
    if (!hasIncrease) return null;
    return calculateResults(formData.currentRent, increasePct, formData.movingCosts, rentData);
  }, [formData.currentRent, increasePct, formData.movingCosts, rentData, hasIncrease]);

  const newRent = formData.currentRent + increaseAmount;
  const annualExtra = increaseAmount * 12;
  const marketYoy = rentData.yoyChange;
  const multiplier = calc?.increaseRatio ?? 0;
  const excessAnnual = hasIncrease
    ? Math.round(formData.currentRent * ((increasePct - marketYoy) / 100) * 12)
    : 0;

  const isAboveMarket = calc?.verdict === 'above';
  const isFair = calc?.verdict === 'at-market';
  const isBelowMarket = calc?.verdict === 'below';

  // Compute landlord cost data from property lookup
  const landlordCosts = useMemo<LandlordCostEstimate | null>(() => {
    if (!propertyData) return null;
    const costs = calculateLandlordCosts(propertyData);
    if (!costs) return null;
    return toLegacyCostEstimate(propertyData, costs);
  }, [propertyData]);

  const landlordInsights = useMemo(() => {
    if (!propertyData) return null;
    const costs = calculateLandlordCosts(propertyData);
    if (!costs) return null;
    return generateInsights(propertyData, costs, formData.currentRent, newRent);
  }, [propertyData, formData.currentRent, newRent]);

  const rentcast = useRentcast(rentData.zip, formData.bedrooms, formData.fullAddress);
  const hasRentcastComps = rentcast.data && rentcast.data.comparables.length > 0;

  // FIX 1: Smart comparison rent for "Should you move?"
  const comparisonRent = useMemo<{ rent: number; label: string } | null>(() => {
    const ratio = formData.currentRent / rentData.fmr;
    if (ratio <= 1.5) {
      return { rent: rentData.fmr, label: 'fair market rate' };
    } else if (rentcast.data?.rentRangeLow && rentcast.data.rentRangeLow > rentData.fmr) {
      return { rent: rentcast.data.rentRangeLow, label: 'low end of comparable units' };
    } else {
      return null;
    }
  }, [formData.currentRent, rentData.fmr, rentcast.data]);

  // FIX 5: High-rent verdict nuance
  const isHighRent = formData.currentRent > rentData.fmr * 1.5;

  const verdictColor = isFair ? 'text-verdict-fair' : isAboveMarket ? 'text-verdict-overpaying' : 'text-verdict-good';
  const pillClass = isFair ? 'verdict-pill-fair' : isAboveMarket ? 'verdict-pill-overpaying' : 'verdict-pill-good';
  const verdictLabel = !hasIncrease
    ? 'No Increase'
    : isFair ? 'At Market'
    : isAboveMarket ? 'Above Market'
    : 'Below Market';

  const city = rentData.city;
  // FIX 3: Avoid double-s in "bedroomss"
  const brLabel = bedroomLabels[formData.bedrooms].toLowerCase();

  const rentBurden = calc?.rentBurden ?? null;
  const currentRentBurden = calc?.currentRentBurden ?? null;
  const isCostBurdened = calc?.isCostBurdened ?? false;
  const breakEvenMonths = calc?.breakEvenMonths ?? Infinity;


  let rowIdx = 0;

  return (
    <div className="max-w-[620px] mx-auto px-6">

      {/* ━━━ 1. VERDICT ━━━ */}
      <motion.div {...fade(0)} className="py-16 text-center border-b border-border">
        {hasIncrease ? (
          <>
            <div className={`verdict-pill ${pillClass} mb-5`}>{verdictLabel}</div>
            <h1 className="font-body text-[32px] font-semibold leading-[1.25] tracking-tight mx-auto max-w-[480px]" style={{ letterSpacing: '-0.02em' }}>
              {isAboveMarket ? (
                marketYoy <= 0
                  ? <>Your increase is <span className={verdictColor}>above the market trend.</span></>
                  : <>Your increase is <span className={verdictColor}>{multiplier}× the market rate.</span></>
              ) : isBelowMarket ? (
                <>Your increase is <span className={verdictColor}>below the market rate.</span></>
              ) : (
                <>Your increase is <span className={verdictColor}>right at market.</span></>
              )}
            </h1>
            <p className="text-lg text-muted-foreground max-w-[440px] mx-auto mt-4 leading-relaxed">
              {marketYoy <= 0 && isAboveMarket ? (
                <>Market rents {marketYoy < 0 ? <><em>decreased</em> {Math.abs(marketYoy)}%</> : 'held flat'} in {city}. An increase of <strong className={`font-bold text-xl ${verdictColor}`}>{increasePct}%</strong> is going against the trend.</>
              ) : isAboveMarket ? (
              <>Rents in {city} rose <strong className="text-foreground font-bold text-xl">{marketYoy}%</strong> this year. Your landlord is raising yours <strong className={`font-bold text-xl ${verdictColor}`}>{increasePct}%</strong>. That's <strong>${fmt(annualExtra)} extra per year.</strong></>
              ) : isFair ? (
                isHighRent
                  ? <>Your increase rate is roughly in line with what rents are doing in {city}. Note: your rent is well above the area median — this assessment is about the rate of increase, not the rent amount.</>
                  : <>Your increase is roughly in line with what rents are doing in {city}. You're not being overcharged.</>
              ) : (
                isHighRent
                  ? <>Rents in {city} rose <strong className="text-foreground font-bold text-xl">{marketYoy}%</strong> and your landlord is only raising yours <strong className={`font-bold text-xl ${verdictColor}`}>{increasePct}%</strong>. Note: your rent is well above the area median — this assessment is about the rate of increase, not the rent amount.</>
                  : <>Rents in {city} rose <strong className="text-foreground font-bold text-xl">{marketYoy}%</strong> and your landlord is only raising yours <strong className={`font-bold text-xl ${verdictColor}`}>{increasePct}%</strong>. This is a fair deal.</>
              )}
            </p>
            <button onClick={onReset} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mt-4">
              ← Check a different address
            </button>
          </>
        ) : (
          <>
            <h1 className="font-body text-[32px] font-semibold text-foreground">No increase entered</h1>
            <p className="text-muted-foreground mt-2">Enter your proposed increase to compare.</p>
          </>
        )}
      </motion.div>

      {/* ━━━ 2. NUMBERS ROW ━━━ */}
      {hasIncrease && (
        <motion.div {...fade(0.05)} className="flex justify-center gap-16 py-14 border-b border-border">
          {[
            { label: 'Your Rent', value: `$${fmt(formData.currentRent)}` },
            { label: 'Proposed', value: `$${fmt(newRent)}`, isProposed: true },
            { label: 'Extra / Year', value: `$${fmt(annualExtra)}` },
          ].map((item) => (
            <div key={item.label} className="text-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{item.label}</p>
              <p className={`font-display text-[36px] md:text-[42px] tracking-tight ${item.isProposed ? 'text-destructive' : 'text-foreground'}`} style={{ letterSpacing: '-0.02em' }}>
                {item.value}
              </p>
            </div>
          ))}
        </motion.div>
      )}

      {/* ━━━ 3. MARKET CONTEXT ━━━ */}
      <motion.div {...fade(0.1)} className="py-12 border-b border-border">
        <h2 className="section-title">{city}, {rentData.state} — {bedroomLabels[formData.bedrooms]}</h2>
        <div className={`context-row ${rowIdx++ % 2 === 0 ? 'context-row-even' : 'context-row-odd'}`}>
          <span className="context-label">{city} rents this year</span>
          <span className="context-value">
            {marketYoy > 0 ? '+' : ''}{marketYoy}% this year
            {rentData.yoyCapped && <span className="context-sub"> (capped — unusually large shift)</span>}
          </span>
        </div>
        {rentData.zillowMonthly !== null && rentData.zillowDirection && (
          <div className={`context-row ${rowIdx++ % 2 === 0 ? 'context-row-even' : 'context-row-odd'}`}>
            <span className="context-label">Monthly trend</span>
            <span className="context-value">
              {rentData.zillowMonthly > 0 ? '+' : ''}{rentData.zillowMonthly}%/mo
              <span className="context-sub">
                {rentData.zillowDirection === 'rising' ? ' ↑ rising' : rentData.zillowDirection === 'falling' ? ' ↓ cooling' : ' → steady'}
              </span>
            </span>
          </div>
        )}
        {calc && (
          <div className={`context-row ${rowIdx++ % 2 === 0 ? 'context-row-even' : 'context-row-odd'}`}>
            <span className="context-label">What most {brLabel} go for</span>
            <span className="context-value">${fmt(calc.typicalRangeLow)} – ${fmt(calc.typicalRangeHigh)}</span>
          </div>
        )}
        {/* FIX 2: Remove "HUD 40th pctl" jargon */}
        <div className={`context-row ${rowIdx++ % 2 === 0 ? 'context-row-even' : 'context-row-odd'}`}>
          <span className="context-label">{city} benchmark</span>
          <span className="context-value">${fmt(rentData.fmr)}</span>
        </div>
        {rentData.censusMedianRent && (
          <div className={`context-row ${rowIdx++ % 2 === 0 ? 'context-row-even' : 'context-row-odd'}`}>
            <span className="context-label">What the typical renter pays</span>
            <span className="context-value">${fmt(rentData.censusMedianRent)}</span>
          </div>
        )}
        {hasIncrease && isAboveMarket && calc && (
          <div className={`context-row ${rowIdx++ % 2 === 0 ? 'context-row-even' : 'context-row-odd'}`}>
            <span className="context-label">Fair counter-offer</span>
            <span className="context-value text-verdict-good font-semibold">${fmt(calc.counterLow)}–${fmt(calc.counterHigh)}/mo</span>
          </div>
        )}
        {/* FIX 4: Tiered rent burden display */}
        {rentBurden && rentBurden <= 50 && (
          <div className={`context-row ${rowIdx++ % 2 === 0 ? 'context-row-even' : 'context-row-odd'}`}>
            <span className="context-label">Rent as % of area median income</span>
            <span className="context-value">
              {currentRentBurden !== null ? (
                <>
                  {currentRentBurden}% → <span className={isCostBurdened ? 'text-verdict-overpaying' : ''}>{rentBurden}%</span>
                </>
              ) : (
                <>{rentBurden}%</>
              )}
              {isCostBurdened && rentBurden <= 40 && <span className="context-sub text-verdict-overpaying ml-1">Above the 30% affordability guideline</span>}
              {rentBurden > 40 && rentBurden <= 50 && <span className="context-sub text-verdict-overpaying ml-1">Well above the 30% affordability guideline</span>}
            </span>
          </div>
        )}
        {rentData.fredTrend && rentData.zillowMonthly === null && (
          <div className={`context-row ${rowIdx++ % 2 === 0 ? 'context-row-even' : 'context-row-odd'}`}>
            <span className="context-label">Monthly trend</span>
            <span className="context-value">
              {rentData.fredTrend.monthlyChange > 0 ? '+' : ''}{rentData.fredTrend.monthlyChange}%/mo
              <span className="context-sub">({rentData.fredTrend.direction})</span>
            </span>
          </div>
        )}
        {/* FIX 4: Severe rent burden callout (50%+) */}
        {rentBurden && rentBurden > 50 && (
          <div className="bg-destructive/10 border-l-[3px] border-destructive px-4 py-3 mt-3 rounded-sm">
            <p className="text-sm font-semibold text-destructive">
              Rent burden: {currentRentBurden !== null ? `${currentRentBurden}% → ` : ''}{rentBurden}% of area median income
            </p>
            <p className="text-[13px] text-destructive/80 mt-1">
              Financial experts recommend spending no more than 30% of income on rent.
            </p>
          </div>
        )}
        <p className="text-[11px] text-muted-foreground mt-3">{rentData.yoySourceLabel}</p>
        {rentData.yoySource === 'hud' && rentData.priorSource === 'm' && (
          <p className="text-[11px] text-muted-foreground mt-1">Based on {rentData.metro} area average trend.</p>
        )}
        {rentData.yoySource === 'hud' && rentData.priorSource === 'n' && (
          <p className="text-[11px] text-muted-foreground mt-1">Note: This uses the national rent trend because local data is limited for this area.</p>
        )}
        {hasIncrease && isAboveMarket && newRent < rentData.fmr && (
          <p className="text-[11px] text-verdict-good mt-3">Your overall rent is reasonable for {city} — it's the rate of increase that's out of line with the market.</p>
        )}
      </motion.div>

      {/* ━━━ 4. NEGOTIATION LETTER ━━━ */}
      {hasIncrease && isAboveMarket && calc && (
        <motion.div {...fade(0.12)} className="py-12 border-b border-border">
          <NegotiationLetter
            currentRent={formData.currentRent}
            newRent={newRent}
            increasePct={increasePct}
            marketYoy={marketYoy}
            fmr={rentData.fmr}
            censusMedian={rentData.censusMedianRent}
            medianIncome={rentData.medianIncome}
            zip={rentData.zip}
            city={rentData.city}
            state={rentData.state}
            bedrooms={formData.bedrooms}
            landlordCosts={landlordCosts}
            landlordInsights={landlordInsights}
            increaseAmount={increaseAmount}
            counterLow={calc.counterLow}
            counterHigh={calc.counterHigh}
            counterLowPercent={calc.counterLowPercent}
            counterHighPercent={calc.counterHighPercent}
          />
        </motion.div>
      )}

      {/* ━━━ 5. YOUR BUILDING (FIX 5: minimized on failure) ━━━ */}
      {hasIncrease && (
        <motion.div {...fade(0.15)} className="py-12 border-b border-border">
          <LandlordCostSection
            propertyData={propertyData}
            propertyLoading={propertyLoading}
            propertyError={propertyError}
            currentRent={formData.currentRent}
            proposedRent={newRent}
            increaseAmount={increaseAmount}
            hasAddress={!!formData.fullAddress}
            onScrollToTop={onScrollToTop}
          />
        </motion.div>
      )}

      {/* ━━━ 6. RENTCAST + COMP LINKS (FIX 4: merged) ━━━ */}
      <motion.div {...fade(0.18)} className="py-12 border-b border-border">
        <RentcastCard
          data={rentcast.data}
          loading={rentcast.loading}
          error={rentcast.error}
          city={city}
          zip={rentData.zip}
          state={rentData.state}
          bedrooms={formData.bedrooms}
          proposedRent={hasIncrease ? newRent : undefined}
        />
        {/* If no Rentcast comps, show full CompLinks as fallback */}
        {!rentcast.loading && !hasRentcastComps && (
          <CompLinks zip={rentData.zip} city={rentData.city} state={rentData.state} bedrooms={formData.bedrooms} />
        )}
      </motion.div>

      {/* ━━━ 7. SHOULD YOU MOVE? ━━━ */}
      {hasIncrease && comparisonRent && newRent > comparisonRent.rent && (() => {
        const monthlySavings = newRent - comparisonRent.rent;
        const annualSavings = monthlySavings * 12;
        const movingCostLow = 1500;
        const movingCostHigh = Math.max(5000, Math.round(newRent * 1.5));
        const breakEvenLow = movingCostLow / monthlySavings;
        const breakEvenHigh = movingCostHigh / monthlySavings;

        const fmtBE = (months: number): string => {
          if (months < 1) {
            const weeks = Math.max(1, Math.round(months * 4.3));
            return `${weeks} week${weeks !== 1 ? 's' : ''}`;
          } else if (months > 18) {
            return `${(months / 12).toFixed(1)} years`;
          }
          return `${Math.round(months)} month${Math.round(months) !== 1 ? 's' : ''}`;
        };

        return (
          <motion.div {...fade(0.21)} className="my-10">
            <div className="callout-box">
              <p className="callout-box-title">Should you move?</p>
              <p className="font-display text-[28px] md:text-[32px] tracking-tight text-foreground font-semibold mt-3" style={{ letterSpacing: '-0.02em' }}>
                ${fmt(monthlySavings)}/mo savings
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                ${fmt(annualSavings)}/yr at the {comparisonRent.label} (${fmt(comparisonRent.rent)}/mo)
              </p>
              <p className="text-[13px] text-muted-foreground/70 mt-3">
                Break-even on moving costs: {fmtBE(breakEvenLow)}–{fmtBE(breakEvenHigh)} depending on your area
              </p>
            </div>
          </motion.div>
        );
      })()}

      {/* ━━━ 8. EMAIL ━━━ */}
      <motion.div {...fade(0.24)} className="py-12 text-center">
        <EmailCapture city={city} />
      </motion.div>

      {/* ━━━ 9. SHARE ━━━ */}
      <motion.div {...fade(0.27)} className="pb-12 text-center">
        <ShareSection
          increasePct={increasePct}
          marketPct={marketYoy}
          excessAnnual={excessAnnual}
          multiplier={multiplier}
          landlordCosts={landlordCosts}
          increaseAmount={increaseAmount}
        />
      </motion.div>
    </div>
  );
};

export default RentResults;
