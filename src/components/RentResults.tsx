import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { RentFormData } from './RentForm';
import { RentData, getFmrForBedrooms, getTypicalRange, bedroomLabels, calculateBreakEven } from '@/data/rentData';
import ScenarioToggles from './ScenarioToggles';
import ShareSection from './ShareSection';
import EmailCapture from './EmailCapture';
import CompLinks from './CompLinks';
import NegotiationLetter from './NegotiationLetter';
import AffordabilityCard from './AffordabilityCard';
import { ArrowLeft, TrendingUp, TrendingDown, Scale, FileText } from 'lucide-react';

interface RentResultsProps {
  formData: RentFormData;
  rentData: RentData;
  onReset: () => void;
}

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

const fade = (delay: number) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] as const },
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
  const [showLetter, setShowLetter] = useState(false);

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
    <div className="space-y-16 md:space-y-20">

      {/* ━━━ SECTION 1: Hero Verdict ━━━ */}
      <motion.section {...fade(0)} className="text-center">
        {hasIncrease ? (
          <>
            <span className={`verdict-pill ${pillClass}`}>{verdictLabel}</span>

            <h2 className="font-display text-[clamp(3rem,9vw,5.5rem)] leading-[0.88] tracking-tight mt-6">
              <span className={verdictColor}>{increasePct}%</span>
              <span className="block text-[0.35em] text-muted-foreground font-body font-normal tracking-wide mt-3">
                vs {marketYoy}% market average
              </span>
            </h2>

            <p className="text-sm text-muted-foreground mt-4 max-w-sm mx-auto leading-relaxed">
              {bedroomLabels[formData.bedrooms]} · {rentData.city}, {rentData.state} {rentData.zip}
            </p>

            {isAboveMarket && multiplier > 0 && (
              <p className="text-base mt-6 text-foreground">
                Your increase is <span className={`font-bold ${verdictColor}`}>{multiplier}×</span> the market rate —{' '}
                <span className="font-mono font-bold">${fmt(excessAnnual)}</span> extra per year
              </p>
            )}
            {isBelowMarket && (
              <p className="text-base mt-6 text-verdict-good font-medium">Below market — you're in good shape ✓</p>
            )}
          </>
        ) : (
          <>
            <h2 className="font-display text-3xl text-foreground">No increase entered</h2>
            <p className="text-muted-foreground mt-2">Enter your proposed increase to compare</p>
          </>
        )}
      </motion.section>

      {/* ━━━ SECTION 2: Key Numbers ━━━ */}
      {hasIncrease && (
        <motion.section {...fade(0.08)}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            {[
              { label: 'Current Rent', value: `$${fmt(formData.currentRent)}` },
              { label: 'Proposed Rent', value: `$${fmt(newRent)}`, highlight: true },
              { label: 'Extra Per Year', value: `$${fmt(annualExtra)}` },
              { label: 'Break-even', value: breakEven.months === Infinity ? '—' : `${breakEven.months.toFixed(0)} mo` },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="data-label mb-2">{stat.label}</p>
                <p className={`font-mono text-2xl md:text-3xl font-bold tracking-tight ${stat.highlight ? verdictColor : 'text-foreground'}`}>
                  {stat.value}
                </p>
              </div>
            ))}
          </div>
        </motion.section>
      )}

      {/* ━━━ SECTION 3: Negotiate CTA ━━━ */}
      {hasIncrease && isAboveMarket && (
        <motion.section {...fade(0.12)}>
          {!showLetter ? (
            <button
              onClick={() => setShowLetter(true)}
              className="w-full text-left rounded-2xl p-8 md:p-10 border-2 border-primary/20 bg-primary/[0.03] hover:border-primary/40 hover:bg-primary/[0.06] transition-all group"
            >
              <div className="flex items-start gap-5">
                <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-primary/10 shrink-0">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-display text-2xl text-foreground mb-1.5 group-hover:text-primary transition-colors">
                    Generate Your Negotiation Letter
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Pre-written with your data, backed by HUD and Census numbers. Customize the tone, set your counter-offer, and send it to your landlord.
                  </p>
                </div>
              </div>
            </button>
          ) : (
            <div className="rounded-2xl border border-border p-6 md:p-8">
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
          )}
        </motion.section>
      )}

      {/* ━━━ SECTION 4: Share ━━━ */}
      {hasIncrease && isAboveMarket && (
        <motion.section {...fade(0.14)}>
          <ShareSection
            increasePct={increasePct}
            marketPct={marketYoy}
            excessAnnual={excessAnnual}
            multiplier={multiplier}
          />
        </motion.section>
      )}

      {/* ━━━ SECTION 5: Market Data ━━━ */}
      <motion.section {...fade(0.16)}>
        <h2 className="font-display text-2xl md:text-3xl text-foreground mb-2">Market Data</h2>
        <p className="text-muted-foreground mb-8">
          Federal benchmarks for {bedroomLabels[formData.bedrooms]} in {rentData.zip}
        </p>

        <div className="divide-y divide-border">
          <div className="data-row py-4">
            <span className="data-row-label">YoY rent change</span>
            <span className={`data-row-value flex items-center gap-1.5 ${rentData.yoyChange > 0 ? 'text-verdict-overpaying' : 'text-verdict-good'}`}>
              {rentData.yoyChange > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              {rentData.yoyChange > 0 ? '+' : ''}{rentData.yoyChange}%
            </span>
          </div>
          <div className="data-row py-4">
            <span className="data-row-label">Typical range</span>
            <span className="data-row-value">${fmt(range.low)} – ${fmt(range.high)}</span>
          </div>
          <div className="data-row py-4">
            <span className="data-row-label">HUD Fair Market Rent</span>
            <span className="data-row-value">${fmt(fmr)}</span>
          </div>
          {rentData.censusMedian && (
            <div className="data-row py-4">
              <span className="data-row-label">Census median</span>
              <span className="data-row-value">${fmt(rentData.censusMedian)}</span>
            </div>
          )}
          {hasIncrease && (
            <div className="data-row py-4">
              <span className="data-row-label">Your increase</span>
              <span className="data-row-value">
                +{increasePct}%{' '}
                <span className="text-muted-foreground font-normal text-xs ml-1">(+${fmt(increaseAmount)}/mo)</span>
              </span>
            </div>
          )}
        </div>

        {hasIncrease && (
          <div className="callout mt-6">
            <Scale className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <p className="font-mono text-sm font-semibold text-foreground">
                Break-even: {breakEven.months === Infinity ? '∞' : breakEven.months.toFixed(1)} months
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {breakEven.verdict === 'move' && `Moving saves ~$${fmt(Math.abs(breakEven.yearOneSavings))} in year 1`}
                {breakEven.verdict === 'close' && `Close call — depends on your priorities`}
                {breakEven.verdict === 'stay' && `Staying is likely the smarter move`}
              </p>
            </div>
          </div>
        )}
      </motion.section>

      {/* ━━━ SECTION 6: What If ━━━ */}
      {hasIncrease && (
        <motion.section {...fade(0.2)}>
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
        </motion.section>
      )}

      {/* ━━━ SECTION 7: Affordability ━━━ */}
      {hasIncrease && (
        <motion.section {...fade(0.24)}>
          <AffordabilityCard
            currentRent={formData.currentRent}
            newRent={newRent}
            medianHouseholdIncome={rentData.medianHouseholdIncome}
            zip={rentData.zip}
          />
        </motion.section>
      )}

      {/* ━━━ SECTION 8: Comps ━━━ */}
      <motion.section {...fade(0.28)} id="comps-section">
        <CompLinks
          zip={rentData.zip}
          city={rentData.city}
          state={rentData.state}
          bedrooms={formData.bedrooms}
        />
      </motion.section>

      {/* ━━━ SECTION 9: Email ━━━ */}
      <motion.section {...fade(0.3)}>
        <EmailCapture />
      </motion.section>

      {/* ━━━ Back ━━━ */}
      <div className="text-center pb-8">
        <button
          onClick={onReset}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Check another increase
        </button>
      </div>
    </div>
  );
};

export default RentResults;
