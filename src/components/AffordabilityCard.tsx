import { AlertTriangle, DollarSign } from 'lucide-react';

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
  const areaBurden = currentBurden; // proxy: current rent vs area median income
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

  return (
    <div className="brand-card space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-md bg-secondary shrink-0 mt-0.5">
          <DollarSign className="w-4 h-4 text-foreground" />
        </div>
        <div>
          <p className="data-label mb-0.5">Affordability</p>
          <h3 className="font-display text-xl text-foreground leading-tight">
            Rent burden analysis
          </h3>
        </div>
      </div>

      <div className="space-y-0 divide-y divide-border text-sm">
        <div className="flex justify-between py-3">
          <span className="text-muted-foreground">Area median household income</span>
          <span className="font-mono font-semibold text-foreground">${fmt(medianHouseholdIncome)}/yr</span>
        </div>
        <div className="flex justify-between py-3">
          <span className="text-muted-foreground">Current rent-to-income ratio</span>
          <span className="font-mono font-semibold text-foreground">{currentBurden}%</span>
        </div>
        <div className="flex justify-between py-3">
          <span className="text-muted-foreground">New rent-to-income ratio</span>
          <span className={`font-mono font-semibold ${burdenColor}`}>{newBurden}%</span>
        </div>
        <div className="flex justify-between py-3">
          <span className="text-muted-foreground">HUD affordability threshold</span>
          <span className="font-mono font-semibold text-foreground">30%</span>
        </div>
      </div>

      {/* Burden bar visualization */}
      <div className="space-y-2">
        <div className="percentile-bar">
          <div
            className="percentile-fill"
            style={{
              width: `${Math.min(newBurden, 100)}%`,
              background: isSevereBurden
                ? 'hsl(var(--verdict-overpaying))'
                : isCostBurdened
                  ? 'hsl(var(--verdict-fair))'
                  : 'hsl(var(--verdict-good))',
            }}
          />
          {/* 30% threshold marker */}
          <div
            className="absolute top-0 h-full w-px bg-foreground/30"
            style={{ left: '30%' }}
          />
        </div>
        <div className="flex justify-between text-xs font-mono text-muted-foreground">
          <span>0%</span>
          <span className="text-foreground/50">30% threshold</span>
          <span>60%+</span>
        </div>
      </div>

      {/* Verdict pill */}
      <div className={`verdict-pill ${isSevereBurden ? 'verdict-pill-overpaying' : isCostBurdened ? 'verdict-pill-fair' : 'verdict-pill-good'}`}>
        {burdenLabel}
      </div>

      {isCostBurdened && (
        <div className="flex items-start gap-2 p-3 rounded-md bg-accent/10 border border-accent/20">
          <AlertTriangle className="w-4 h-4 text-accent shrink-0 mt-0.5" />
          <p className="text-sm text-foreground">
            At ${fmt(newRent)}/mo, your rent would represent {newBurden}% of the area median household income
            — {isSevereBurden ? 'well above' : 'above'} HUD's 30% affordability guideline.
          </p>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Based on Census ACS median household income for {zip}. Your personal income may differ.
      </p>
    </div>
  );
};

export default AffordabilityCard;
