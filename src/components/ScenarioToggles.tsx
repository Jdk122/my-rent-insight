import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Calculator } from 'lucide-react';

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
    <div className="brand-card space-y-6">
      <div>
        <p className="data-label mb-1">Scenario Calculator</p>
        <h3 className="font-display text-2xl text-foreground">What If…</h3>
      </div>

      <div className="space-y-5">
        <div className="space-y-3">
          <Label className="text-sm font-medium text-foreground">
            I find a place for…
          </Label>
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm text-muted-foreground">$</span>
            <Input
              type="number"
              value={scenarioNewRent}
              onChange={(e) => setScenarioNewRent(Number(e.target.value))}
              className="h-10 w-32 font-mono bg-background"
              min={0}
            />
            <span className="font-mono text-xs text-muted-foreground">/mo</span>
          </div>
          <Slider
            value={[scenarioNewRent]}
            onValueChange={([v]) => setScenarioNewRent(v)}
            min={Math.round(fmr * 0.6)}
            max={Math.round(currentRent * 1.2)}
            step={25}
          />
        </div>

        <div className="space-y-3">
          <Label className="text-sm font-medium text-foreground">
            Moving costs…
          </Label>
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm text-muted-foreground">$</span>
            <Input
              type="number"
              value={scenarioMovingCost}
              onChange={(e) => setScenarioMovingCost(Number(e.target.value))}
              className="h-10 w-32 font-mono bg-background"
              min={0}
            />
          </div>
          <Slider
            value={[scenarioMovingCost]}
            onValueChange={([v]) => setScenarioMovingCost(v)}
            min={500}
            max={10000}
            step={100}
          />
        </div>

        {hasIncrease && (
          <div className="space-y-3">
            <Label className="text-sm font-medium text-foreground">
              I negotiate my increase down to…
            </Label>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                value={scenarioNegotiatedPct}
                onChange={(e) => setScenarioNegotiatedPct(Number(e.target.value))}
                className="h-10 w-24 font-mono bg-background"
                min={0}
                step={0.5}
              />
              <span className="font-mono text-xs text-muted-foreground">%</span>
            </div>
            <Slider
              value={[scenarioNegotiatedPct]}
              onValueChange={([v]) => setScenarioNegotiatedPct(v)}
              min={0}
              max={20}
              step={0.5}
            />
          </div>
        )}
      </div>

      {/* Live verdict */}
      <div className="p-4 rounded-md bg-secondary border border-border">
        <div className="flex items-center gap-2">
          <Calculator className="w-4 h-4 text-muted-foreground" />
          <span className="font-mono text-sm font-semibold text-foreground">
            {breakEven.months === Infinity
              ? 'Moving would cost you more'
              : `Break-even: ${breakEven.months.toFixed(1)} months`}
          </span>
        </div>
        {breakEven.yearOneSavings !== 0 && (
          <p className="font-mono text-xs text-muted-foreground mt-1.5 ml-6">
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
