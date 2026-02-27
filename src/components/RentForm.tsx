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

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
];

interface RentFormProps {
  onSubmit: (data: RentFormData) => void;
  isLoading?: boolean;
}

const RentForm = ({ onSubmit, isLoading }: RentFormProps) => {
  const [street, setStreet] = useState('');
  const [unit, setUnit] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [bedrooms, setBedrooms] = useState<BedroomType>('oneBr');
  const [currentRent, setCurrentRent] = useState('');
  const [rentIncrease, setRentIncrease] = useState('');
  const [increaseIsPercent, setIncreaseIsPercent] = useState(true);
  const [movingCosts] = useState('2500');

  const hasStreet = street.trim().length > 0;
  const hasFullAddress = hasStreet && city.trim().length > 0 && state.length > 0 && zip.trim().length === 5;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedZip = zip.trim();
    if (!trimmedZip || trimmedZip.length !== 5 || !currentRent) return;

    let fullAddress: string | null = null;
    if (hasFullAddress) {
      const parts = [street.trim()];
      if (unit.trim()) parts[0] += ` ${unit.trim()}`;
      parts.push(`${city.trim()}, ${state} ${trimmedZip}`);
      fullAddress = parts.join(', ');
    }

    onSubmit({
      zip: trimmedZip,
      fullAddress,
      bedrooms,
      currentRent: parseFloat(currentRent),
      rentIncrease: rentIncrease ? parseFloat(rentIncrease) : null,
      increaseIsPercent,
      movingCosts: parseFloat(movingCosts) || 2500,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Street Address */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-foreground">Street Address <span className="text-muted-foreground font-normal">(optional — zip is enough)</span></Label>
        <Input
          type="text"
          placeholder="123 Main St"
          value={street}
          onChange={(e) => setStreet(e.target.value)}
          className="h-11 text-sm bg-background"
        />
      </div>

      {/* Apt/Unit + City + State + Zip */}
      <div className="grid grid-cols-[72px,1fr,72px,88px] gap-2">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Apt/Unit</Label>
          <Input
            type="text"
            placeholder="#3B"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="h-11 text-sm bg-background"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">City</Label>
          <Input
            type="text"
            placeholder="Austin"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="h-11 text-sm bg-background"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">State</Label>
          <Select value={state} onValueChange={setState}>
            <SelectTrigger className="h-11 text-xs bg-background">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              {US_STATES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-foreground">Zip Code<span className="text-destructive">*</span></Label>
          <Input
            type="text"
            inputMode="numeric"
            placeholder="78701"
            value={zip}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '').slice(0, 5);
              setZip(v);
            }}
            className="h-11 text-sm font-mono bg-background"
            required
            maxLength={5}
          />
        </div>
      </div>

      {/* Helper text */}
      {hasStreet && !hasFullAddress && (
        <p className="text-[11px] text-destructive/70 -mt-2">
          Fill in city, state & zip for building-specific data
        </p>
      )}
      {!hasStreet && (
        <p className="text-[11px] text-muted-foreground -mt-2">
          Just a zip code works — add your address for building-specific insights
        </p>
      )}

      {/* Bedrooms */}
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
