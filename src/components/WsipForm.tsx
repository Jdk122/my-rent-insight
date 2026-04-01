import { useState, useRef } from 'react';
import { BedroomType, bedroomLabels } from '@/data/rentData';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import { Lightbulb } from 'lucide-react';

export interface WsipFormData {
  zip: string;
  fullAddress: string | null;
  bedrooms: BedroomType;
  askingRent: number | null;
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

export interface WsipFormPrefill {
  zip?: string;
  bedrooms?: number;
  rent?: number;
  address?: string;
}

interface WsipFormProps {
  onSubmit: (data: WsipFormData) => void;
  isLoading?: boolean;
  prefill?: WsipFormPrefill;
}

interface FormErrors {
  address?: string;
}

const WsipForm = ({ onSubmit, isLoading, prefill }: WsipFormProps) => {
  const [zip, setZip] = useState(prefill?.zip || '');
  const [fullAddress, setFullAddress] = useState<string | null>(null);
  const [unit, setUnit] = useState('');
  const [bedrooms, setBedrooms] = useState<BedroomType>(
    prefill?.bedrooms !== undefined ? (bedroomNumToKey[prefill.bedrooms] || 'oneBr') : 'oneBr'
  );
  const [askingRent, setAskingRent] = useState(
    prefill?.rent ? fmtInput(String(prefill.rent)) : ''
  );
  const [showZipOnly, setShowZipOnly] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [attempted, setAttempted] = useState(false);

  const addressRef = useRef<HTMLDivElement>(null);

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

    return errs;
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
      addressRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const input = addressRef.current?.querySelector('input');
      input?.focus();
      return;
    }

    const trimmedZip = zip.trim();
    const addressWithUnit = fullAddress
      ? (unit.trim()
          ? fullAddress.replace(/,/, ` ${unit.trim()},`)
          : fullAddress)
      : null;

    const rentVal = askingRent ? parseFloat(parseFormatted(askingRent)) : null;

    onSubmit({
      zip: trimmedZip,
      fullAddress: addressWithUnit,
      bedrooms,
      askingRent: rentVal && rentVal > 0 ? rentVal : null,
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
            <Label className="text-sm font-medium text-foreground">Address or ZIP Code</Label>
            <AddressAutocomplete
              className={`h-12 text-base md:text-sm bg-background ${errorClass('address')}`}
              placeholder="Start typing an address..."
              onSelect={(addr) => {
                if (addr.zip) setZip(addr.zip);
                setFullAddress(addr.fullAddress);
                if (addr.unit) setUnit(addr.unit);
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
              Don't have an address? Just use a zip code →
            </button>
            <p className="text-xs text-muted-foreground/70 flex items-start gap-1.5">
              <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
              <span>Browsing Zillow or Apartments.com? Paste any listing address here.</span>
            </p>
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
              ← Enter a full address instead
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

        {/* Bedrooms */}
        <div className="space-y-1.5">
          <Label htmlFor="wsip-bedrooms-select" className="text-sm font-medium text-foreground">Bedrooms</Label>
          <select
            id="wsip-bedrooms-select"
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

        {/* Asking rent — optional */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-foreground">What rent are they asking? <span className="text-muted-foreground/60 font-normal">(optional)</span></Label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-sm text-muted-foreground">$</span>
            <Input
              type="text"
              inputMode="numeric"
              placeholder="e.g. 3,000"
              value={askingRent}
              onChange={(e) => setAskingRent(fmtInput(e.target.value))}
              className="h-12 pl-8 font-mono text-lg bg-background"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            If provided, we'll tell you if it's a fair price. Leave blank to just see the fair range.
          </p>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full h-12 sm:h-14 bg-primary text-primary-foreground text-[15px] sm:text-base font-bold rounded-lg hover:opacity-90 active:scale-[0.99] transition-all duration-200 disabled:opacity-60 disabled:pointer-events-none"
        >
          {isLoading ? 'Loading data…' : 'Show me fair rent →'}
        </button>
        <p className="text-[11px] text-muted-foreground/60 text-center mt-3">
          By using this tool, you agree to our{' '}
          <a href="/privacy" className="underline hover:text-foreground transition-colors">Privacy Policy</a>
          {' '}and{' '}
          <a href="/terms" className="underline hover:text-foreground transition-colors">Terms of Service</a>.
        </p>
      </form>

      {/* Credibility badges */}
      <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-x-6 gap-y-1.5 sm:gap-y-2 mt-5 sm:mt-6 text-[11px] sm:text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="18" rx="2"/><path d="M8 7h8M8 12h8M8 17h4"/></svg>
          38,600+ zip codes covered
        </span>
        <span className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          Results in under 10 seconds
        </span>
        <span className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-5"/></svg>
          Real comparable listings included
        </span>
      </div>
    </div>
  );
};

export default WsipForm;
