import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { RentFormData } from './RentForm';
import { RentData, getFmrForBedrooms, getTypicalRange, getPercentile, calculateBreakEven, bedroomLabels } from '@/data/rentData';
import { Button } from '@/components/ui/button';
import ScenarioToggles from './ScenarioToggles';
import ShareSection from './ShareSection';
import EmailCapture from './EmailCapture';
import { ArrowLeft, TrendingUp, TrendingDown, Minus, Scale } from 'lucide-react';

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
  const percentile = getPercentile(formData.currentRent, range.low, range.high);

  const diff = formData.currentRent - fmr;
  const annualDiff = diff * 12;
  const isOverpaying = diff > 0;
  const isFair = Math.abs(diff) <= fmr * 0.05;

  const increaseAmount = formData.rentIncrease
    ? formData.increaseIsPercent
      ? Math.round(formData.currentRent * (formData.rentIncrease / 100))
      : formData.rentIncrease
    : 0;
  const newRent = formData.currentRent + increaseAmount;

  const [scenarioNewRent, setScenarioNewRent] = useState<number>(fmr);
  const [scenarioMovingCost, setScenarioMovingCost] = useState<number>(formData.movingCosts);
  const [scenarioNegotiatedPct, setScenarioNegotiatedPct] = useState<number>(
    formData.rentIncrease
      ? formData.increaseIsPercent
        ? formData.rentIncrease
        : Math.round((formData.rentIncrease / formData.currentRent) * 1000) / 10
      : 0
  );

  const breakEven = useMemo(() => {
    const negotiatedIncrease = Math.round(formData.currentRent * (scenarioNegotiatedPct / 100));
    const effectiveCurrentRent = formData.currentRent + negotiatedIncrease;
    return calculateBreakEven(effectiveCurrentRent, scenarioNewRent, scenarioMovingCost);
  }, [formData.currentRent, scenarioNewRent, scenarioMovingCost, scenarioNegotiatedPct]);

  const verdictColor = isFair ? 'text-verdict-fair' : isOverpaying ? 'text-verdict-overpaying' : 'text-verdict-good';
  const pillClass = isFair ? 'verdict-pill-fair' : isOverpaying ? 'verdict-pill-overpaying' : 'verdict-pill-good';
  const verdictLabel = isFair ? 'About Average' : isOverpaying ? 'Overpaying' : 'Below Average';

  // Percentile bar position
  const barPosition = Math.min(Math.max(percentile, 5), 95);

  return (
    <div className="space-y-8">
      {/* Primary Result — Hero card */}
      <motion.div {...anim(0)} className="brand-card-dark">
        <div className="flex items-center justify-between mb-8">
          <span className="data-label" style={{ color: 'hsl(var(--warm-gray))' }}>
            Your Rent Report
          </span>
          <span className={`verdict-pill ${pillClass}`}>
            {verdictLabel}
          </span>
        </div>

        <div className="text-center py-4">
          <p className={`font-mono text-6xl md:text-7xl font-bold tracking-tight ${verdictColor}`}>
            {isOverpaying ? '+' : isFair ? '~' : '-'}${fmt(Math.abs(diff))}
          </p>
          <p className="font-mono text-sm mt-2" style={{ color: 'hsl(var(--warm-gray))' }}>
            per month {isOverpaying ? 'above' : isFair ? 'near' : 'below'} typical rent
          </p>
        </div>

        <div className="border-t mt-6 pt-5" style={{ borderColor: 'hsl(var(--warm-gray) / 0.2)' }}>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-xs font-mono uppercase tracking-widest mb-1" style={{ color: 'hsl(var(--warm-gray))' }}>
                Annual Impact
              </p>
              <p className={`font-mono text-2xl font-bold ${verdictColor}`}>
                ${fmt(Math.abs(annualDiff))}
                <span className="text-sm font-normal" style={{ color: 'hsl(var(--warm-gray))' }}>/yr</span>
              </p>
            </div>
            <div>
              <p className="text-xs font-mono uppercase tracking-widest mb-1" style={{ color: 'hsl(var(--warm-gray))' }}>
                Percentile
              </p>
              <p className="font-mono text-2xl font-bold" style={{ color: 'hsl(var(--cream))' }}>
                {percentile}<span className="text-sm font-normal" style={{ color: 'hsl(var(--warm-gray))' }}>th</span>
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Share — emotional peak */}
      <motion.div {...anim(0.1)}>
        <ShareSection diff={diff} annualDiff={annualDiff} isOverpaying={isOverpaying} />
      </motion.div>

      {/* Market Context */}
      <motion.div {...anim(0.15)} className="brand-card">
        <p className="data-label mb-1">Market Data</p>
        <h3 className="font-display text-2xl text-foreground mb-6">
          {bedroomLabels[formData.bedrooms]} in {rentData.city}, {rentData.state} ({rentData.zip})
        </h3>

        {/* Percentile bar */}
        <div className="mb-6">
          <div className="flex justify-between mb-2">
            <span className="text-xs font-mono text-muted-foreground">${fmt(range.low)}</span>
            <span className="text-xs font-mono text-muted-foreground">${fmt(range.high)}</span>
          </div>
          <div className="percentile-bar">
            <div
              className="percentile-fill bg-accent"
              style={{ width: `${barPosition}%` }}
            />
            <div
              className="percentile-marker bg-accent"
              style={{ left: `${barPosition}%` }}
            />
          </div>
          <p className="text-xs font-mono text-muted-foreground mt-2 text-center">
            Your rent: ${fmt(formData.currentRent)} — {percentile}th percentile
          </p>
        </div>

        <div className="space-y-0 divide-y divide-border text-sm">
          <div className="flex justify-between py-3">
            <span className="text-muted-foreground">Typical range</span>
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
          <div className="flex justify-between py-3">
            <span className="text-muted-foreground">Year-over-year</span>
            <span className={`font-mono font-semibold flex items-center gap-1 ${rentData.yoyChange > 0 ? 'text-verdict-overpaying' : 'text-verdict-good'}`}>
              {rentData.yoyChange > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              {rentData.yoyChange > 0 ? '+' : ''}{rentData.yoyChange}%
            </span>
          </div>
        </div>
      </motion.div>

      {/* Rent Increase & Decision */}
      {increaseAmount > 0 && (
        <motion.div {...anim(0.2)} className="brand-card">
          <p className="data-label mb-1">Increase Analysis</p>
          <h3 className="font-display text-2xl text-foreground mb-5">Rent Increase Impact</h3>

          <div className="flex items-center gap-3 font-mono text-lg">
            <span className="text-foreground">${fmt(formData.currentRent)}</span>
            <ArrowLeft className="w-4 h-4 text-muted-foreground rotate-180" />
            <span className="font-bold text-foreground">${fmt(newRent)}</span>
            <span className="text-sm text-muted-foreground">
              +${fmt(increaseAmount)}/mo
            </span>
          </div>

          <div className="mt-5 p-4 rounded-md bg-secondary">
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-muted-foreground" />
              <span className="font-mono text-sm font-semibold">
                Break-even: {breakEven.months === Infinity ? '∞' : breakEven.months.toFixed(1)} months
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

      {/* Scenario Toggles */}
      <motion.div {...anim(0.25)}>
        <ScenarioToggles
          currentRent={newRent || formData.currentRent}
          fmr={fmr}
          scenarioNewRent={scenarioNewRent}
          setScenarioNewRent={setScenarioNewRent}
          scenarioMovingCost={scenarioMovingCost}
          setScenarioMovingCost={setScenarioMovingCost}
          scenarioNegotiatedPct={scenarioNegotiatedPct}
          setScenarioNegotiatedPct={setScenarioNegotiatedPct}
          breakEven={breakEven}
          hasIncrease={increaseAmount > 0}
        />
      </motion.div>

      {/* Email Capture */}
      <motion.div {...anim(0.3)}>
        <EmailCapture />
      </motion.div>

      <div className="text-center pt-2">
        <button
          onClick={onReset}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors font-mono"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Check another rent
        </button>
      </div>
    </div>
  );
};

export default RentResults;
