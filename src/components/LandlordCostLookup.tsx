import { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock } from 'lucide-react';
import { RentData } from '@/data/rentData';
import { BedroomType } from '@/data/rentData';
import { estimateLandlordCosts, LandlordCostEstimate } from '@/data/landlordCosts';

interface LandlordCostLookupProps {
  rentData: RentData;
  bedrooms: BedroomType;
  currentRent: number;
  increaseAmount: number;
  onCostData: (data: LandlordCostEstimate) => void;
}

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

const LandlordCostLookup = ({
  rentData,
  bedrooms,
  currentRent,
  increaseAmount,
  onCostData,
}: LandlordCostLookupProps) => {
  const [address, setAddress] = useState('');
  const [costData, setCostData] = useState<LandlordCostEstimate | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLookup = () => {
    if (!address.trim()) return;
    setIsLoading(true);
    setTimeout(() => {
      const data = estimateLandlordCosts(address, rentData, bedrooms);
      setCostData(data);
      onCostData(data);
      setIsLoading(false);
    }, 800);
  };

  const profit = costData ? currentRent - costData.totalCosts : 0;
  const annualProfit = profit * 12;

  if (!costData) {
    return (
      <div>
        <div className="text-3xl mb-3 opacity-70">🔍</div>
        <h2 className="font-display text-[22px] font-semibold text-foreground mb-2" style={{ letterSpacing: '-0.01em' }}>
          Want to see what your landlord actually pays?
        </h2>
        <p className="text-[15px] text-muted-foreground max-w-[380px] mx-auto mb-6 leading-relaxed">
          Enter your address and we'll estimate their mortgage, taxes, HOA, and profit margin.
        </p>

        <div className="flex gap-2 max-w-[440px] mx-auto">
          <input
            type="text"
            placeholder="123 Washington St, Apt 4B"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
            className="flex-1 px-4 py-3 text-sm border border-border rounded bg-card text-foreground outline-none focus:border-foreground transition-colors placeholder:text-muted-foreground/50"
          />
          <button
            onClick={handleLookup}
            disabled={!address.trim() || isLoading}
            className="bg-primary text-primary-foreground px-5 py-3 rounded text-sm font-semibold hover:opacity-90 transition-opacity whitespace-nowrap disabled:opacity-50"
          >
            {isLoading ? 'Looking up…' : 'Look up'}
          </button>
        </div>

        <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground mt-3">
          <Lock className="w-3 h-3" />
          Public records only. Your address is never shared.
        </p>
      </div>
    );
  }

  const costRows = [
    { label: 'Estimated mortgage', value: `$${fmt(costData.mortgage)}` },
    { label: 'Property taxes', value: `$${fmt(costData.propertyTax)}` },
    { label: 'HOA / condo fees', value: `$${fmt(costData.hoa)}` },
    { label: 'Insurance', value: `$${fmt(costData.insurance)}` },
    { label: 'Total estimated costs', value: `$${fmt(costData.totalCosts)}`, bold: true },
    { label: 'Your current rent', value: `$${fmt(currentRent)}`, bold: true },
    { label: 'Estimated monthly profit', value: `$${fmt(profit)}`, highlight: true },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="text-left"
    >
      <h2 className="section-title">Your landlord's estimated costs</h2>
      <p className="text-sm text-muted-foreground mb-6">
        {address}, {rentData.city}
      </p>

      {costRows.map((row, i) => (
        <div
          key={row.label}
          className={`context-row ${row.bold ? 'pt-4' : ''}`}
        >
          <span className={`context-label ${row.bold || row.highlight ? '!text-foreground !font-medium' : ''}`}>
            {row.label}
          </span>
          <span className={`context-value ${row.highlight ? '!text-verdict-good !text-lg' : ''}`}>
            {row.value}
          </span>
        </div>
      ))}

      <p className="text-sm text-muted-foreground mt-6 leading-relaxed text-left">
        Your landlord is estimated to clear{' '}
        <strong className="text-foreground font-semibold">~${fmt(annualProfit)}/year</strong> on your unit.
        {increaseAmount > 0 && (
          <> They're asking for a <strong className="text-foreground font-semibold">${fmt(increaseAmount)}/month</strong> increase
          when their costs likely went up <strong className="text-foreground font-semibold">${fmt(costData.monthlyCostIncrease)}/month</strong>.</>
        )}
      </p>

      <p className="text-[11px] text-muted-foreground mt-4 text-left">
        Estimates based on public records and typical financing for a {costData.purchaseYear} purchase at ~${fmt(costData.purchasePrice)}. Actual costs may vary.
      </p>
    </motion.div>
  );
};

export default LandlordCostLookup;
