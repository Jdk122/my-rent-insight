import { type DataFreshness, formatFreshnessDate } from '@/data/dataFreshness';

interface DataPageFreshnessProps {
  freshness: DataFreshness | null;
}

const DataPageFreshness = ({ freshness }: DataPageFreshnessProps) => {
  if (!freshness) return null;

  // Check if any source is older than 3 months
  const now = new Date();
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
  const dates = [freshness.hud_safmr, freshness.hud_50pct, freshness.apartment_list, freshness.zillow_zori];
  const stale = dates.filter(d => new Date(d + 'T00:00:00') < threeMonthsAgo);

  return (
    <div className="text-xs text-muted-foreground/70 space-y-1 mt-1">
      <p>Data sources updated monthly. HUD benchmarks updated annually.</p>
      {stale.length > 0 && (
        <p className="italic">
          Some data for this area may be from {formatFreshnessDate(stale.sort()[0])}. We update as new data becomes available.
        </p>
      )}
    </div>
  );
};

export default DataPageFreshness;
