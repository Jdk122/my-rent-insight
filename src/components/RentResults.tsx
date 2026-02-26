import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { RentFormData } from './RentForm';
import { RentData, getFmrForBedrooms, getTypicalRange, bedroomLabels, calculateBreakEven } from '@/data/rentData';
import ShareSection from './ShareSection';
import EmailCapture from './EmailCapture';
import CompLinks from './CompLinks';
import NegotiationLetter from './NegotiationLetter';
import LandlordCostLookup from './LandlordCostLookup';
import { LandlordCostEstimate } from '@/data/landlordCosts';

interface RentResultsProps {
  formData: RentFormData;
  rentData: RentData;
  onReset: () => void;
}

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

const fade = (delay: number) => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] as const },
});

const RentResults = ({ formData, rentData, onReset }: RentResultsProps) => {
  const fmr = getFmrForBedrooms(rentData, formData.bedrooms);
  const range = getTypicalRange(rentData, formData.bedrooms);
  const marketYoy = rentData.yoyChange;

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

  const newRent = formData.currentRent + increaseAmount;
  const annualExtra = increaseAmount * 12;
  const increaseVsMarket = increasePct - marketYoy;
  const multiplier = marketYoy > 0 ? Math.round((increasePct / marketYoy) * 10) / 10 : 0;
  const excessAnnual = Math.round((formData.currentRent * (increaseVsMarket / 100)) * 12);

  const hasIncrease = increaseAmount > 0;
  const isAboveMarket = increaseVsMarket > 1;
  const isFair = Math.abs(increaseVsMarket) <= 1;
  const isBelowMarket = increaseVsMarket < -1;

  const [landlordCosts, setLandlordCosts] = useState<LandlordCostEstimate | null>(null);

  const breakEven = useMemo(() => {
    return calculateBreakEven(newRent, fmr, formData.movingCosts);
  }, [newRent, fmr, formData.movingCosts]);

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
  const monthlyIncome = rentData.medianHouseholdIncome ? rentData.medianHouseholdIncome / 12 : null;
  const rentBurden = monthlyIncome ? Math.round((newRent / monthlyIncome) * 100) : null;
  const isCostBurdened = rentBurden ? rentBurden > 30 : false;

  return (
    <div className="max-w-[620px] mx-auto px-6">

      {/* ━━━ VERDICT ━━━ */}
      <motion.div {...fade(0)} className="py-14 text-center border-b border-border">
        {hasIncrease ? (
          <>
            <div className={`verdict-pill ${pillClass} mb-5 text-sm px-5 py-2`}>{verdictLabel}</div>

            <h1 className="font-display text-[32px] font-bold leading-[1.25] tracking-tight mx-auto max-w-[480px]" style={{ letterSpacing: '-0.02em' }}>
              {isAboveMarket ? (
                <>Your increase is <span className={verdictColor}>{multiplier}× the market rate.</span></>
              ) : isBelowMarket ? (
                <>Your increase is <span className={verdictColor}>below the market rate.</span></>
              ) : (
                <>Your increase is <span className={verdictColor}>right at market.</span></>
              )}
            </h1>

            <p className="text-base text-muted-foreground max-w-[440px] mx-auto mt-4 leading-relaxed">
              Rents in <strong className="text-foreground font-semibold">{city}, {rentData.state}</strong> rose <strong className="text-foreground font-semibold">{marketYoy}%</strong> this year.
              Your landlord is raising yours <strong className="text-foreground font-semibold">{increasePct}%</strong>.
              {isAboveMarket && <> That's <strong className="text-foreground font-semibold">${fmt(excessAnnual)}/year more</strong> than the typical increase in your area.</>}
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
        <motion.div {...fade(0.05)} className="flex justify-center gap-12 py-9 border-b border-border">
          {[
            { label: 'Your Rent', value: `$${fmt(formData.currentRent)}` },
            { label: 'Proposed', value: `$${fmt(newRent)}`, color: verdictColor },
            { label: 'Extra / Year', value: `$${fmt(annualExtra)}` },
          ].map((item) => (
            <div key={item.label} className="text-center">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">{item.label}</p>
              <p className={`font-display text-[28px] font-bold tracking-tight ${item.color || 'text-foreground'}`} style={{ letterSpacing: '-0.02em' }}>
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
          <span className="context-label">How fast rents are rising</span>
          <span className="context-value">{rentData.yoyChange > 0 ? '+' : ''}{rentData.yoyChange}% / year</span>
        </div>
        <div className="context-row">
          <span className="context-label">What most {brLabel.toLowerCase()}s go for</span>
          <span className="context-value">${fmt(range.low)} – ${fmt(range.high)}</span>
        </div>
        <div className="context-row">
          <span className="context-label">{city} benchmark</span>
          <span className="context-value">${fmt(fmr)} <span className="context-sub">HUD 40th pctl</span></span>
        </div>
        {rentData.censusMedian && (
          <div className="context-row">
            <span className="context-label">{city} median rent</span>
            <span className="context-value">${fmt(rentData.censusMedian)}</span>
          </div>
        )}
        {hasIncrease && (
          <div className="context-row">
            <span className="context-label">Your increase</span>
            <span className={`context-value ${verdictColor}`}>+{increasePct}% <span className="context-sub">+${fmt(increaseAmount)}/mo</span></span>
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
      </motion.div>

      {/* ━━━ BREAK-EVEN CALLOUT ━━━ */}
      {hasIncrease && (
        <motion.div {...fade(0.13)} className="my-8">
          <div className="callout-box">
            <p className="callout-box-title">Should you move?</p>
            <p className="callout-box-body">
              If moving costs ${fmt(formData.movingCosts)} and you find a place for ${fmt(Math.abs(newRent - fmr))}/month less,
              you break even in <strong className="text-foreground font-semibold">
                {breakEven.months === Infinity ? 'never — staying is cheaper' : `${breakEven.months.toFixed(1)} months`}
              </strong>.
              {breakEven.verdict === 'move' && ` After that, you'd save about $${fmt(Math.abs(breakEven.yearOneSavings))} in year one.`}
              {breakEven.verdict === 'stay' && ` Staying put is probably the smarter financial move.`}
              {breakEven.verdict === 'close' && ` It's close — depends on how much you value staying.`}
            </p>
          </div>
        </motion.div>
      )}

      {/* ━━━ NEGOTIATION LETTER ━━━ */}
      {hasIncrease && isAboveMarket && (
        <motion.div {...fade(0.16)} className="py-9 border-b border-border">
          <NegotiationLetter
            currentRent={formData.currentRent}
            newRent={newRent}
            increasePct={increasePct}
            marketYoy={marketYoy}
            fmr={fmr}
            censusMedian={rentData.censusMedian}
            medianHouseholdIncome={rentData.medianHouseholdIncome}
            zip={rentData.zip}
            city={rentData.city}
            state={rentData.state}
            bedrooms={formData.bedrooms}
            landlordCosts={landlordCosts}
            increaseAmount={increaseAmount}
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
