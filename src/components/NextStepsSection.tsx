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

const fade = (delay: number) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, delay, ease: [0.16, 1, 0.3, 1] as const },
});

interface ActionCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  stats: { label: string; value: string }[];
  actionLabel: string;
  actionHref?: string;
  onAction?: () => void;
  recommended?: boolean;
  delay: number;
}

const ActionCard = ({ icon, title, description, stats, actionLabel, actionHref, onAction, recommended, delay }: ActionCardProps) => (
  <motion.div
    {...fade(delay)}
    className={`rounded-xl border bg-card p-5 transition-shadow duration-200 hover:shadow-md ${
      recommended ? 'border-primary/40 shadow-sm' : 'border-border'
    }`}
  >
    <div className="flex items-start gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
        recommended ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground'
      }`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-[15px] font-semibold text-foreground leading-tight">{title}</h3>
          {recommended && (
            <span className="text-[10px] font-semibold uppercase tracking-wider text-primary bg-primary/10 rounded-full px-2 py-0.5 shrink-0">
              Recommended
            </span>
          )}
        </div>
        <p className="text-[13px] text-muted-foreground leading-relaxed mb-3">{description}</p>

        {stats.length > 0 && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3">
            {stats.map((s, i) => (
              <div key={i} className="flex items-baseline gap-1.5">
                <span className="text-[11px] text-muted-foreground/70">{s.label}:</span>
                <span className="text-[13px] font-semibold text-foreground">{s.value}</span>
              </div>
            ))}
          </div>
        )}

        {actionHref ? (
          <a
            href={actionHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onAction?.()}
            className={`inline-flex items-center gap-1.5 text-[13px] font-semibold transition-colors ${
              recommended
                ? 'text-primary hover:text-primary/80'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {actionLabel} <ArrowRight className="w-3.5 h-3.5" />
          </a>
        ) : (
          <button
            onClick={() => onAction?.()}
            className={`inline-flex items-center gap-1.5 text-[13px] font-semibold transition-colors ${
              recommended
                ? 'text-primary hover:text-primary/80'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {actionLabel} <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  </motion.div>
);

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
        <div className="border-t border-border/60 pt-8 mb-6">
          <h2 className="text-xl font-semibold text-foreground tracking-tight">{heading}</h2>
        </div>

        <div className="space-y-3">
          {isAboveMarket ? (
            <>
              <ActionCard
                icon={<Building className="w-5 h-5" />}
                title="See Apartments in Your Budget"
                description="View listings and compare to what you're being asked to pay."
                stats={[
                  ...(compMedianRent
                    ? [{ label: `Median ${bedroomLabel(bedrooms)} in ${city}`, value: `$${fmt(compMedianRent)}/mo` }]
                    : []),
                  ...(savings && savings > 0
                    ? [{ label: 'Potential savings', value: `~$${fmt(savings)}/mo` }]
                    : []),
                ]}
                actionLabel="Get Matched Free"
                onAction={() => {
                  setModalOpen(true);
                  trackEvent('agent_card_clicked', { zip });
                }}
                recommended
                delay={0.24}
              />

              <ActionCard
                icon={<Truck className="w-5 h-5" />}
                title="Get Free Moving Quotes"
                description="Compare vetted movers before you commit to a renewal."
                stats={[
                  { label: `Typical move in ${state}`, value: '$1,200–$2,500' },
                  { label: 'Quote turnaround', value: 'Often same day' },
                ]}
                actionLabel="Compare Movers"
                actionHref="https://www.moving.com/movers/"
                onAction={() => trackEvent('moving_quote_clicked')}
                delay={0.28}
              />

              <ActionCard
                icon={<Key className="w-5 h-5" />}
                title="Could You Buy Instead?"
                description="Run a quick affordability check with current mortgage assumptions."
                stats={[
                  { label: 'Estimated buying power', value: `$${fmt(estimatedHomePrice)}` },
                  { label: 'Based on current rent', value: `$${fmt(currentRent)}/mo` },
                ]}
                actionLabel="Check Rates"
                actionHref="https://www.bankrate.com/mortgages/mortgage-calculator/"
                onAction={() => trackEvent('mortgage_link_clicked')}
                delay={0.32}
              />
            </>
          ) : (
            <>
              <ActionCard
                icon={<Shield className="w-5 h-5" />}
                title="Protect Your Home"
                description="Renters insurance can cover theft, accidental damage, and liability."
                stats={[
                  { label: 'Typical starting cost', value: 'From $5/mo' },
                  { label: 'Setup time', value: 'A few minutes' },
                ]}
                actionLabel="Get a Free Quote"
                actionHref="https://www.lemonade.com/renters"
                onAction={() => trackEvent('insurance_quote_clicked')}
                recommended
                delay={0.24}
              />

              <ActionCard
                icon={<Share2 className="w-5 h-5" />}
                title="Share With Your Neighbors"
                description="Know someone dealing with a rent increase? Send them this tool."
                stats={[]}
                actionLabel="Share Results"
                onAction={() => {
                  trackEvent('share_clicked', { source: 'next_steps' });
                  onShareClick?.();
                }}
                delay={0.28}
              />
            </>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between rounded-xl border border-border bg-secondary/60 px-4 py-3">
          <span className="text-[13px] text-muted-foreground">At ${fmt(currentRent)}/mo in rent, you might be able to own.</span>
          <a
            href="https://www.bankrate.com/mortgages/mortgage-calculator/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[13px] font-medium text-primary hover:underline inline-flex items-center gap-1 shrink-0"
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
