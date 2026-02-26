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
  initial: { opacity: 0, y: 20 },
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

  // For the visual bar on market data rows
  const maxRent = Math.max(newRent, fmr, range.high, rentData.censusMedian || 0) * 1.1;

  return (
    <div>
      {/* ━━━ VERDICT HERO ━━━ */}
      <motion.div {...fade(0)} className="relative overflow-hidden">
        {/* Subtle gradient wash */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            background: isAboveMarket
              ? 'radial-gradient(ellipse 80% 60% at 20% 40%, hsl(var(--verdict-overpaying)), transparent)'
              : isBelowMarket
                ? 'radial-gradient(ellipse 80% 60% at 20% 40%, hsl(var(--verdict-good)), transparent)'
                : 'radial-gradient(ellipse 80% 60% at 20% 40%, hsl(var(--verdict-fair)), transparent)',
          }}
        />

        <div className="relative px-6 md:px-12 lg:px-20 pt-14 md:pt-24 pb-14 md:pb-20">
          <div className="max-w-3xl">
            {hasIncrease ? (
              <>
                <motion.span
                  {...fade(0.05)}
                  className="inline-flex items-center gap-2 text-xs font-mono text-muted-foreground tracking-wide"
                >
                  {brLabel} · {city}, {rentData.state} {rentData.zip}
                </motion.span>

                {/* The big comparison */}
                <motion.div {...fade(0.1)} className="mt-6 md:mt-8">
                  <div className="flex items-baseline gap-3 md:gap-5 flex-wrap">
                    <div>
                      <p className="text-[11px] font-mono text-muted-foreground tracking-wide uppercase mb-1">Your increase</p>
                      <span className={`font-display text-[clamp(4rem,10vw,7rem)] leading-[0.85] tracking-tight ${verdictColor}`}>
                        {increasePct}%
                      </span>
                    </div>
                    <span className="text-muted-foreground/40 text-2xl md:text-3xl font-body font-light self-center pb-4">vs</span>
                    <div>
                      <p className="text-[11px] font-mono text-muted-foreground tracking-wide uppercase mb-1">Market rate</p>
                      <span className="font-display text-[clamp(4rem,10vw,7rem)] leading-[0.85] tracking-tight text-foreground">
                        {marketYoy}%
                      </span>
                    </div>
                  </div>
                </motion.div>

                {/* Verdict pill + explainer */}
                <motion.div {...fade(0.15)} className="mt-6 md:mt-8">
                  <span className={`verdict-pill ${pillClass}`}>{verdictLabel}</span>
                  <p className="text-muted-foreground text-base md:text-lg leading-relaxed mt-4 max-w-lg">
                    Rents in {city} rose {marketYoy}% this year. Your landlord is asking for {increasePct}%.
                    {isAboveMarket && multiplier > 0 && (
                      <> That's <span className={`font-semibold ${verdictColor}`}>{multiplier}×</span> the local rate — <span className="font-mono font-bold text-foreground">${fmt(excessAnnual)}/year</span> above market.</>
                    )}
                    {isBelowMarket && <> That's below the local average — you're in good shape.</>}
                  </p>
                </motion.div>

                {/* Key stats — card-style grid */}
                <motion.div {...fade(0.2)} className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-10 md:mt-14">
                  {[
                    { label: 'Current', value: `$${fmt(formData.currentRent)}`, sub: '/mo' },
                    { label: 'Proposed', value: `$${fmt(newRent)}`, sub: '/mo', highlight: true },
                    { label: 'Extra cost', value: `$${fmt(annualExtra)}`, sub: '/year' },
                    { label: 'Break-even', value: breakEven.months === Infinity ? 'n/a' : `${breakEven.months.toFixed(0)}`, sub: breakEven.months === Infinity ? '' : 'months' },
                  ].map((s) => (
                    <div key={s.label} className="rounded-xl border border-border/60 bg-secondary/30 px-4 py-4">
                      <p className="text-[10px] font-mono text-muted-foreground tracking-wide uppercase mb-1.5">{s.label}</p>
                      <p className={`font-mono text-2xl md:text-3xl font-bold tracking-tight ${s.highlight ? verdictColor : 'text-foreground'}`}>
                        {s.value}
                      </p>
                      {s.sub && <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{s.sub}</p>}
                    </div>
                  ))}
                </motion.div>
              </>
            ) : (
              <>
                <h2 className="font-display text-3xl md:text-4xl text-foreground">No increase entered</h2>
                <p className="text-muted-foreground mt-2">Enter your proposed increase to compare.</p>
              </>
            )}
          </div>
        </div>
      </motion.div>

      {/* ━━━ TAKE ACTION ━━━ */}
      {hasIncrease && isAboveMarket && (
        <>
          <div className="h-px bg-border mx-6 md:mx-12 lg:mx-20" />
          <motion.div {...fade(0.06)} className="px-6 md:px-12 lg:px-20 py-10 md:py-14">
            <div className="max-w-3xl">
              {!showLetter ? (
                <div className="space-y-8">
                  <button
                    onClick={() => setShowLetter(true)}
                    className="w-full text-left group rounded-2xl border-2 border-primary/15 bg-primary/[0.02] hover:border-primary/30 hover:bg-primary/[0.04] transition-all p-6 md:p-8"
                  >
                    <div className="flex items-center gap-5">
                      <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 shrink-0 group-hover:bg-primary/15 transition-colors">
                        <FileText className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-display text-xl md:text-2xl text-foreground group-hover:text-primary transition-colors">
                          Push back with {city} data
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          We'll draft a negotiation letter citing market rates, your counter-offer, and local comps
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
                    </div>
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
            </div>
          </motion.div>
        </>
      )}

      {/* ━━━ MARKET CONTEXT ━━━ */}
      <div className="bg-secondary/40">
        <motion.div {...fade(0.1)} className="px-6 md:px-12 lg:px-20 py-12 md:py-16">
          <div className="max-w-3xl">
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
                { label: `${brLabel} benchmark`, value: `$${fmt(fmr)}`, bar: fmr },
                ...(rentData.censusMedian ? [{ label: `Median rent`, value: `$${fmt(rentData.censusMedian)}`, bar: rentData.censusMedian }] : []),
                ...(hasIncrease ? [{ label: 'Your proposed rent', value: `$${fmt(newRent)}`, extra: `+${increasePct}%`, bar: newRent, isProposed: true }] : []),
              ].map((row: any, i: number) => (
                <div key={row.label} className={`py-4 ${i > 0 ? 'border-t border-border/50' : ''}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[13px] text-muted-foreground">{row.label}</span>
                    <span className={`font-mono text-[13px] font-semibold tabular-nums flex items-center gap-1.5 ${
                      row.trending ? (rentData.yoyChange > 0 ? 'text-verdict-overpaying' : 'text-verdict-good')
                        : row.isProposed ? verdictColor
                          : 'text-foreground'
                    }`}>
                      {row.trending && (rentData.yoyChange > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />)}
                      {row.value}
                      {row.extra && <span className="text-muted-foreground font-normal text-[11px] ml-1.5">({row.extra})</span>}
                    </span>
                  </div>
                  {/* Visual bar for dollar values */}
                  {row.bar && (
                    <div className="h-1 rounded-full bg-border/60 mt-1.5 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min((row.bar / maxRent) * 100, 100)}%` }}
                        transition={{ duration: 0.8, delay: 0.3 + i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                        className={`h-full rounded-full ${row.isProposed
                          ? isAboveMarket ? 'bg-verdict-overpaying/60' : 'bg-verdict-good/60'
                          : 'bg-primary/40'
                        }`}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {hasIncrease && breakEven.verdict && (
              <div className="callout mt-8">
                <div>
                  <p className="text-sm text-foreground leading-relaxed">
                    <span className="font-mono font-bold">
                      {breakEven.months === Infinity ? 'No break-even' : `${breakEven.months.toFixed(0)}-month break-even`}
                    </span>
                    {' — '}
                    {breakEven.verdict === 'move' && `moving saves ~$${fmt(Math.abs(breakEven.yearOneSavings))} in year one.`}
                    {breakEven.verdict === 'close' && `it's a close call — depends on your priorities.`}
                    {breakEven.verdict === 'stay' && `staying is likely the smarter financial move.`}
                  </p>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* ━━━ SCENARIOS + AFFORDABILITY ━━━ */}
      {hasIncrease && (
        <motion.div {...fade(0.13)} className="px-6 md:px-12 lg:px-20 py-12 md:py-16">
          <div className="max-w-3xl">
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
          </div>
        </motion.div>
      )}

      {/* ━━━ LANDLORD COST LOOKUP ━━━ */}
      {hasIncrease && (
        <div className="bg-secondary/40">
          <motion.div {...fade(0.15)} className="px-6 md:px-12 lg:px-20 py-12 md:py-16">
            <div className="max-w-3xl">
              <LandlordCostLookup
                rentData={rentData}
                bedrooms={formData.bedrooms}
                currentRent={formData.currentRent}
                increaseAmount={increaseAmount}
                onCostData={setLandlordCosts}
              />
            </div>
          </motion.div>
        </div>
      )}

      {/* ━━━ COMPS ━━━ */}
      <motion.div {...fade(0.18)} className="px-6 md:px-12 lg:px-20 py-12 md:py-16" id="comps-section">
        <div className="max-w-3xl">
          <CompLinks
            zip={rentData.zip}
            city={rentData.city}
            state={rentData.state}
            bedrooms={formData.bedrooms}
          />
        </div>
      </motion.div>

      {/* ━━━ EMAIL ━━━ */}
      <div className="border-t border-border">
        <motion.div {...fade(0.18)} className="px-6 md:px-12 lg:px-20 py-12 md:py-16 text-center">
          <div className="max-w-sm mx-auto">
            <EmailCapture />
          </div>
        </motion.div>
      </div>

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
  );
};

export default RentResults;
