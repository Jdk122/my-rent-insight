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
import { ArrowLeft, TrendingUp, TrendingDown, FileText, ChevronRight } from 'lucide-react';

interface RentResultsProps {
  formData: RentFormData;
  rentData: RentData;
  onReset: () => void;
}

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

const fade = (delay: number) => ({
  initial: { opacity: 0, y: 16 },
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
      <div className="max-w-3xl">

        {/* ━━━ VERDICT ━━━ */}
        <motion.div {...fade(0)} className="pt-12 md:pt-20 pb-10 md:pb-14">
          {hasIncrease ? (
            <>
              <span className="text-xs font-mono text-muted-foreground tracking-wide">
                {brLabel} · {city}, {rentData.state} {rentData.zip}
              </span>

              <h2 className="font-display text-[clamp(3rem,8vw,5.5rem)] leading-[0.88] tracking-tight mt-3">
                <span className={verdictColor}>{increasePct}%</span>
                <span className="text-muted-foreground text-[0.28em] font-body font-normal mx-3 align-middle">vs</span>
                <span className="text-foreground">{marketYoy}%</span>
              </h2>

              <p className="text-muted-foreground text-base md:text-lg leading-relaxed mt-4 max-w-lg">
                Rents in {city} rose {marketYoy}% this year. Your landlord is asking for {increasePct}%.
                {isAboveMarket && multiplier > 0 && (
                  <> That's <span className={`font-semibold ${verdictColor}`}>{multiplier}×</span> the local rate — <span className="font-mono font-semibold text-foreground">${fmt(excessAnnual)}</span> extra per year.</>
                )}
                {isBelowMarket && <> That's below the local average — you're in good shape.</>}
              </p>

              <div className="flex items-center gap-2.5 mt-5">
                <span className={`verdict-pill ${pillClass}`}>{verdictLabel}</span>
              </div>

              {/* Key figures — open, no box */}
              <div className="flex flex-wrap gap-x-10 gap-y-4 mt-10">
                {[
                  { label: 'Current rent', value: `$${fmt(formData.currentRent)}` },
                  { label: 'Proposed rent', value: `$${fmt(newRent)}`, highlight: true },
                  { label: 'Extra per year', value: `$${fmt(annualExtra)}` },
                  { label: 'Break-even if you move', value: breakEven.months === Infinity ? 'n/a' : `${breakEven.months.toFixed(0)} months` },
                ].map((s) => (
                  <div key={s.label}>
                    <p className="text-[11px] text-muted-foreground tracking-wide mb-0.5">{s.label}</p>
                    <p className={`font-mono text-xl md:text-2xl font-bold tracking-tight ${s.highlight ? verdictColor : 'text-foreground'}`}>
                      {s.value}
                    </p>
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

        {/* thin rule */}
        <div className="h-px bg-border" />

        {/* ━━━ TAKE ACTION ━━━ */}
        {hasIncrease && isAboveMarket && (
          <motion.div {...fade(0.06)} className="py-10 md:py-14">
            {!showLetter ? (
              <div className="space-y-8">
                <button
                  onClick={() => setShowLetter(true)}
                  className="w-full text-left group flex items-center gap-4"
                >
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/8 shrink-0 group-hover:bg-primary/12 transition-colors">
                    <FileText className="w-[18px] h-[18px] text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display text-lg md:text-xl text-foreground group-hover:text-primary transition-colors">
                      Push back with {city} data
                    </p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      We'll draft a negotiation letter with your counter-offer
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
                </button>

                <ShareSection
                  increasePct={increasePct}
                  marketPct={marketYoy}
                  excessAnnual={excessAnnual}
                  multiplier={multiplier}
                  landlordCosts={landlordCosts}
                  increaseAmount={increaseAmount}
                />
              </div>
            ) : (
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
            )}
          </motion.div>
        )}

        <div className="h-px bg-border" />

        {/* ━━━ MARKET CONTEXT ━━━ */}
        <motion.div {...fade(0.1)} className="py-10 md:py-14">
          <h3 className="font-display text-2xl md:text-3xl text-foreground mb-1">
            Rents in {city}
          </h3>
          <p className="text-sm text-muted-foreground mb-8">
            What {brPlural} actually cost near {rentData.zip}
          </p>

          <div className="space-y-0">
            {[
              { label: `${city} rent trend`, value: `${rentData.yoyChange > 0 ? '+' : ''}${rentData.yoyChange}%`, trending: true },
              { label: `Typical ${brPlural}`, value: `$${fmt(range.low)} – $${fmt(range.high)}` },
              { label: `${brLabel} benchmark`, value: `$${fmt(fmr)}` },
              ...(rentData.censusMedian ? [{ label: `Median rent`, value: `$${fmt(rentData.censusMedian)}` }] : []),
              ...(hasIncrease ? [{ label: 'Your proposed increase', value: `+${increasePct}%`, extra: `+$${fmt(increaseAmount)}/mo` }] : []),
            ].map((row: any, i: number) => (
              <div key={row.label} className={`flex items-center justify-between py-3.5 ${i > 0 ? 'border-t border-border/60' : ''}`}>
                <span className="text-[13px] text-muted-foreground">{row.label}</span>
                <span className={`font-mono text-[13px] font-semibold tabular-nums flex items-center gap-1.5 ${
                  row.trending ? (rentData.yoyChange > 0 ? 'text-verdict-overpaying' : 'text-verdict-good') : 'text-foreground'
                }`}>
                  {row.trending && (rentData.yoyChange > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />)}
                  {row.value}
                  {row.extra && <span className="text-muted-foreground font-normal text-[11px] ml-1.5">({row.extra})</span>}
                </span>
              </div>
            ))}
          </div>

          {hasIncrease && breakEven.verdict && (
            <p className="text-sm text-muted-foreground mt-6 leading-relaxed">
              <span className="font-mono font-bold text-foreground">
                {breakEven.months === Infinity ? 'No break-even' : `${breakEven.months.toFixed(0)}-month break-even`}
              </span>
              {' — '}
              {breakEven.verdict === 'move' && `moving saves ~$${fmt(Math.abs(breakEven.yearOneSavings))} in year one.`}
              {breakEven.verdict === 'close' && `it's a close call — depends on your priorities.`}
              {breakEven.verdict === 'stay' && `staying is likely the smarter financial move.`}
            </p>
          )}
        </motion.div>

        {/* ━━━ SCENARIOS + AFFORDABILITY ━━━ */}
        {hasIncrease && (
          <>
            <div className="h-px bg-border" />
            <motion.div {...fade(0.13)} className="py-10 md:py-14">
              <h3 className="font-display text-2xl md:text-3xl text-foreground mb-8">
                What if…
              </h3>
              <div className="grid md:grid-cols-2 gap-12 lg:gap-16">
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
                <AffordabilityCard
                  currentRent={formData.currentRent}
                  newRent={newRent}
                  medianHouseholdIncome={rentData.medianHouseholdIncome}
                  zip={rentData.zip}
                  city={city}
                />
              </div>
            </motion.div>
          </>
        )}

        <div className="h-px bg-border" />

        {/* ━━━ LANDLORD COST LOOKUP ━━━ */}
        {hasIncrease && (
          <motion.div {...fade(0.15)} className="py-10 md:py-14">
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
        <motion.div {...fade(0.18)} className="py-10 md:py-14" id="comps-section">
          <CompLinks
            zip={rentData.zip}
            city={rentData.city}
            state={rentData.state}
            bedrooms={formData.bedrooms}
          />
        </motion.div>

        <div className="h-px bg-border" />

        {/* ━━━ EMAIL ━━━ */}
        <motion.div {...fade(0.18)} className="py-10 md:py-14 text-center">
          <div className="max-w-sm mx-auto">
            <EmailCapture />
          </div>
        </motion.div>

        {/* ━━━ BACK ━━━ */}
        <div className="pb-12 pt-2 text-center">
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
