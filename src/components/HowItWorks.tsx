import { Link } from 'react-router-dom';

const steps = [
  {
    number: '1',
    title: 'Enter your address',
    description: 'Tell us where you live, your current rent, and your landlord\'s proposed increase.',
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    ),
  },
  {
    number: '2',
    title: 'Get your Fairness Score',
    description: 'We cross-reference six data sources to score your increase from 0–100 in under 10 seconds.',
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    ),
  },
  {
    number: '3',
    title: 'Download your letter',
    description: 'If your increase is above market, get a free negotiation letter backed by real data.',
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
];

const HowItWorks = () => (
  <section className="w-full border-t border-border/60" aria-label="How it works">
    <div className="max-w-[620px] mx-auto px-5 sm:px-6 py-14 sm:py-20">
      <h2 className="font-display text-[22px] sm:text-[26px] text-foreground text-center tracking-tight mb-3" style={{ letterSpacing: '-0.02em' }}>
        How It Works
      </h2>
      <p className="text-[14px] sm:text-[15px] text-muted-foreground text-center max-w-[440px] mx-auto mb-10 sm:mb-12 leading-relaxed">
        Three steps. No account required. Free forever.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-5">
        {steps.map((step) => (
          <div key={step.number} className="flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4">
              {step.icon}
            </div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[12px] font-mono font-semibold text-primary/60">
                {step.number}
              </span>
              <h3 className="text-[15px] font-semibold text-foreground">{step.title}</h3>
            </div>
            <p className="text-[13px] text-muted-foreground leading-relaxed max-w-[220px]">
              {step.description}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-10 sm:mt-12 flex flex-col items-center gap-3">
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="bg-primary text-primary-foreground px-6 sm:px-8 py-3 sm:py-3.5 rounded-lg text-[15px] font-bold hover:brightness-90 active:scale-[0.99] transition-all duration-200 shadow-sm shadow-primary/20"
        >
          See if your increase is fair →
        </button>
        <p className="text-[12px] text-muted-foreground/60">
          Used by renters in all 50 states · <Link to="/methodology" className="underline hover:text-muted-foreground transition-colors">See methodology</Link>
        </p>
      </div>
    </div>
  </section>
);

export default HowItWorks;
