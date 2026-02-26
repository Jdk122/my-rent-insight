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
  const [increaseIsPercent, setIncreaseIsPercent] = useState(false);
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
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Primary fields — side by side */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="data-label">Zip Code</Label>
          <Input
            type="text"
            placeholder="07030"
            value={zip}
            onChange={(e) => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
            maxLength={5}
            className="h-12 font-mono text-base bg-background"
            required
          />
        </div>
        <div className="space-y-2">
          <Label className="data-label">Bedrooms</Label>
          <Select value={bedrooms} onValueChange={(v) => setBedrooms(v as BedroomType)}>
            <SelectTrigger className="h-12 text-base bg-background">
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

      {/* Current rent — full width, prominent */}
      <div className="space-y-2">
        <Label className="data-label">Current Monthly Rent</Label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono text-muted-foreground">$</span>
          <Input
            type="number"
            placeholder="2,500"
            value={currentRent}
            onChange={(e) => setCurrentRent(e.target.value)}
            className="h-14 pl-9 font-mono text-xl bg-background"
            min={0}
            required
          />
        </div>
      </div>

      {/* Optional fields */}
      <div className="border-t border-border pt-5 space-y-4">
        <p className="data-label">Optional</p>
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">Rent Increase</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono text-sm text-muted-foreground">
                {increaseIsPercent ? '%' : '$'}
              </span>
              <Input
                type="number"
                placeholder={increaseIsPercent ? "6.6" : "165"}
                value={rentIncrease}
                onChange={(e) => setRentIncrease(e.target.value)}
                className="h-11 pl-9 font-mono bg-background"
                min={0}
              />
            </div>
            <button
              type="button"
              className="h-11 px-3 rounded-md border border-border text-xs font-mono text-muted-foreground hover:bg-secondary transition-colors"
              onClick={() => setIncreaseIsPercent(!increaseIsPercent)}
            >
              {increaseIsPercent ? '%→$' : '$→%'}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">Moving Costs</Label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono text-sm text-muted-foreground">$</span>
            <Input
              type="number"
              placeholder="2,500"
              value={movingCosts}
              onChange={(e) => setMovingCosts(e.target.value)}
              className="h-11 pl-9 font-mono bg-background"
              min={0}
            />
          </div>
        </div>
      </div>

      <Button type="submit" size="lg" className="w-full h-13 text-base font-semibold gap-2 group">
        Analyze My Rent
        <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
      </Button>
    </form>
  );
};

export default RentForm;
