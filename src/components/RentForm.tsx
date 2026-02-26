import { useState } from 'react';
import { BedroomType, bedroomLabels } from '@/data/rentData';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface RentFormData {
  zip: string;
  fullAddress: string | null;
  bedrooms: BedroomType;
  currentRent: number;
  rentIncrease: number | null;
  increaseIsPercent: boolean;
  movingCosts: number;
}

function isZipOnly(input: string): boolean {
  return /^\d{5}$/.test(input.trim());
}

interface RentFormProps {
  onSubmit: (data: RentFormData) => void;
  isLoading?: boolean;
}

const RentForm = ({ onSubmit, isLoading }: RentFormProps) => {
  const [addressInput, setAddressInput] = useState('');
  const [bedrooms, setBedrooms] = useState<BedroomType>('oneBr');
  const [currentRent, setCurrentRent] = useState('');
  const [rentIncrease, setRentIncrease] = useState('');
  const [increaseIsPercent, setIncreaseIsPercent] = useState(true);
  const [movingCosts] = useState('2500');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = addressInput.trim();
    if (!trimmed || !currentRent) return;

    const zipOnly = isZipOnly(trimmed);

    onSubmit({
      zip: zipOnly ? trimmed : '', // Will be filled from Rentcast response if address
      fullAddress: zipOnly ? null : trimmed,
      bedrooms,
      currentRent: parseFloat(currentRent),
      rentIncrease: rentIncrease ? parseFloat(rentIncrease) : null,
      increaseIsPercent,
      movingCosts: parseFloat(movingCosts) || 2500,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Address/Zip + Bedrooms */}
      <div className="grid grid-cols-[1fr,140px] gap-3">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-foreground">Address or Zip Code</Label>
          <Input
            type="text"
            placeholder="e.g. 123 Main St, Austin, TX 78701"
            value={addressInput}
            onChange={(e) => setAddressInput(e.target.value)}
            className="h-11 text-sm bg-background"
            required
          />
          <p className="text-[11px] text-muted-foreground mt-1">Include city & state for best results, or just enter a 5-digit zip</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-foreground">Bedrooms</Label>
          <Select value={bedrooms} onValueChange={(v) => setBedrooms(v as BedroomType)}>
            <SelectTrigger className="h-11 text-sm bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(bedroomLabels).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Current rent */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-foreground">Current Monthly Rent</Label>
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-sm text-muted-foreground">$</span>
          <Input
            type="number"
            placeholder="2,500"
            value={currentRent}
            onChange={(e) => setCurrentRent(e.target.value)}
            className="h-12 pl-8 font-mono text-lg bg-background"
            min={0}
            required
          />
        </div>
      </div>

      {/* Rent increase */}
      <div className="space-y-1.5 pt-3 border-t border-border">
        <Label className="text-sm font-medium text-foreground">How much is your landlord raising your rent?</Label>
        <div className="flex gap-2 mt-2">
          <div className="relative flex-1">
            {!increaseIsPercent && (
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-sm text-muted-foreground">$</span>
            )}
            <Input
              type="number"
              placeholder={increaseIsPercent ? "8.5" : "200"}
              value={rentIncrease}
              onChange={(e) => setRentIncrease(e.target.value)}
              className={`h-12 font-mono text-lg bg-background ${!increaseIsPercent ? 'pl-8' : 'pl-3.5'}`}
              min={0}
              step={increaseIsPercent ? 0.1 : 1}
            />
          </div>
          <button
            type="button"
            className="h-12 w-12 rounded-lg border border-border text-xs font-mono text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors flex items-center justify-center"
            onClick={() => setIncreaseIsPercent(!increaseIsPercent)}
            title={increaseIsPercent ? 'Switch to dollar amount' : 'Switch to percentage'}
          >
            {increaseIsPercent ? '%' : '$'}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full h-14 bg-primary text-primary-foreground text-base font-bold rounded-lg hover:opacity-90 active:scale-[0.99] transition-all duration-200 disabled:opacity-60 disabled:pointer-events-none"
      >
        {isLoading ? 'Loading data…' : 'Check my increase →'}
      </button>
      <p className="text-center text-xs text-muted-foreground mt-6">38,000+ zip codes · Data from HUD, Census & Zillow</p>
    </form>
  );
};

export default RentForm;
