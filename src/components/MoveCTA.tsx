import { Link } from 'react-router-dom';
import { trackEvent } from '@/lib/analytics';

interface MoveCTAProps {
  city: string;
  zip: string;
  hasListingsAbove: boolean;
  placement: string;
}

const MoveCTA = ({ city, zip, hasListingsAbove, placement }: MoveCTAProps) => {
  const handleClick = () => {
    trackEvent('internal_click', {
      link_type: 'browse_deals',
      city,
      zip,
      placement,
    });
  };

  return (
    <div className="border-l-[3px] border-primary rounded-r-lg bg-secondary pl-4 pr-4 py-4">
      <p className="text-[13px] font-semibold text-foreground">
        {hasListingsAbove ? 'Want to see more options?' : 'See what\'s available nearby'}
      </p>
      {hasListingsAbove && (
        <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed">
          Browse all scored deals in your area — including apartments not shown above.
        </p>
      )}
      <Link
        to="/deals"
        onClick={handleClick}
        className="mt-2 inline-block text-[13px] font-semibold text-primary hover:text-primary/80 transition-colors"
      >
        {hasListingsAbove ? 'Browse more apartments →' : 'Browse apartments →'}
      </Link>
    </div>
  );
};

export default MoveCTA;
