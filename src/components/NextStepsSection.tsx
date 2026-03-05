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

const bedroomLabel = (n: number) => (n === 0 ? 'studios' : n === 1 ? '1-bedrooms' : `${n}-bedrooms`);

const cardBase =
  'relative rounded-xl border border-border bg-card p-6 flex flex-col min-h-[250px] shadow-sm transition-shadow duration-200 hover:shadow-md';

const primaryBtn =
  'inline-flex items-center justify-center gap-1.5 h-10 w-full rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:brightness-105 transition-all whitespace-nowrap';
const ghostBtn =
  'inline-flex items-center justify-center gap-1.5 h-10 w-full rounded-lg border border-primary/30 text-primary text-sm font-medium hover:bg-primary/5 transition-all whitespace-nowrap';

const IconWrap = ({ children }: { children: React.ReactNode }) => (
  <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center mb-4 shrink-0 border border-border/80 text-primary">
    {children}
  </div>
);

const StatRow = ({ label, value, valueTone = 'default' }: { label: string; value: string; valueTone?: 'default' | 'primary' }) => (
  <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/40 px-3 py-2">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className={valueTone === 'primary' ? 'text-sm font-semibold text-primary' : 'text-sm font-semibold text-foreground'}>{value}</span>
  </div>
);

const fade = (delay: number) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, delay, ease: [0.16, 1, 0.3, 1] as const },
});

const NextStepsSection = ({
  isAboveMarket,
  fairnessScore,
  verdictLabel,
  zip,
  bedrooms,
  currentRent,
  proposedRent,
  propertyType,
  city,
  state,
  compMedianRent,
  dollarOverpayment,
  brLabel,
  onShareClick,
}: NextStepsSectionProps) => {
  const [modalOpen, setModalOpen] = useState(false);

  const savings = compMedianRent ? Math.round(proposedRent - compMedianRent) : null;
  const estimatedHomePrice = Math.round(currentRent * 200);
  const overpaymentDisplay = dollarOverpayment && dollarOverpayment > 0 ? dollarOverpayment : null;

  const heading = isAboveMarket
    ? overpaymentDisplay
      ? `You're paying ~$${fmt(overpaymentDisplay)}/mo above market — here are your options`
      : `Your rent is above market — here are your options`
    : `Your rent looks fair — here's how to stay protected`;

  return (
    <>
      <motion.section id="section-next-steps" {...fade(0.22)} className="pt-10 pb-6">
        <div className="border-t border-border/60 pt-8 mb-8">
          <h2 className="text-xl font-semibold text-foreground tracking-tight">{heading}</h2>
        </div>

        {isAboveMarket ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={`${cardBase} border-l-[3px] border-l-primary`}>
              <span className="inline-block text-[10px] font-semibold uppercase tracking-wider text-primary bg-primary/10 rounded-full px-2.5 py-0.5 mb-3 w-fit">
                Recommended for you
              </span>
              <IconWrap>
                <Building className="w-5 h-5" />
              </IconWrap>
              <h3 className="text-lg font-semibold text-foreground mb-2">See Apartments in Your Budget</h3>
              <p className="text-sm text-muted-foreground mb-4">View listings and compare to what you're being asked to pay.</p>
              <div className="space-y-2 mb-5 flex-1">
                <StatRow
                  label={`Median ${bedroomLabel(bedrooms)} in ${city}`}
                  value={compMedianRent ? `$${fmt(compMedianRent)}/mo` : 'Live market rate'}
                />
                {savings && savings > 0 ? <StatRow label="Potential savings" value={`~$${fmt(savings)}/mo`} valueTone="primary" /> : null}
              </div>
              <button
                className={primaryBtn}
                onClick={() => {
                  setModalOpen(true);
                  trackEvent('agent_card_clicked', { zip });
                }}
              >
                Get Matched Free <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className={cardBase}>
              <IconWrap>
                <Truck className="w-5 h-5" />
              </IconWrap>
              <h3 className="text-lg font-semibold text-foreground mb-2">Get Free Moving Quotes</h3>
              <p className="text-sm text-muted-foreground mb-4">Compare vetted movers before you commit to a renewal.</p>
              <div className="space-y-2 mb-5 flex-1">
                <StatRow label={`Typical move in ${state}`} value="$1,200–$2,500" />
                <StatRow label="Quote turnaround" value="Often same day" />
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

            <div className={cardBase}>
              <IconWrap>
                <Key className="w-5 h-5" />
              </IconWrap>
              <h3 className="text-lg font-semibold text-foreground mb-2">Could You Buy Instead?</h3>
              <p className="text-sm text-muted-foreground mb-4">Run a quick affordability check with current mortgage assumptions.</p>
              <div className="space-y-2 mb-5 flex-1">
                <StatRow label="Estimated buying power" value={`$${fmt(estimatedHomePrice)}`} />
                <StatRow label="Based on current rent" value={`$${fmt(currentRent)}/mo`} />
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
            <div className={`${cardBase} border-l-[3px] border-l-primary`}>
              <span className="inline-block text-[10px] font-semibold uppercase tracking-wider text-primary bg-primary/10 rounded-full px-2.5 py-0.5 mb-3 w-fit">
                Recommended for you
              </span>
              <IconWrap>
                <Shield className="w-5 h-5" />
              </IconWrap>
              <h3 className="text-lg font-semibold text-foreground mb-2">Protect Your Home</h3>
              <p className="text-sm text-muted-foreground mb-4">Renters insurance can cover theft, accidental damage, and liability.</p>
              <div className="space-y-2 mb-5 flex-1">
                <StatRow label="Typical starting cost" value="From $5/mo" />
                <StatRow label="Setup time" value="A few minutes" />
              </div>
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

            <div className={cardBase}>
              <IconWrap>
                <Share2 className="w-5 h-5" />
              </IconWrap>
              <h3 className="text-lg font-semibold text-foreground mb-2">Share With Your Neighbors</h3>
              <p className="text-sm text-muted-foreground mb-5 flex-1">Know someone dealing with a rent increase? Send them this tool.</p>
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

        <div className="mt-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 rounded-xl border border-border bg-secondary/60 px-4 py-3">
          <span className="text-[13px] text-muted-foreground">At ${fmt(currentRent)}/mo in rent, you might be able to own.</span>
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
