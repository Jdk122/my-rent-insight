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
  const brShort = formData.bedrooms === 'studio' ? 'studios' : brLabel.replace('-Bedroom', 'BR');

  // Shared section wrapper for consistent full-width + padding
  const Section = ({ children, className = '', ...props }: { children: React.ReactNode; className?: string; [key: string]: any }) => (
    <div className={`px-6 md:px-12 lg:px-20 ${className}`} {...props}>
      {children}
    </div>
  );

  return (
    <div>

      {/* ━━━ HERO: Verdict — full-bleed background ━━━ */}
      <motion.div {...fade(0)}>
        <div className="bg-secondary/30 border-b border-border/50">
          <Section className="py-16 md:py-24">
            <div className="max-w-4xl">
              {hasIncrease ? (
                <>
                  <div className="flex flex-wrap items-center gap-3 mb-6">
                    <span className={`verdict-pill ${pillClass}`}>{verdictLabel}</span>
                    <span className="text-sm text-muted-foreground">
                      {bedroomLabels[formData.bedrooms]} · {rentData.city}, {rentData.state} {rentData.zip}
                    </span>
                  </div>

                  <h2 className="font-display text-[clamp(3.5rem,10vw,7rem)] leading-[0.85] tracking-tight">
                    <span className={verdictColor}>{increasePct}%</span>
                    <span className="text-muted-foreground text-[0.3em] font-body font-normal mx-4 align-middle">vs</span>
                    <span className="text-foreground">{marketYoy}%</span>
                  </h2>

                  <p className="text-lg text-muted-foreground mt-5 max-w-lg leading-relaxed">
                    Rents in {city} rose {marketYoy}% this year. Your landlord is raising yours {increasePct}%.
                  </p>

                  {isAboveMarket && multiplier > 0 && (
                    <p className="text-lg mt-4 text-foreground">
                      That's <span className={`font-bold ${verdictColor}`}>{multiplier}×</span> faster than {city} —{' '}
                      <span className="font-mono font-bold">${fmt(excessAnnual)}</span> extra per year
                    </p>
                  )}
                  {isBelowMarket && (
                    <p className="text-lg mt-4 text-verdict-good font-medium">Below the {city} average — you're in good shape ✓</p>
                  )}
                </>
              ) : (
                <>
                  <h2 className="font-display text-4xl text-foreground">No increase entered</h2>
                  <p className="text-muted-foreground mt-2 text-lg">Enter your proposed increase to compare</p>
                </>
              )}
            </div>
          </Section>
        </div>
      </motion.div>

      {/* ━━━ KEY NUMBERS — full width grid ━━━ */}
      {hasIncrease && (
        <motion.div {...fade(0.06)}>
          <Section className="py-12 md:py-16">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12 max-w-4xl">
              {[
                { label: 'Current Rent', value: `$${fmt(formData.currentRent)}` },
                { label: 'Proposed Rent', value: `$${fmt(newRent)}`, highlight: true },
                { label: 'Extra Per Year', value: `$${fmt(annualExtra)}` },
                { label: 'Break-even', value: breakEven.months === Infinity ? '—' : `${breakEven.months.toFixed(0)} months` },
              ].map((stat) => (
                <div key={stat.label}>
                  <p className="data-label mb-2">{stat.label}</p>
                  <p className={`font-mono text-3xl md:text-4xl font-bold tracking-tight ${stat.highlight ? verdictColor : 'text-foreground'}`}>
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
        <motion.div {...fade(0.1)}>
          <div className="border-y border-border/50 bg-primary/[0.02]">
            <Section className="py-12 md:py-16">
              <div className="max-w-3xl">
                {!showLetter ? (
                  <button
                    onClick={() => setShowLetter(true)}
                    className="w-full text-left group"
                  >
                    <div className="flex items-start gap-6">
                      <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-primary/10 shrink-0 group-hover:bg-primary/15 transition-colors">
                        <FileText className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-display text-2xl md:text-3xl text-foreground mb-2 group-hover:text-primary transition-colors">
                          Generate Your Negotiation Letter
                        </h3>
                        <p className="text-muted-foreground text-base leading-relaxed max-w-lg">
                          Pre-written with your data, backed by HUD and Census numbers. Customize the tone, set your counter-offer, and send it to your landlord.
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
              </div>
            </Section>
          </div>
        </motion.div>
      )}

      {/* ━━━ SHARE ━━━ */}
      {hasIncrease && isAboveMarket && (
        <motion.div {...fade(0.12)}>
          <Section className="py-10">
            <div className="max-w-3xl">
              <ShareSection
                increasePct={increasePct}
                marketPct={marketYoy}
                excessAnnual={excessAnnual}
                multiplier={multiplier}
              />
            </div>
          </Section>
        </motion.div>
      )}

      {/* ━━━ MARKET DATA ━━━ */}
      <motion.div {...fade(0.14)}>
        <div className="border-t border-border/50">
          <Section className="py-14 md:py-20">
            <div className="max-w-3xl">
              <h2 className="font-display text-3xl md:text-4xl text-foreground mb-2">Rents in {city}</h2>
              <p className="text-muted-foreground text-base mb-10">
                What {brShort} actually cost in your area
              </p>

              <div className="divide-y divide-border">
                <div className="data-row py-5">
                  <span className="data-row-label text-base">How fast {city} rents are rising</span>
                  <span className={`data-row-value text-base flex items-center gap-2 ${rentData.yoyChange > 0 ? 'text-verdict-overpaying' : 'text-verdict-good'}`}>
                    {rentData.yoyChange > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    {rentData.yoyChange > 0 ? '+' : ''}{rentData.yoyChange}%
                  </span>
                </div>
                <div className="data-row py-5">
                  <span className="data-row-label text-base">What most {brShort} in {city} go for</span>
                  <span className="data-row-value text-base">${fmt(range.low)} – ${fmt(range.high)}</span>
                </div>
                <div className="data-row py-5">
                  <span className="data-row-label text-base">{city} {brLabel.toLowerCase()} benchmark</span>
                  <span className="data-row-value text-base">${fmt(fmr)}</span>
                </div>
                {rentData.censusMedian && (
                  <div className="data-row py-5">
                    <span className="data-row-label text-base">{city} median rent</span>
                    <span className="data-row-value text-base">${fmt(rentData.censusMedian)}</span>
                  </div>
                )}
                {hasIncrease && (
                  <div className="data-row py-5">
                    <span className="data-row-label text-base">Your increase</span>
                    <span className="data-row-value text-base">
                      +{increasePct}%{' '}
                      <span className="text-muted-foreground font-normal text-sm ml-2">(+${fmt(increaseAmount)}/mo)</span>
                    </span>
                  </div>
                )}
              </div>

              {hasIncrease && (
                <div className="callout mt-8">
                  <Scale className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <p className="font-mono text-base font-semibold text-foreground">
                      Break-even: {breakEven.months === Infinity ? '∞' : breakEven.months.toFixed(1)} months
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {breakEven.verdict === 'move' && `Moving saves ~$${fmt(Math.abs(breakEven.yearOneSavings))} in year 1`}
                      {breakEven.verdict === 'close' && `Close call — depends on your priorities`}
                      {breakEven.verdict === 'stay' && `Staying is likely the smarter move`}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </Section>
        </div>
      </motion.div>

      {/* ━━━ TWO-COLUMN: Scenarios + Affordability ━━━ */}
      {hasIncrease && (
        <motion.div {...fade(0.18)}>
          <div className="border-t border-border/50 bg-secondary/20">
            <Section className="py-14 md:py-20">
              <div className="grid md:grid-cols-2 gap-12 lg:gap-20 max-w-5xl">
                <div>
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
                <div>
                  <AffordabilityCard
                    currentRent={formData.currentRent}
                    newRent={newRent}
                    medianHouseholdIncome={rentData.medianHouseholdIncome}
                    zip={rentData.zip}
                    city={city}
                  />
                </div>
              </div>
            </Section>
          </div>
        </motion.div>
      )}

      {/* ━━━ COMPS ━━━ */}
      <motion.div {...fade(0.22)} id="comps-section">
        <div className="border-t border-border/50">
          <Section className="py-14 md:py-20">
            <div className="max-w-3xl">
              <CompLinks
                zip={rentData.zip}
                city={rentData.city}
                state={rentData.state}
                bedrooms={formData.bedrooms}
              />
            </div>
          </Section>
        </div>
      </motion.div>

      {/* ━━━ EMAIL ━━━ */}
      <motion.div {...fade(0.24)}>
        <div className="border-t border-border/50 bg-secondary/20">
          <Section className="py-14 md:py-20">
            <div className="max-w-md">
              <EmailCapture />
            </div>
          </Section>
        </div>
      </motion.div>

      {/* ━━━ Back ━━━ */}
      <Section className="py-10 text-center border-t border-border/50">
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
