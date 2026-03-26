import { Link } from 'react-router-dom';
import { trackEvent } from '@/lib/analytics';

interface MoveCTAProps {
  city: string;
  zip: string;
  hasListings: boolean;
  placement: string;
}

const MoveCTA = ({ city, zip, hasListings, placement }: MoveCTAProps) => {
  const handleClick = () => {
    trackEvent('internal_click', {
      link_type: 'browse_deals',
      city,
      zip,
      placement,
    });
  };

  if (hasListings) {
    return (
      <div
        className="border-l-[3px] border-primary rounded-r-lg bg-secondary pl-4 pr-4 py-4"
      >
        <p className="text-[13px] font-semibold text-foreground">See cheaper apartments nearby</p>
        <button
          onClick={() => {
            handleClick();
            document.getElementById('section-next-steps')?.scrollIntoView({ behavior: 'smooth' });
          }}
          className="mt-2 inline-block text-[13px] font-semibold text-primary hover:text-primary/80 transition-colors"
        >
          See what's available →
        </button>
      </div>
    );
  }

  return (
    <div
      className="border-l-[3px] border-primary rounded-r-lg bg-secondary pl-4 pr-4 py-4"
    >
      <p className="text-[13px] font-semibold text-foreground">See cheaper apartments nearby</p>
      <Link
        to="/deals"
        onClick={handleClick}
        className="mt-2 inline-block text-[13px] font-semibold text-primary hover:text-primary/80 transition-colors"
      >
        See what's available →
      </Link>
    </div>
  );
};

export default MoveCTA;
