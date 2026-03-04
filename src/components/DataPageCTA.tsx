import { Link } from 'react-router-dom';

interface DataPageCTAProps {
  location: string;
  zip?: string;
  variant?: 'mid' | 'bottom';
}

/**
 * Renter-focused CTA for data pages.
 * "mid" variant goes after trends; "bottom" variant goes before footer.
 */
const DataPageCTA = ({ location, zip, variant = 'mid' }: DataPageCTAProps) => {
  const linkTo = zip ? `/?zip=${zip}` : '/';

  if (variant === 'mid') {
    return (
      <section className="mb-12 rounded-xl border-2 border-primary/20 bg-primary/[0.03] p-6 sm:p-8">
        <h2 className="font-display text-xl sm:text-2xl text-foreground tracking-tight mb-2">
          Renting in {location}?
        </h2>
        <p className="text-muted-foreground text-sm sm:text-base mb-5 leading-relaxed max-w-lg">
          Check if your specific rent increase is fair — free, instant, no signup required.
        </p>
        <Link
          to={linkTo}
          className="inline-block bg-primary text-primary-foreground px-6 sm:px-8 py-3 rounded-lg font-semibold hover:brightness-90 transition-all duration-150 shadow-sm shadow-primary/20"
        >
          Check Your Rent →
        </Link>
      </section>
    );
  }

  return (
    <section className="mb-12 text-center py-10">
      <h2 className="font-display text-2xl text-foreground mb-3 tracking-tight">
        Got a rent increase in {location}?
      </h2>
      <p className="text-muted-foreground mb-6">See how it compares to the market.</p>
      <Link
        to={linkTo}
        className="inline-block bg-primary text-primary-foreground px-8 py-3 rounded-lg font-semibold hover:brightness-90 transition-all duration-150 shadow-sm shadow-primary/20"
      >
        Check Your Rent Free →
      </Link>
    </section>
  );
};

export default DataPageCTA;
