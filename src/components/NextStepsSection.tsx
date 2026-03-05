import { useState } from 'react';
import { motion } from 'framer-motion';
import { Building, Truck, Key, Shield, Share2, ArrowRight } from 'lucide-react';
import { trackEvent } from '@/lib/analytics';
import AgentLeadModal from './AgentLeadModal';

interface NextStepsSectionProps {
  isAboveMarket: boolean;
  fairnessScore: number | null;
  verdictLabel: string;
  zip: string;
  bedrooms: number;
  currentRent: number;
  proposedRent: number;
  propertyType?: string;
  city: string;
  state: string;
  compMedianRent: number | null;
  dollarOverpayment: number | null;
  brLabel: string;
  onShareClick?: () => void;
}

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

const bedroomLabel = (n: number) => n === 0 ? 'studios' : n === 1 ? '1-bedrooms' : `${n}-bedrooms`;

const cardBase =
  'relative bg-card rounded-xl flex flex-col transition-all duration-200';
const cardBorder = 'border border-[rgba(0,0,0,0.06)]';
const cardShadow = 'shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] hover:-translate-y-0.5';

const primaryBtn =
  'inline-flex items-center justify-center gap-1.5 h-10 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:brightness-105 transition-all whitespace-nowrap';
const ghostBtn =
  'inline-flex items-center justify-center gap-1.5 h-10 px-5 rounded-lg border border-primary/30 text-primary text-sm font-medium hover:bg-primary/5 transition-all whitespace-nowrap';

const IconWrap = ({ children }: { children: React.ReactNode }) => (
  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 shrink-0">
    {children}
  </div>
);

const fade = (delay: number) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, delay, ease: [0.16, 1, 0.3, 1] as const },
});

const NextStepsSection = ({
  isAboveMarket, fairnessScore, verdictLabel, zip, bedrooms,
  currentRent, proposedRent, propertyType, city, state,
  compMedianRent, dollarOverpayment, brLabel, onShareClick,
}: NextStepsSectionProps) => {
  const [modalOpen, setModalOpen] = useState(false);

  const savings = compMedianRent ? Math.round(proposedRent - compMedianRent) : null;
  const estimatedHomePrice = Math.round(currentRent * 200);
  const overpaymentDisplay = dollarOverpayment && dollarOverpayment > 0 ? dollarOverpayment : null;

  // Dynamic heading
  const heading = isAboveMarket
    ? overpaymentDisplay
      ? `You're paying ~$${fmt(overpaymentDisplay)}/mo above market — here are your options`
      : `Your rent is above market — here are your options`
    : `Your rent looks fair — here's how to stay protected`;

  // Card 1 subtitle (above market)
  const card1Subtitle = compMedianRent && savings && savings > 0
    ? `Based on ${bedroomLabel(bedrooms)} in ${city}, comparable units start around $${fmt(compMedianRent)}/mo — $${fmt(savings)}/mo less than your proposed rent.`
    : `A local rental specialist can show you ${bedroomLabel(bedrooms)} near you in ${city} — free, no obligation.`;

  // Card 3 subtitle (mortgage)
  const card3Subtitle = `At your current rent of $${fmt(currentRent)}/mo, you may qualify for a $${fmt(estimatedHomePrice)} home. See your options.`;

  return (
    <>
      <motion.section id="section-next-steps" {...fade(0.22)} className="pt-10 pb-6">
        {/* Divider + heading */}
        <div className="border-t border-border/60 pt-8 mb-8">
          <h2 className="text-xl font-semibold text-foreground tracking-tight">{heading}</h2>
        </div>

        {/* Cards */}
        {isAboveMarket ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Primary — Agent match */}
            <div className={`${cardBase} ${cardBorder} ${cardShadow} p-6 border-l-[3px] border-l-primary`}>
              <span className="inline-block text-[10px] font-semibold uppercase tracking-wider text-primary bg-primary/10 rounded-full px-2.5 py-0.5 mb-3 w-fit">
                Recommended for you
              </span>
              <IconWrap><Building className="w-5 h-5 text-primary" /></IconWrap>
              <h3 className="text-lg font-semibold text-foreground mb-2">See Apartments in Your Budget</h3>
              {compMedianRent && savings && savings > 0 ? (
                <div className="flex items-baseline gap-1.5 mb-4 flex-1">
                  <span className="text-2xl font-bold text-primary">${fmt(compMedianRent)}</span>
                  <span className="text-sm text-muted-foreground">/mo median for {bedroomLabel(bedrooms)} in {city}</span>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground leading-relaxed mb-4 flex-1">
                  Find {bedroomLabel(bedrooms)} near you in {city} — free, no obligation.
                </p>
              )}
              <button className={primaryBtn} onClick={() => { setModalOpen(true); trackEvent('agent_card_clicked', { zip }); }}>
                Get Matched Free <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Moving quotes */}
            <div className={`${cardBase} ${cardBorder} ${cardShadow} p-6`}>
              <IconWrap><Truck className="w-5 h-5 text-primary" /></IconWrap>
              <h3 className="text-lg font-semibold text-foreground mb-2">Get Free Moving Quotes</h3>
              <div className="flex items-baseline gap-1.5 mb-4 flex-1">
                <span className="text-2xl font-bold text-foreground">$1,200–$2,500</span>
                <span className="text-sm text-muted-foreground">avg in {state}</span>
              </div>
              <a
                href="https://www.moving.com/movers/quotes/"
                target="_blank"
                rel="noopener noreferrer"
                className={ghostBtn}
                onClick={() => trackEvent('moving_quote_clicked')}
              >
                Compare Movers <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* Mortgage */}
            <div className={`${cardBase} ${cardBorder} ${cardShadow} p-6`}>
              <IconWrap><Key className="w-5 h-5 text-primary" /></IconWrap>
              <h3 className="text-lg font-semibold text-foreground mb-2">Could You Buy Instead?</h3>
              <div className="flex items-baseline gap-1.5 mb-4 flex-1">
                <span className="text-2xl font-bold text-foreground">${fmt(estimatedHomePrice)}</span>
                <span className="text-sm text-muted-foreground">est. home you could afford</span>
              </div>
              <a
                href="https://www.bankrate.com/mortgages/mortgage-calculator/"
                target="_blank"
                rel="noopener noreferrer"
                className={ghostBtn}
                onClick={() => trackEvent('mortgage_link_clicked')}
              >
                Check Rates <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Insurance */}
            <div className={`${cardBase} ${cardBorder} ${cardShadow} p-6 border-l-[3px] border-l-primary`}>
              <span className="inline-block text-[10px] font-semibold uppercase tracking-wider text-primary bg-primary/10 rounded-full px-2.5 py-0.5 mb-3 w-fit">
                Recommended for you
              </span>
              <IconWrap><Shield className="w-5 h-5 text-primary" /></IconWrap>
              <h3 className="text-lg font-semibold text-foreground mb-1">Protect Your Home</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-5 flex-1">
                Renters insurance from $5/mo. Covers theft, damage, and liability.
              </p>
              <a
                href="https://www.lemonade.com/renters"
                target="_blank"
                rel="noopener noreferrer"
                className={primaryBtn}
                onClick={() => trackEvent('insurance_quote_clicked')}
              >
                Get a Free Quote <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* Share */}
            <div className={`${cardBase} ${cardBorder} ${cardShadow} p-6`}>
              <IconWrap><Share2 className="w-5 h-5 text-primary" /></IconWrap>
              <h3 className="text-lg font-semibold text-foreground mb-1">Share With Your Neighbors</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-5 flex-1">
                Know someone dealing with a rent increase? Send them this tool.
              </p>
              <button
                className={ghostBtn}
                onClick={() => {
                  trackEvent('share_clicked', { source: 'next_steps' });
                  onShareClick?.();
                }}
              >
                Share Results <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Bottom banner — personalized */}
        <div className="mt-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 rounded-lg px-4 py-3" style={{ background: 'hsl(var(--secondary))' }}>
          <span className="text-[13px] text-muted-foreground">
            At ${fmt(currentRent)}/mo in rent, you might be able to own.
          </span>
          <a
            href="https://www.bankrate.com/mortgages/mortgage-calculator/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[13px] font-medium text-primary hover:underline inline-flex items-center gap-1"
            onClick={() => trackEvent('mortgage_banner_clicked')}
          >
            See if you qualify <ArrowRight className="w-3 h-3" />
          </a>
        </div>
      </motion.section>

      <AgentLeadModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        prefillBedrooms={bedrooms}
        zip={zip}
        currentRent={currentRent}
        proposedRent={proposedRent}
        propertyType={propertyType}
        verdictLabel={verdictLabel}
        fairnessScore={fairnessScore}
      />
    </>
  );
};

export default NextStepsSection;
