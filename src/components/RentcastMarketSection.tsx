import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';

interface MarketData {
  averageRent: number | null;
  medianRent: number | null;
  minRent: number | null;
  maxRent: number | null;
  totalListings: number | null;
  cacheHit?: boolean;
  error?: string;
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

export default function RentcastMarketSection({ zip, city, state }: { zip: string; city: string; state: string }) {
  const [data, setData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  async function loadMarketData() {
    setLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('rentcast-market', {
        body: { zip },
      });
      if (error) {
        setData({ averageRent: null, medianRent: null, minRent: null, maxRent: null, totalListings: null, error: 'Could not load market data' });
      } else {
        setData(result as MarketData);
      }
    } catch {
      setData({ averageRent: null, medianRent: null, minRent: null, maxRent: null, totalListings: null, error: 'Could not load market data' });
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }

  // Not yet loaded — show CTA
  if (!loaded && !loading) {
    return (
      <section className="mb-12">
        <h2 className="font-display text-2xl text-foreground mb-4 tracking-tight">
          Current Asking Rents in {zip}
        </h2>
        <div className="rounded-lg border border-border p-6 bg-card">
          <p className="text-muted-foreground text-sm leading-relaxed mb-4">
            What are apartments actually renting for near {zip}? Click below to see live asking rents from current listings.
          </p>
          <button
            onClick={loadMarketData}
            className="bg-primary text-primary-foreground px-5 h-10 rounded-lg text-sm font-semibold hover:brightness-90 transition-all duration-150 shadow-sm shadow-primary/20"
          >
            See live listings near {zip} →
          </button>
          <p className="mt-2 text-xs text-muted-foreground">Powered by Rentcast · Updated daily</p>
        </div>
      </section>
    );
  }

  // Loading
  if (loading) {
    return (
      <section className="mb-12">
        <h2 className="font-display text-2xl text-foreground mb-4 tracking-tight">
          Current Asking Rents in {zip}
        </h2>
        <div className="rounded-lg border border-border p-6 bg-card space-y-3">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-6 w-40" />
        </div>
      </section>
    );
  }

  // Error or no data
  if (!data || data.error || (!data.averageRent && !data.medianRent)) {
    return (
      <section className="mb-12">
        <h2 className="font-display text-2xl text-foreground mb-4 tracking-tight">
          Current Asking Rents in {zip}
        </h2>
        <div className="rounded-lg border border-border p-6 bg-card">
          <p className="text-muted-foreground text-sm">
            Market rent data isn't available for {zip} right now. HUD Fair Market Rents above are still a reliable benchmark.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-12">
      <h2 className="font-display text-2xl text-foreground mb-4 tracking-tight">
        Current Asking Rents in {zip}
      </h2>
      <div className="rounded-lg border border-border p-6 bg-card">
        <div className="flex flex-wrap gap-6">
          {data.averageRent && (
            <div>
              <p className="text-sm text-muted-foreground">Average Asking Rent</p>
              <p className="text-2xl font-bold tabular-nums">{fmt(data.averageRent)}/mo</p>
            </div>
          )}
          {data.medianRent && (
            <div>
              <p className="text-sm text-muted-foreground">Median Asking Rent</p>
              <p className="text-2xl font-bold tabular-nums">{fmt(data.medianRent)}/mo</p>
            </div>
          )}
          {data.minRent && data.maxRent && (
            <div>
              <p className="text-sm text-muted-foreground">Range</p>
              <p className="text-2xl font-bold tabular-nums">{fmt(data.minRent)} – {fmt(data.maxRent)}</p>
            </div>
          )}
          {data.totalListings && (
            <div>
              <p className="text-sm text-muted-foreground">Active Listings</p>
              <p className="text-2xl font-bold tabular-nums">{data.totalListings.toLocaleString()}</p>
            </div>
          )}
        </div>
        <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
          These are current asking rents from active listings in {zip}. Compare to the HUD fair market rent above to see how the market compares to federal benchmarks.
        </p>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Source: Rentcast market data{data.cacheHit ? ' (cached)' : ''}</p>
    </section>
  );
}
