import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';

interface PlacePrediction {
  place_id: string;
  description: string;
}

interface AddressComponents {
  street: string;
  unit: string;
  city: string;
  state: string;
  zip: string;
  fullAddress: string;
}

interface AddressAutocompleteProps {
  onSelect: (address: AddressComponents) => void;
  placeholder?: string;
  className?: string;
}

const AddressAutocomplete = ({ onSelect, placeholder = '123 Main St, Austin, TX', className }: AddressAutocompleteProps) => {
  const [query, setQuery] = useState('');
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchPredictions = useCallback(async (input: string) => {
    if (input.length < 3) { setPredictions([]); setOpen(false); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('places-autocomplete', {
        body: { action: 'autocomplete', input },
      });
      if (!error && data?.predictions) {
        setPredictions(data.predictions.slice(0, 5));
        setOpen(data.predictions.length > 0);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  const handleChange = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchPredictions(val), 300);
  };

  const handleSelect = async (prediction: PlacePrediction) => {
    setQuery(prediction.description);
    setOpen(false);
    setPredictions([]);

    try {
      const { data, error } = await supabase.functions.invoke('places-autocomplete', {
        body: { action: 'details', placeId: prediction.place_id },
      });
      if (error || !data?.result) return;

      const components = data.result.address_components || [];
      const get = (type: string) => components.find((c: any) => c.types.includes(type));

      const streetNumber = get('street_number')?.long_name || '';
      const route = get('route')?.short_name || '';
      const subpremise = get('subpremise')?.long_name || '';
      const city = get('locality')?.long_name || get('sublocality_level_1')?.long_name || '';
      const state = get('administrative_area_level_1')?.short_name || '';
      const zip = get('postal_code')?.long_name || '';

      onSelect({
        street: `${streetNumber} ${route}`.trim(),
        unit: subpremise,
        city,
        state,
        zip,
        fullAddress: data.result.formatted_address || prediction.description,
      });
    } catch { /* silent */ }
  };

  return (
    <div ref={containerRef} className="relative">
      <Input
        type="text"
        placeholder={placeholder}
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => predictions.length > 0 && setOpen(true)}
        className={className}
        autoComplete="off"
      />
      {open && predictions.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
          {predictions.map((p) => (
            <li
              key={p.place_id}
              onClick={() => handleSelect(p)}
              className="px-3 py-2.5 text-sm cursor-pointer hover:bg-accent transition-colors truncate"
            >
              {p.description}
            </li>
          ))}
        </ul>
      )}
      {loading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="w-4 h-4 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
};

export default AddressAutocomplete;
