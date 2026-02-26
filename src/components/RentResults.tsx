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
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] as const },
});

// Consistent section wrapper
const Section = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`px-6 md:px-12 lg:px-20 ${className}`}>
    <div className="max-w-4xl">{children}</div>
  </div>
);

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

  // Plain-language helpers
  const city = rentData.city;
  const brLabel = bedroomLabels[formData.bedrooms];
  const brPlural = formData.bedrooms === 'studio' ? 'studios'
    : formData.bedrooms === 'oneBr' ? '1-bedrooms'
    : formData.bedrooms === 'twoBr' ? '2-bedrooms'
    : formData.bedrooms === 'threeBr' ? '3-bedrooms'
    : '4-bedrooms';

  return (
    <div>

      {/* ━━━ HERO: Verdict ━━━ */}
      <motion.div {...fade(0)}>
        <div className="bg-secondary/30 border-b border-border/50">
          <Section className="py-12 md:py-16">
            {hasIncrease ? (
              <>
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <span className={`verdict-pill ${pillClass}`}>{verdictLabel}</span>
                  <span className="text-sm text-muted-foreground">
                    {brLabel} · {city}, {rentData.state} {rentData.zip}
                  </span>
                </div>

                <h2 className="font-display text-[clamp(3rem,8vw,5.5rem)] leading-[0.88] tracking-tight">
                  <span className={verdictColor}>{increasePct}%</span>
                  <span className="text-muted-foreground text-[0.3em] font-body font-normal mx-3 align-middle">vs</span>
                  <span className="text-foreground">{marketYoy}%</span>
                </h2>

                <p className="text-base md:text-lg text-muted-foreground mt-4 max-w-lg leading-relaxed">
                  Rents in {city} rose {marketYoy}% this year. Your landlord is raising yours {increasePct}%.
                </p>

                {isAboveMarket && multiplier > 0 && (
                  <p className="text-base md:text-lg mt-3 text-foreground">
                    That's <span className={`font-bold ${verdictColor}`}>{multiplier}×</span> faster than {city} —{' '}
                    <span className="font-mono font-bold">${fmt(excessAnnual)}</span> extra per year
                  </p>
                )}
                {isBelowMarket && (
                  <p className="text-base md:text-lg mt-3 text-verdict-good font-medium">Below the {city} average — you're in good shape ✓</p>
                )}
              </>
            ) : (
              <>
                <h2 className="font-display text-3xl text-foreground">No increase entered</h2>
                <p className="text-muted-foreground mt-2">Enter your proposed increase to compare</p>
              </>
            )}
          </Section>
        </div>
      </motion.div>

      {/* ━━━ KEY NUMBERS ━━━ */}
      {hasIncrease && (
        <motion.div {...fade(0.05)}>
          <Section className="py-10 md:py-12 border-b border-border/50">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-10">
              {[
                { label: 'Current Rent', value: `$${fmt(formData.currentRent)}` },
                { label: 'Proposed Rent', value: `$${fmt(newRent)}`, highlight: true },
                { label: 'Extra Per Year', value: `$${fmt(annualExtra)}` },
                { label: 'Break-even', value: breakEven.months === Infinity ? '—' : `${breakEven.months.toFixed(0)} mo` },
              ].map((stat) => (
                <div key={stat.label}>
                  <p className="data-label mb-1.5">{stat.label}</p>
                  <p className={`font-mono text-2xl md:text-3xl font-bold tracking-tight ${stat.highlight ? verdictColor : 'text-foreground'}`}>
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>
          </Section>
        </motion.div>
      )}

      {/* ━━━ NEGOTIATE CTA ━━━ */}
      {hasIncrease && isAboveMarket && (
        <motion.div {...fade(0.08)}>
          <div className="bg-primary/[0.02] border-b border-border/50">
            <Section className="py-10 md:py-12">
              {!showLetter ? (
                <button
                  onClick={() => setShowLetter(true)}
                  className="w-full text-left group"
                >
                  <div className="flex items-start gap-5">
                    <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 shrink-0 group-hover:bg-primary/15 transition-colors">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-display text-xl md:text-2xl text-foreground mb-1 group-hover:text-primary transition-colors">
                        Push back with {city} rent data
                      </h3>
                      <p className="text-sm md:text-base text-muted-foreground leading-relaxed max-w-lg">
                        Generate a negotiation letter pre-filled with local benchmarks. Pick your tone, set a counter-offer, and send it.
                      </p>
                    </div>
                  </div>
                </button>
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
                />
              )}
            </Section>
          </div>
        </motion.div>
      )}

      {/* ━━━ SHARE ━━━ */}
      {hasIncrease && isAboveMarket && (
        <motion.div {...fade(0.1)}>
          <Section className="py-8 border-b border-border/50">
            <ShareSection
              increasePct={increasePct}
              marketPct={marketYoy}
              excessAnnual={excessAnnual}
              multiplier={multiplier}
            />
          </Section>
        </motion.div>
      )}

      {/* ━━━ MARKET DATA ━━━ */}
      <motion.div {...fade(0.12)}>
        <Section className="py-10 md:py-14 border-b border-border/50">
          <h2 className="font-display text-2xl md:text-3xl text-foreground mb-1">Rents in {city}</h2>
          <p className="text-sm md:text-base text-muted-foreground mb-8">
            What {brPlural} actually cost in your area
          </p>

          <div className="divide-y divide-border">
            {[
              { label: `How fast ${city} rents are rising`, value: `${rentData.yoyChange > 0 ? '+' : ''}${rentData.yoyChange}%`, trending: true },
              { label: `What most ${brPlural} in ${city} go for`, value: `$${fmt(range.low)} – $${fmt(range.high)}` },
              { label: `${city} ${brLabel.toLowerCase()} benchmark`, value: `$${fmt(fmr)}` },
              ...(rentData.censusMedian ? [{ label: `${city} median rent`, value: `$${fmt(rentData.censusMedian)}` }] : []),
              ...(hasIncrease ? [{ label: 'Your increase', value: `+${increasePct}%`, extra: `+$${fmt(increaseAmount)}/mo` }] : []),
            ].map((row: any) => (
              <div key={row.label} className="flex items-center justify-between py-4">
                <span className="text-sm text-muted-foreground">{row.label}</span>
                <span className={`font-mono text-sm font-semibold tabular-nums flex items-center gap-1.5 ${
                  row.trending ? (rentData.yoyChange > 0 ? 'text-verdict-overpaying' : 'text-verdict-good') : 'text-foreground'
                }`}>
                  {row.trending && (rentData.yoyChange > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />)}
                  {row.value}
                  {row.extra && <span className="text-muted-foreground font-normal text-xs ml-1.5">({row.extra})</span>}
                </span>
              </div>
            ))}
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
        </Section>
      </motion.div>

      {/* ━━━ TWO-COLUMN: Scenarios + Affordability ━━━ */}
      {hasIncrease && (
        <motion.div {...fade(0.15)}>
          <div className="bg-secondary/20 border-b border-border/50">
            <Section className="py-10 md:py-14">
              <div className="grid md:grid-cols-2 gap-10 lg:gap-16">
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
            </Section>
          </div>
        </motion.div>
      )}

      {/* ━━━ COMPS ━━━ */}
      <motion.div {...fade(0.18)} id="comps-section">
        <Section className="py-10 md:py-14 border-b border-border/50">
          <CompLinks
            zip={rentData.zip}
            city={rentData.city}
            state={rentData.state}
            bedrooms={formData.bedrooms}
          />
        </Section>
      </motion.div>

      {/* ━━━ EMAIL ━━━ */}
      <motion.div {...fade(0.2)}>
        <div className="bg-secondary/20 border-b border-border/50">
          <Section className="py-10 md:py-14">
            <div className="max-w-md">
              <EmailCapture />
            </div>
          </Section>
        </div>
      </motion.div>

      {/* ━━━ Back ━━━ */}
      <Section className="py-8 text-center">
        <button
          onClick={onReset}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Check another increase
        </button>
      </Section>
    </div>
  );
};

export default RentResults;
