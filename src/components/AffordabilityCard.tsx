import { AlertTriangle } from 'lucide-react';

interface AffordabilityCardProps {
  currentRent: number;
  newRent: number;
  medianHouseholdIncome: number | null;
  zip: string;
}

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

const AffordabilityCard = ({ currentRent, newRent, medianHouseholdIncome, zip }: AffordabilityCardProps) => {
  if (!medianHouseholdIncome) return null;

  const monthlyIncome = medianHouseholdIncome / 12;
  const currentBurden = Math.round((currentRent / monthlyIncome) * 100);
  const newBurden = Math.round((newRent / monthlyIncome) * 100);
  const isCostBurdened = newBurden > 30;
  const isSevereBurden = newBurden > 50;

  const burdenColor = isSevereBurden
    ? 'text-verdict-overpaying'
    : isCostBurdened
      ? 'text-verdict-fair'
      : 'text-verdict-good';

  const burdenLabel = isSevereBurden
    ? 'Severely Cost-Burdened'
    : isCostBurdened
      ? 'Cost-Burdened'
      : 'Affordable';

  const fillColor = isSevereBurden
    ? 'hsl(var(--verdict-overpaying))'
    : isCostBurdened
      ? 'hsl(var(--verdict-fair))'
      : 'hsl(var(--verdict-good))';

  return (
    <div className="brand-card-afford space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0" style={{ background: 'hsl(var(--accent-amber) / 0.1)' }}>
          <span className="font-mono text-sm font-bold" style={{ color: 'hsl(var(--accent-amber))' }}>%</span>
        </div>
        <div>
          <p className="data-label mb-0">Affordability</p>
          <h3 className="font-display text-xl text-foreground leading-tight">
            Rent burden analysis
          </h3>
        </div>
      </div>

      <div className="divide-y divide-border">
        <div className="data-row">
          <span className="data-row-label">Area median income</span>
          <span className="data-row-value">${fmt(medianHouseholdIncome)}/yr</span>
        </div>
        <div className="data-row">
          <span className="data-row-label">Current burden</span>
          <span className="data-row-value">{currentBurden}%</span>
        </div>
        <div className="data-row">
          <span className="data-row-label">New burden</span>
          <span className={`data-row-value ${burdenColor}`}>{newBurden}%</span>
        </div>
        <div className="data-row">
          <span className="data-row-label">HUD threshold</span>
          <span className="data-row-value">30%</span>
        </div>
      </div>

      {/* Burden bar */}
      <div className="space-y-1.5">
        <div className="percentile-bar">
          <div
            className="percentile-fill"
            style={{ width: `${Math.min(newBurden * 1.67, 100)}%`, background: fillColor }}
          />
          <div
            className="absolute top-0 h-full w-px bg-foreground/20"
            style={{ left: '50%' }}
          />
        </div>
        <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
          <span>0%</span>
          <span>30%</span>
          <span>60%+</span>
        </div>
      </div>

      <div className={`verdict-pill ${isSevereBurden ? 'verdict-pill-overpaying' : isCostBurdened ? 'verdict-pill-fair' : 'verdict-pill-good'}`}>
        {burdenLabel}
      </div>

      {isCostBurdened && (
        <div className="flex items-start gap-2 p-3 rounded-lg" style={{ background: 'hsl(var(--accent-amber) / 0.06)', border: '1px solid hsl(var(--accent-amber) / 0.15)' }}>
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: 'hsl(var(--accent-amber))' }} />
          <p className="text-xs text-foreground leading-relaxed">
            At ${fmt(newRent)}/mo, rent is {newBurden}% of area median income — {isSevereBurden ? 'well above' : 'above'} the 30% guideline.
          </p>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground">
        Census ACS median household income for {zip}. Your income may differ.
      </p>
    </div>
  );
};

export default AffordabilityCard;
