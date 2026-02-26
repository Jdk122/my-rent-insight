import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { RentFormData } from './RentForm';
import { RentData, getFmrForBedrooms, getTypicalRange, bedroomLabels, calculateBreakEven } from '@/data/rentData';
import ScenarioToggles from './ScenarioToggles';
import ShareSection from './ShareSection';
import EmailCapture from './EmailCapture';
import CompLinks from './CompLinks';
import NegotiationLetter from './NegotiationLetter';
import RentControlCard from './RentControlCard';
import AffordabilityCard from './AffordabilityCard';
import { ArrowLeft, TrendingUp, TrendingDown, Scale, Shield, CreditCard } from 'lucide-react';

interface RentResultsProps {
  formData: RentFormData;
  rentData: RentData;
  onReset: () => void;
}

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

const anim = (delay: number) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, delay, ease: [0.16, 1, 0.3, 1] as const },
});

const RentResults = ({ formData, rentData, onReset }: RentResultsProps) => {
  const fmr = getFmrForBedrooms(rentData, formData.bedrooms);
  const range = getTypicalRange(rentData, formData.bedrooms);
  const marketYoy = rentData.yoyChange;

  const increaseAmount = formData.rentIncrease
    ? formData.increaseIsPercent
      ? Math.round(formData.currentRent * (formData.rentIncrease / 100))
      : formData.rentIncrease
    : 0;

  const increasePct = formData.rentIncrease
    ? formData.increaseIsPercent
      ? formData.rentIncrease
      : Math.round((formData.rentIncrease / formData.currentRent) * 1000) / 10
    : 0;

  const newRent = formData.currentRent + increaseAmount;
  const annualExtra = increaseAmount * 12;

  const increaseVsMarket = increasePct - marketYoy;
  const multiplier = marketYoy > 0 ? Math.round((increasePct / marketYoy) * 10) / 10 : 0;
  const excessAnnual = Math.round((formData.currentRent * (increaseVsMarket / 100)) * 12);

  const hasIncrease = increaseAmount > 0;
  const isAboveMarket = increaseVsMarket > 1;
  const isFair = Math.abs(increaseVsMarket) <= 1;
  const isBelowMarket = increaseVsMarket < -1;

  const [scenarioNewRent, setScenarioNewRent] = useState<number>(fmr);
  const [scenarioMovingCost, setScenarioMovingCost] = useState<number>(formData.movingCosts);
  const [scenarioNegotiatedPct, setScenarioNegotiatedPct] = useState<number>(increasePct);

  const breakEven = useMemo(() => {
    const negotiatedIncrease = Math.round(formData.currentRent * (scenarioNegotiatedPct / 100));
    const effectiveCurrentRent = formData.currentRent + negotiatedIncrease;
    return calculateBreakEven(effectiveCurrentRent, scenarioNewRent, scenarioMovingCost);
  }, [formData.currentRent, scenarioNewRent, scenarioMovingCost, scenarioNegotiatedPct]);

  const verdictColor = isFair ? 'text-verdict-fair' : isAboveMarket ? 'text-verdict-overpaying' : 'text-verdict-good';
  const pillClass = isFair ? 'verdict-pill-fair' : isAboveMarket ? 'verdict-pill-overpaying' : 'verdict-pill-good';
  const verdictLabel = !hasIncrease
    ? 'No Increase'
    : isFair ? 'Market Rate'
    : isAboveMarket ? 'Above Market'
    : 'Below Market';

  return (
    <div className="space-y-6">
      {/* ━━━ PRIMARY VERDICT ━━━ */}
      <motion.div {...anim(0)} className="brand-card-dark relative overflow-hidden">
        {/* Subtle gradient glow */}
        {hasIncrease && isAboveMarket && (
          <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full opacity-[0.07]" style={{ background: 'radial-gradient(circle, hsl(var(--verdict-overpaying)), transparent)' }} />
        )}
        <div className="relative flex items-center justify-between mb-6">
          <span className="data-label" style={{ color: 'hsl(var(--warm-gray))' }}>
            Increase Report
          </span>
          <span className={`verdict-pill ${pillClass}`}>
            {verdictLabel}
          </span>
        </div>

        {hasIncrease ? (
          <div className="relative text-center py-2">
            <p className={`font-mono text-4xl md:text-5xl font-bold tracking-tight ${verdictColor}`}>
              {increasePct}%
              <span className="text-lg font-normal mx-2" style={{ color: 'hsl(var(--warm-gray))' }}>vs</span>
              {marketYoy}%
            </p>
            <p className="font-mono text-xs mt-3 tracking-wide" style={{ color: 'hsl(var(--warm-gray))' }}>
              YOUR INCREASE vs. MARKET RATE · {rentData.zip}
            </p>

            {isAboveMarket && multiplier > 0 && (
              <p className="font-mono text-base mt-5" style={{ color: 'hsl(var(--cream))' }}>
                That's <span className="text-verdict-overpaying font-bold">{multiplier}×</span> the market rate
              </p>
            )}
            {isBelowMarket && (
              <p className="font-mono text-base mt-5 text-verdict-good">
                Below the local market trend
              </p>
            )}
          </div>
        ) : (
          <div className="text-center py-2">
            <p className="font-mono text-2xl md:text-3xl font-bold tracking-tight" style={{ color: 'hsl(var(--cream))' }}>
              No increase entered
            </p>
            <p className="font-mono text-xs mt-3" style={{ color: 'hsl(var(--warm-gray))' }}>
              Enter your proposed increase to compare
            </p>
          </div>
        )}

        {hasIncrease && (
          <div className="grid grid-cols-2 gap-4 mt-6 pt-5" style={{ borderTop: '1px solid hsl(var(--warm-gray) / 0.15)' }}>
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.15em] mb-1" style={{ color: 'hsl(var(--warm-gray))' }}>
                Extra / Year
              </p>
              <p className={`font-mono text-xl font-bold ${verdictColor}`}>
                ${fmt(annualExtra)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.15em] mb-1" style={{ color: 'hsl(var(--warm-gray))' }}>
                Above-Market
              </p>
              <p className="font-mono text-xl font-bold" style={{ color: isAboveMarket ? 'hsl(var(--verdict-overpaying))' : 'hsl(var(--cream))' }}>
                {excessAnnual > 0 ? `$${fmt(excessAnnual)}` : '—'}
              </p>
            </div>
          </div>
        )}
      </motion.div>

      {/* ━━━ SHARE ━━━ */}
      {hasIncrease && isAboveMarket && (
        <motion.div {...anim(0.06)}>
          <ShareSection
            increasePct={increasePct}
            marketPct={marketYoy}
            excessAnnual={excessAnnual}
            multiplier={multiplier}
          />
        </motion.div>
      )}

      {/* ━━━ MARKET DATA ━━━ */}
      <motion.div {...anim(0.1)} className="brand-card">
        <p className="data-label mb-1" style={{ color: 'hsl(var(--accent-emerald))' }}>Market Data</p>
        <h3 className="font-display text-xl text-foreground mb-5">
          {bedroomLabels[formData.bedrooms]} · {rentData.city}, {rentData.state}
        </h3>

        <div className="divide-y divide-border">
          <div className="data-row">
            <span className="data-row-label">YoY rent change</span>
            <span className={`data-row-value flex items-center gap-1 ${rentData.yoyChange > 0 ? 'text-verdict-overpaying' : 'text-verdict-good'}`}>
              {rentData.yoyChange > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {rentData.yoyChange > 0 ? '+' : ''}{rentData.yoyChange}%
            </span>
          </div>
          {hasIncrease && (
            <div className="data-row">
              <span className="data-row-label">Your increase</span>
              <span className="data-row-value">
                +{increasePct}%
                <span className="text-muted-foreground font-normal text-xs ml-1.5">(+${fmt(increaseAmount)}/mo)</span>
              </span>
            </div>
          )}
          <div className="data-row">
            <span className="data-row-label">Typical range</span>
            <span className="data-row-value">${fmt(range.low)} – ${fmt(range.high)}</span>
          </div>
          <div className="data-row">
            <span className="data-row-label">HUD Fair Market Rent</span>
            <span className="data-row-value">${fmt(fmr)}</span>
          </div>
          {rentData.censusMedian && (
            <div className="data-row">
              <span className="data-row-label">Census median</span>
              <span className="data-row-value">${fmt(rentData.censusMedian)}</span>
            </div>
          )}
        </div>
      </motion.div>

      {/* ━━━ LEGAL CONTEXT ━━━ */}
      {hasIncrease && (
        <motion.div {...anim(0.13)}>
          <RentControlCard zip={rentData.zip} increasePct={increasePct} />
        </motion.div>
      )}

      {/* ━━━ AFFORDABILITY ━━━ */}
      {hasIncrease && (
        <motion.div {...anim(0.15)}>
          <AffordabilityCard
            currentRent={formData.currentRent}
            newRent={newRent}
            medianHouseholdIncome={rentData.medianHouseholdIncome}
            zip={rentData.zip}
          />
        </motion.div>
      )}

      {/* ━━━ COMPS ━━━ */}
      <motion.div {...anim(0.17)}>
        <CompLinks
          zip={rentData.zip}
          city={rentData.city}
          state={rentData.state}
          bedrooms={formData.bedrooms}
        />
      </motion.div>

      {/* ━━━ DECISION ━━━ */}
      {hasIncrease && (
        <motion.div {...anim(0.19)} className="brand-card-decision">
          <p className="data-label mb-1" style={{ color: 'hsl(var(--accent-blue))' }}>Decision</p>
          <h3 className="font-display text-xl text-foreground mb-4">Accept, Negotiate, or Move?</h3>

          <div className="flex items-baseline gap-2 font-mono text-lg">
            <span className="text-muted-foreground">${fmt(formData.currentRent)}</span>
            <span className="text-muted-foreground/50">→</span>
            <span className="font-bold text-foreground">${fmt(newRent)}</span>
            <span className="text-xs text-muted-foreground ml-1">+${fmt(increaseAmount)}/mo</span>
          </div>

          <div className="mt-4 p-3.5 rounded-lg bg-secondary/70">
            <div className="flex items-center gap-2">
              <Scale className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="font-mono text-sm font-semibold">
                Break-even: {breakEven.months === Infinity ? '∞' : breakEven.months.toFixed(1)} months
              </span>
            </div>
            <div className={`mt-2.5 verdict-pill ${breakEven.verdict === 'move' ? 'verdict-pill-good' : breakEven.verdict === 'close' ? 'verdict-pill-fair' : 'verdict-pill-overpaying'}`}>
              {breakEven.verdict === 'move' && `Moving saves ~$${fmt(Math.abs(breakEven.yearOneSavings))} yr 1`}
              {breakEven.verdict === 'close' && `Close call — depends on your situation`}
              {breakEven.verdict === 'stay' && `Staying is probably smarter`}
            </div>
          </div>
        </motion.div>
      )}

      {/* ━━━ NEGOTIATION LETTER ━━━ */}
      {hasIncrease && isAboveMarket && (
        <motion.div {...anim(0.21)}>
          <NegotiationLetter
            currentRent={formData.currentRent}
            newRent={newRent}
            increasePct={increasePct}
            marketYoy={marketYoy}
            fmr={fmr}
            censusMedian={rentData.censusMedian}
            medianHouseholdIncome={rentData.medianHouseholdIncome}
            zip={rentData.zip}
            city={rentData.city}
            state={rentData.state}
            bedrooms={formData.bedrooms}
          />
        </motion.div>
      )}

      {/* ━━━ SCENARIOS ━━━ */}
      {hasIncrease && (
        <motion.div {...anim(0.23)}>
          <ScenarioToggles
            currentRent={newRent}
            fmr={fmr}
            scenarioNewRent={scenarioNewRent}
            setScenarioNewRent={setScenarioNewRent}
            scenarioMovingCost={scenarioMovingCost}
            setScenarioMovingCost={setScenarioMovingCost}
            scenarioNegotiatedPct={scenarioNegotiatedPct}
            setScenarioNegotiatedPct={setScenarioNegotiatedPct}
            breakEven={breakEven}
            hasIncrease={hasIncrease}
          />
        </motion.div>
      )}

      {/* ━━━ AFFILIATE: RENTERS INSURANCE ━━━ */}
      {hasIncrease && (
        <motion.div {...anim(0.25)}>
          <a href="#lemonade-affiliate" target="_blank" rel="noopener noreferrer" className="affiliate-cta group">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-accent/8 shrink-0">
              <Shield className="w-4 h-4 text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground leading-tight">
                Protect your belongings wherever you live
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Renters insurance from ~$5/mo
              </p>
            </div>
            <span className="text-xs font-mono font-semibold text-accent shrink-0">
              Get Covered →
            </span>
          </a>
        </motion.div>
      )}

      {/* ━━━ EMAIL CAPTURE ━━━ */}
      <motion.div {...anim(0.27)}>
        <EmailCapture />
      </motion.div>

      {/* ━━━ AFFILIATE: CREDIT SCORE ━━━ */}
      <motion.div {...anim(0.29)}>
        <a href="#credit-karma-affiliate" target="_blank" rel="noopener noreferrer" className="affiliate-cta group">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-verdict-good/8 shrink-0">
            <CreditCard className="w-4 h-4 text-verdict-good" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground leading-tight">
              Check your credit score before signing a new lease
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Landlords pull credit — know your number first
            </p>
          </div>
          <span className="text-xs font-mono font-semibold text-verdict-good shrink-0">
            Check Free →
          </span>
        </a>
      </motion.div>

      {/* ━━━ RESET ━━━ */}
      <div className="text-center pt-4 pb-2">
        <button
          onClick={onReset}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors font-mono"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Check another increase
        </button>
      </div>
    </div>
  );
};

export default RentResults;
