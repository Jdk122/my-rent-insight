import { useState, useRef } from 'react';
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

const bedroomNumToKey: Record<number, BedroomType> = {
  0: 'studio',
  1: 'oneBr',
  2: 'twoBr',
  3: 'threeBr',
  4: 'fourBr',
};

export interface RentFormPrefill {
  zip?: string;
  bedrooms?: number;
  rent?: number;
  address?: string;
}

interface RentFormProps {
  onSubmit: (data: RentFormData) => void;
  isLoading?: boolean;
  prefill?: RentFormPrefill;
}

interface FormErrors {
  address?: string;
  currentRent?: string;
  rentIncrease?: string;
}

const RentForm = ({ onSubmit, isLoading, prefill }: RentFormProps) => {
  const [zip, setZip] = useState(prefill?.zip || '');
  const [fullAddress, setFullAddress] = useState<string | null>(null);
  const [unit, setUnit] = useState('');
  const [bedrooms, setBedrooms] = useState<BedroomType>(
    prefill?.bedrooms !== undefined ? (bedroomNumToKey[prefill.bedrooms] || 'oneBr') : 'oneBr'
  );
  const [currentRent, setCurrentRent] = useState(
    prefill?.rent ? fmtInput(String(prefill.rent)) : '2,500'
  );
  const [rentIncrease, setRentIncrease] = useState('200');
  const [increaseIsPercent, setIncreaseIsPercent] = useState(false);
  const [movingCosts] = useState('2500');
  const [showZipOnly, setShowZipOnly] = useState(!!prefill?.zip && !prefill?.address);
  const [errors, setErrors] = useState<FormErrors>({});
  const [attempted, setAttempted] = useState(false);

  const addressRef = useRef<HTMLDivElement>(null);
  const rentRef = useRef<HTMLDivElement>(null);
  const increaseRef = useRef<HTMLDivElement>(null);

  const validate = (): FormErrors => {
    const errs: FormErrors = {};
    const trimmedZip = zip.trim();

    if (!showZipOnly && !fullAddress && !trimmedZip) {
      errs.address = 'Please enter your address or zip code';
    } else if (showZipOnly && (!trimmedZip || trimmedZip.length !== 5)) {
      errs.address = 'Please enter a valid 5-digit zip code';
    } else if (!showZipOnly && !fullAddress && trimmedZip && trimmedZip.length !== 5) {
      errs.address = 'Please enter your address or zip code';
    }

    const rentVal = parseFloat(parseFormatted(currentRent));
    if (!currentRent || isNaN(rentVal) || rentVal <= 0) {
      errs.currentRent = 'Please enter your current monthly rent';
    }

    const incVal = rentIncrease
      ? (increaseIsPercent ? parseFloat(rentIncrease) : parseFloat(parseFormatted(rentIncrease)))
      : NaN;
    if (!rentIncrease || isNaN(incVal) || incVal <= 0) {
      errs.rentIncrease = 'Please enter the increase amount';
    }

    return errs;
  };

  const scrollToFirstError = (errs: FormErrors) => {
    if (errs.address && addressRef.current) {
      addressRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const input = addressRef.current.querySelector('input');
      input?.focus();
    } else if (errs.currentRent && rentRef.current) {
      rentRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const input = rentRef.current.querySelector('input');
      input?.focus();
    } else if (errs.rentIncrease && increaseRef.current) {
      increaseRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const input = increaseRef.current.querySelector('input');
      input?.focus();
    }
  };

  const clearError = (field: keyof FormErrors) => {
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setAttempted(true);

    const errs = validate();
    setErrors(errs);

    if (Object.keys(errs).length > 0) {
      scrollToFirstError(errs);
      return;
    }

    const trimmedZip = zip.trim();
    const addressWithUnit = fullAddress
      ? (unit.trim()
          ? fullAddress.replace(/,/, ` ${unit.trim()},`)
          : fullAddress)
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

  const errorClass = (field: keyof FormErrors) =>
    errors[field] ? 'border-destructive focus:border-destructive focus-visible:ring-destructive' : '';

  return (
    <div>
      <form onSubmit={handleSubmit} className="border border-border rounded-2xl p-5 sm:p-6 md:p-8 bg-card space-y-4 sm:space-y-5">
        {/* Address — primary input */}
        {!showZipOnly && (
          <div className="space-y-1.5" ref={addressRef}>
            <Label className="text-sm font-medium text-foreground">Your Address</Label>
            <AddressAutocomplete
              className={`h-12 text-sm bg-background ${errorClass('address')}`}
              placeholder="Start typing your address..."
              onSelect={(addr) => {
                if (addr.zip) setZip(addr.zip);
                setFullAddress(addr.fullAddress);
                clearError('address');
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
            {errors.address && <p className="text-[13px] text-destructive mt-1">{errors.address}</p>}
          </div>
        )}

        {/* Zip Code — shown standalone when toggled */}
        {showZipOnly && (
          <div className="space-y-1.5 animate-fade-in" ref={addressRef}>
            <Label className="text-sm font-medium text-foreground">Zip Code <span className="text-destructive">*</span></Label>
            <Input
              type="text"
              inputMode="numeric"
              placeholder="e.g. 78701"
              value={zip}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 5);
                setZip(v);
                clearError('address');
              }}
              className={`h-12 text-sm bg-background ${errorClass('address')}`}
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
            {errors.address && <p className="text-[13px] text-destructive mt-1">{errors.address}</p>}
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
        <div className="space-y-1.5" ref={rentRef}>
          <Label className="text-sm font-medium text-foreground">Current Monthly Rent</Label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-sm text-muted-foreground">$</span>
            <Input
              type="text"
              inputMode="numeric"
              placeholder="2,500"
              value={currentRent}
              onChange={(e) => { setCurrentRent(fmtInput(e.target.value)); clearError('currentRent'); }}
              className={`h-12 pl-8 font-mono text-lg bg-background ${errorClass('currentRent')}`}
              required
            />
          </div>
          {errors.currentRent && <p className="text-[13px] text-destructive mt-1">{errors.currentRent}</p>}
        </div>

        {/* Proposed increase */}
        <div className="space-y-1.5" ref={increaseRef}>
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
                  clearError('rentIncrease');
                }}
                className={`h-12 font-mono text-lg bg-background ${!increaseIsPercent ? 'pl-8' : 'pl-3.5'} ${errorClass('rentIncrease')}`}
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
          {errors.rentIncrease && <p className="text-[13px] text-destructive mt-1">{errors.rentIncrease}</p>}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full h-12 sm:h-14 bg-primary text-primary-foreground text-[15px] sm:text-base font-bold rounded-lg hover:opacity-90 active:scale-[0.99] transition-all duration-200 disabled:opacity-60 disabled:pointer-events-none"
        >
          {isLoading ? 'Loading data…' : 'Get my rent report →'}
        </button>
      </form>

      {/* Credibility badges */}
      <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-x-6 gap-y-1.5 sm:gap-y-2 mt-5 sm:mt-6 text-[11px] sm:text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="18" rx="2"/><path d="M8 7h8M8 12h8M8 17h4"/></svg>
          58,000+ zip codes covered
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
