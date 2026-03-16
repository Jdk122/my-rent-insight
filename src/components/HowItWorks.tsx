import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export interface HowItWorksStep {
  number: string;
  title: string;
  description: string;
}

interface HowItWorksProps {
  steps?: HowItWorksStep[];
  subtitle?: string;
}

const defaultSteps: HowItWorksStep[] = [
  {
    number: '01',
    title: 'Enter Your Details',
    description: 'Your address, current rent, and proposed increase. Takes 10 seconds.',
  },
  {
    number: '02',
    title: 'See If Your Increase Is Fair',
    description: 'We cross-reference six data sources to score your increase and show your fair rent range — instantly.',
  },
  {
    number: '03',
    title: 'Unlock Your Full Report',
    description: 'Get detailed comps, market conditions, and a negotiation letter delivered to your inbox.',
  },
];

const HowItWorks = React.forwardRef<HTMLElement, HowItWorksProps>(
  ({ steps = defaultSteps, subtitle = 'Three steps. No account required.' }, ref) => (
    <section ref={ref} className="w-full border-t border-border/60" aria-label="How it works">
      <div className="max-w-[820px] mx-auto px-5 sm:px-6 pt-10 pb-14 sm:pb-16">
        <h2
          className="font-display text-[22px] sm:text-[26px] text-foreground text-center tracking-tight mb-2"
          style={{ letterSpacing: '-0.02em' }}
        >
          How It Works
        </h2>
        <p className="text-[15px] sm:text-base text-muted-foreground text-center max-w-[440px] mx-auto mb-8 leading-relaxed">
          {subtitle}
        </p>

        {/* Desktop: horizontal 3-col with flow arrows */}
        <div className="hidden lg:grid lg:grid-cols-[1fr_auto_1fr_auto_1fr] lg:items-start relative">
          {steps.map((step, i) => (
            <React.Fragment key={step.number}>
              <div className="relative z-10 group flex flex-col items-center text-center px-5 py-6 rounded-xl transition-all duration-200 hover:bg-muted/40 hover:shadow-sm cursor-default">
                <span className="font-display text-[40px] text-primary/50 leading-none mb-3" style={{ letterSpacing: '-0.03em' }}>
                  {step.number}
                </span>
                <h3 className="text-[16px] font-semibold text-foreground mb-1.5">{step.title}</h3>
                <p className="text-[13px] text-muted-foreground leading-relaxed max-w-[220px]">
                  {step.description}
                </p>
              </div>
              {i < steps.length - 1 && (
                <div className="flex items-center justify-center pt-[22px]">
                  <ArrowRight className="text-primary/70" size={24} strokeWidth={2} />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Mobile/Tablet: vertical stacked */}
        <div className="lg:hidden relative">
          <div className="space-y-2">
            {steps.map((step) => (
              <div
                key={step.number}
                className="relative z-10 group flex items-start gap-4 py-4 px-3 rounded-xl transition-all duration-200 hover:bg-muted/40 hover:shadow-sm"
              >
                <span className="font-display text-[30px] text-primary/50 leading-none shrink-0 w-[38px] text-center mt-0.5" style={{ letterSpacing: '-0.03em' }}>
                  {step.number}
                </span>
                <div className="pt-0.5">
                  <h3 className="text-[16px] font-semibold text-foreground mb-1">{step.title}</h3>
                  <p className="text-[14px] text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-8 sm:mt-10 text-[12px] text-muted-foreground/60 text-center">
          Used by renters in all 50 states ·{' '}
          <Link to="/methodology" className="underline hover:text-muted-foreground transition-colors">
            See methodology
          </Link>
        </p>
      </div>
    </section>
  )
);

HowItWorks.displayName = 'HowItWorks';

export default HowItWorks;
