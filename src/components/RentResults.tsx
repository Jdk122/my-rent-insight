import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { RentFormData } from './RentForm';
import { RentData, getFmrForBedrooms, getTypicalRange, bedroomLabels, calculateBreakEven } from '@/data/rentData';
import ScenarioToggles from './ScenarioToggles';
import ShareSection from './ShareSection';
import EmailCapture from './EmailCapture';
import CompLinks from './CompLinks';
import NegotiationLetter from './NegotiationLetter';
import AffordabilityCard from './AffordabilityCard';
import { ArrowLeft, TrendingUp, TrendingDown, Scale, ArrowRight, Search, FileText } from 'lucide-react';

interface RentResultsProps {
  formData: RentFormData;
  rentData: RentData;
  onReset: () => void;
}

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

const fade = (delay: number) => ({
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] as const },
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
  const [showLetter, setShowLetter] = useState(false);
  const [activeTab, setActiveTab] = useState<'data' | 'scenarios' | 'afford'>('data');

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
    <div>
      {/* ━━━ ABOVE THE FOLD: Verdict + Stats + Actions ━━━ */}
      <motion.div {...fade(0)}>
        {/* Verdict */}
        <div className="text-center pt-2 pb-4">
          {hasIncrease ? (
            <>
              <span className={`verdict-pill ${pillClass}`}>{verdictLabel}</span>
              <p className="font-display text-[clamp(2.4rem,7vw,3.8rem)] leading-[0.9] tracking-tight mt-3">
                <span className={verdictColor}>{increasePct}%</span>
                <span className="text-muted-foreground mx-2 text-[0.4em] align-middle">vs</span>
                <span className="text-foreground">{marketYoy}%</span>
              </p>
              <p className="text-xs text-muted-foreground mt-2 tracking-wide uppercase">
                Your Increase vs. Market · {bedroomLabels[formData.bedrooms]} · {rentData.zip}
              </p>
              {isAboveMarket && multiplier > 0 && (
                <p className="text-sm mt-3 text-foreground">
                  <span className={`font-bold ${verdictColor}`}>{multiplier}×</span> the market rate —{' '}
                  <span className="font-mono font-bold">${fmt(excessAnnual)}</span>/yr above market
                </p>
              )}
              {isBelowMarket && (
                <p className="text-sm mt-3 text-verdict-good">Below market — you're in good shape</p>
              )}
            </>
          ) : (
            <>
              <p className="font-display text-2xl text-foreground">No increase entered</p>
              <p className="text-sm text-muted-foreground mt-1">Enter your proposed increase to compare</p>
            </>
          )}
        </div>

        {/* Key stats row */}
        {hasIncrease && (
          <div className="grid grid-cols-4 gap-3 py-4 border-y border-border">
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Current</p>
              <p className="font-mono text-base font-bold text-foreground mt-0.5">${fmt(formData.currentRent)}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Proposed</p>
              <p className={`font-mono text-base font-bold mt-0.5 ${verdictColor}`}>${fmt(newRent)}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Extra/yr</p>
              <p className="font-mono text-base font-bold text-foreground mt-0.5">${fmt(annualExtra)}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Break-even</p>
              <p className="font-mono text-base font-bold text-foreground mt-0.5">
                {breakEven.months === Infinity ? '—' : `${breakEven.months.toFixed(0)}mo`}
              </p>
            </div>
          </div>
        )}

        {/* Action buttons */}
        {hasIncrease && (
          <div className="flex gap-2 pt-4">
            {isAboveMarket && (
              <button
                onClick={() => setShowLetter(!showLetter)}
                className="flex-1 flex items-center justify-center gap-2 h-10 rounded-md border-2 border-primary/20 bg-primary/[0.03] text-sm font-medium text-primary hover:border-primary/40 hover:bg-primary/[0.06] transition-all"
              >
                <FileText className="w-4 h-4" />
                Negotiate
              </button>
            )}
            <a
              href={`#comps`}
              onClick={(e) => { e.preventDefault(); document.getElementById('comps-section')?.scrollIntoView({ behavior: 'smooth' }); }}
              className="flex-1 flex items-center justify-center gap-2 h-10 rounded-md border border-border text-sm font-medium text-foreground hover:bg-secondary transition-colors"
            >
              <Search className="w-4 h-4" />
              See Listings
            </a>
            <button
              onClick={onReset}
              className="flex items-center justify-center gap-2 h-10 px-4 rounded-md border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              New
            </button>
          </div>
        )}

        {/* Share */}
        {hasIncrease && isAboveMarket && (
          <div className="pt-3">
            <ShareSection
              increasePct={increasePct}
              marketPct={marketYoy}
              excessAnnual={excessAnnual}
              multiplier={multiplier}
            />
          </div>
        )}
      </motion.div>

      {/* ━━━ NEGOTIATION LETTER (expandable inline) ━━━ */}
      {hasIncrease && isAboveMarket && showLetter && (
        <motion.div {...fade(0.05)}>
          <div className="report-rule mt-4" />
          <div className="report-section">
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
          </div>
        </motion.div>
      )}

      {/* ━━━ TABBED DETAILS ━━━ */}
      <motion.div {...fade(0.08)}>
        <div className="report-rule mt-4" />

        {/* Tab bar */}
        <div className="flex border-b border-border">
          {(['data', ...(hasIncrease ? ['scenarios', 'afford'] as const : [])] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as typeof activeTab)}
              className={`flex-1 py-3 text-xs font-medium uppercase tracking-wide transition-colors border-b-2 -mb-px ${
                activeTab === tab
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab === 'data' ? 'Market Data' : tab === 'scenarios' ? 'What If' : 'Affordability'}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="py-5">
          {activeTab === 'data' && (
            <div>
              <div className="divide-y divide-border">
                <div className="data-row">
                  <span className="data-row-label">YoY rent change</span>
                  <span className={`data-row-value flex items-center gap-1.5 ${rentData.yoyChange > 0 ? 'text-verdict-overpaying' : 'text-verdict-good'}`}>
                    {rentData.yoyChange > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {rentData.yoyChange > 0 ? '+' : ''}{rentData.yoyChange}%
                  </span>
                </div>
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
                {hasIncrease && (
                  <div className="data-row">
                    <span className="data-row-label">Your increase</span>
                    <span className="data-row-value">+{increasePct}% <span className="text-muted-foreground font-normal text-xs ml-1">(+${fmt(increaseAmount)}/mo)</span></span>
                  </div>
                )}
              </div>

              {hasIncrease && (
                <div className="callout mt-4">
                  <Scale className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <p className="font-mono text-sm font-semibold text-foreground">
                      Break-even: {breakEven.months === Infinity ? '∞' : breakEven.months.toFixed(1)} months
                    </p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {breakEven.verdict === 'move' && `Moving saves ~$${fmt(Math.abs(breakEven.yearOneSavings))} in year 1`}
                      {breakEven.verdict === 'close' && `Close call — depends on your priorities`}
                      {breakEven.verdict === 'stay' && `Staying is likely the smarter move`}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'scenarios' && hasIncrease && (
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
          )}

          {activeTab === 'afford' && hasIncrease && (
            <AffordabilityCard
              currentRent={formData.currentRent}
              newRent={newRent}
              medianHouseholdIncome={rentData.medianHouseholdIncome}
              zip={rentData.zip}
            />
          )}
        </div>
      </motion.div>

      {/* ━━━ COMPS ━━━ */}
      <div id="comps-section">
        <motion.div {...fade(0.1)}>
          <div className="report-rule" />
          <div className="py-5">
            <CompLinks
              zip={rentData.zip}
              city={rentData.city}
              state={rentData.state}
              bedrooms={formData.bedrooms}
            />
          </div>
        </motion.div>
      </div>

      {/* ━━━ EMAIL ━━━ */}
      <motion.div {...fade(0.12)}>
        <div className="report-rule" />
        <div className="py-5">
          <EmailCapture />
        </div>
      </motion.div>

      {/* ━━━ RESET (bottom) ━━━ */}
      {!hasIncrease && (
        <div className="report-rule" />
      )}
      <div className="text-center py-6">
        <button
          onClick={onReset}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Check another increase
        </button>
      </div>
    </div>
  );
};

export default RentResults;
