import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';

interface ScenarioTogglesProps {
  currentRent: number;
  fmr: number;
  scenarioNewRent: number;
  setScenarioNewRent: (v: number) => void;
  scenarioMovingCost: number;
  setScenarioMovingCost: (v: number) => void;
  scenarioNegotiatedPct: number;
  setScenarioNegotiatedPct: (v: number) => void;
  breakEven: { months: number; verdict: string; yearOneSavings: number };
  hasIncrease: boolean;
}

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

const ScenarioToggles = ({
  currentRent,
  fmr,
  scenarioNewRent,
  setScenarioNewRent,
  scenarioMovingCost,
  setScenarioMovingCost,
  scenarioNegotiatedPct,
  setScenarioNegotiatedPct,
  breakEven,
  hasIncrease,
}: ScenarioTogglesProps) => {
  return (
    <div className="stat-card space-y-6">
      <h3 className="font-display text-xl">What If…</h3>

      {/* What if I find a place for $X? */}
      <div className="space-y-2">
        <Label className="text-sm text-muted-foreground">
          "What if I find a place for…"
        </Label>
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground">$</span>
          <Input
            type="number"
            value={scenarioNewRent}
            onChange={(e) => setScenarioNewRent(Number(e.target.value))}
            className="h-10 w-32"
            min={0}
          />
          <span className="text-sm text-muted-foreground">/month</span>
        </div>
        <Slider
          value={[scenarioNewRent]}
          onValueChange={([v]) => setScenarioNewRent(v)}
          min={Math.round(fmr * 0.6)}
          max={Math.round(currentRent * 1.2)}
          step={25}
          className="mt-2"
        />
      </div>

      {/* What if moving costs $X? */}
      <div className="space-y-2">
        <Label className="text-sm text-muted-foreground">
          "What if moving costs…"
        </Label>
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground">$</span>
          <Input
            type="number"
            value={scenarioMovingCost}
            onChange={(e) => setScenarioMovingCost(Number(e.target.value))}
            className="h-10 w-32"
            min={0}
          />
        </div>
        <Slider
          value={[scenarioMovingCost]}
          onValueChange={([v]) => setScenarioMovingCost(v)}
          min={500}
          max={10000}
          step={100}
          className="mt-2"
        />
      </div>

      {/* What if I negotiate? */}
      {hasIncrease && (
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">
            "What if I negotiate my increase down to…"
          </Label>
          <div className="flex items-center gap-3">
            <Input
              type="number"
              value={scenarioNegotiatedPct}
              onChange={(e) => setScenarioNegotiatedPct(Number(e.target.value))}
              className="h-10 w-24"
              min={0}
              step={0.5}
            />
            <span className="text-sm text-muted-foreground">%</span>
          </div>
          <Slider
            value={[scenarioNegotiatedPct]}
            onValueChange={([v]) => setScenarioNegotiatedPct(v)}
            min={0}
            max={20}
            step={0.5}
            className="mt-2"
          />
        </div>
      )}

      {/* Live verdict */}
      <div className="rounded-lg bg-secondary p-4">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-lg">
            {breakEven.verdict === 'move' ? '🟢' : breakEven.verdict === 'close' ? '🟡' : '🔵'}
          </span>
          <span className="font-semibold text-foreground">
            {breakEven.months === Infinity
              ? 'Moving would cost you more'
              : `Break-even: ${breakEven.months.toFixed(1)} months`}
          </span>
        </div>
        {breakEven.yearOneSavings !== 0 && (
          <p className="text-sm text-muted-foreground mt-1 ml-8">
            {breakEven.yearOneSavings > 0
              ? `Saves ~$${fmt(breakEven.yearOneSavings)} in year one after moving costs`
              : `Costs ~$${fmt(Math.abs(breakEven.yearOneSavings))} more in year one`}
          </p>
        )}
      </div>
    </div>
  );
};

export default ScenarioToggles;
