import { useState } from 'react';
import { BedroomType, bedroomLabels } from '@/data/rentData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowRight } from 'lucide-react';

export interface RentFormData {
  zip: string;
  bedrooms: BedroomType;
  currentRent: number;
  rentIncrease: number | null;
  increaseIsPercent: boolean;
  movingCosts: number;
}

interface RentFormProps {
  onSubmit: (data: RentFormData) => void;
}

const RentForm = ({ onSubmit }: RentFormProps) => {
  const [zip, setZip] = useState('');
  const [bedrooms, setBedrooms] = useState<BedroomType>('oneBr');
  const [currentRent, setCurrentRent] = useState('');
  const [rentIncrease, setRentIncrease] = useState('');
  const [increaseIsPercent, setIncreaseIsPercent] = useState(true);
  const [movingCosts, setMovingCosts] = useState('2500');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!zip || !currentRent) return;
    onSubmit({
      zip: zip.trim(),
      bedrooms,
      currentRent: parseFloat(currentRent),
      rentIncrease: rentIncrease ? parseFloat(rentIncrease) : null,
      increaseIsPercent,
      movingCosts: parseFloat(movingCosts) || 2500,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Zip + Bedrooms */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-foreground">Zip Code</Label>
          <Input
            type="text"
            placeholder="07030"
            value={zip}
            onChange={(e) => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
            maxLength={5}
            className="h-11 font-mono text-sm bg-background"
            required
          />
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
        <Label className="text-sm font-medium text-primary">Proposed Increase</Label>
        <p className="text-sm text-muted-foreground leading-relaxed">How much is your landlord raising your rent?</p>
        <div className="flex gap-2 mt-2">
          <div className="relative flex-1">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-sm text-muted-foreground">
              {increaseIsPercent ? '%' : '$'}
            </span>
            <Input
              type="number"
              placeholder={increaseIsPercent ? "8.5" : "200"}
              value={rentIncrease}
              onChange={(e) => setRentIncrease(e.target.value)}
              className="h-12 pl-8 font-mono text-lg bg-background"
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

      {/* Moving costs — collapsed feel */}
      <details className="group">
        <summary className="text-sm font-medium text-muted-foreground cursor-pointer select-none py-1 hover:text-foreground transition-colors">
          <span className="ml-1">Moving costs (optional)</span>
        </summary>
        <div className="mt-2">
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-sm text-muted-foreground">$</span>
            <Input
              type="number"
              placeholder="2,500"
              value={movingCosts}
              onChange={(e) => setMovingCosts(e.target.value)}
              className="h-10 pl-8 font-mono text-sm bg-background"
              min={0}
            />
          </div>
        </div>
      </details>

      <button
        type="submit"
        className="w-full h-14 bg-gradient-to-r from-primary to-accent text-primary-foreground text-base font-bold rounded-md shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 hover:scale-[1.01] active:scale-[0.99] transition-all duration-200"
      >
        Check my increase →
      </button>
    </form>
  );
};

export default RentForm;
