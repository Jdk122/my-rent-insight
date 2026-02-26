import { useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, Search, Lock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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

    // Simulate API delay
    setTimeout(() => {
      const data = estimateLandlordCosts(address, rentData, bedrooms);
      setCostData(data);
      onCostData(data);
      setIsLoading(false);
    }, 800);
  };

  const profit = costData ? currentRent - costData.totalCosts : 0;
  const annualProfit = profit * 12;
  const annualIncreaseAmount = increaseAmount * 12;

  if (!costData) {
    return (
      <div>
        <div className="flex items-start gap-3 mb-5">
          <Building2 className="w-5 h-5 text-primary mt-0.5 shrink-0" />
          <div>
            <h3 className="font-display text-2xl text-foreground">
              Want to know what your landlord actually pays?
            </h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-md leading-relaxed">
              Enter your address and we'll estimate their mortgage, taxes, and fees — so you can see the real margin on your unit.
            </p>
          </div>
        </div>

        <div className="flex gap-2 max-w-md">
          <Input
            placeholder="123 Main St, Apt 4B"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
            className="h-10 font-mono text-sm bg-background flex-1"
          />
          <Button
            onClick={handleLookup}
            disabled={!address.trim() || isLoading}
            className="h-10 px-5 gap-2 text-sm font-semibold shrink-0"
          >
            {isLoading ? (
              <span className="animate-pulse">Looking up…</span>
            ) : (
              <>
                <Search className="w-3.5 h-3.5" />
                Look Up
              </>
            )}
          </Button>
        </div>

        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-3">
          <Lock className="w-3 h-3" />
          We only use public records. Your address is never shared.
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
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <h3 className="font-display text-2xl md:text-3xl text-foreground mb-1">
        Your Landlord's Estimated Costs
      </h3>
      <p className="text-sm text-muted-foreground mb-6">
        {address}, {rentData.city}
      </p>

      <div className="space-y-0">
        {costRows.map((row, i) => (
          <div
            key={row.label}
            className={`flex items-center justify-between py-3 ${
              i > 0 ? 'border-t border-border/60' : ''
            } ${row.bold ? 'pt-4' : ''}`}
          >
            <span className={`text-[13px] ${row.bold || row.highlight ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
              {row.label}
            </span>
            <span className={`font-mono text-[13px] font-semibold tabular-nums ${
              row.highlight ? 'text-verdict-good text-base' : 'text-foreground'
            }`}>
              {row.value}
            </span>
          </div>
        ))}
      </div>

      {/* Summary insight */}
      <p className="text-sm text-muted-foreground mt-6 leading-relaxed">
        Your landlord is estimated to clear{' '}
        <span className="font-mono font-bold text-foreground">~${fmt(annualProfit)}/year</span> on your unit.
        {increaseAmount > 0 && (
          <> They're asking for a <span className="font-mono font-semibold text-foreground">${fmt(increaseAmount)}/month</span> increase
          when their costs likely went up <span className="font-mono font-semibold text-foreground">${fmt(costData.monthlyCostIncrease)}/month</span>.</>
        )}
      </p>

      <p className="text-[10px] text-muted-foreground mt-4">
        Estimates based on public records and typical financing for a {costData.purchaseYear} purchase at ~${fmt(costData.purchasePrice)}. Actual costs may vary.
      </p>
    </motion.div>
  );
};

export default LandlordCostLookup;
