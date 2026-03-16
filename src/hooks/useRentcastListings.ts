import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ActiveListing {
  formattedAddress: string;
  city: string;
  state: string;
  zipCode: string;
  rent: number;
  bedrooms: number | null;
  bathrooms: number | null;
  squareFootage: number | null;
  daysOnMarket: number | null;
  listingUrl: string | null;
}

export interface RentcastListingsResult {
  listings: ActiveListing[];
  cacheHit: boolean;
}

export function useRentcastListings(
  zip: string,
  bedrooms: number,
  analysisId: string | null | undefined,
  enabled: boolean,
) {
  const [data, setData] = useState<RentcastListingsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !/^\d{5}$/.test(zip) || bedrooms < 0 || !Number.isInteger(bedrooms)) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const { data: result, error: fnError } = await supabase.functions.invoke(
          'rentcast-listings',
          { body: { zip, bedrooms, analysisId: analysisId ?? null } },
        );

        if (cancelled) return;

        if (fnError || !result) {
          setData({ listings: [], cacheHit: false });
          setError('Could not load listings');
          return;
        }

        setData({
          listings: Array.isArray(result.listings) ? result.listings : [],
          cacheHit: !!result.cacheHit,
        });
      } catch {
        if (!cancelled) {
          setData({ listings: [], cacheHit: false });
          setError('Could not load listings');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [zip, bedrooms, analysisId, enabled]);

  return { data, loading, error };
}
