import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface HcrResult {
  found: boolean;
  stabilized?: boolean;
  borough?: string;
  status?: string;
  unitCount?: number | null;
  taxBenefit?: string | null;
  reason?: string;
  error?: string;
}

// NYC zip ranges
function isNycZip(zip: string): boolean {
  const z = parseInt(zip, 10);
  return (
    (z >= 10001 && z <= 10282) ||
    (z >= 10301 && z <= 10314) ||
    (z >= 10451 && z <= 10475) ||
    (z >= 11001 && z <= 11109) ||
    (z >= 11201 && z <= 11256) ||
    (z >= 11351 && z <= 11697) ||
    (z >= 11004 && z <= 11005)
  );
}

export function useHcrLookup(address: string | null, zip: string) {
  const [result, setResult] = useState<HcrResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Only run for NYC zips with a street address
    if (!address || !isNycZip(zip)) {
      setResult(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('hcr-lookup', {
          body: { address, zip },
        });

        if (cancelled) return;

        if (error) {
          console.error('HCR lookup error:', error);
          setResult(null);
        } else {
          setResult(data as HcrResult);
        }
      } catch {
        if (!cancelled) setResult(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [address, zip]);

  return { result, loading, isNyc: isNycZip(zip) };
}
