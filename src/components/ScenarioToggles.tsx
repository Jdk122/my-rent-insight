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
    <div>
      <h2 className="font-display text-xl text-foreground mb-1">What If…</h2>
      <p className="text-sm text-muted-foreground mb-5">Adjust the numbers to explore your options</p>

      <div className="space-y-5">
        <div className="space-y-2">
          <Label className="text-[13px] font-medium text-foreground">I find a place for…</Label>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">$</span>
            <Input
              type="number"
              value={scenarioNewRent}
              onChange={(e) => setScenarioNewRent(Number(e.target.value))}
              className="h-9 w-28 font-mono text-sm bg-background"
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

        <div className="space-y-2">
          <Label className="text-[13px] font-medium text-foreground">Moving costs…</Label>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">$</span>
            <Input
              type="number"
              value={scenarioMovingCost}
              onChange={(e) => setScenarioMovingCost(Number(e.target.value))}
              className="h-9 w-28 font-mono text-sm bg-background"
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
          <div className="space-y-2">
            <Label className="text-[13px] font-medium text-foreground">I negotiate down to…</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={scenarioNegotiatedPct}
                onChange={(e) => setScenarioNegotiatedPct(Number(e.target.value))}
                className="h-9 w-20 font-mono text-sm bg-background"
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

      {/* Result */}
      <div className="callout mt-5">
        <Calculator className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
        <div>
          <p className="font-mono text-sm font-semibold text-foreground">
            {breakEven.months === Infinity
              ? 'Moving would cost more'
              : `Break-even: ${breakEven.months.toFixed(1)} months`}
          </p>
          {breakEven.yearOneSavings !== 0 && (
            <p className="font-mono text-xs text-muted-foreground mt-0.5">
              {breakEven.yearOneSavings > 0
                ? `Saves ~$${fmt(breakEven.yearOneSavings)} yr 1 after moving costs`
                : `Costs ~$${fmt(Math.abs(breakEven.yearOneSavings))} more yr 1`}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScenarioToggles;
