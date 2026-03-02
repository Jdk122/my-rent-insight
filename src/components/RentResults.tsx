import { useState, useMemo, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { RentFormData } from './RentForm';
import { RentLookupResult, bedroomLabels, calculateResults } from '@/data/rentData';
import ShareSection from './ShareSection';
import ShareableCard from './ShareableCard';
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
  capturedEmail?: string;
  onEmailCaptured?: (email: string) => void;
}

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

const fade = (delay: number) => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] as const },
});

const RentResults = ({ formData, rentData, propertyData, propertyLoading, propertyError, onReset, onScrollToTop, capturedEmail: externalEmail, onEmailCaptured: externalOnEmail }: RentResultsProps) => {
  const [internalEmail, setInternalEmail] = useState('');
  const capturedEmail = externalEmail ?? internalEmail;
  const setCapturedEmail = (email: string) => {
    setInternalEmail(email);
    externalOnEmail?.(email);
  };
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

  // ━━━ Path 1 vs Path 2 detection ━━━
  // Path 1: sale data exists AND passes secondary checks → show landlord cost breakdown
  // Path 2: no sale data OR fails secondary checks → market-only experience
  const hasSaleData = !!(propertyData?.lastSalePrice && propertyData?.lastSaleDate);
  const bedroomNum = formData.bedrooms === 'studio' ? 0 : formData.bedrooms === 'oneBr' ? 1 : formData.bedrooms === 'twoBr' ? 2 : formData.bedrooms === 'threeBr' ? 3 : 4;
  const forceMarketOnly = useMemo(() => {
    // No street address → force Path 2
    if (!formData.fullAddress) return true;
    if (!propertyData) return true;
    // Multi-family 5+ units
    if (propertyData.propertyType?.toLowerCase().includes('multi') && propertyData.units >= 5) return true;
    // Unreasonable sale price for a single unit
    if (propertyData.lastSalePrice) {
      const price = propertyData.lastSalePrice;
      if (bedroomNum <= 1 && price > 3_000_000) return true;
      if (bedroomNum === 2 && price > 5_000_000) return true;
      if (bedroomNum >= 3 && price > 7_000_000) return true;
    }
    return false;
  }, [formData.fullAddress, propertyData, bedroomNum]);

  const isPath1 = hasSaleData && !forceMarketOnly;
  const marketMultiple = marketYoy > 0 ? Math.round((increasePct / marketYoy) * 10) / 10 : 0;

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
      ? (calc.counterLow === calc.counterHigh ? `$${fmt(calc.counterLow)}` : `$${fmt(calc.counterLow)}–$${fmt(calc.counterHigh)}`)
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
    fairCounterOffer: calc ? (calc.counterLow === calc.counterHigh ? `$${fmt(calc.counterLow)}` : `$${fmt(calc.counterLow)}–$${fmt(calc.counterHigh)}`) : undefined,
    compsPosition: medianCompRent ? (newRent > medianCompRent ? 'above' : 'below') : undefined,
    letterGenerated: !!(hasIncrease && isAboveMarket && calc),
  }), [analysisId, formData, rentData, newRent, increasePct, marketYoy, calc, medianCompRent, hasIncrease, isAboveMarket]);

  // Build section nav items based on available data
  const navSections = useMemo(() => {
    const sections = [{ id: 'section-verdict', label: 'Verdict' }];
    sections.push({ id: 'section-evidence', label: 'Evidence' });
    if (hasIncrease && medianCompRent && hasEnoughComps) {
      sections.push({ id: 'section-comps', label: 'Comps' });
    }
    if (hasIncrease && isAboveMarket && calc) {
      sections.push({ id: 'section-letter', label: 'Letter' });
    }
    return sections;
  }, [hasIncrease, medianCompRent, hasEnoughComps, isAboveMarket, calc]);

  // Markup insight for verdict (only for Path 1)
  const costMarkup = landlordInsights?.costIncreaseMarkup ?? null;
  const showMarkupInVerdict = isPath1 && costMarkup !== null && costMarkup > 1;

  let rowIdx = 0;

  return (
    <>
      <SectionNav sections={navSections} />

      {/* ━━━ ACT 1: THE VERDICT — full-width warm hero zone ━━━ */}
      <div
        className="w-full"
        style={{ background: 'hsl(var(--verdict-bg))' }}
      >
        <div className="max-w-[620px] mx-auto px-6">
          <motion.section
            id="section-verdict"
            {...fade(0)}
            className="min-h-[70vh] flex flex-col items-center justify-center text-center py-12"
          >
          {hasIncrease ? (
            <>
              {/* Dollar-first headline */}
              <h1
                className="font-display text-[clamp(1.75rem,5vw,2.5rem)] text-foreground leading-[1.15] tracking-tight max-w-[520px]"
                style={{ letterSpacing: '-0.02em' }}
              >
                {isAboveMarket && calc ? (
                  isPath1 ? (
                    <>Your landlord is asking for{' '}
                      <span className="text-destructive">${fmt(newRent - calc.counterHigh)}/mo more</span>{' '}
                      than the market supports.</>
                  ) : (
                    <>Your landlord is asking for{' '}
                      <span className="text-destructive">{marketMultiple}× the market rate increase.</span></>
                  )
                ) : isFair ? (
                  <>Your rent increase is <span className="text-verdict-fair">right at market.</span></>
                ) : increasePct > 0 && increasePct <= marketYoy ? (
                  <>Your rent increase is <span className="text-verdict-good">in line with the market.</span></>
                ) : (
                  <>Your rent increase is <span className="text-verdict-good">below market.</span></>
                )}
              </h1>

              {/* Subline */}
              <p className="text-lg md:text-xl text-muted-foreground mt-5 max-w-[460px] leading-relaxed">
                The market moved {marketYoy > 0 ? '+' : ''}{marketYoy}% this year.
                Your landlord is asking for {increasePct}%.
              </p>



              {/* ── Stat dashboard strip ── */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="mt-6 w-full grid grid-cols-2 md:grid-cols-4 gap-4 max-w-[540px]"
              >
                {[
                  { label: 'You pay now', value: `$${fmt(formData.currentRent)}`, color: 'text-foreground' },
                  { label: 'They want', value: `$${fmt(newRent)}`, color: 'text-destructive' },
                  { label: 'Area trend', value: `${marketYoy > 0 ? '+' : ''}${marketYoy}%`, color: 'text-foreground' },
                  { label: 'Your increase', value: `${increasePct}%`, color: verdictColor },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="text-center rounded-lg border border-border/80 bg-card px-3 py-4 flex flex-col justify-between"
                    style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">{stat.label}</p>
                    <p className={`font-display text-[24px] md:text-[28px] tracking-tight tabular-nums ${stat.color}`} style={{ letterSpacing: '-0.02em', lineHeight: 1 }}>
                      {stat.value}
                    </p>
                  </div>
                ))}
              </motion.div>

              {/* Share — prominent, right after stats */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.35, duration: 0.4 }}
                className="mt-5"
              >
                <ShareableCard
                  headline={
                    isAboveMarket && calc
                      ? isPath1
                        ? `My landlord is asking for $${fmt(newRent - calc.counterHigh)}/mo more than the market supports.`
                        : `My landlord is asking for ${marketMultiple}× the market rate increase.`
                      : isFair
                      ? `My rent increase is right at market.`
                      : increasePct > 0 && increasePct <= marketYoy
                      ? `My rent increase is in line with the market.`
                      : `My rent increase is below market.`
                  }
                  stats={[
                    { label: 'You pay now', value: `$${fmt(formData.currentRent)}` },
                    { label: 'They want', value: `$${fmt(newRent)}`, color: 'hsl(0, 72%, 51%)' },
                    { label: 'Area trend', value: `${marketYoy > 0 ? '+' : ''}${marketYoy}%` },
                    { label: 'Your increase', value: `${increasePct}%`, color: isAboveMarket ? 'hsl(0, 72%, 51%)' : isFair ? 'hsl(45, 80%, 45%)' : 'hsl(151, 50%, 38%)' },
                  ]}
                />
              </motion.div>

              {/* See evidence + reset */}
              <div className="mt-4 flex flex-col items-center gap-2">
                <button
                  onClick={() => document.getElementById('section-evidence')?.scrollIntoView({ behavior: 'smooth' })}
                  className="text-base font-semibold text-primary hover:text-primary/80 transition-colors duration-150"
                >
                  See the evidence ↓
                </button>
                <button onClick={onReset} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  ← Check a different address
                </button>
              </div>
            </>
          ) : (
            <>
              <h1 className="font-display text-[32px] font-semibold text-foreground">Here's what rents are doing in {city}</h1>
              <p className="text-muted-foreground mt-2 max-w-[460px] leading-relaxed">
                You didn't enter a proposed increase, but here's the market data and your rights.
              </p>
              <button onClick={onReset} className="mt-6 text-xs text-muted-foreground hover:text-foreground transition-colors">
                ← Check a different address
              </button>
            </>
          )}
        </motion.section>
        </div>
      </div>

      {/* ━━━ Transition edge ━━━ */}
      <div className="w-full h-px" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }} />

      {/* ━━━ ACT 2: THE EVIDENCE — white background ━━━ */}
      <div className="w-full bg-card">
        <div className="max-w-[620px] mx-auto px-6">

        {(
          <section id="section-evidence" className="pt-10 pb-8">
            <motion.h2 {...fade(0.05)} className="results-section-header mb-10">
              {hasIncrease ? 'The Evidence' : 'What the Market Says'}
            </motion.h2>

            <div className="space-y-6">

              {/* Card A: Market Context */}
              <motion.div {...fade(0.08)} className="evidence-card">
                <h3 className="evidence-card-header">What the Market Says</h3>
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
                {calc && (
                  <div className={`context-row ${rowIdx++ % 2 === 0 ? 'context-row-even' : 'context-row-odd'}`}>
                    <span className="context-label">Your current rent</span>
                    <span className={`context-value ${
                      formData.currentRent < calc.typicalRangeLow
                        ? 'text-verdict-good'
                        : formData.currentRent > calc.typicalRangeHigh
                        ? 'text-destructive'
                        : 'text-muted-foreground'
                    }`}>
                      ${fmt(formData.currentRent)} — {
                        formData.currentRent < calc.typicalRangeLow
                          ? 'below this range'
                          : formData.currentRent > calc.typicalRangeHigh
                          ? 'above this range'
                          : 'within this range'
                      }
                    </span>
                  </div>
                )}
                {isAboveMarket && calc && (
                  <div className="context-row-highlight mt-2">
                    <span className="context-label">Fair counter-offer</span>
                    <span className="context-value text-verdict-good font-bold">
                      {calc.counterLow === calc.counterHigh
                        ? `$${fmt(calc.counterLow)}/mo`
                        : `$${fmt(calc.counterLow)}–$${fmt(calc.counterHigh)}/mo`}
                    </span>
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

              {/* Card B: Your Landlord's Property (Path 1 only) */}
              {isPath1 && (
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
              )}

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
          <motion.section id="section-comps" {...fade(0.15)} className="py-12 -mx-2 px-2 rounded-2xl" style={{ background: 'hsl(var(--comps-bg))' }}>
            <h2 className="results-section-header mb-8">
              How Your Rent Compares to Nearby Units
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
            isPath1={isPath1}
            marketMultiple={marketMultiple}
          />
        </section>
        </div>
      </div>
    </>
  );
};

export default RentResults;
