import { Link } from 'react-router-dom';

interface RenterToolsCTAProps {
  zip?: string;
}

const tools = [
  {
    title: 'Got a Rent Increase?',
    sub: 'See if your landlord is overcharging — in 60 seconds.',
    cta: 'Check Your Increase →',
  },
  {
    title: 'Is This Listing Fair?',
    sub: 'Compare any asking rent to real market data.',
    cta: 'Check a Listing →',
  },
  {
    title: 'Set a Renewal Reminder',
    sub: 'Get market data emailed before your lease expires.',
    cta: 'Set Reminder →',
  },
];

const RenterToolsCTA = ({ zip }: RenterToolsCTAProps) => {
  const linkTo = zip ? `/?zip=${zip}` : '/';

  return (
    <section className="mb-12">
      <h2 className="font-display text-2xl text-foreground mb-5 tracking-tight">Renter Tools</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {tools.map((t, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-5 flex flex-col shadow-sm">
            <h3 className="font-semibold text-foreground text-[15px] mb-1">{t.title}</h3>
            <p className="text-xs text-muted-foreground leading-relaxed mb-4 flex-1">{t.sub}</p>
            <Link
              to={linkTo}
              className="inline-flex items-center justify-center bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-semibold hover:brightness-90 transition-all duration-150 shadow-sm shadow-primary/20"
            >
              {t.cta}
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
};

export default RenterToolsCTA;
