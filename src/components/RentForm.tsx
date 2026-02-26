import { useState } from 'react';
import { BedroomType, bedroomLabels } from '@/data/rentData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="zip" className="text-sm font-medium text-foreground">
          Zip Code
        </Label>
        <Input
          id="zip"
          type="text"
          placeholder="e.g. 07030"
          value={zip}
          onChange={(e) => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
          maxLength={5}
          className="h-12 text-lg"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="bedrooms" className="text-sm font-medium text-foreground">
          Bedrooms
        </Label>
        <Select value={bedrooms} onValueChange={(v) => setBedrooms(v as BedroomType)}>
          <SelectTrigger className="h-12 text-lg">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(bedroomLabels).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="rent" className="text-sm font-medium text-foreground">
          Your Current Monthly Rent
        </Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg text-muted-foreground">$</span>
          <Input
            id="rent"
            type="number"
            placeholder="2,500"
            value={currentRent}
            onChange={(e) => setCurrentRent(e.target.value)}
            className="h-12 pl-8 text-lg"
            min={0}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="increase" className="text-sm font-medium text-foreground">
          Rent Increase <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg text-muted-foreground">
              {increaseIsPercent ? '%' : '$'}
            </span>
            <Input
              id="increase"
              type="number"
              placeholder={increaseIsPercent ? "6.6" : "165"}
              value={rentIncrease}
              onChange={(e) => setRentIncrease(e.target.value)}
              className="h-12 pl-8 text-lg"
              min={0}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-12 px-4 text-sm"
            onClick={() => setIncreaseIsPercent(!increaseIsPercent)}
          >
            {increaseIsPercent ? '% → $' : '$ → %'}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="moving" className="text-sm font-medium text-foreground">
          Estimated Moving Costs <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg text-muted-foreground">$</span>
          <Input
            id="moving"
            type="number"
            placeholder="2,500"
            value={movingCosts}
            onChange={(e) => setMovingCosts(e.target.value)}
            className="h-12 pl-8 text-lg"
            min={0}
          />
        </div>
      </div>

      <Button type="submit" className="w-full h-14 text-lg font-semibold mt-4">
        Check My Rent
      </Button>
    </form>
  );
};

export default RentForm;
