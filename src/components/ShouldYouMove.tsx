import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Home, ExternalLink } from 'lucide-react';
import { RentcastComparable } from '@/hooks/useRentcast';
import { BedroomType, bedroomLabels } from '@/data/rentData';

interface ShouldYouMoveProps {
  proposedRent: number;
  currentRent: number;
  comparables: RentcastComparable[];
  medianCompRent: number;
  brLabel: string;
  city: string;
  state: string;
  zip: string;
  bedrooms: BedroomType;
  counterOffer: number | null;
  isAboveMarket: boolean;
  onScrollToLetter: () => void;
}

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

const brokerFeeStates = ['NJ', 'NY', 'MA'];

function buildListingLinks(zip: string, city: string, state: string, bedrooms: BedroomType) {
  const citySlug = city.toLowerCase().replace(/\s+/g, '-');
  const stateSlug = state.toLowerCase();
  const beds: Record<BedroomType, string> = {
    studio: '0', oneBr: '1', twoBr: '2', threeBr: '3', fourBr: '4',
  };
  const b = beds[bedrooms];
  return [
    { name: 'Zillow', url: `https://www.zillow.com/homes/for_rent/${zip}/${b}-_beds/` },
    { name: 'Apartments.com', url: `https://www.apartments.com/${citySlug}-${stateSlug}-${zip}/${bedrooms === 'studio' ? 'studios' : b + '-bedrooms'}/` },
  ];
}

const ShouldYouMove = ({
  proposedRent,
  currentRent,
  comparables,
  medianCompRent,
  brLabel,
  city,
  state,
  zip,
  bedrooms,
  counterOffer,
  isAboveMarket,
  onScrollToLetter,
}: ShouldYouMoveProps) => {
  const isAboveMedian = proposedRent > medianCompRent;
  const difference = Math.abs(proposedRent - medianCompRent);

  // Sort comps by distance, take top 5
  const topComps = useMemo(() => {
    return [...comparables]
      .filter(c => c.rent && c.rent > 0)
      .sort((a, b) => (a.distance ?? 99) - (b.distance ?? 99))
      .slice(0, 5);
  }, [comparables]);

  // Moving cost estimate
  const hasBrokerFee = brokerFeeStates.includes(state);
  const estimatedMovingCost = medianCompRent * 2 + 2500 + (hasBrokerFee ? medianCompRent : 0);

  // Percentile calculation for below-market scenario
  const percentileBelow = useMemo(() => {
    if (isAboveMedian) return null;
    const rents = comparables.map(c => c.rent).filter((r): r is number => r !== null && r > 0);
    if (rents.length < 3) return null;
    const below = rents.filter(r => r >= proposedRent).length;
    return Math.round((below / rents.length) * 100);
  }, [comparables, proposedRent, isAboveMedian]);

  const listingLinks = buildListingLinks(zip, city, state, bedrooms);

  const negotiationSavings = counterOffer ? proposedRent - counterOffer : null;

  return (
    <div className="callout-box">
      {isAboveMedian ? (
        /* ━━━ SCENARIO 1: Above median — you might save ━━━ */
        <>
          <p className="callout-box-title">You might save by moving</p>

          <div className="mt-4 px-4 py-3 rounded-md border text-sm font-medium text-foreground bg-destructive/10 border-destructive/20">
            Your proposed rent of ${fmt(proposedRent)}/mo is{' '}
            <span className="font-bold text-destructive">${fmt(difference)} above</span>{' '}
            the median for similar units nearby.
          </div>

          {/* Savings */}
          <div className="mt-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Potential savings
            </p>
            <p className="font-display text-[28px] md:text-[32px] tracking-tight text-foreground font-semibold" style={{ letterSpacing: '-0.02em' }}>
              ${fmt(difference)}/mo
            </p>
            <p className="text-sm text-muted-foreground mt-0.5">
              ${fmt(difference * 12)}/yr vs. the median comparable ({brLabel} near you: ${fmt(medianCompRent)}/mo)
            </p>
          </div>

          {/* Comp listings */}
          {topComps.length > 0 && (
            <div className="mt-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Nearby comparable rentals
              </p>
              <div className="space-y-2">
                {topComps.map((comp, i) => (
                  <div key={i} className={`flex items-start gap-3 p-3 rounded-md text-sm ${i % 2 === 0 ? 'bg-muted/30' : ''}`}>
                    <Home className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground font-medium truncate">{comp.formattedAddress}</p>
                      <p className="text-muted-foreground text-[12px]">
                        {comp.bedrooms != null && `${comp.bedrooms} bed`}
                        {comp.bathrooms != null && ` · ${comp.bathrooms} bath`}
                        {comp.distance != null && ` · ${comp.distance.toFixed(1)} mi away`}
                      </p>
                    </div>
                    <span className={`font-semibold shrink-0 ${comp.rent && comp.rent < proposedRent ? 'text-verdict-good' : 'text-foreground'}`}>
                      ${comp.rent ? fmt(comp.rent) : '—'}/mo
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CTA: Browse listings */}
          <div className="mt-5 flex flex-wrap gap-2">
            {listingLinks.map(link => (
              <a
                key={link.name}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 border border-border rounded text-sm font-medium text-foreground bg-card hover:border-foreground transition-colors"
              >
                Browse {link.name}
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            ))}
          </div>

          {/* Secondary CTA: negotiate */}
          {isAboveMarket && negotiationSavings && negotiationSavings > 0 && counterOffer && (
            <div className="mt-6 p-5 rounded-lg bg-verdict-good/10 border border-verdict-good/20">
              <p className="text-xs font-semibold uppercase tracking-wider text-verdict-good mb-2">
                Or negotiate your current rent first
              </p>
              <p className="text-sm text-muted-foreground">
                If you negotiate to the fair counter-offer (
                <span className="font-semibold text-verdict-good">${fmt(counterOffer)}/mo</span>
                ), you save{' '}
                <span className="font-semibold text-verdict-good">${fmt(negotiationSavings)}/mo</span>
                {' '}starting immediately — with zero upfront costs.
              </p>
              <button
                onClick={onScrollToLetter}
                className="text-sm font-semibold text-primary hover:underline mt-3"
              >
                Generate negotiation letter →
              </button>
            </div>
          )}
        </>
      ) : (
        /* ━━━ SCENARIO 2: At or below median — your rent is competitive ━━━ */
        <>
          <p className="callout-box-title">Your rent is competitive</p>

          <div className="mt-4 px-4 py-3 rounded-md border text-sm font-medium text-foreground bg-verdict-good/10 border-verdict-good/20">
            Even after the increase, your proposed rent of ${fmt(proposedRent)}/mo is{' '}
            <span className="font-bold text-verdict-good">${fmt(difference)} below</span>{' '}
            the area median of ${fmt(medianCompRent)} for similar units.
          </div>

          {/* Cost of moving */}
          <div className="mt-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              What it would cost to move
            </p>
            <p className="font-display text-[24px] tracking-tight text-foreground font-semibold" style={{ letterSpacing: '-0.02em' }}>
              ~${fmt(estimatedMovingCost)}
            </p>
            <p className="text-[12px] text-muted-foreground mt-1">
              First month + security deposit + moving expenses{hasBrokerFee ? ` + broker fee (common in ${state})` : ''}
            </p>
            <p className="text-sm text-muted-foreground mt-3">
              Moving would likely cost you more — plus you'd be paying a higher monthly rent at most nearby units.
            </p>
          </div>

          {/* Percentile callout */}
          {percentileBelow && percentileBelow >= 50 && (
            <p className="text-sm text-verdict-good font-medium mt-4">
              Your rent is in the bottom {100 - percentileBelow}% of comparable units nearby.
            </p>
          )}

          {/* Comp listings */}
          {topComps.length > 0 && (
            <div className="mt-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Nearby comparable rentals
              </p>
              <div className="space-y-2">
                {topComps.map((comp, i) => (
                  <div key={i} className={`flex items-start gap-3 p-3 rounded-md text-sm ${i % 2 === 0 ? 'bg-muted/30' : ''}`}>
                    <Home className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground font-medium truncate">{comp.formattedAddress}</p>
                      <p className="text-muted-foreground text-[12px]">
                        {comp.bedrooms != null && `${comp.bedrooms} bed`}
                        {comp.bathrooms != null && ` · ${comp.bathrooms} bath`}
                        {comp.distance != null && ` · ${comp.distance.toFixed(1)} mi away`}
                      </p>
                    </div>
                    <span className={`font-semibold shrink-0 ${comp.rent && comp.rent > proposedRent ? 'text-destructive' : 'text-foreground'}`}>
                      ${comp.rent ? fmt(comp.rent) : '—'}/mo
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CTA: Negotiate anyway */}
          {isAboveMarket && (
            <div className="mt-6 pt-4 border-t border-border text-center">
              <p className="text-sm text-muted-foreground">Still want to push back on the increase?</p>
              <button
                onClick={onScrollToLetter}
                className="text-sm font-semibold text-primary hover:underline mt-1"
              >
                Generate negotiation letter →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ShouldYouMove;
