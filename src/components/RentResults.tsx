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
import { ArrowLeft, TrendingUp, TrendingDown, Scale } from 'lucide-react';

interface RentResultsProps {
  formData: RentFormData;
  rentData: RentData;
  onReset: () => void;
}

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

const anim = (delay: number) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] as const },
});

const RentResults = ({ formData, rentData, onReset }: RentResultsProps) => {
  const fmr = getFmrForBedrooms(rentData, formData.bedrooms);
  const range = getTypicalRange(rentData, formData.bedrooms);
  const marketYoy = rentData.yoyChange;

  // Calculate the user's increase as a percentage
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

  // How does their increase compare to the market?
  const increaseVsMarket = increasePct - marketYoy;
  const multiplier = marketYoy > 0 ? Math.round((increasePct / marketYoy) * 10) / 10 : 0;
  const excessAnnual = Math.round((formData.currentRent * (increaseVsMarket / 100)) * 12);

  const hasIncrease = increaseAmount > 0;
  const isAboveMarket = increaseVsMarket > 1; // >1pp above market
  const isFair = Math.abs(increaseVsMarket) <= 1;
  const isBelowMarket = increaseVsMarket < -1;

  // Scenario state
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
    : isFair
      ? 'Market Rate'
      : isAboveMarket
        ? 'Above Market'
        : 'Below Market';

  return (
    <div className="space-y-8">
      {/* Primary Result — The Increase Verdict */}
      <motion.div {...anim(0)} className="brand-card-dark">
        <div className="flex items-center justify-between mb-8">
          <span className="data-label" style={{ color: 'hsl(var(--warm-gray))' }}>
            Your Increase Report
          </span>
          <span className={`verdict-pill ${pillClass}`}>
            {verdictLabel}
          </span>
        </div>

        {hasIncrease ? (
          <div className="text-center py-4">
            <p className={`font-mono text-5xl md:text-6xl font-bold tracking-tight ${verdictColor}`}>
              {increasePct}% vs {marketYoy}%
            </p>
            <p className="font-mono text-sm mt-3" style={{ color: 'hsl(var(--warm-gray))' }}>
              Your increase vs. market rate in {rentData.zip}
            </p>

            {isAboveMarket && multiplier > 0 && (
              <p className="font-mono text-lg mt-4" style={{ color: 'hsl(var(--cream))' }}>
                That's <span className="text-verdict-overpaying font-bold">{multiplier}×</span> the market rate of increase
              </p>
            )}
            {isBelowMarket && (
              <p className="font-mono text-lg mt-4 text-verdict-good">
                Your increase is below the local market trend
              </p>
            )}
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="font-mono text-3xl md:text-4xl font-bold tracking-tight" style={{ color: 'hsl(var(--cream))' }}>
              No increase entered
            </p>
            <p className="font-mono text-sm mt-3" style={{ color: 'hsl(var(--warm-gray))' }}>
              Enter your proposed increase to see how it compares to the market
            </p>
          </div>
        )}

        {hasIncrease && (
          <div className="border-t mt-6 pt-5" style={{ borderColor: 'hsl(var(--warm-gray) / 0.2)' }}>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-mono uppercase tracking-widest mb-1" style={{ color: 'hsl(var(--warm-gray))' }}>
                  Extra You'd Pay
                </p>
                <p className={`font-mono text-2xl font-bold ${verdictColor}`}>
                  ${fmt(annualExtra)}
                  <span className="text-sm font-normal" style={{ color: 'hsl(var(--warm-gray))' }}>/yr</span>
                </p>
              </div>
              <div>
                <p className="text-xs font-mono uppercase tracking-widest mb-1" style={{ color: 'hsl(var(--warm-gray))' }}>
                  Above-Market Cost
                </p>
                <p className="font-mono text-2xl font-bold" style={{ color: isAboveMarket ? 'hsl(var(--verdict-overpaying))' : 'hsl(var(--cream))' }}>
                  {excessAnnual > 0 ? `$${fmt(excessAnnual)}` : '—'}
                  {excessAnnual > 0 && <span className="text-sm font-normal" style={{ color: 'hsl(var(--warm-gray))' }}>/yr</span>}
                </p>
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Share — right at the emotional peak */}
      {hasIncrease && isAboveMarket && (
        <motion.div {...anim(0.1)}>
          <ShareSection
            increasePct={increasePct}
            marketPct={marketYoy}
            excessAnnual={excessAnnual}
            multiplier={multiplier}
          />
        </motion.div>
      )}

      {/* Market Context */}
      <motion.div {...anim(0.15)} className="brand-card">
        <p className="data-label mb-1">Market Data</p>
        <h3 className="font-display text-2xl text-foreground mb-6">
          {bedroomLabels[formData.bedrooms]} in {rentData.city}, {rentData.state} ({rentData.zip})
        </h3>

        <div className="space-y-0 divide-y divide-border text-sm">
          <div className="flex justify-between py-3">
            <span className="text-muted-foreground">Year-over-year rent change</span>
            <span className={`font-mono font-semibold flex items-center gap-1 ${rentData.yoyChange > 0 ? 'text-verdict-overpaying' : 'text-verdict-good'}`}>
              {rentData.yoyChange > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              {rentData.yoyChange > 0 ? '+' : ''}{rentData.yoyChange}%
            </span>
          </div>
          {hasIncrease && (
            <div className="flex justify-between py-3">
              <span className="text-muted-foreground">Your proposed increase</span>
              <span className="font-mono font-semibold text-foreground">
                +{increasePct}%
                <span className="text-muted-foreground font-normal ml-1">(+${fmt(increaseAmount)}/mo)</span>
              </span>
            </div>
          )}
          <div className="flex justify-between py-3">
            <span className="text-muted-foreground">Typical range ({bedroomLabels[formData.bedrooms]})</span>
            <span className="font-mono font-semibold">${fmt(range.low)} – ${fmt(range.high)}</span>
          </div>
          <div className="flex justify-between py-3">
            <span className="text-muted-foreground">HUD Fair Market Rent</span>
            <span className="font-mono font-semibold">${fmt(fmr)}</span>
          </div>
          {rentData.censusMedian && (
            <div className="flex justify-between py-3">
              <span className="text-muted-foreground">Census median</span>
              <span className="font-mono font-semibold">${fmt(rentData.censusMedian)}</span>
            </div>
          )}
        </div>
      </motion.div>

      {/* Legal Context — rent control laws */}
      {hasIncrease && (
        <motion.div {...anim(0.16)}>
          <RentControlCard zip={rentData.zip} increasePct={increasePct} />
        </motion.div>
      )}

      {/* Affordability — rent burden analysis */}
      {hasIncrease && (
        <motion.div {...anim(0.17)}>
          <AffordabilityCard
            currentRent={formData.currentRent}
            newRent={newRent}
            medianHouseholdIncome={rentData.medianHouseholdIncome}
            zip={rentData.zip}
          />
        </motion.div>
      )}

      {/* Comp Links — see what's available */}
      <motion.div {...anim(0.18)}>
        <CompLinks
          zip={rentData.zip}
          city={rentData.city}
          state={rentData.state}
          bedrooms={formData.bedrooms}
        />
      </motion.div>

      {/* Stay or Move — the decision */}
      {hasIncrease && (
        <motion.div {...anim(0.2)} className="brand-card">
          <p className="data-label mb-1">Decision</p>
          <h3 className="font-display text-2xl text-foreground mb-5">Accept, Negotiate, or Move?</h3>

          <div className="flex items-center gap-3 font-mono text-lg">
            <span className="text-foreground">${fmt(formData.currentRent)}</span>
            <span className="text-muted-foreground">→</span>
            <span className="font-bold text-foreground">${fmt(newRent)}</span>
            <span className="text-sm text-muted-foreground">
              +${fmt(increaseAmount)}/mo
            </span>
          </div>

          <div className="mt-5 p-4 rounded-md bg-secondary">
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-muted-foreground" />
              <span className="font-mono text-sm font-semibold">
                Break-even to move: {breakEven.months === Infinity ? '∞' : breakEven.months.toFixed(1)} months
              </span>
            </div>
            <div className={`mt-3 verdict-pill ${breakEven.verdict === 'move' ? 'verdict-pill-good' : breakEven.verdict === 'close' ? 'verdict-pill-fair' : 'verdict-pill-overpaying'}`}>
              {breakEven.verdict === 'move' && `Moving saves ~$${fmt(Math.abs(breakEven.yearOneSavings))} in year one`}
              {breakEven.verdict === 'close' && `Close call — depends on your situation`}
              {breakEven.verdict === 'stay' && `Staying is probably smarter`}
            </div>
          </div>
        </motion.div>
      )}

      {/* Negotiation Letter */}
      {hasIncrease && isAboveMarket && (
        <motion.div {...anim(0.22)}>
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
        </motion.div>
      )}

      {/* Scenario Toggles */}
      {hasIncrease && (
        <motion.div {...anim(0.25)}>
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
        </motion.div>
      )}

      {/* Affiliate: Renters Insurance — contextual after move/stay decision */}
      {hasIncrease && (
        <motion.div {...anim(0.28)}>
          <a
            href="#lemonade-affiliate"
            target="_blank"
            rel="noopener noreferrer"
            className="brand-card group flex items-center gap-4 hover:border-accent/40 transition-colors cursor-pointer no-underline"
          >
            <div className="flex items-center justify-center w-10 h-10 rounded-md bg-accent/10 shrink-0">
              <span className="text-lg">🛡️</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-display text-base text-foreground leading-tight">
                Protect your belongings wherever you live
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Renters insurance from ~$5/mo. Takes 90 seconds.
              </p>
            </div>
            <span className="text-xs font-mono font-semibold text-accent group-hover:underline shrink-0">
              Get Covered →
            </span>
          </a>
        </motion.div>
      )}

      {/* Email Capture */}
      <motion.div {...anim(0.3)}>
        <EmailCapture />
      </motion.div>

      {/* Affiliate: Credit Score — after email capture */}
      <motion.div {...anim(0.32)}>
        <a
          href="#credit-karma-affiliate"
          target="_blank"
          rel="noopener noreferrer"
          className="brand-card group flex items-center gap-4 hover:border-accent/40 transition-colors cursor-pointer no-underline"
        >
          <div className="flex items-center justify-center w-10 h-10 rounded-md bg-verdict-good/10 shrink-0">
            <span className="text-lg">📊</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-display text-base text-foreground leading-tight">
              Check your credit score free before signing a new lease
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Landlords pull credit. Know your number first.
            </p>
          </div>
          <span className="text-xs font-mono font-semibold text-verdict-good group-hover:underline shrink-0">
            Check Now →
          </span>
        </a>
      </motion.div>

      <div className="text-center pt-2">
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
