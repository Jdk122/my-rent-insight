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
import LandlordCostLookup from './LandlordCostLookup';
import { LandlordCostEstimate } from '@/data/landlordCosts';
import { ArrowLeft, TrendingUp, TrendingDown } from 'lucide-react';

interface RentResultsProps {
  formData: RentFormData;
  rentData: RentData;
  onReset: () => void;
}

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

const fade = (delay: number) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] as const },
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
  const [landlordCosts, setLandlordCosts] = useState<LandlordCostEstimate | null>(null);

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

  const city = rentData.city;
  const brLabel = bedroomLabels[formData.bedrooms];
  const brPlural = formData.bedrooms === 'studio' ? 'studios'
    : formData.bedrooms === 'oneBr' ? '1-bedrooms'
    : formData.bedrooms === 'twoBr' ? '2-bedrooms'
    : formData.bedrooms === 'threeBr' ? '3-bedrooms'
    : '4-bedrooms';

  return (
    <div className="px-6 md:px-12 lg:px-20">
      <div className="max-w-[620px] mx-auto">

        {/* ━━━ VERDICT ━━━ */}
        <motion.div {...fade(0)} className="pt-14 md:pt-24 pb-12">
          {hasIncrease ? (
            <>
              <span className="text-xs font-mono text-muted-foreground tracking-wide">
                {brLabel} · {city}, {rentData.state} {rentData.zip}
              </span>

              <h2 className="font-display text-[clamp(2.5rem,7vw,4.5rem)] leading-[0.9] tracking-tight mt-4">
                Your landlord wants <span className={verdictColor}>{increasePct}%.</span>
                <br />
                <span className="text-muted-foreground/60">The market moved {marketYoy}%.</span>
              </h2>

              <div className="flex items-center gap-2.5 mt-5">
                <span className={`verdict-pill ${pillClass}`}>{verdictLabel}</span>
              </div>

              <p className="text-muted-foreground text-base leading-relaxed mt-6">
                {isAboveMarket && multiplier > 0 && (
                  <>That's <span className={`font-semibold ${verdictColor}`}>{multiplier}× the local rate</span>. You'd pay <span className="font-mono font-semibold text-foreground">${fmt(excessAnnual)}</span> more per year than someone whose landlord matched the market.</>
                )}
                {isFair && <>Your increase is roughly in line with what rents are doing in {city}. You're not being overcharged.</>}
                {isBelowMarket && <>Your increase is actually below what the market did this year. That's a good deal — your landlord is being fair.</>}
              </p>

              {/* Key numbers — plain, inline */}
              <div className="mt-10 space-y-0">
                {[
                  { label: 'What you pay now', value: `$${fmt(formData.currentRent)}/mo` },
                  { label: 'What they want', value: `$${fmt(newRent)}/mo`, highlight: true },
                  { label: 'That adds up to', value: `$${fmt(annualExtra)} more per year` },
                ].map((row, i) => (
                  <div key={row.label} className={`flex items-baseline justify-between py-3 ${i > 0 ? 'border-t border-border/50' : ''}`}>
                    <span className="text-sm text-muted-foreground">{row.label}</span>
                    <span className={`font-mono text-sm font-semibold tabular-nums ${row.highlight ? verdictColor : 'text-foreground'}`}>
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <h2 className="font-display text-3xl md:text-4xl text-foreground">No increase entered</h2>
              <p className="text-muted-foreground mt-2">Enter your proposed increase to compare.</p>
            </>
          )}
        </motion.div>

        <div className="h-px bg-border" />

        {/* ━━━ WHAT YOUR MARKET LOOKS LIKE ━━━ */}
        <motion.div {...fade(0.08)} className="py-12">
          <h3 className="font-display text-2xl text-foreground mb-1">
            What {city} actually looks like
          </h3>
          <p className="text-sm text-muted-foreground mb-8">
            Here's how your numbers compare to real market data.
          </p>

          <div className="space-y-0">
            {[
              { label: `How fast rents are rising`, value: `${rentData.yoyChange > 0 ? '+' : ''}${rentData.yoyChange}% this year`, trending: true },
              { label: `What most ${brPlural} go for`, value: `$${fmt(range.low)} – $${fmt(range.high)}` },
              { label: `Federal benchmark for a ${brLabel.toLowerCase()}`, value: `$${fmt(fmr)}/mo` },
              ...(rentData.censusMedian ? [{ label: `What the typical renter pays`, value: `$${fmt(rentData.censusMedian)}/mo` }] : []),
              ...(hasIncrease ? [{ label: 'What your landlord wants', value: `$${fmt(newRent)}/mo`, isProposed: true }] : []),
            ].map((row: any, i: number) => (
              <div key={row.label} className={`flex items-baseline justify-between py-3.5 ${i > 0 ? 'border-t border-border/50' : ''}`}>
                <span className="text-sm text-muted-foreground">{row.label}</span>
                <span className={`font-mono text-sm font-semibold tabular-nums flex items-center gap-1.5 ${
                  row.trending ? (rentData.yoyChange > 0 ? 'text-verdict-overpaying' : 'text-verdict-good')
                    : row.isProposed ? verdictColor
                      : 'text-foreground'
                }`}>
                  {row.trending && (rentData.yoyChange > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />)}
                  {row.value}
                </span>
              </div>
            ))}
          </div>

          {hasIncrease && breakEven.verdict && (
            <p className="text-sm text-muted-foreground mt-8 leading-relaxed">
              <span className="font-semibold text-foreground">
                {breakEven.months === Infinity ? 'Moving would cost more than staying.' : `If you moved, it'd take ${breakEven.months.toFixed(0)} months to break even.`}
              </span>
              {' '}
              {breakEven.verdict === 'move' && `After that, you'd save about $${fmt(Math.abs(breakEven.yearOneSavings))} in the first year.`}
              {breakEven.verdict === 'close' && `It's close — depends on how much you like the place.`}
              {breakEven.verdict === 'stay' && `Staying put is probably the smarter financial move.`}
            </p>
          )}
        </motion.div>

        <div className="h-px bg-border" />

        {/* ━━━ NEGOTIATION LETTER (inline, always visible if above market) ━━━ */}
        {hasIncrease && isAboveMarket && (
          <motion.div {...fade(0.12)} className="py-12">
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

            <div className="mt-10">
              <ShareSection
                increasePct={increasePct}
                marketPct={marketYoy}
                excessAnnual={excessAnnual}
                multiplier={multiplier}
                landlordCosts={landlordCosts}
                increaseAmount={increaseAmount}
              />
            </div>
          </motion.div>
        )}

        <div className="h-px bg-border" />

        {/* ━━━ WHAT IF ━━━ */}
        {hasIncrease && (
          <motion.div {...fade(0.15)} className="py-12">
            <h3 className="font-display text-2xl text-foreground mb-2">
              What are your options?
            </h3>
            <p className="text-sm text-muted-foreground mb-8">
              Play with the numbers. See if moving makes sense, or what a counter-offer would save you.
            </p>

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

            <div className="mt-12">
              <AffordabilityCard
                currentRent={formData.currentRent}
                newRent={newRent}
                medianHouseholdIncome={rentData.medianHouseholdIncome}
                zip={rentData.zip}
                city={city}
              />
            </div>
          </motion.div>
        )}

        <div className="h-px bg-border" />

        {/* ━━━ LANDLORD COST LOOKUP ━━━ */}
        {hasIncrease && (
          <motion.div {...fade(0.18)} className="py-12">
            <LandlordCostLookup
              rentData={rentData}
              bedrooms={formData.bedrooms}
              currentRent={formData.currentRent}
              increaseAmount={increaseAmount}
              onCostData={setLandlordCosts}
            />
          </motion.div>
        )}

        <div className="h-px bg-border" />

        {/* ━━━ COMPS ━━━ */}
        <motion.div {...fade(0.2)} className="py-12">
          <CompLinks
            zip={rentData.zip}
            city={rentData.city}
            state={rentData.state}
            bedrooms={formData.bedrooms}
          />
        </motion.div>

        <div className="h-px bg-border" />

        {/* ━━━ EMAIL ━━━ */}
        <motion.div {...fade(0.22)} className="py-12 text-center">
          <div className="max-w-sm mx-auto">
            <EmailCapture />
          </div>
        </motion.div>

        {/* ━━━ BACK ━━━ */}
        <div className="pb-14 pt-2 text-center">
          <button
            onClick={onReset}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Check another increase
          </button>
        </div>

      </div>
    </div>
  );
};

export default RentResults;
