import DealScoreRing from './DealScoreRing';
import type { DealScoreResult } from '@/lib/dealScore';

export interface DealListing {
  id: string;
  address: string;
  beds: number;
  baths: number;
  sqft: number | null;
  rent: number;
  daysOnMarket: number | null;
  // Full score result fields
  score: number;
  verdict: 'great' | 'good';
  savingsPerMonth: number;
  savingsPct: number;
  median: number;
  isSuspicious: boolean;
  hasLeverage: boolean;
  leverageNote: string | null;
  components: DealScoreResult['components'];
  fairRange: DealScoreResult['fairRange'];
  trendContext: string | null;
  walkScore: number | null;
  isRentStabilized: boolean;
  listingUrl: string | null;
  // Legacy fields
  cleanBuilding: boolean;
  issues: number;
}

const VERDICT_STYLES = {
  great: { label: 'Great Deal', className: 'bg-accent/10 text-accent border-accent/30' },
  good: { label: 'Good Deal', className: 'bg-primary/10 text-primary border-primary/30' },
};

const fmt = (n: number) => n.toLocaleString('en-US');

interface DealCardProps {
  listing: DealListing;
  index: number;
  onSelect: (listing: DealListing) => void;
}

const DealCard = ({ listing, index, onSelect }: DealCardProps) => {
  const v = VERDICT_STYLES[listing.verdict];
  const beds = listing.beds === 0 ? 'Studio' : `${listing.beds}BR`;

  return (
    <div
      className="grid items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-card rounded-lg border border-border hover:border-primary hover:shadow-sm transition-all duration-150 cursor-pointer"
      style={{
        gridTemplateColumns: '40px 1fr auto',
        animation: `fadeSlideIn 0.25s ease ${index * 0.035}s both`,
      }}
      onClick={() => onSelect(listing)}
    >
      <DealScoreRing score={listing.score} />

      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-semibold text-foreground truncate">
            {listing.address}
          </span>
          <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold border ${v.className}`}>
            {v.label}
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span className="font-medium text-foreground/80">{beds}</span>
          <span className="opacity-30">·</span>
          <span>{listing.baths}ba</span>
          {listing.sqft && (
            <>
              <span className="opacity-30">·</span>
              <span>{listing.sqft}ft²</span>
            </>
          )}
          <span className="opacity-30">·</span>
          {listing.cleanBuilding ? (
            <span className="text-accent font-medium">✓ Clean</span>
          ) : (
            <span className="text-amber-600 font-medium">{listing.issues} issue{listing.issues !== 1 && 's'}</span>
          )}
          {listing.daysOnMarket !== null && (
            <>
              <span className="opacity-30">·</span>
              <span>{listing.daysOnMarket}d ago</span>
            </>
          )}
          {listing.hasLeverage && (
            <>
              <span className="opacity-30">·</span>
              <span className="text-primary font-medium">Room to negotiate</span>
            </>
          )}
          {listing.walkScore != null && (
            <>
              <span className="opacity-30">·</span>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                listing.walkScore >= 90 ? 'bg-accent/10 text-accent' :
                listing.walkScore >= 70 ? 'bg-accent/5 text-accent/80' :
                listing.walkScore >= 50 ? 'bg-muted text-muted-foreground' :
                'bg-muted text-muted-foreground/60'
              }`}>
                🚶 {listing.walkScore}
              </span>
            </>
          )}
          {listing.isRentStabilized && (
            <>
              <span className="opacity-30">·</span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                🏛 Stabilized
              </span>
            </>
          )}
        </div>
      </div>

      <div className="text-right shrink-0">
        <div className="text-lg font-bold text-foreground tracking-tight leading-tight">
          ${fmt(listing.rent)}<span className="text-xs font-normal text-muted-foreground">/mo</span>
        </div>
        <div className="text-[11.5px] font-semibold text-accent mt-0.5">
          ${fmt(listing.savingsPerMonth)}/mo savings
        </div>
      </div>
    </div>
  );
};

export default DealCard;
