import { type DataFreshness, formatFreshnessDate } from '@/data/dataFreshness';
import { Link } from 'react-router-dom';

interface DataPageFreshnessProps {
  freshness: DataFreshness | null;
}

const DataPageFreshness = ({ freshness }: DataPageFreshnessProps) => {
  if (!freshness) return null;

  const now = new Date();
  const fourMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 4, now.getDate());
  const dates = [freshness.hud_safmr, freshness.hud_50pct, freshness.apartment_list, freshness.zillow_zori];
  const hasOldData = dates.some(d => new Date(d + 'T00:00:00') < fourMonthsAgo);

  return (
    <div className="text-xs text-muted-foreground/70 space-y-1 mt-1">
      <p>Data sources updated monthly. HUD benchmarks updated annually.</p>
      {hasOldData && (
        <p className="italic">
          Some data sources for this area may be older. See <Link to="/methodology" className="underline hover:text-muted-foreground">methodology</Link> for update schedule.
        </p>
      )}
    </div>
  );
};

export default DataPageFreshness;
