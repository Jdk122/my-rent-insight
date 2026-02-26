import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { RentFormData } from './RentForm';
import { RentLookupResult, bedroomLabels, calculateResults } from '@/data/rentData';
import ShareSection from './ShareSection';
import EmailCapture from './EmailCapture';
import CompLinks from './CompLinks';
import NegotiationLetter from './NegotiationLetter';
import LandlordCostLookup from './LandlordCostLookup';
import { LandlordCostEstimate } from '@/data/landlordCosts';

interface RentResultsProps {
  formData: RentFormData;
  rentData: RentLookupResult;
  onReset: () => void;
}

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

const fade = (delay: number) => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] as const },
});

const RentResults = ({ formData, rentData, onReset }: RentResultsProps) => {
  // Compute increase amounts
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

  // Use the new calculation engine
  const calc = useMemo(() => {
    if (!hasIncrease) return null;
    return calculateResults(
      formData.currentRent,
      increasePct,
      formData.movingCosts,
      rentData
    );
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

  const [landlordCosts, setLandlordCosts] = useState<LandlordCostEstimate | null>(null);

  const verdictColor = isFair ? 'text-verdict-fair' : isAboveMarket ? 'text-verdict-overpaying' : 'text-verdict-good';
  const pillClass = isFair ? 'verdict-pill-fair' : isAboveMarket ? 'verdict-pill-overpaying' : 'verdict-pill-good';
  const verdictLabel = !hasIncrease
    ? 'No Increase'
    : isFair ? 'At Market'
    : isAboveMarket ? 'Above Market'
    : 'Below Market';

  const city = rentData.city;
  const brLabel = bedroomLabels[formData.bedrooms];

  // Affordability
  const rentBurden = calc?.rentBurden ?? null;
  const isCostBurdened = calc?.isCostBurdened ?? false;

  // Break-even
  const breakEvenMonths = calc?.breakEvenMonths ?? Infinity;

  return (
    <div className="max-w-[620px] mx-auto px-6">

      {/* ━━━ VERDICT ━━━ */}
      <motion.div {...fade(0)} className="py-14 text-center border-b border-border">
        {hasIncrease ? (
          <>
            <div className={`verdict-pill ${pillClass} mb-5 text-sm px-5 py-2`}>{verdictLabel}</div>

            <h1 className="font-display text-[32px] font-bold leading-[1.25] tracking-tight mx-auto max-w-[480px]" style={{ letterSpacing: '-0.02em' }}>
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
                <>Your increase is roughly in line with what rents are doing in {city}. You're not being overcharged.</>
              ) : (
                <>Rents in {city} rose <strong className="text-foreground font-bold text-xl">{marketYoy}%</strong> and your landlord is only raising yours <strong className={`font-bold text-xl ${verdictColor}`}>{increasePct}%</strong>. This is a fair deal.</>
              )}
            </p>

            <button onClick={onReset} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mt-4">
              ← Check a different address
            </button>
          </>
        ) : (
          <>
            <h1 className="font-display text-[32px] font-bold text-foreground">No increase entered</h1>
            <p className="text-muted-foreground mt-2">Enter your proposed increase to compare.</p>
          </>
        )}
      </motion.div>

      {/* ━━━ NUMBERS ROW ━━━ */}
      {hasIncrease && (
        <motion.div {...fade(0.05)} className="flex justify-center gap-16 py-12 border-b border-border">
          {[
            { label: 'Your Rent', value: `$${fmt(formData.currentRent)}` },
            { label: 'Proposed', value: `$${fmt(newRent)}`, color: verdictColor },
            { label: 'Extra / Year', value: `$${fmt(annualExtra)}` },
          ].map((item) => (
            <div key={item.label} className="text-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{item.label}</p>
              <p className={`font-display text-[36px] md:text-[42px] tracking-tight ${item.color || 'text-foreground'}`} style={{ letterSpacing: '-0.02em' }}>
                {item.value}
              </p>
            </div>
          ))}
        </motion.div>
      )}

      {/* ━━━ MARKET CONTEXT ━━━ */}
      <motion.div {...fade(0.1)} className="py-9 border-b border-border">
        <h2 className="section-title">{city}, {rentData.state} — {brLabel}</h2>

        <div className="context-row">
          <span className="context-label">{city} rents this year</span>
          <span className="context-value">
            {marketYoy > 0 ? '+' : ''}{marketYoy}% this year
            {rentData.yoyCapped && <span className="context-sub"> (capped — unusually large shift)</span>}
          </span>
        </div>
        {rentData.zillowMonthly !== null && rentData.zillowDirection && (
          <div className="context-row">
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
          <div className="context-row">
            <span className="context-label">What most {brLabel.toLowerCase()}s go for</span>
            <span className="context-value">${fmt(calc.typicalRangeLow)} – ${fmt(calc.typicalRangeHigh)}</span>
          </div>
        )}
        <div className="context-row">
          <span className="context-label">{city} benchmark</span>
          <span className="context-value">${fmt(rentData.fmr)} <span className="context-sub">HUD 40th pctl</span></span>
        </div>
        {rentData.censusMedianRent && (
          <div className="context-row">
            <span className="context-label">What the typical renter pays</span>
            <span className="context-value">${fmt(rentData.censusMedianRent)}</span>
          </div>
        )}
        {hasIncrease && isAboveMarket && calc && (
          <div className="context-row">
            <span className="context-label">Fair counter-offer</span>
            <span className="context-value text-verdict-good font-semibold">${fmt(calc.counterLow)}–${fmt(calc.counterHigh)}/mo</span>
          </div>
        )}
        {rentBurden && (
          <div className="context-row">
            <span className="context-label">Rent as % of area median income</span>
            <span className="context-value">
              {rentBurden}%
              {isCostBurdened && <span className="context-sub text-verdict-overpaying">cost-burdened</span>}
            </span>
          </div>
        )}
        {/* FRED trend (only show if no Zillow monthly — avoids duplication) */}
        {rentData.fredTrend && rentData.zillowMonthly === null && (
          <div className="context-row">
            <span className="context-label">Monthly trend</span>
            <span className="context-value">
              {rentData.fredTrend.monthlyChange > 0 ? '+' : ''}{rentData.fredTrend.monthlyChange}%/mo
              <span className="context-sub">({rentData.fredTrend.direction})</span>
            </span>
          </div>
        )}

        {/* Source attribution */}
        <p className="text-[11px] text-muted-foreground mt-3">{rentData.yoySourceLabel}</p>

        {/* Prior source note */}
        {rentData.yoySource === 'hud' && rentData.priorSource === 'm' && (
          <p className="text-[11px] text-muted-foreground mt-1">Based on {rentData.metro} area average trend.</p>
        )}
        {rentData.yoySource === 'hud' && rentData.priorSource === 'n' && (
          <p className="text-[11px] text-muted-foreground mt-1">Note: This uses the national rent trend because local data is limited for this area.</p>
        )}

        {/* Below FMR note — rent is reasonable, increase rate is the issue */}
        {hasIncrease && isAboveMarket && newRent < rentData.fmr && (
          <p className="text-[11px] text-verdict-good mt-3">Your overall rent is reasonable for {city} — it's the rate of increase that's out of line with the market.</p>
        )}
      </motion.div>

      {/* ━━━ BREAK-EVEN CALLOUT ━━━ */}
      {hasIncrease && (
        <motion.div {...fade(0.13)} className="my-8">
          <div className="callout-box">
            <p className="callout-box-title">Should you move?</p>
            <p className="callout-box-body">
              If moving costs ${fmt(formData.movingCosts)} and you find a place at the benchmark (${fmt(rentData.censusMedianRent || rentData.fmr)}/mo),
              you break even in <strong className="text-foreground font-semibold">
                {breakEvenMonths === Infinity ? 'never — staying is cheaper' : `${breakEvenMonths.toFixed(1)} months`}
              </strong>.
            </p>
          </div>
        </motion.div>
      )}

      {/* ━━━ NEGOTIATION LETTER ━━━ */}
      {hasIncrease && isAboveMarket && calc && (
        <motion.div {...fade(0.16)} className="py-9 border-b border-border">
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
            increaseAmount={increaseAmount}
            counterLow={calc.counterLow}
            counterHigh={calc.counterHigh}
            counterLowPercent={calc.counterLowPercent}
            counterHighPercent={calc.counterHighPercent}
          />
        </motion.div>
      )}

      {/* ━━━ LANDLORD COST LOOKUP ━━━ */}
      {hasIncrease && (
        <motion.div {...fade(0.19)} className="py-12 border-b border-border text-center">
          <LandlordCostLookup
            rentData={rentData}
            bedrooms={formData.bedrooms}
            currentRent={formData.currentRent}
            increaseAmount={increaseAmount}
            onCostData={setLandlordCosts}
          />
        </motion.div>
      )}

      {/* ━━━ COMPS ━━━ */}
      <motion.div {...fade(0.22)} className="py-9 border-b border-border">
        <CompLinks
          zip={rentData.zip}
          city={rentData.city}
          state={rentData.state}
          bedrooms={formData.bedrooms}
        />
      </motion.div>

      {/* ━━━ EMAIL ━━━ */}
      <motion.div {...fade(0.25)} className="py-12 text-center">
        <EmailCapture city={city} />
      </motion.div>

      {/* ━━━ SHARE ━━━ */}
      <motion.div {...fade(0.28)} className="pb-12 text-center">
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
