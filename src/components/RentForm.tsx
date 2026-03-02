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
  const [street, setStreet] = useState('');
  const [unit, setUnit] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [bedrooms, setBedrooms] = useState<BedroomType>('oneBr');
  const [currentRent, setCurrentRent] = useState('');
  const [rentIncrease, setRentIncrease] = useState('');
  const [increaseIsPercent, setIncreaseIsPercent] = useState(false);
  const [movingCosts] = useState('2500');
  const [showAddress, setShowAddress] = useState(false);

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
      currentRent: parseFloat(parseFormatted(currentRent)),
      rentIncrease: rentIncrease ? (increaseIsPercent ? parseFloat(rentIncrease) : parseFloat(parseFormatted(rentIncrease))) : null,
      increaseIsPercent,
      movingCosts: parseFloat(movingCosts) || 2500,
    });
  };

  return (
    <div>
      <form onSubmit={handleSubmit} className="border border-border rounded-2xl p-6 md:p-8 bg-card space-y-5">
        {/* Zip Code — first and prominent */}
        <div className="space-y-1.5">
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
          <p className="text-xs text-muted-foreground">
            This is the only required field. Add details below for sharper insights.
          </p>
        </div>

        {/* Collapsible address section */}
        {!showAddress ? (
          <button
            type="button"
            onClick={() => setShowAddress(true)}
            className="text-sm text-primary font-medium hover:underline transition-colors flex items-center gap-1.5"
          >
            <span>→</span> Add your full address for building-specific data
          </button>
        ) : (
          <div className="space-y-3 animate-fade-in">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Street Address</Label>
              <Input
                type="text"
                placeholder="123 Main St"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                className="h-11 text-sm bg-background"
              />
            </div>
            <div className="grid grid-cols-[72px,1fr,72px] gap-2">
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
            </div>
            {hasStreet && !hasFullAddress && (
              <p className="text-[11px] text-destructive/70">
                Fill in city & state for building-specific data
              </p>
            )}
          </div>
        )}

        <div className="border-t border-border" />

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
