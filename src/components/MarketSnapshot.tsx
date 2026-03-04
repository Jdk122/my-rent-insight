import { motion } from 'framer-motion';
import { Building2, Clock, TrendingDown } from 'lucide-react';

interface MarketSnapshotProps {
  rcTotalListings: number | null;
  rcNewListings: number | null;
  rcAvgDaysOnMarket: number | null;
  alVacancy: number | null;
}

const MarketSnapshot = ({ rcTotalListings, rcNewListings, rcAvgDaysOnMarket, alVacancy }: MarketSnapshotProps) => {
  const hasListings = rcTotalListings !== null;
  const hasDaysOnMarket = rcAvgDaysOnMarket !== null;

  // If no data at all, show fallback
  if (!hasListings && !hasDaysOnMarket) {
    return (
      <div className="rounded-lg border border-border bg-card px-4 py-4">
        <h3 className="text-[13px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Your Local Market</h3>
        <p className="text-[13px] text-muted-foreground leading-relaxed">
          Market snapshot data for your area is limited. Your score is based on comparable rents and government benchmarks.
        </p>
      </div>
    );
  }

  // Days on market color
  const domColor = hasDaysOnMarket
    ? rcAvgDaysOnMarket > 35 ? 'text-verdict-good'
    : rcAvgDaysOnMarket < 20 ? 'text-destructive'
    : 'text-accent-amber'
    : 'text-foreground';

  // Build interpretation sentence(s)
  const sentences: string[] = [];
  if (hasDaysOnMarket) {
    if (rcAvgDaysOnMarket > 35) {
      sentences.push('Rentals in your area are taking longer than average to lease — your landlord may be more open to negotiation.');
    } else if (rcAvgDaysOnMarket < 20) {
      sentences.push('Units in your area are leasing quickly — your landlord has less pressure to negotiate on price.');
    }
  }
  if (hasListings && rcTotalListings > 30) {
    sentences.push(`There are ${rcTotalListings} active rentals in your ZIP code, giving you options if negotiations stall.`);
  }
  if (alVacancy !== null && alVacancy > 6) {
    sentences.push(`Local vacancy is above average at ${alVacancy.toFixed(1)}%.`);
  }

  const interpretation = sentences.length > 0
    ? sentences.join(' ')
    : 'Market snapshot data for your area is limited. Your score is based on comparable rents and government benchmarks.';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, duration: 0.4 }}
      className="rounded-lg border border-border bg-card px-4 py-4"
    >
      <h3 className="text-[13px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Your Local Market</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        {hasListings && (
          <div className="flex items-center gap-2.5">
            <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <div>
              <p className="text-[15px] font-semibold text-foreground tabular-nums">{rcTotalListings}</p>
              <p className="text-[11px] text-muted-foreground leading-tight">
                Active rentals in your ZIP
                {rcNewListings !== null && rcNewListings > 0 && (
                  <span className="text-muted-foreground/70"> · +{rcNewListings} new this month</span>
                )}
              </p>
            </div>
          </div>
        )}
        {hasDaysOnMarket && (
          <div className="flex items-center gap-2.5">
            <Clock className={`w-4 h-4 flex-shrink-0 ${domColor}`} />
            <div>
              <p className={`text-[15px] font-semibold tabular-nums ${domColor}`}>{Math.round(rcAvgDaysOnMarket)} days</p>
              <p className="text-[11px] text-muted-foreground leading-tight">Avg days on market</p>
            </div>
          </div>
        )}
      </div>

      <p className="text-[12px] text-muted-foreground leading-relaxed">{interpretation}</p>
    </motion.div>
  );
};

export default MarketSnapshot;
