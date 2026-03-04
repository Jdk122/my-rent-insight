import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BedroomType } from '@/data/rentData';

const bedroomToNum: Record<BedroomType, number> = {
  studio: 0, oneBr: 1, twoBr: 2, threeBr: 3, fourBr: 4,
};

export interface RentcastMarketResult {
  rcMedianRent: number | null;
  rcAvgDaysOnMarket: number | null;
  rcTotalListings: number | null;
  rcNewListings: number | null;
  rcRentHistory: { month: string; medianRent: number }[] | null;
}

export function useRentcastMarket(zip: string, bedrooms: BedroomType): RentcastMarketResult {
  const [data, setData] = useState<RentcastMarketResult>({
    rcMedianRent: null,
    rcAvgDaysOnMarket: null,
    rcTotalListings: null,
    rcNewListings: null,
    rcRentHistory: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const { data: result, error } = await supabase.functions.invoke(
          'rentcast-market',
          { body: { zip } }
        );

        if (cancelled || error || !result) return;

        const bedroomNum = bedroomToNum[bedrooms];

        // Extract bedroom-specific median from detailedByBedroom array
        let rcMedianRent: number | null = null;
        if (result.detailedByBedroom && Array.isArray(result.detailedByBedroom)) {
          const match = result.detailedByBedroom.find(
            (d: { bedrooms: number }) => d.bedrooms === bedroomNum
          );
          if (match?.medianRent) {
            rcMedianRent = match.medianRent;
          }
        }
        // Fallback to overall median if no bedroom-specific data
        if (rcMedianRent === null && result.medianRent) {
          rcMedianRent = result.medianRent;
        }

        // Extract rent history for matching bedroom count
        let rcRentHistory: { month: string; medianRent: number }[] | null = null;
        if (result.history && Array.isArray(result.history)) {
          const entries = result.history
            .filter((h: any) => h.month && h.detailedByBedroom)
            .map((h: any) => {
              const match = h.detailedByBedroom?.find(
                (d: { bedrooms: number }) => d.bedrooms === bedroomNum
              );
              return match?.medianRent
                ? { month: h.month, medianRent: match.medianRent }
                : null;
            })
            .filter(Boolean)
            .slice(-6);
          if (entries.length > 0) rcRentHistory = entries;
        }

        if (!cancelled) {
          setData({
            rcMedianRent,
            rcAvgDaysOnMarket: result.averageDaysOnMarket ?? null,
            rcTotalListings: result.totalListings ?? null,
            rcNewListings: result.newListings ?? null,
            rcRentHistory,
          });
        }
      } catch {
        // Silent failure — rc* fields stay null
      }
    }

    load();
    return () => { cancelled = true; };
  }, [zip, bedrooms]);

  return data;
}
