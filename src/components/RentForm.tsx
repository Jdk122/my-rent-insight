import { useState } from 'react';
import { BedroomType, bedroomLabels } from '@/data/rentData';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AddressAutocomplete from '@/components/AddressAutocomplete';

export interface RentFormData {
  zip: string;
  fullAddress: string | null;
  bedrooms: BedroomType;
  currentRent: number;
  rentIncrease: number | null;
  increaseIsPercent: boolean;
  movingCosts: number;
}


const fmtInput = (val: string) => {
  const digits = val.replace(/[^\d]/g, '');
  if (!digits) return '';
  return Number(digits).toLocaleString('en-US');
};

const parseFormatted = (val: string) => val.replace(/,/g, '');

interface RentFormProps {
  onSubmit: (data: RentFormData) => void;
  isLoading?: boolean;
}

const RentForm = ({ onSubmit, isLoading }: RentFormProps) => {
  const [zip, setZip] = useState('');
  const [fullAddress, setFullAddress] = useState<string | null>(null);
  const [unit, setUnit] = useState('');
  const [bedrooms, setBedrooms] = useState<BedroomType>('oneBr');
  const [currentRent, setCurrentRent] = useState('');
  const [rentIncrease, setRentIncrease] = useState('');
  const [increaseIsPercent, setIncreaseIsPercent] = useState(false);
  const [movingCosts] = useState('2500');
  const [showZipOnly, setShowZipOnly] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const trimmedZip = zip.trim();
    if (!trimmedZip || trimmedZip.length !== 5 || !currentRent) return;

    const addressWithUnit = fullAddress
      ? (unit.trim() ? `${fullAddress.replace(/, USA$/, '')} ${unit.trim()}, USA` : fullAddress)
      : null;

    onSubmit({
      zip: trimmedZip,
      fullAddress: addressWithUnit,
      bedrooms,
      currentRent: parseFloat(parseFormatted(currentRent)),
      rentIncrease: rentIncrease ? (increaseIsPercent ? parseFloat(rentIncrease) : parseFloat(parseFormatted(rentIncrease))) : null,
      increaseIsPercent,
      movingCosts: parseFloat(movingCosts) || 2500,
    });
  };

  return (
    <div>
      <form onSubmit={handleSubmit} className="border border-border rounded-2xl p-6 md:p-8 bg-card space-y-5">
        {/* Address — primary input */}
        {!showZipOnly && (
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-foreground">Your Address</Label>
            <AddressAutocomplete
              className="h-12 text-sm bg-background"
              placeholder="Start typing your address..."
              onSelect={(addr) => {
                if (addr.zip) setZip(addr.zip);
                setFullAddress(addr.fullAddress);
              }}
            />
            {fullAddress && (
              <div className="space-y-2 animate-fade-in">
                <p className="text-[11px] text-muted-foreground truncate">✓ {fullAddress}</p>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground">Apt / Unit <span className="text-muted-foreground/60">(optional)</span></Label>
                  <Input
                    type="text"
                    placeholder="e.g. #4B"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="h-10 text-sm bg-background w-32"
                  />
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={() => setShowZipOnly(true)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Don't want to enter your address? Just use your zip code →
            </button>
          </div>
        )}

        {/* Zip Code — shown standalone when toggled, or as auto-filled hidden field */}
        {showZipOnly && (
          <div className="space-y-1.5 animate-fade-in">
            <Label className="text-sm font-medium text-foreground">Zip Code <span className="text-destructive">*</span></Label>
            <Input
              type="text"
              inputMode="numeric"
              placeholder="e.g. 78701"
              value={zip}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 5);
                setZip(v);
              }}
              className="h-12 text-sm bg-background"
              required
              maxLength={5}
            />
            <button
              type="button"
              onClick={() => setShowZipOnly(false)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Enter your full address instead
            </button>
          </div>
        )}

        {/* Auto-filled zip indicator when using address mode */}
        {!showZipOnly && zip && (
          <p className="text-xs text-muted-foreground">
            Zip code: <span className="font-mono font-medium text-foreground">{zip}</span>
          </p>
        )}

        <div className="border-t border-border" />

        {/* Bedrooms — native select for reliability */}
        <div className="space-y-1.5">
          <Label htmlFor="bedrooms-select" className="text-sm font-medium text-foreground">Bedrooms</Label>
          <select
            id="bedrooms-select"
            value={bedrooms}
            onChange={(e) => setBedrooms(e.target.value as BedroomType)}
            className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 appearance-none"
            style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em', paddingRight: '2.5rem' }}
          >
            {Object.entries(bedroomLabels).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        {/* Current rent */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-foreground">Current Monthly Rent</Label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-sm text-muted-foreground">$</span>
            <Input
              type="text"
              inputMode="numeric"
              placeholder="2,500"
              value={currentRent}
              onChange={(e) => setCurrentRent(fmtInput(e.target.value))}
              className="h-12 pl-8 font-mono text-lg bg-background"
              required
            />
          </div>
        </div>

        {/* Proposed increase */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-foreground">Proposed Increase</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              {!increaseIsPercent && (
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-sm text-muted-foreground">$</span>
              )}
              <Input
                type={increaseIsPercent ? 'number' : 'text'}
                inputMode="numeric"
                placeholder={increaseIsPercent ? "8.5" : "200"}
                value={rentIncrease}
                onChange={(e) => {
                  if (increaseIsPercent) {
                    setRentIncrease(e.target.value);
                  } else {
                    setRentIncrease(fmtInput(e.target.value));
                  }
                }}
                className={`h-12 font-mono text-lg bg-background ${!increaseIsPercent ? 'pl-8' : 'pl-3.5'}`}
                min={0}
                step={increaseIsPercent ? 0.1 : undefined}
              />
            </div>
            <div className="flex rounded-lg border border-border overflow-hidden">
              <button
                type="button"
                className={`h-12 w-11 text-sm font-mono flex items-center justify-center transition-colors ${
                  !increaseIsPercent
                    ? 'bg-foreground text-background font-bold'
                    : 'bg-background text-muted-foreground hover:bg-secondary'
                }`}
                onClick={() => setIncreaseIsPercent(false)}
              >
                $
              </button>
              <button
                type="button"
                className={`h-12 w-11 text-sm font-mono flex items-center justify-center transition-colors ${
                  increaseIsPercent
                    ? 'bg-foreground text-background font-bold'
                    : 'bg-background text-muted-foreground hover:bg-secondary'
                }`}
                onClick={() => setIncreaseIsPercent(true)}
              >
                %
              </button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            The amount your landlord wants to raise your rent by.
          </p>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full h-14 bg-primary text-primary-foreground text-base font-bold rounded-lg hover:opacity-90 active:scale-[0.99] transition-all duration-200 disabled:opacity-60 disabled:pointer-events-none"
        >
          {isLoading ? 'Loading data…' : 'Check my increase →'}
        </button>
      </form>

      {/* Credibility badges */}
      <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-6 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="18" rx="2"/><path d="M8 7h8M8 12h8M8 17h4"/></svg>
          38,000+ zip codes covered
        </span>
        <span className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          Results in under 10 seconds
        </span>
        <span className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-5"/></svg>
          Free negotiation letter included
        </span>
      </div>
    </div>
  );
};

export default RentForm;
