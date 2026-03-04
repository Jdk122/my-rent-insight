import { Link } from 'react-router-dom';

interface DataPageCTAProps {
  location: string;
  zip?: string;
  variant?: 'mid' | 'bottom';
}

const DataPageCTA = ({ location, zip, variant = 'mid' }: DataPageCTAProps) => {
  const linkTo = zip ? `/?zip=${zip}` : '/';

  if (variant === 'mid') {
    return (
      <section className="mb-12 rounded-2xl bg-gradient-to-br from-primary/[0.07] via-primary/[0.04] to-accent/[0.06] py-10 sm:py-12 px-6 sm:px-10 text-center shadow-[0_4px_24px_-6px_hsl(var(--primary)/0.12)]">
        <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground tracking-tight mb-3" style={{ letterSpacing: '-0.02em' }}>
          Renting in {location}?
        </h2>
        <p className="text-muted-foreground text-sm sm:text-base mb-7 leading-relaxed max-w-md mx-auto">
          Check if your specific rent increase is fair — free, instant, no signup required.
        </p>
        <Link
          to={linkTo}
          className="inline-block w-full sm:w-1/2 bg-primary text-primary-foreground px-8 py-3.5 rounded-xl font-semibold text-base hover:brightness-90 transition-all duration-150 shadow-md shadow-primary/20"
        >
          Check Your Rent →
        </Link>
      </section>
    );
  }

  return (
    <section className="mb-12 rounded-2xl bg-gradient-to-br from-primary/[0.07] via-primary/[0.04] to-accent/[0.06] py-10 sm:py-12 px-6 sm:px-10 text-center shadow-[0_4px_24px_-6px_hsl(var(--primary)/0.12)]">
      <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground tracking-tight mb-3" style={{ letterSpacing: '-0.02em' }}>
        Got a rent increase in {location}?
      </h2>
      <p className="text-muted-foreground text-sm sm:text-base mb-7 leading-relaxed max-w-md mx-auto">
        See how it compares to the market.
      </p>
      <Link
        to={linkTo}
        className="inline-block w-full sm:w-1/2 bg-primary text-primary-foreground px-8 py-3.5 rounded-xl font-semibold text-base hover:brightness-90 transition-all duration-150 shadow-md shadow-primary/20"
      >
        Check Your Rent Free →
      </Link>
    </section>
  );
};

export default DataPageCTA;
