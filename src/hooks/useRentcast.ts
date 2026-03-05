import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BedroomType } from '@/data/rentData';

const bedroomToNum: Record<BedroomType, number> = {
  studio: 0, oneBr: 1, twoBr: 2, threeBr: 3, fourBr: 4,
};

export interface RentcastComparable {
  formattedAddress: string;
  rent: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  squareFootage: number | null;
  distance: number | null;
  daysOld: number | null;
  correlation: number | null;
}

export interface RentcastResult {
  rentEstimate: number | null;
  rentRangeLow: number | null;
  rentRangeHigh: number | null;
  propertyType: string | null;
  comparables: RentcastComparable[];
}

export function useRentcast(zip: string, bedrooms: BedroomType, fullAddress?: string | null) {
  const [data, setData] = useState<RentcastResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetch() {
      setLoading(true);
      setError(null);
      try {
        const body: Record<string, unknown> = { bedrooms: bedroomToNum[bedrooms] };
        if (fullAddress) {
          body.address = fullAddress;
        } else {
          body.zip = zip;
        }
        const { data: result, error: fnError } = await supabase.functions.invoke(
          'rentcast-lookup',
          { body }
        );

        if (cancelled) return;

        if (fnError) {
          setError('Could not load Rentcast data');
          return;
        }

        setData(result as RentcastResult);
      } catch {
        if (!cancelled) setError('Could not load Rentcast data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetch();
    return () => { cancelled = true; };
  }, [zip, bedrooms, fullAddress]);

  return { data, loading, error };
}
