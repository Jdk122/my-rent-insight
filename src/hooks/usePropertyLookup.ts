import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PropertyLookupResult {
  address: string;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  propertyType: string;
  yearBuilt: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  squareFootage: number | null;
  lotSize: number | null;
  lastSalePrice: number | null;
  lastSaleDate: string | null;
  saleHistory: { date: string; price: number }[];
  assessedValue: number | null;
  landValue: number | null;
  improvementValue: number | null;
  annualTax: number | null;
  taxYear: number | null;
  priorYearTax: number | null;
  priorTaxYear: number | null;
  ownerType: string | null;
  isInvestor: boolean;
  ownerCity: string | null;
  ownerState: string | null;
  hoaFee: number | null;
  units: number;
}

export type PropertyLookupError = 'NOT_FOUND' | 'RATE_LIMIT' | 'NETWORK' | null;

export function usePropertyLookup() {
  const [data, setData] = useState<PropertyLookupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<PropertyLookupError>(null);

  const lookup = async (address: string) => {
    setLoading(true);
    setError(null);
    setData(null);

    try {
      const { data: result, error: fnError } = await supabase.functions.invoke(
        'property-lookup',
        { body: { address } }
      );

      if (fnError) {
        setError('NETWORK');
        return null;
      }

      if (result?.error) {
        if (result.code === 'RATE_LIMIT') setError('RATE_LIMIT');
        else if (result.code === 'NOT_FOUND') setError('NOT_FOUND');
        else setError('NETWORK');
        return null;
      }

      const parsed = result as PropertyLookupResult;
      setData(parsed);
      return parsed;
    } catch {
      setError('NETWORK');
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { data, loading, error, lookup };
}
