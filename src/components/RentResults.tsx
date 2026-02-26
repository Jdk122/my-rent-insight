import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { RentFormData } from './RentForm';
import { RentData, getFmrForBedrooms, getTypicalRange, getPercentile, calculateBreakEven, bedroomLabels } from '@/data/rentData';
import { Button } from '@/components/ui/button';
import ScenarioToggles from './ScenarioToggles';
import ShareSection from './ShareSection';
import EmailCapture from './EmailCapture';

interface RentResultsProps {
  formData: RentFormData;
  rentData: RentData;
  onReset: () => void;
}

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

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
  const verdictBadge = isFair ? 'verdict-badge-fair' : isOverpaying ? 'verdict-badge-overpaying' : 'verdict-badge-good';
  const verdictEmoji = isFair ? '🟡' : isOverpaying ? '🔴' : '🟢';

  return (
    <div className="space-y-6">
      {/* Primary Result */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="stat-card text-center"
      >
        <span className={`verdict-badge ${verdictBadge} mb-4`}>
          {verdictEmoji} {isFair ? 'Your rent is about average' : isOverpaying ? "You're overpaying" : "You're getting a deal"}
        </span>
        <h2 className={`text-4xl md:text-5xl font-display mt-4 ${verdictColor}`}>
          {isOverpaying ? '+' : ''}${fmt(Math.abs(diff))}<span className="text-xl text-muted-foreground">/mo</span>
        </h2>
        <p className={`text-lg mt-1 ${verdictColor}`}>
          {isOverpaying ? 'above' : isFair ? 'near' : 'below'} typical rent
        </p>
        <p className="text-2xl font-semibold mt-3 text-foreground">
          💸 That's {isOverpaying ? '' : '-'}${fmt(Math.abs(annualDiff))}/year
        </p>
      </motion.div>

      {/* Share — right after the emotional peak */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <ShareSection diff={diff} annualDiff={annualDiff} isOverpaying={isOverpaying} />
      </motion.div>

      {/* Market Context */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="stat-card"
      >
        <h3 className="font-display text-xl mb-4">
          Market Context — {bedroomLabels[formData.bedrooms]} in {rentData.zip}
        </h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between py-2 border-b border-border">
            <span className="text-muted-foreground">Typical rent range</span>
            <span className="font-semibold">${fmt(range.low)} – ${fmt(range.high)}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-border">
            <span className="text-muted-foreground">Federal benchmark (HUD FMR)</span>
            <span className="font-semibold">${fmt(fmr)}</span>
          </div>
          {rentData.censusMedian && (
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-muted-foreground">Census median gross rent</span>
              <span className="font-semibold">${fmt(rentData.censusMedian)}</span>
            </div>
          )}
          <div className="flex justify-between py-2 border-b border-border">
            <span className="text-muted-foreground">Year-over-year change</span>
            <span className={`font-semibold ${rentData.yoyChange > 0 ? 'text-verdict-overpaying' : 'text-verdict-good'}`}>
              {rentData.yoyChange > 0 ? '+' : ''}{rentData.yoyChange}%
            </span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-muted-foreground">Your rent</span>
            <span className="font-semibold">
              ${fmt(formData.currentRent)} — <span className={verdictColor}>{percentile}th percentile</span>
            </span>
          </div>
        </div>
      </motion.div>

      {/* Rent Increase & Decision */}
      {increaseAmount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="stat-card"
        >
          <h3 className="font-display text-xl mb-4">Rent Increase Impact</h3>
          <p className="text-foreground">
            Your rent is going from <span className="font-semibold">${fmt(formData.currentRent)}</span> →{' '}
            <span className="font-semibold">${fmt(newRent)}</span>{' '}
            <span className="text-muted-foreground">(+${fmt(increaseAmount)}/mo, +${fmt(increaseAmount * 12)}/yr)</span>
          </p>
          <div className="mt-4 flex items-center gap-3">
            <span className="text-2xl">⚖️</span>
            <span className="text-foreground">
              Break-even to move: <span className="font-semibold">{breakEven.months === Infinity ? '∞' : breakEven.months.toFixed(1)} months</span>
            </span>
          </div>
          <div className={`mt-3 verdict-badge ${breakEven.verdict === 'move' ? 'verdict-badge-good' : breakEven.verdict === 'close' ? 'verdict-badge-fair' : 'verdict-badge-overpaying'}`}>
            {breakEven.verdict === 'move' && `🟢 MOVING IS FINANCIALLY BETTER (saves ~$${fmt(Math.abs(breakEven.yearOneSavings))} in year one)`}
            {breakEven.verdict === 'close' && `🟡 CLOSE CALL — depends on your situation`}
            {breakEven.verdict === 'stay' && `🔵 STAYING IS PROBABLY SMARTER`}
          </div>
        </motion.div>
      )}

      {/* Scenario Toggles */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
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

      {/* Email Capture — right after scenarios */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
      >
        <EmailCapture />
      </motion.div>

      <div className="text-center pt-4">
        <Button variant="outline" onClick={onReset} className="text-muted-foreground">
          ← Check another rent
        </Button>
      </div>
    </div>
  );
};

export default RentResults;
