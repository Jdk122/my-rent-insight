import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { RentFormData } from './RentForm';
import { RentData, getFmrForBedrooms, getTypicalRange, bedroomLabels, calculateBreakEven } from '@/data/rentData';
import ScenarioToggles from './ScenarioToggles';
import ShareSection from './ShareSection';
import EmailCapture from './EmailCapture';
import CompLinks from './CompLinks';
import NegotiationLetter from './NegotiationLetter';
import RentControlCard from './RentControlCard';
import AffordabilityCard from './AffordabilityCard';
import { ArrowLeft, TrendingUp, TrendingDown, Scale, ArrowRight } from 'lucide-react';

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

  const [scenarioNewRent, setScenarioNewRent] = useState<number>(fmr);
  const [scenarioMovingCost, setScenarioMovingCost] = useState<number>(formData.movingCosts);
  const [scenarioNegotiatedPct, setScenarioNegotiatedPct] = useState<number>(increasePct);

  const breakEven = useMemo(() => {
    const negotiatedIncrease = Math.round(formData.currentRent * (scenarioNegotiatedPct / 100));
    const effectiveCurrentRent = formData.currentRent + negotiatedIncrease;
    return calculateBreakEven(effectiveCurrentRent, scenarioNewRent, scenarioMovingCost);
  }, [formData.currentRent, scenarioNewRent, scenarioMovingCost, scenarioNegotiatedPct]);

  const verdictColor = isFair ? 'text-verdict-fair' : isAboveMarket ? 'text-verdict-overpaying' : 'text-verdict-good';
  const pillClass = isFair ? 'verdict-pill-fair' : isAboveMarket ? 'verdict-pill-overpaying' : 'verdict-pill-good';
  const verdictLabel = !hasIncrease
    ? 'No Increase'
    : isFair ? 'Market Rate'
    : isAboveMarket ? 'Above Market'
    : 'Below Market';

  return (
    <div>
      {/* ━━━ VERDICT ━━━ */}
      <motion.div {...fade(0)} className="verdict-hero">
        {hasIncrease ? (
          <>
            <span className={`verdict-pill ${pillClass} mb-5`}>
              {verdictLabel}
            </span>
            <div className="mt-4">
              <p className="font-display text-[clamp(2.8rem,8vw,4.5rem)] leading-[0.9] tracking-tight">
                <span className={verdictColor}>{increasePct}%</span>
                <span className="text-muted-foreground mx-3 text-[0.4em] align-middle">vs</span>
                <span className="text-foreground">{marketYoy}%</span>
              </p>
              <p className="text-xs text-muted-foreground mt-4 tracking-wide uppercase">
                Your Increase vs. Market · {bedroomLabels[formData.bedrooms]} · {rentData.zip}
              </p>
            </div>

            {isAboveMarket && multiplier > 0 && (
            <p className="text-sm mt-6 text-foreground">
                That's <span className={`font-bold ${verdictColor}`}>{multiplier}×</span> the market rate —{' '}
                <span className="font-mono font-bold">${fmt(excessAnnual)}</span> above market per year
              </p>
            )}
            {isBelowMarket && (
            <p className="text-sm mt-6 text-verdict-good">
                Below the local market trend — you're in good shape
              </p>
            )}
          </>
        ) : (
          <>
            <p className="font-display text-2xl md:text-3xl text-foreground">No increase entered</p>
            <p className="text-sm text-muted-foreground mt-2">Enter your proposed increase to compare</p>
          </>
        )}
      </motion.div>

      {/* ━━━ SHARE (inline, minimal) ━━━ */}
      {hasIncrease && isAboveMarket && (
        <motion.div {...fade(0.04)} className="pb-6">
          <ShareSection
            increasePct={increasePct}
            marketPct={marketYoy}
            excessAnnual={excessAnnual}
            multiplier={multiplier}
          />
        </motion.div>
      )}

      {/* ━━━ NUMBERS ━━━ */}
      <motion.div {...fade(0.06)}>
        <div className="report-rule" />
        <div className="report-section">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl text-foreground">The Numbers</h2>
            <span className="data-label">{rentData.city}, {rentData.state}</span>
          </div>

          {hasIncrease && (
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div>
                <p className="data-label mb-1">Current</p>
                <p className="font-mono text-xl font-bold text-foreground">${fmt(formData.currentRent)}</p>
              </div>
              <div>
                <p className="data-label mb-1">Proposed</p>
                <p className={`font-mono text-xl font-bold ${verdictColor}`}>${fmt(newRent)}</p>
              </div>
              <div>
                <p className="data-label mb-1">Extra/Year</p>
                <p className="font-mono text-xl font-bold text-foreground">${fmt(annualExtra)}</p>
              </div>
            </div>
          )}

          <div className="divide-y divide-border">
            <div className="data-row">
              <span className="data-row-label">YoY rent change</span>
              <span className={`data-row-value flex items-center gap-1.5 ${rentData.yoyChange > 0 ? 'text-verdict-overpaying' : 'text-verdict-good'}`}>
                {rentData.yoyChange > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {rentData.yoyChange > 0 ? '+' : ''}{rentData.yoyChange}%
              </span>
            </div>
            <div className="data-row">
              <span className="data-row-label">Typical range</span>
              <span className="data-row-value">${fmt(range.low)} – ${fmt(range.high)}</span>
            </div>
            <div className="data-row">
              <span className="data-row-label">HUD Fair Market Rent</span>
              <span className="data-row-value">${fmt(fmr)}</span>
            </div>
            {rentData.censusMedian && (
              <div className="data-row">
                <span className="data-row-label">Census median</span>
                <span className="data-row-value">${fmt(rentData.censusMedian)}</span>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* ━━━ LEGAL ━━━ */}
      {hasIncrease && (
        <motion.div {...fade(0.09)}>
          <div className="report-rule" />
          <div className="report-section">
            <RentControlCard zip={rentData.zip} increasePct={increasePct} />
          </div>
        </motion.div>
      )}

      {/* ━━━ AFFORDABILITY ━━━ */}
      {hasIncrease && (
        <motion.div {...fade(0.11)}>
          <div className="report-rule" />
          <div className="report-section">
            <AffordabilityCard
              currentRent={formData.currentRent}
              newRent={newRent}
              medianHouseholdIncome={rentData.medianHouseholdIncome}
              zip={rentData.zip}
            />
          </div>
        </motion.div>
      )}

      {/* ━━━ WHAT'S AVAILABLE ━━━ */}
      <motion.div {...fade(0.13)}>
        <div className="report-rule" />
        <div className="report-section">
          <CompLinks
            zip={rentData.zip}
            city={rentData.city}
            state={rentData.state}
            bedrooms={formData.bedrooms}
          />
        </div>
      </motion.div>

      {/* ━━━ DECISION ━━━ */}
      {hasIncrease && (
        <motion.div {...fade(0.15)}>
          <div className="report-rule" />
          <div className="report-section">
            <h2 className="font-display text-xl text-foreground mb-4">Your Move</h2>

            <div className="flex items-baseline gap-3 font-mono text-lg mb-4">
              <span className="text-muted-foreground">${fmt(formData.currentRent)}</span>
              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/50" />
              <span className="font-bold text-foreground">${fmt(newRent)}</span>
              <span className="text-xs text-muted-foreground">+${fmt(increaseAmount)}/mo</span>
            </div>

            <div className="callout">
              <Scale className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
              <div>
              <p className="font-mono text-sm font-semibold text-foreground">
                  Break-even: {breakEven.months === Infinity ? '∞' : breakEven.months.toFixed(1)} months
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {breakEven.verdict === 'move' && `Moving saves ~$${fmt(Math.abs(breakEven.yearOneSavings))} in year 1`}
                  {breakEven.verdict === 'close' && `Close call — depends on your priorities`}
                  {breakEven.verdict === 'stay' && `Staying is likely the smarter move`}
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ━━━ NEGOTIATION LETTER ━━━ */}
      {hasIncrease && isAboveMarket && (
        <motion.div {...fade(0.17)}>
          <div className="report-rule" />
          <div className="report-section">
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
            />
          </div>
        </motion.div>
      )}

      {/* ━━━ SCENARIOS ━━━ */}
      {hasIncrease && (
        <motion.div {...fade(0.19)}>
          <div className="report-rule" />
          <div className="report-section">
            <ScenarioToggles
              currentRent={newRent}
              fmr={fmr}
              scenarioNewRent={scenarioNewRent}
              setScenarioNewRent={setScenarioNewRent}
              scenarioMovingCost={scenarioMovingCost}
              setScenarioMovingCost={setScenarioMovingCost}
              scenarioNegotiatedPct={scenarioNegotiatedPct}
              setScenarioNegotiatedPct={setScenarioNegotiatedPct}
              breakEven={breakEven}
              hasIncrease={hasIncrease}
            />
          </div>
        </motion.div>
      )}

      {/* ━━━ EMAIL ━━━ */}
      <motion.div {...fade(0.21)}>
        <div className="report-rule" />
        <div className="report-section">
          <EmailCapture />
        </div>
      </motion.div>

      {/* ━━━ RESET ━━━ */}
      <div className="report-rule" />
      <div className="text-center py-10">
        <button
          onClick={onReset}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors font-mono"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Check another increase
        </button>
      </div>
    </div>
  );
};

export default RentResults;
