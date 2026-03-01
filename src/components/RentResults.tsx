import { useState, useMemo, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { RentFormData } from './RentForm';
import { RentLookupResult, bedroomLabels, calculateResults } from '@/data/rentData';
import ShareSection from './ShareSection';
import EmailCapture from './EmailCapture';
import CompLinks from './CompLinks';
import ShouldYouMove from './ShouldYouMove';
import NegotiationLetter from './NegotiationLetter';
import RentControlCard from './RentControlCard';
import { PropertyLookupResult, PropertyLookupError } from '@/hooks/usePropertyLookup';
import { calculateLandlordCosts, generateInsights, toLegacyCostEstimate, LandlordCostEstimate } from '@/data/landlordCosts';
import LandlordCostSection from './LandlordCostSection';
import { useRentcast } from '@/hooks/useRentcast';
import { supabase } from '@/integrations/supabase/client';
import SectionNav from './SectionNav';

interface RentResultsProps {
  formData: RentFormData;
  rentData: RentLookupResult;
  propertyData: PropertyLookupResult | null;
  propertyLoading: boolean;
  propertyError: PropertyLookupError;
  onReset: () => void;
  onScrollToTop: () => void;
}

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

const fade = (delay: number) => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] as const },
});

const RentResults = ({ formData, rentData, propertyData, propertyLoading, propertyError, onReset, onScrollToTop }: RentResultsProps) => {
  const [capturedEmail, setCapturedEmail] = useState('');
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const analysisLogged = useRef(false);

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

  const hasIncrease = increaseAmount > 0;

  const calc = useMemo(() => {
    if (!hasIncrease) return null;
    return calculateResults(formData.currentRent, increasePct, formData.movingCosts, rentData);
  }, [formData.currentRent, increasePct, formData.movingCosts, rentData, hasIncrease]);

  const newRent = formData.currentRent + increaseAmount;
  const annualExtra = increaseAmount * 12;
  const marketYoy = rentData.yoyChange;
  const multiplier = calc?.increaseRatio ?? 0;
  const excessAnnual = hasIncrease
    ? Math.round(formData.currentRent * ((increasePct - marketYoy) / 100) * 12)
    : 0;

  const isAboveMarket = calc?.verdict === 'above';
  const isFair = calc?.verdict === 'at-market';
  const isBelowMarket = calc?.verdict === 'below';

  const landlordCosts = useMemo<LandlordCostEstimate | null>(() => {
    if (!propertyData) return null;
    const costs = calculateLandlordCosts(propertyData);
    if (!costs) return null;
    return toLegacyCostEstimate(propertyData, costs);
  }, [propertyData]);

  const landlordInsights = useMemo(() => {
    if (!propertyData) return null;
    const costs = calculateLandlordCosts(propertyData);
    if (!costs) return null;
    return generateInsights(propertyData, costs, formData.currentRent, newRent);
  }, [propertyData, formData.currentRent, newRent]);

  const rentcast = useRentcast(rentData.zip, formData.bedrooms, formData.fullAddress);
  const hasRentcastComps = rentcast.data && rentcast.data.comparables.length > 0;

  const medianCompRent = useMemo<number | null>(() => {
    if (rentcast.data?.comparables && rentcast.data.comparables.length >= 3) {
      const rents = rentcast.data.comparables
        .map(c => c.rent)
        .filter((r): r is number => r !== null && r > 0)
        .sort((a, b) => a - b);
      if (rents.length >= 2) {
        const mid = Math.floor(rents.length / 2);
        return rents.length % 2 === 0 ? Math.round((rents[mid - 1] + rents[mid]) / 2) : rents[mid];
      }
    }
    if (rentcast.data?.rentEstimate) return rentcast.data.rentEstimate;
    return null;
  }, [rentcast.data]);

  const hasEnoughComps = rentcast.data?.comparables && rentcast.data.comparables.length >= 3;
  const isHighRent = formData.currentRent > rentData.fmr * 1.5;

  const verdictColor = isFair ? 'text-verdict-fair' : isAboveMarket ? 'text-verdict-overpaying' : 'text-verdict-good';
  const verdictLabel = !hasIncrease
    ? 'No Increase'
    : isFair ? 'At Market'
    : isAboveMarket ? 'Above Market'
    : 'Below Market';

  const city = rentData.city;
  const brLabel = bedroomLabels[formData.bedrooms].toLowerCase();

  // ━━━ Anonymous analysis logging ━━━
  useEffect(() => {
    if (analysisLogged.current) return;
    analysisLogged.current = true;

    const compsPosition = medianCompRent
      ? (newRent > medianCompRent ? 'above' : 'below')
      : hasEnoughComps === false ? 'insufficient' : null;

    const counterStr = calc
      ? `$${fmt(calc.counterLow)}–$${fmt(calc.counterHigh)}`
      : null;

    supabase.from('analyses').insert({
      address: formData.fullAddress || null,
      city: rentData.city,
      state: rentData.state,
      zip: rentData.zip,
      bedrooms: formData.bedrooms === 'studio' ? 0 : formData.bedrooms === 'oneBr' ? 1 : formData.bedrooms === 'twoBr' ? 2 : formData.bedrooms === 'threeBr' ? 3 : 4,
      current_rent: formData.currentRent,
      proposed_rent: newRent,
      increase_pct: increasePct,
      market_trend_pct: marketYoy,
      fair_counter_offer: counterStr,
      comps_count: rentcast.data?.comparables?.length ?? 0,
      comps_position: compsPosition,
      sale_data_found: !!propertyData?.lastSalePrice,
      markup_multiplier: landlordInsights?.costIncreaseMarkup ?? null,
      letter_generated: false,
    } as any).select('id').single().then(({ data }) => {
      if (data?.id) setAnalysisId(data.id);
    });
  }, []); // intentionally run once on mount

  const leadContext = useMemo(() => ({
    analysisId,
    address: formData.fullAddress,
    city: rentData.city,
    state: rentData.state,
    zip: rentData.zip,
    bedrooms: formData.bedrooms === 'studio' ? 0 : formData.bedrooms === 'oneBr' ? 1 : formData.bedrooms === 'twoBr' ? 2 : formData.bedrooms === 'threeBr' ? 3 : 4,
    currentRent: formData.currentRent,
    proposedRent: newRent,
    increasePct,
    marketTrendPct: marketYoy,
    fairCounterOffer: calc ? `$${fmt(calc.counterLow)}–$${fmt(calc.counterHigh)}` : undefined,
    compsPosition: medianCompRent ? (newRent > medianCompRent ? 'above' : 'below') : undefined,
    letterGenerated: !!(hasIncrease && isAboveMarket && calc),
  }), [analysisId, formData, rentData, newRent, increasePct, marketYoy, calc, medianCompRent, hasIncrease, isAboveMarket]);

  // Build section nav items based on available data
  const navSections = useMemo(() => {
    const sections = [{ id: 'section-verdict', label: 'Verdict' }];
    if (hasIncrease) sections.push({ id: 'section-evidence', label: 'Evidence' });
    if (hasIncrease && medianCompRent && hasEnoughComps) {
      sections.push({ id: 'section-comps', label: 'Comps' });
    }
    if (hasIncrease && isAboveMarket && calc) {
      sections.push({ id: 'section-letter', label: 'Letter' });
    }
    return sections;
  }, [hasIncrease, medianCompRent, hasEnoughComps, isAboveMarket, calc]);

  // Markup insight for verdict
  const costMarkup = landlordInsights?.costIncreaseMarkup ?? null;
  const showMarkupInVerdict = costMarkup !== null && costMarkup > 1 && !!propertyData?.lastSalePrice;

  let rowIdx = 0;

  return (
    <>
      <SectionNav sections={navSections} />

      <div className="max-w-[620px] mx-auto px-6">

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            SECTION 1: THE VERDICT — full viewport, centered, high impact
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <motion.section
          id="section-verdict"
          {...fade(0)}
          className="min-h-[85vh] flex flex-col items-center justify-center text-center"
        >
          {hasIncrease ? (
            <>
              {/* Dollar-first headline */}
              <h1
                className="font-display text-[clamp(1.75rem,5vw,2.5rem)] text-foreground leading-[1.15] tracking-tight max-w-[520px]"
                style={{ letterSpacing: '-0.02em' }}
              >
                {isAboveMarket && calc ? (
                  <>Your landlord is asking for{' '}
                    <span className="text-destructive">${fmt(newRent - calc.counterHigh)}/mo more</span>{' '}
                    than the market supports.</>
                ) : isFair ? (
                  <>Your rent increase is <span className="text-verdict-fair">right at market.</span></>
                ) : (
                  <>Your rent increase is <span className="text-verdict-good">below market.</span></>
                )}
              </h1>

              {/* Subline */}
              <p className="text-lg md:text-xl text-muted-foreground mt-5 max-w-[460px] leading-relaxed">
                The market moved {marketYoy > 0 ? '+' : ''}{marketYoy}% this year.
                Your landlord is asking for {increasePct}%.
              </p>

              {/* Markup multiplier (if sale data exists) */}
              {showMarkupInVerdict && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3, duration: 0.5 }}
                  className="text-base text-muted-foreground mt-4"
                >
                  That's a{' '}
                  <span className="font-semibold text-destructive">{costMarkup}× markup</span>{' '}
                  on their actual cost increase.
                </motion.p>
              )}

              {/* ── Stat dashboard strip ── */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="mt-10 w-full grid grid-cols-2 md:grid-cols-4 gap-4 max-w-[540px]"
              >
                <div className="text-center">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">You pay now</p>
                  <p className="font-display text-[24px] md:text-[28px] text-foreground tracking-tight" style={{ letterSpacing: '-0.02em' }}>
                    ${fmt(formData.currentRent)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">They want</p>
                  <p className="font-display text-[24px] md:text-[28px] text-destructive tracking-tight" style={{ letterSpacing: '-0.02em' }}>
                    ${fmt(newRent)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">{city} trend</p>
                  <p className="font-display text-[24px] md:text-[28px] text-foreground tracking-tight" style={{ letterSpacing: '-0.02em' }}>
                    {marketYoy > 0 ? '+' : ''}{marketYoy}%
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Your increase</p>
                  <p className={`font-display text-[24px] md:text-[28px] tracking-tight ${verdictColor}`} style={{ letterSpacing: '-0.02em' }}>
                    {increasePct}%
                  </p>
                </div>
              </motion.div>

              {/* CTA */}
              <button
                onClick={() => document.getElementById('section-evidence')?.scrollIntoView({ behavior: 'smooth' })}
                className="mt-10 text-sm font-semibold text-primary hover:underline transition-colors"
              >
                See the evidence ↓
              </button>

              <button onClick={onReset} className="mt-3 text-xs text-muted-foreground hover:text-foreground transition-colors">
                ← Check a different address
              </button>
            </>
          ) : (
            <>
              <h1 className="font-display text-[32px] font-semibold text-foreground">No increase entered</h1>
              <p className="text-muted-foreground mt-2">Enter your proposed increase to compare.</p>
            </>
          )}
        </motion.section>

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            SECTION 2: THE EVIDENCE — card-based layout
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {hasIncrease && (
          <section id="section-evidence" className="pt-12 pb-8">
            <motion.h2 {...fade(0.05)} className="results-section-header mb-10">
              The evidence
            </motion.h2>

            <div className="space-y-6">

              {/* Card A: Market Context */}
              <motion.div {...fade(0.08)} className="evidence-card">
                <h3 className="evidence-card-header">What the market says</h3>
                <p className="text-xs text-muted-foreground mb-4">{city}, {rentData.state} — {bedroomLabels[formData.bedrooms]}</p>

                <div className={`context-row ${rowIdx++ % 2 === 0 ? 'context-row-even' : 'context-row-odd'}`}>
                  <span className="context-label">{city} rents this year</span>
                  <span className="context-value">
                    {marketYoy > 0 ? '+' : ''}{marketYoy}%
                    {rentData.yoyCapped && <span className="context-sub"> (capped)</span>}
                  </span>
                </div>
                {rentData.zillowMonthly !== null && rentData.zillowDirection && (
                  <div className={`context-row ${rowIdx++ % 2 === 0 ? 'context-row-even' : 'context-row-odd'}`}>
                    <span className="context-label">Monthly trend</span>
                    <span className="context-value">
                      {rentData.zillowMonthly > 0 ? '+' : ''}{rentData.zillowMonthly}%/mo
                      <span className="context-sub">
                        {rentData.zillowDirection === 'rising' ? ' ↑ rising' : rentData.zillowDirection === 'falling' ? ' ↓ cooling' : ' → steady'}
                      </span>
                    </span>
                  </div>
                )}
                {calc && (
                  <div className={`context-row ${rowIdx++ % 2 === 0 ? 'context-row-even' : 'context-row-odd'}`}>
                    <span className="context-label">What most {brLabel} go for</span>
                    <span className="context-value">${fmt(calc.typicalRangeLow)} – ${fmt(calc.typicalRangeHigh)}</span>
                  </div>
                )}
                {isAboveMarket && calc && (
                  <div className="context-row-highlight mt-2">
                    <span className="context-label">Fair counter-offer</span>
                    <span className="context-value text-verdict-good font-bold">${fmt(calc.counterLow)}–${fmt(calc.counterHigh)}/mo</span>
                  </div>
                )}

                <p className="text-[11px] text-muted-foreground mt-3">
                  {rentData.yoySourceLabel}
                </p>
                {rentData.yoySource === 'hud' && rentData.priorSource === 'm' && (
                  <p className="text-[11px] text-muted-foreground mt-1">Based on {rentData.metro} area average trend.</p>
                )}
                {rentData.yoySource === 'hud' && rentData.priorSource === 'n' && (
                  <p className="text-[11px] text-muted-foreground mt-1">Note: This uses the national rent trend because local data is limited for this area.</p>
                )}
              </motion.div>

              {/* Card B: Your Landlord's Property */}
              <motion.div {...fade(0.12)} className="evidence-card">
                <LandlordCostSection
                  propertyData={propertyData}
                  propertyLoading={propertyLoading}
                  propertyError={propertyError}
                  currentRent={formData.currentRent}
                  proposedRent={newRent}
                  increaseAmount={increaseAmount}
                  hasAddress={!!formData.fullAddress}
                  onScrollToTop={onScrollToTop}
                />
              </motion.div>

              {/* Card C: Know Your Rights */}
              <motion.div {...fade(0.14)} className="evidence-card">
                <RentControlCard
                  state={rentData.state}
                  city={rentData.city}
                  zip={rentData.zip}
                  increasePct={increasePct}
                />
              </motion.div>

            </div>
          </section>
        )}

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            SECTION 3: COMPARABLE LISTINGS
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {hasIncrease && medianCompRent && hasEnoughComps && (
          <motion.section id="section-comps" {...fade(0.15)} className="py-12">
            <h2 className="results-section-header mb-8">
              How your rent compares to nearby units
            </h2>
            <ShouldYouMove
              proposedRent={newRent}
              currentRent={formData.currentRent}
              comparables={rentcast.data!.comparables}
              medianCompRent={medianCompRent}
              brLabel={brLabel}
              city={city}
              state={rentData.state}
              zip={rentData.zip}
              bedrooms={formData.bedrooms}
              counterOffer={calc?.counterHigh ?? null}
              isAboveMarket={isAboveMarket}
              onScrollToLetter={() => document.getElementById('section-letter')?.scrollIntoView({ behavior: 'smooth' })}
            />
          </motion.section>
        )}
        {!hasEnoughComps && !rentcast.loading && (
          <motion.section {...fade(0.15)} className="py-12">
            <CompLinks zip={rentData.zip} city={rentData.city} state={rentData.state} bedrooms={formData.bedrooms} />
          </motion.section>
        )}

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            SECTION 4: LEASE REMINDER — after comps, before letter
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <section className="py-12">
          <div className="rounded-xl px-8 py-10 text-center" style={{ background: 'hsl(var(--secondary))' }}>
            <EmailCapture
              city={city}
              captureSource="lease_reminder"
              prefilledEmail={capturedEmail}
              onEmailCaptured={setCapturedEmail}
              leadContext={leadContext}
            />
          </div>
        </section>

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            SECTION 5: NEGOTIATION LETTER
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {hasIncrease && isAboveMarket && calc && (
          <motion.section id="section-letter" {...fade(0.21)} className="py-12">
            <NegotiationLetter
              currentRent={formData.currentRent}
              newRent={newRent}
              increasePct={increasePct}
              marketYoy={marketYoy}
              fmr={rentData.fmr}
              censusMedian={rentData.censusMedianRent}
              medianIncome={rentData.medianIncome}
              zip={rentData.zip}
              city={rentData.city}
              state={rentData.state}
              bedrooms={formData.bedrooms}
              increaseAmount={increaseAmount}
              counterLow={calc.counterLow}
              counterHigh={calc.counterHigh}
              counterLowPercent={calc.counterLowPercent}
              counterHighPercent={calc.counterHighPercent}
              analysisId={analysisId}
              prefilledEmail={capturedEmail}
              onEmailCaptured={setCapturedEmail}
              leadContext={leadContext}
            />
          </motion.section>
        )}

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            SECTION 6: SHARE
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <section className="py-12 text-center">
          <ShareSection
            increasePct={increasePct}
            marketPct={marketYoy}
            excessAnnual={excessAnnual}
            multiplier={multiplier}
            landlordCosts={landlordCosts}
            increaseAmount={increaseAmount}
          />
        </section>
      </div>
    </>
  );
};

export default RentResults;
