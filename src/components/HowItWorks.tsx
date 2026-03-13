import { Link } from 'react-router-dom';
import { MapPin, BarChart3, Mail } from 'lucide-react';

const steps = [
  {
    number: '01',
    icon: MapPin,
    title: 'Enter Your Details',
    description: 'Your address, current rent, and proposed increase. Takes 30 seconds.',
  },
  {
    number: '02',
    icon: BarChart3,
    title: 'See If Your Increase Is Fair',
    description: 'We cross-reference six data sources to score your increase and show your fair rent range — instantly.',
  },
  {
    number: '03',
    icon: Mail,
    title: 'Unlock Your Full Report',
    description: 'Get detailed comps, market conditions, and a negotiation letter delivered to your inbox.',
  },
];

const HowItWorks = () => (
  <section className="w-full border-t border-border/60" aria-label="How it works">
    <div className="max-w-[820px] mx-auto px-5 sm:px-6 py-14 sm:py-20">
      <h2
        className="font-display text-[22px] sm:text-[26px] text-foreground text-center tracking-tight mb-2"
        style={{ letterSpacing: '-0.02em' }}
      >
        How It Works
      </h2>
      <p className="text-[15px] sm:text-base text-muted-foreground text-center max-w-[440px] mx-auto mb-8 sm:mb-12 leading-relaxed">
        Three steps. No account required. Free forever.
      </p>

      {/* Desktop: horizontal 3-col with connecting lines */}
      <div className="hidden lg:grid lg:grid-cols-3 lg:gap-0 relative">
        {/* Connecting line behind cards */}
        <div className="absolute top-[52px] left-[16.67%] right-[16.67%] h-px border-t-2 border-dashed border-primary/20 z-0" />

        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <div
              key={step.number}
              className="relative z-10 group flex flex-col items-center text-center px-5 py-6 rounded-xl transition-all duration-200 hover:bg-muted/40 hover:shadow-sm cursor-default"
            >
              <div className="w-[56px] h-[56px] rounded-xl bg-primary/[0.07] flex items-center justify-center mb-3 group-hover:bg-primary/[0.12] transition-colors duration-200">
                <Icon className="text-primary" size={22} strokeWidth={1.8} />
              </div>
              <span className="text-[13px] font-mono font-semibold text-primary/60 mb-2 tabular-nums tracking-wide">
                {step.number}
              </span>
              <h3 className="text-[15px] font-semibold text-foreground mb-1.5">{step.title}</h3>
              <p className="text-[13px] text-muted-foreground leading-relaxed max-w-[220px]">
                {step.description}
              </p>
            </div>
          );
        })}
      </div>

      {/* Mobile/Tablet: vertical stacked with connecting line */}
      <div className="lg:hidden relative">
        {/* Vertical connecting line */}
        <div className="absolute left-[29px] top-[40px] bottom-[40px] w-px border-l-2 border-dashed border-primary/15 z-0" />

        <div className="space-y-2">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.number}
                className="relative z-10 group flex items-start gap-5 py-4 px-3 rounded-xl transition-all duration-200 hover:bg-muted/40 hover:shadow-sm"
              >
                <div className="w-[46px] h-[46px] rounded-xl bg-primary/[0.07] flex items-center justify-center shrink-0 group-hover:bg-primary/[0.12] transition-colors duration-200">
                  <Icon className="text-primary" size={22} strokeWidth={1.8} />
                </div>
                <div className="pt-0.5">
                  <div className="flex items-center gap-2.5 mb-1">
                    <span className="text-[12px] font-mono font-semibold text-primary/60 tabular-nums tracking-wide">
                      {step.number}
                    </span>
                    <h3 className="text-[15px] font-semibold text-foreground">{step.title}</h3>
                  </div>
                  <p className="text-[14px] text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
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
);

export default HowItWorks;
