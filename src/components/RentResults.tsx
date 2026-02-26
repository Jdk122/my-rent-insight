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
import { ArrowLeft, TrendingUp, TrendingDown, FileText, ChevronRight } from 'lucide-react';

interface RentResultsProps {
  formData: RentFormData;
  rentData: RentData;
  onReset: () => void;
}

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

const fade = (delay: number) => ({
  initial: { opacity: 0, y: 12 },
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

  const city = rentData.city;
  const brLabel = bedroomLabels[formData.bedrooms];
  const brPlural = formData.bedrooms === 'studio' ? 'studios'
    : formData.bedrooms === 'oneBr' ? '1-bedrooms'
    : formData.bedrooms === 'twoBr' ? '2-bedrooms'
    : formData.bedrooms === 'threeBr' ? '3-bedrooms'
    : '4-bedrooms';

  const stats = [
    { label: 'Current', value: `$${fmt(formData.currentRent)}` },
    { label: 'Proposed', value: `$${fmt(newRent)}`, highlight: true },
    { label: 'Extra / year', value: `$${fmt(annualExtra)}` },
    { label: 'Break-even', value: breakEven.months === Infinity ? '—' : `${breakEven.months.toFixed(0)} mo` },
  ];

  return (
    <div className="max-w-2xl mx-auto px-5 md:px-8 pb-16">

      {/* ━━━ VERDICT HERO ━━━ */}
      <motion.div {...fade(0)} className="pt-8 md:pt-12 pb-8">
        {hasIncrease ? (
          <>
            <div className="flex items-center gap-2.5 mb-4">
              <span className={`verdict-pill ${pillClass}`}>{verdictLabel}</span>
              <span className="text-xs text-muted-foreground font-mono">
                {brLabel} · {city}, {rentData.state}
              </span>
            </div>

            <h2 className="font-display text-[clamp(2.4rem,6vw,4rem)] leading-[0.92] tracking-tight mb-3">
              <span className={verdictColor}>{increasePct}%</span>
              <span className="text-muted-foreground text-[0.35em] font-body font-normal mx-2 align-middle">vs</span>
              <span className="text-foreground">{marketYoy}%</span>
            </h2>

            <p className="text-muted-foreground text-[15px] leading-relaxed max-w-md">
              Rents in {city} rose {marketYoy}% this year. Your landlord is asking for {increasePct}%.
              {isAboveMarket && multiplier > 0 && (
                <> That's <span className={`font-semibold ${verdictColor}`}>{multiplier}×</span> the market rate — <span className="font-mono font-semibold text-foreground">${fmt(excessAnnual)}</span>/yr above average.</>
              )}
              {isBelowMarket && (
                <> That's below average — you're in good shape.</>
              )}
            </p>

            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-px mt-8 rounded-lg overflow-hidden border border-border bg-border">
              {stats.map((s) => (
                <div key={s.label} className="bg-card px-4 py-3.5">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium mb-1">{s.label}</p>
                  <p className={`font-mono text-base md:text-lg font-bold tracking-tight ${s.highlight ? verdictColor : 'text-foreground'}`}>
                    {s.value}
                  </p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <h2 className="font-display text-2xl text-foreground">No increase entered</h2>
            <p className="text-muted-foreground mt-1 text-sm">Enter your proposed increase to compare.</p>
          </>
        )}
      </motion.div>

      {/* ━━━ NEGOTIATE CTA ━━━ */}
      {hasIncrease && isAboveMarket && (
        <motion.div {...fade(0.06)} className="mb-6">
          <div className="rounded-lg border border-border overflow-hidden">
            {!showLetter ? (
              <div>
                <button
                  onClick={() => setShowLetter(true)}
                  className="w-full text-left group flex items-center gap-3.5 px-5 py-4 hover:bg-secondary/50 transition-colors"
                >
                  <div className="flex items-center justify-center w-9 h-9 rounded-md bg-primary/10 shrink-0 group-hover:bg-primary/15 transition-colors">
                    <FileText className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display text-base text-foreground group-hover:text-primary transition-colors leading-tight">
                      Push back with {city} rent data
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">Generate a counter-offer letter</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                </button>

                <div className="border-t border-border px-5 py-4">
                  <ShareSection
                    increasePct={increasePct}
                    marketPct={marketYoy}
                    excessAnnual={excessAnnual}
                    multiplier={multiplier}
                  />
                </div>
              </div>
            ) : (
              <div className="px-5 py-5">
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
          </div>
        </motion.div>
      )}

      {/* ━━━ MARKET DATA ━━━ */}
      <motion.div {...fade(0.1)} className="mb-6">
        <div className="rounded-lg border border-border bg-card">
          <div className="px-5 pt-5 pb-1">
            <h3 className="font-display text-lg text-foreground">Rents in {city}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">What {brPlural} actually cost near {rentData.zip}</p>
          </div>

          <div className="px-5 pb-5">
            <div className="divide-y divide-border">
              {[
                { label: `${city} rent trend`, value: `${rentData.yoyChange > 0 ? '+' : ''}${rentData.yoyChange}%`, trending: true },
                { label: `Typical ${brPlural}`, value: `$${fmt(range.low)} – $${fmt(range.high)}` },
                { label: `${brLabel} benchmark`, value: `$${fmt(fmr)}` },
                ...(rentData.censusMedian ? [{ label: `Median rent`, value: `$${fmt(rentData.censusMedian)}` }] : []),
                ...(hasIncrease ? [{ label: 'Your increase', value: `+${increasePct}%`, extra: `+$${fmt(increaseAmount)}/mo` }] : []),
              ].map((row: any) => (
                <div key={row.label} className="flex items-center justify-between py-3">
                  <span className="text-sm text-muted-foreground">{row.label}</span>
                  <span className={`font-mono text-sm font-semibold tabular-nums flex items-center gap-1.5 ${
                    row.trending ? (rentData.yoyChange > 0 ? 'text-verdict-overpaying' : 'text-verdict-good') : 'text-foreground'
                  }`}>
                    {row.trending && (rentData.yoyChange > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />)}
                    {row.value}
                    {row.extra && <span className="text-muted-foreground font-normal text-[11px] ml-1">({row.extra})</span>}
                  </span>
                </div>
              ))}
            </div>

            {hasIncrease && breakEven.verdict && (
              <div className="mt-4 rounded-md bg-secondary/60 px-4 py-3 flex items-start gap-2.5">
                <span className="font-mono text-xs font-bold text-foreground whitespace-nowrap mt-px">
                  {breakEven.months === Infinity ? '∞' : `${breakEven.months.toFixed(0)} mo`}
                </span>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {breakEven.verdict === 'move' && `Moving saves ~$${fmt(Math.abs(breakEven.yearOneSavings))} in year one`}
                  {breakEven.verdict === 'close' && `Close call — depends on your priorities`}
                  {breakEven.verdict === 'stay' && `Staying is likely the smarter financial move`}
                </p>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* ━━━ SCENARIOS + AFFORDABILITY ━━━ */}
      {hasIncrease && (
        <motion.div {...fade(0.13)} className="mb-6">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-border bg-card px-5 py-5">
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
            <div className="rounded-lg border border-border bg-card px-5 py-5">
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

      {/* ━━━ COMPS ━━━ */}
      <motion.div {...fade(0.16)} className="mb-6" id="comps-section">
        <div className="rounded-lg border border-border bg-card px-5 py-5">
          <CompLinks
            zip={rentData.zip}
            city={rentData.city}
            state={rentData.state}
            bedrooms={formData.bedrooms}
          />
        </div>
      </motion.div>

      {/* ━━━ EMAIL ━━━ */}
      <motion.div {...fade(0.18)} className="mb-8">
        <div className="rounded-lg border border-border bg-card px-5 py-5">
          <EmailCapture />
        </div>
      </motion.div>

      {/* ━━━ BACK ━━━ */}
      <div className="text-center pt-2 pb-4">
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
