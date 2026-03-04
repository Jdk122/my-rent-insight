import { Link } from 'react-router-dom';

const steps = [
  {
    number: '01',
    title: 'Enter Your Address',
    description: 'Tell us where you live, your current rent, and your landlord\'s proposed increase.',
  },
  {
    number: '02',
    title: 'Get Your Fairness Score',
    description: 'We cross-reference six data sources to score your increase from 0–100 in under 10 seconds.',
  },
  {
    number: '03',
    title: 'Download Your Letter',
    description: 'If your increase is above market, get a free negotiation letter backed by real data.',
  },
];

const HowItWorks = () => (
  <section className="w-full border-t border-border/60" aria-label="How it works">
    <div className="max-w-[620px] mx-auto px-5 sm:px-6 py-14 sm:py-20">
      <h2
        className="font-display text-[22px] sm:text-[26px] text-foreground text-center tracking-tight mb-2"
        style={{ letterSpacing: '-0.02em' }}
      >
        How It Works
      </h2>
      <p className="text-[15px] sm:text-base text-muted-foreground text-center max-w-[440px] mx-auto mb-10 sm:mb-12 leading-relaxed">
        Three steps. No account required. Free forever.
      </p>

      <div className="space-y-0">
        {steps.map((step, i) => (
          <div
            key={step.number}
            className={`flex items-baseline gap-5 py-4 px-4 ${
              i < steps.length - 1 ? 'border-b border-border/60' : ''
            }`}
          >
            <span className="text-[13px] font-mono font-semibold text-primary/50 shrink-0 tabular-nums pt-0.5">
              {step.number}
            </span>
            <div>
              <h3 className="text-base font-semibold text-foreground mb-1">{step.title}</h3>
              <p className="text-[15px] text-muted-foreground leading-relaxed">
                {step.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-8 sm:mt-10 text-[12px] text-muted-foreground/60 text-center">
        Used by renters in all 50 states ·{' '}
        <Link to="/methodology" className="underline hover:text-muted-foreground transition-colors">
          See methodology
        </Link>
      </p>
    </div>
  </section>
);

export default HowItWorks;
