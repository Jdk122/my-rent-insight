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
  onShareClick?: () => void;
}

const cardBase =
  'relative bg-card rounded-xl flex flex-col transition-all duration-200 cursor-default';
const cardBorder = 'border border-[rgba(0,0,0,0.06)]';
const cardShadow = 'shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] hover:-translate-y-0.5';

const primaryBtn =
  'inline-flex items-center justify-center gap-1.5 h-10 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:brightness-105 transition-all';
const ghostBtn =
  'inline-flex items-center justify-center gap-1.5 h-10 px-5 rounded-lg border border-primary/30 text-primary text-sm font-medium hover:bg-primary/5 transition-all';

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
  currentRent, proposedRent, propertyType, onShareClick,
}: NextStepsSectionProps) => {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <motion.section id="section-next-steps" {...fade(0.22)} className="pt-10 pb-6">
        {/* Divider + heading */}
        <div className="border-t border-border/60 pt-8 mb-8">
          <h2 className="text-xl font-semibold text-foreground tracking-tight">Your Next Steps</h2>
          <p className="text-sm text-muted-foreground mt-1">Based on your results, here's what we recommend</p>
        </div>

        {/* Cards */}
        {isAboveMarket ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Primary — Agent match */}
            <div className={`${cardBase} ${cardBorder} ${cardShadow} p-6 border-l-[3px] border-l-primary`}>
              <IconWrap><Building className="w-5 h-5 text-primary" /></IconWrap>
              <h3 className="text-lg font-semibold text-foreground mb-1">See Apartments in Your Budget</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-5 flex-1">
                A local rental specialist can show you places near you — free, no obligation.
              </p>
              <button className={primaryBtn} onClick={() => { setModalOpen(true); trackEvent('agent_card_clicked', { zip }); }}>
                Get Matched Free <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Moving quotes */}
            <div className={`${cardBase} ${cardBorder} ${cardShadow} p-6`}>
              <IconWrap><Truck className="w-5 h-5 text-primary" /></IconWrap>
              <h3 className="text-lg font-semibold text-foreground mb-1">Get Free Moving Quotes</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-5 flex-1">
                Compare licensed movers near you. Takes 30 seconds.
              </p>
              <a
                href="https://renewalreply.com/moving"
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
              <h3 className="text-lg font-semibold text-foreground mb-1">Could You Buy Instead?</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-5 flex-1">
                See today's mortgage rates and what you could afford.
              </p>
              <a
                href="https://renewalreply.com/mortgage"
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
              <IconWrap><Shield className="w-5 h-5 text-primary" /></IconWrap>
              <h3 className="text-lg font-semibold text-foreground mb-1">Protect Your Home</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-5 flex-1">
                Renters insurance from $5/mo. Covers theft, damage, and liability.
              </p>
              <a
                href="https://renewalreply.com/insurance"
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

        {/* Bottom banner */}
        <div className="mt-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 rounded-lg px-4 py-3" style={{ background: 'hsl(var(--secondary))' }}>
          <span className="text-[13px] text-muted-foreground">Thinking about buying instead of renting?</span>
          <a
            href="https://renewalreply.com/mortgage"
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
