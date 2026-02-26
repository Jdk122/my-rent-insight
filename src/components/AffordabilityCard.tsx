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
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-display text-xl text-foreground mb-0.5">Affordability</h2>
          <p className="text-[13px] text-muted-foreground">Rent burden vs. area median income</p>
        </div>
        <span className={`verdict-pill ${isSevereBurden ? 'verdict-pill-overpaying' : isCostBurdened ? 'verdict-pill-fair' : 'verdict-pill-good'}`}>
          {burdenLabel}
        </span>
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
      <div className="mt-4 space-y-1.5">
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

      {isCostBurdened && (
        <div className="callout callout-warn mt-4">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'hsl(var(--verdict-overpaying))' }} />
          <p className="text-xs text-foreground leading-relaxed">
            At ${fmt(newRent)}/mo, rent is {newBurden}% of area median income — {isSevereBurden ? 'well above' : 'above'} the 30% guideline.
          </p>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground mt-3">
        Census ACS median household income for {zip}. Your income may differ.
      </p>
    </div>
  );
};

export default AffordabilityCard;
