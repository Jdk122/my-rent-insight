import { motion } from 'framer-motion';
import { RentcastResult } from '@/hooks/useRentcast';
import { Loader2, MapPin } from 'lucide-react';

interface RentcastCardProps {
  data: RentcastResult | null;
  loading: boolean;
  error: string | null;
  city: string;
}

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

const RentcastCard = ({ data, loading, error, city }: RentcastCardProps) => {
  if (loading) {
    return (
      <div className="text-center py-8">
        <Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
        <p className="text-sm text-muted-foreground mt-2">Loading Rentcast data…</p>
      </div>
    );
  }

  if (error || !data) return null;

  const hasEstimate = data.rentEstimate !== null;
  const hasComps = data.comparables.length > 0;

  if (!hasEstimate && !hasComps) return null;

  return (
    <div>
      <h2 className="section-title">Rentcast Market Data</h2>

      {/* Rent estimate */}
      {hasEstimate && (
        <div className="flex justify-center gap-10 mb-6">
          {data.rentRangeLow !== null && data.rentRangeHigh !== null ? (
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Rentcast Estimate</p>
              <p className="font-display text-2xl tracking-tight text-foreground" style={{ letterSpacing: '-0.02em' }}>
                ${fmt(data.rentRangeLow)} – ${fmt(data.rentRangeHigh)}
              </p>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Rentcast Estimate</p>
              <p className="font-display text-2xl tracking-tight text-foreground" style={{ letterSpacing: '-0.02em' }}>
                ${fmt(data.rentEstimate!)}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Comparable listings */}
      {hasComps && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 text-center">
            Nearby Comparable Listings
          </p>
          {data.comparables.map((comp, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
              className={`flex items-start justify-between gap-4 px-4 py-3 rounded-md ${i % 2 === 0 ? 'bg-muted/40' : ''}`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate flex items-center gap-1.5">
                  <MapPin className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                  {comp.formattedAddress}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {comp.bedrooms !== null && `${comp.bedrooms === 0 ? 'Studio' : `${comp.bedrooms}BR`}`}
                  {comp.bathrooms !== null && ` · ${comp.bathrooms}BA`}
                  {comp.squareFootage !== null && ` · ${fmt(comp.squareFootage)} sqft`}
                  {comp.distance !== null && ` · ${comp.distance.toFixed(1)} mi`}
                </p>
              </div>
              {comp.rent !== null && (
                <span className="text-sm font-semibold text-foreground whitespace-nowrap">
                  ${fmt(comp.rent)}/mo
                </span>
              )}
            </motion.div>
          ))}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground mt-3 text-center">Source: Rentcast</p>
    </div>
  );
};

export default RentcastCard;
