import { motion } from 'framer-motion';
import { RentcastResult } from '@/hooks/useRentcast';
import { Loader2, MapPin } from 'lucide-react';
import { BedroomType } from '@/data/rentData';

interface RentcastCardProps {
  data: RentcastResult | null;
  loading: boolean;
  error: string | null;
  city: string;
  zip: string;
  state: string;
  bedrooms: BedroomType;
  proposedRent?: number;
}

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

const bedroomNum: Record<BedroomType, string> = {
  studio: '0', oneBr: '1', twoBr: '2', threeBr: '3', fourBr: '4',
};

const bedroomLabel: Record<BedroomType, string> = {
  studio: 'studio', oneBr: '1-bedroom', twoBr: '2-bedroom', threeBr: '3-bedroom', fourBr: '4-bedroom',
};

function buildLinks(zip: string, city: string, state: string, bedrooms: BedroomType) {
  const citySlug = city.toLowerCase().replace(/\s+/g, '-');
  const stateSlug = state.toLowerCase();
  const beds = bedroomNum[bedrooms];
  const isNYC = state === 'NY' && ['New York', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island'].includes(city);

  const links: { name: string; url: string }[] = [];

  if (isNYC) {
    links.push({
      name: 'StreetEasy',
      url: `https://streeteasy.com/for-rent/${citySlug}?bedrooms=${bedrooms === 'studio' ? 'studio' : beds}`,
    });
  }

  links.push(
    { name: 'Zillow', url: `https://www.zillow.com/homes/for_rent/${zip}/${beds}-_beds/` },
    { name: 'Apartments.com', url: `https://www.apartments.com/${citySlug}-${stateSlug}-${zip}/${bedrooms === 'studio' ? 'studios' : beds + '-bedrooms'}/` },
    { name: 'Realtor.com', url: `https://www.realtor.com/apartments/${zip}/beds-${beds}` },
    { name: 'HotPads', url: `https://hotpads.com/${citySlug}-${stateSlug}/apartments-for-rent/${beds === '0' ? 'studio' : beds + '-beds'}` },
  );

  return links;
}

const RentcastCard = ({ data, loading, error, city, zip, state, bedrooms, proposedRent }: RentcastCardProps) => {
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

  // FIX 6: Wide range note
  const rangeSpread = (data.rentRangeHigh ?? 0) - (data.rentRangeLow ?? 0);
  const showRangeNote = hasEstimate && data.rentRangeLow !== null && data.rentRangeHigh !== null && rangeSpread > 1000;

  // FIX 4: inline external links when comps exist
  const externalLinks = buildLinks(zip, city, state, bedrooms);

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
              {showRangeNote && (
                <p className="text-xs text-muted-foreground mt-1">Range varies due to different building types and unit sizes in this area.</p>
              )}
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

      {/* FIX 2: Comparable listings sorted low-to-high with reference line */}
      {hasComps && (() => {
        const sortedComps = [...data.comparables].filter(c => c.rent !== null).sort((a, b) => (a.rent ?? 0) - (b.rent ?? 0));
        // Find where proposed rent falls in sorted order
        let refIndex = sortedComps.length; // default: at bottom
        if (proposedRent) {
          refIndex = sortedComps.findIndex(c => (c.rent ?? 0) >= proposedRent);
          if (refIndex === -1) refIndex = sortedComps.length;
        }

        return (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 text-center">
              Nearby Comparable Listings
            </p>
            {sortedComps.map((comp, i) => (
              <div key={i}>
                {proposedRent && i === refIndex && (
                  <div className="flex items-center gap-3 px-4 py-2">
                    <div className="flex-1 h-px bg-destructive" />
                    <span className="text-[13px] text-destructive font-semibold whitespace-nowrap">
                      Your proposed rent: ${fmt(proposedRent)}/mo
                    </span>
                    <div className="flex-1 h-px bg-destructive" />
                  </div>
                )}
                <motion.div
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
              </div>
            ))}
            {/* Reference line at bottom if all comps are cheaper */}
            {proposedRent && refIndex === sortedComps.length && (
              <div className="flex items-center gap-3 px-4 py-2">
                <div className="flex-1 h-px bg-destructive" />
                <span className="text-[13px] text-destructive font-semibold whitespace-nowrap">
                  Your proposed rent: ${fmt(proposedRent)}/mo
                </span>
                <div className="flex-1 h-px bg-destructive" />
              </div>
            )}
          </div>
        );
      })()}

      <p className="text-[11px] text-muted-foreground mt-3 text-center">Source: Rentcast</p>

      {/* FIX 4: Inline external links when comps exist */}
      {hasComps && (
        <p className="text-sm text-muted-foreground mt-4 text-center">
          Want to browse more?{' '}
          {externalLinks.map((link, i) => (
            <span key={link.name}>
              <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                {link.name} →
              </a>
              {i < externalLinks.length - 1 && <span className="mx-1.5">·</span>}
            </span>
          ))}
        </p>
      )}
    </div>
  );
};

export default RentcastCard;
