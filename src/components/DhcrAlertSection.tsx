import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { isNycZip } from '@/data/rentControlData';

export default function DhcrAlertSection({ zip, city }: { zip: string; city: string }) {
  const [count, setCount] = useState<number | null>(null);

  const nycZip = isNycZip(zip);

  useEffect(() => {
    if (!nycZip) return;

    let cancelled = false;
    (async () => {
      const { count: c, error } = await supabase
        .from('dhcr_buildings')
        .select('id', { count: 'exact', head: true })
        .eq('zip', zip);

      if (!cancelled && !error && c !== null) {
        setCount(c);
      }
    })();
    return () => { cancelled = true; };
  }, [zip, nycZip]);

  if (!nycZip || count === null || count === 0) return null;

  return (
    <section className="mb-12">
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-6">
        <div className="flex items-start gap-3">
          <span className="text-xl mt-0.5">🏛️</span>
          <div>
            <h3 className="font-display text-lg font-semibold text-foreground tracking-tight">
              Rent Stabilization in {zip}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
              There are <strong className="text-foreground">{count.toLocaleString()} rent-stabilized building{count !== 1 ? 's' : ''}</strong> registered in this zip code. 
              If your building is rent-stabilized, your landlord can only raise your rent by the amounts set by the NYC Rent Guidelines Board — 
              currently <strong className="text-foreground">3% for a 1-year renewal</strong> or <strong className="text-foreground">4.5% for a 2-year renewal</strong> (2025–26).
            </p>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              Not sure if your unit is stabilized?{' '}
              <Link to={`/?zip=${zip}`} className="text-primary underline hover:text-primary/80 font-medium">
                Check your address on our homepage
              </Link>{' '}
              or verify at{' '}
              <a href="https://portal.hcr.ny.gov/app/ask" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80 font-medium">
                HCR's portal
              </a>.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
