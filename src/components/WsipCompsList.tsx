import type { RentcastComparable } from '@/hooks/useRentcast';

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

interface WsipCompsListProps {
  comparables: RentcastComparable[];
  askingRent?: number | null;
  medianCompRent: number | null;
}

const WsipCompsList = ({ comparables, askingRent, medianCompRent }: WsipCompsListProps) => {
  if (comparables.length === 0) return null;

  return (
    <div className="space-y-1">
      {comparables.map((comp, i) => (
        <div
          key={`wsip-comp-${i}`}
          className={`flex items-start justify-between gap-4 px-4 py-3 rounded-md ${
            i % 2 === 0 ? 'bg-muted/40' : ''
          }`}
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {comp.formattedAddress}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {comp.bedrooms !== null &&
                `${comp.bedrooms === 0 ? 'Studio' : `${comp.bedrooms}BR`}`}
              {comp.bathrooms !== null && ` · ${comp.bathrooms}BA`}
              {comp.squareFootage !== null && comp.squareFootage > 0 && ` · ${fmt(comp.squareFootage)} sqft`}
              {comp.distance !== null && ` · ${comp.distance.toFixed(1)} mi`}
            </p>
          </div>
          {comp.rent !== null && (
            <span className="text-sm font-semibold text-foreground whitespace-nowrap">
              ${fmt(comp.rent)}/mo
            </span>
          )}
        </div>
      ))}

      {askingRent && medianCompRent && (
        <p className="text-xs text-muted-foreground mt-3 px-4">
          The asking price of ${fmt(askingRent)} is{' '}
          <span className={askingRent > medianCompRent ? 'text-destructive font-medium' : 'text-verdict-good font-medium'}>
            {askingRent > medianCompRent
              ? `$${fmt(askingRent - medianCompRent)} above`
              : askingRent < medianCompRent
              ? `$${fmt(medianCompRent - askingRent)} below`
              : 'equal to'}
          </span>{' '}
          the comp median of ${fmt(medianCompRent)}.
        </p>
      )}
    </div>
  );
};

export default WsipCompsList;
