import { useState, useMemo, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { RentFormData } from './RentForm';
import { RentLookupResult, bedroomLabels, calculateResults } from '@/data/rentData';
import ShareHub from './ShareHub';
import EmailCapture from './EmailCapture';
import CompLinks from './CompLinks';
import ShouldYouMove, { CompsList } from './ShouldYouMove';
import NegotiationLetter from './NegotiationLetter';
import LetterGate from './LetterGate';
import RentControlCard from './RentControlCard';
import { PropertyLookupResult, PropertyLookupError } from '@/hooks/usePropertyLookup';
import TurnoverCostSection from './TurnoverCostSection';
import { getRentControlByStateCity, getApplicableCap } from '@/data/rentControlData';
import { useRentcast } from '@/hooks/useRentcast';
import { useRentcastMarket } from '@/hooks/useRentcastMarket';
import { supabase } from '@/integrations/supabase/client';
import SectionNav from './SectionNav';
import { trackEvent } from '@/lib/analytics';
import DataConfidenceBadge from './DataConfidenceBadge';
import { assessConfidence, detectOutliers, checkCrossSourceConsistency, getCompRadius } from '@/lib/dataQuality';
import { calculateFairnessScore, scoreToVerdict, FairnessScoreResult } from '@/lib/fairnessScore';
import FairnessScoreGauge, { ComponentSourceInfo } from './FairnessScoreGauge';
import MarketSnapshot from './MarketSnapshot';

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
  onVerdictReady?: (isAboveMarket: boolean) => void;
}

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

const fade = (delay: number) => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] as const },
});

const RentResults = ({ formData, rentData, propertyData, propertyLoading, propertyError, onReset, onScrollToTop, capturedEmail: externalEmail, onEmailCaptured: externalOnEmail, onVerdictReady }: RentResultsProps) => {
  const [internalEmail, setInternalEmail] = useState('');
  const capturedEmail = externalEmail ?? internalEmail;
  const setCapturedEmail = (email: string) => {
    setInternalEmail(email);
    externalOnEmail?.(email);
  };
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [reportUrl, setReportUrl] = useState<string | null>(null);
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
  const fmrUpperBound = rentData.fmr * 1.15;

  // ━━━ Path 1 vs Path 2 detection ━━━
  const hasSaleData = !!(propertyData?.lastSalePrice && propertyData?.lastSaleDate);
  const bedroomNum = formData.bedrooms === 'studio' ? 0 : formData.bedrooms === 'oneBr' ? 1 : formData.bedrooms === 'twoBr' ? 2 : formData.bedrooms === 'threeBr' ? 3 : 4;
  const forceMarketOnly = useMemo(() => {
    if (!formData.fullAddress) return true;
    if (!propertyData) return true;
    if (propertyData.propertyType?.toLowerCase().includes('multi') && propertyData.units >= 5) return true;
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

  const rentcast = useRentcast(rentData.zip, formData.bedrooms, formData.fullAddress);
  const rcMarket = useRentcastMarket(rentData.zip, formData.bedrooms);
  const hasRentcastComps = rentcast.data && rentcast.data.comparables.length > 0;

  // ━━━ Outlier detection ━━━
  const outlierResult = useMemo(() => {
    if (!rentcast.data?.comparables) return null;
    return detectOutliers(rentcast.data.comparables);
  }, [rentcast.data]);

  const medianCompRent = useMemo<number | null>(() => {
    if (outlierResult && outlierResult.filtered.length >= 2) {
      return outlierResult.median;
    }
    if (rentcast.data?.rentEstimate) return rentcast.data.rentEstimate;
    return null;
  }, [outlierResult, rentcast.data]);

  const hasEnoughComps = outlierResult ? outlierResult.filtered.length >= 3 : false;
  const isHighRent = formData.currentRent > rentData.fmr * 1.5;

  // ━━━ Data confidence ━━━
  const compRadius = useMemo(() => {
    if (!rentcast.data?.comparables) return { maxDistance: null, label: '' };
    return getCompRadius(rentcast.data.comparables);
  }, [rentcast.data]);

  const confidence = useMemo(() => assessConfidence({
    hasHud: true,
    compCount: outlierResult?.filtered.length ?? 0,
    maxCompDistance: compRadius.maxDistance,
    hasZillow: rentData.zillowMonthly !== null,
    hasCensus: rentData.censusMedianRent !== null,
  }), [outlierResult, compRadius, rentData]);

  // ━━━ Cross-source consistency ━━━
  const consistencyNote = useMemo(() => {
    return checkCrossSourceConsistency(rentData.fmr, medianCompRent);
  }, [rentData.fmr, medianCompRent]);

  // ━━━ Fairness Score (replaces 3-factor verdict) ━━━
  const fairnessScore = useMemo<FairnessScoreResult | null>(() => {
    if (!hasIncrease) return null;
    return calculateFairnessScore({
      increasePct,
      marketYoY: marketYoy,
      proposedRent: newRent,
      currentRent: formData.currentRent,
      compMedian: medianCompRent,
      compCount: outlierResult?.filtered.length ?? 0,
      fmr: rentData.fmr,
      medianIncome: rentData.medianIncome,
      zillowMonthly: rentData.zillowMonthly,
      hvd: rentData.hvd,
      alYoY: rentData.alYoY,
      alMoM: rentData.alMoM,
      bedroomCount: formData.bedrooms === 'studio' ? 0 : formData.bedrooms === 'oneBr' ? 1 : formData.bedrooms === 'twoBr' ? 2 : formData.bedrooms === 'threeBr' ? 3 : 4,
      f50: rentData.f50,
      rcMedianRent: rcMarket.rcMedianRent,
      rcTotalListings: rcMarket.rcTotalListings,
    });
  }, [hasIncrease, increasePct, marketYoy, newRent, medianCompRent, outlierResult, rentData.fmr, rentData.medianIncome, rentData.zillowMonthly, rentData.hvd, rentData.alYoY, rentData.alMoM, rentData.f50, rcMarket.rcMedianRent, rcMarket.rcTotalListings]);

  const refinedVerdict = useMemo(() => {
    if (!fairnessScore) return null;
    return scoreToVerdict(fairnessScore.total);
  }, [fairnessScore]);

  const isAboveMarket = refinedVerdict === 'above'; // score 0-59
  const isFair = refinedVerdict === 'at-market';    // score 60-79
  const isBelowMarket = refinedVerdict === 'below';  // score 80-100

  useEffect(() => {
    if (refinedVerdict) onVerdictReady?.(isAboveMarket);
  }, [refinedVerdict]);

  // Nuanced message: increase exceeds trend but rent is still competitive
  const isNuancedAtMarket = isFair && increasePct - marketYoy > 2 && medianCompRent != null && newRent <= medianCompRent;
  const proposedFarBelowMedian = medianCompRent != null && newRent < medianCompRent * 0.8;

  const verdictColor = isAboveMarket ? 'text-destructive' : isFair ? 'text-verdict-fair' : 'text-verdict-good';
  const verdictLabel = !hasIncrease
    ? 'No Increase'
    : fairnessScore ? fairnessScore.tierLabel : 'At Market';

  const city = rentData.city;
  const brLabel = bedroomLabels[formData.bedrooms].toLowerCase();

  // ━━━ Anonymous analysis logging ━━━
  useEffect(() => {
    trackEvent('results_viewed', { zip: rentData.zip, verdict: verdictLabel });

    const startTime = Date.now();
    const handleUnload = () => {
      const seconds = Math.round((Date.now() - startTime) / 1000);
      trackEvent('time_on_results', { seconds });
    };
    window.addEventListener('beforeunload', handleUnload);

    const sectionIds = ['section-verdict', 'section-evidence', 'section-comps', 'section-letter', 'section-share'];
    const firedSections = new Set<string>();
    const sectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !firedSections.has(entry.target.id)) {
            firedSections.add(entry.target.id);
            trackEvent('results_scrolled_to_section', { section: entry.target.id.replace('section-', '') });
          }
        });
      },
      { threshold: 0.3 }
    );
    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) sectionObserver.observe(el);
    });

    if (analysisLogged.current) return () => { window.removeEventListener('beforeunload', handleUnload); sectionObserver.disconnect(); };
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
      markup_multiplier: null,
      letter_generated: false,
      cache_hit: !!(rentcast.data as any)?.cacheHit || !!(propertyData as any)?.cacheHit,
      fairness_score: fairnessScore?.total ?? null,
      comp_median_rent: medianCompRent ?? null,
      hud_fmr_value: rentData.fmr ?? null,
    } as any).select('id').single().then(({ data }) => {
      if (data?.id) setAnalysisId(data.id);
    });

    return () => { window.removeEventListener('beforeunload', handleUnload); sectionObserver.disconnect(); };
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
    fairnessScore: fairnessScore?.total ?? null,
    compMedianRent: medianCompRent ?? null,
    hudFmrValue: rentData.fmr ?? null,
  }), [analysisId, formData, rentData, newRent, increasePct, marketYoy, calc, medianCompRent, hasIncrease, isAboveMarket, fairnessScore]);

  // Determine if Know Your Rights section is relevant (rent control jurisdiction)
  const hasRentControl = useMemo(() => {
    const result = getRentControlByStateCity(rentData.state, rentData.city);
    return !!getApplicableCap(result);
  }, [rentData.state, rentData.city]);

  // Build section nav items based on verdict and available data
  const navSections = useMemo(() => {
    const sections = [{ id: 'section-verdict', label: 'Verdict' }];
    sections.push({ id: 'section-evidence', label: 'Evidence' });
    if (hasIncrease && medianCompRent && hasEnoughComps) {
      sections.push({ id: 'section-comps', label: 'Comps' });
    }
    if (hasRentControl) {
      sections.push({ id: 'section-rights', label: 'Rights' });
    }
    if (isAboveMarket) {
      // Above trend: Letter → Share
      if (hasIncrease && calc) {
        sections.push({ id: 'section-letter', label: 'Letter' });
      }
      sections.push({ id: 'section-share', label: 'Send' });
    } else {
      // Below/fair: Should You Move → Share
      if (hasIncrease && medianCompRent && hasEnoughComps) {
        sections.push({ id: 'section-move', label: 'Move' });
      }
      if (hasIncrease) {
        sections.push({ id: 'section-share', label: 'Share' });
      }
    }
    return sections;
  }, [hasIncrease, medianCompRent, hasEnoughComps, calc, isAboveMarket, hasRentControl]);

  // Compute annual savings for turnover section
  const annualSavingsForTurnover = useMemo(() => {
    if (!medianCompRent || !hasIncrease) return 0;
    const diff = newRent - medianCompRent;
    return diff > 0 ? Math.round(diff * 12) : 0;
  }, [medianCompRent, newRent, hasIncrease]);
  const proposedRentAboveMedian = medianCompRent ? newRent > medianCompRent : false;

  // ━━━ Shared report payload (used in ShareHub and NegotiationLetter) ━━━
  const shareReportPayload = useMemo(() => ({
    zip: rentData.zip,
    address: formData.fullAddress || null,
    bedrooms: bedroomNum,
    currentRent: formData.currentRent,
    proposedIncrease: increasePct,
    increaseType: 'percent' as const,
    reportData: {
      city: rentData.city, state: rentData.state, newRent, increasePct, marketYoy,
      fmr: rentData.fmr, verdict: calc?.verdict || '',
      counterLow: calc?.counterLow ?? null, counterHigh: calc?.counterHigh ?? null,
      censusMedianRent: rentData.censusMedianRent, medianIncome: rentData.medianIncome,
      bedroomLabel: bedroomLabels[formData.bedrooms],
      zillowMonthly: rentData.zillowMonthly, zillowDirection: rentData.zillowDirection,
      yoySourceLabel: rentData.yoySourceLabel,
      typicalRangeLow: calc?.typicalRangeLow ?? null, typicalRangeHigh: calc?.typicalRangeHigh ?? null,
      rentStabilized: null, rentControlNote: null,
      comparables: rentcast.data?.comparables ?? null, medianCompRent,
    },
  }), [rentData, formData, bedroomNum, increasePct, newRent, marketYoy, calc, medianCompRent, rentcast.data]);

  let rowIdx = 0;

  return (
    <>
      <SectionNav sections={navSections} />

      {/* ━━━ ACT 1: THE VERDICT — full-width warm hero zone ━━━ */}
      <div
        className="w-full"
        style={{ background: 'hsl(var(--verdict-bg))' }}
      >
        <div className="max-w-[620px] mx-auto px-5 sm:px-6">
          <motion.section
            id="section-verdict"
            {...fade(0)}
            className="min-h-[45vh] sm:min-h-[50vh] flex flex-col items-center justify-center text-center py-8 sm:py-12"
          >
          {hasIncrease && fairnessScore ? (
            <>
              {/* Fairness Score Gauge + Dynamic Verdict */}
              {/* Build source attribution for each component */}
              {(() => {
                // Component sources for transparency
                const sources: ComponentSourceInfo = {};

                // Component 1: Rate vs Trend
                if (rentData.alYoY !== null && rentData.alYoY !== undefined) {
                  sources.rate = `Source: Apartment List${rentData.alRegion ? ` (${rentData.alRegion})` : ''}`;
                } else if (rentData.zillowMonthly !== null) {
                  sources.rate = 'Source: Zillow ZORI';
                } else {
                  sources.rate = 'Source: HUD FMR';
                }

                // Component 2: Comps
                const compCt = outlierResult?.filtered.length ?? 0;
                if (compCt > 0 && compRadius.label) {
                  sources.comps = `Based on ${compCt} comp${compCt !== 1 ? 's' : ''} ${compRadius.label}`;
                } else if (compCt > 0) {
                  sources.comps = `Based on ${compCt} comparable listing${compCt !== 1 ? 's' : ''}`;
                }

                // Component 3: FMR / Reasonableness
                if (rcMarket.rcMedianRent != null && rcMarket.rcTotalListings != null && rcMarket.rcTotalListings >= 10) {
                  sources.fmr = 'Source: Rentcast market median';
                } else if (rentData.f50 && bedroomNum >= 0 && bedroomNum <= 4 && rentData.f50[bedroomNum] > 0) {
                  sources.fmr = 'Source: HUD 50th percentile';
                } else {
                  sources.fmr = 'Source: HUD FMR';
                }

                // Component 4: Income
                sources.income = rentData.medianIncome ? 'Source: Census ACS 2022' : 'Neutral default (no Census data)';

                // Component 5: Momentum
                if (rentData.zillowMonthly !== null) {
                  sources.momentum = 'Source: Zillow ZORI';
                } else if (rentData.alMoM !== null && rentData.alMoM !== undefined) {
                  sources.momentum = 'Source: Apartment List';
                } else if (rentData.hvd) {
                  sources.momentum = 'Source: ZHVI home value proxy';
                } else {
                  sources.momentum = 'Neutral default';
                }

                return (
                  <FairnessScoreGauge
                    score={fairnessScore}
                    componentSources={sources}
                    dynamicMessage={
                      <div className="space-y-2">
                        <h1
                          className="font-display text-[1.35rem] sm:text-[clamp(1.5rem,4.5vw,2.2rem)] text-foreground leading-[1.15] tracking-tight"
                          style={{ letterSpacing: '-0.02em' }}
                        >
                          {isAboveMarket && calc ? (
                            fairnessScore && fairnessScore.total >= 40 ? (
                              marketYoy < -0.5 ? (
                                <>Rents near you dropped {Math.abs(marketYoy)}% — your landlord is asking for{' '}
                                  <span className="text-accent-amber">{increasePct}%, slightly above trend.</span></>
                              ) : marketYoy >= -0.5 && marketYoy <= 0.5 ? (
                                <>Rents near you have been flat — your landlord is asking for{' '}
                                  <span className="text-accent-amber">{increasePct}%, above the current trend.</span></>
                              ) : (
                                <>Rents near you went up {marketYoy}% — your landlord is asking for{' '}
                                  <span className="text-accent-amber">{increasePct}%, slightly above trend.</span></>
                              )
                            ) : (
                              marketYoy < -0.5 ? (
                                <>Rents near you dropped {Math.abs(marketYoy)}% — but your landlord wants{' '}
                                  <span className="text-destructive">{increasePct}% more.</span></>
                              ) : marketYoy >= -0.5 && marketYoy <= 0.5 ? (
                                <>Rents near you have been flat — but your landlord wants{' '}
                                  <span className="text-destructive">{increasePct}% more.</span></>
                              ) : (
                                <>Rents near you went up {marketYoy}% — but your landlord wants{' '}
                                  <span className="text-destructive">{increasePct}% more.</span></>
                              )
                            )
                          ) : isFair ? (
                            <>Your rent increase is <span className="text-verdict-fair">right at market.</span></>
                          ) : increasePct > 0 && increasePct <= marketYoy ? (
                            <>Your increase of {increasePct}% is{' '}
                              <span className="text-verdict-good">below the {marketYoy}% area trend.</span></>
                          ) : increasePct <= 0 ? (
                            <>Your rent is staying the same or going down — that's{' '}
                              <span className="text-verdict-good">below the {marketYoy}% area trend.</span></>
                          ) : (
                            <>Your rent increase is <span className="text-verdict-good">below market.</span></>
                          )}
                        </h1>
                        <p className="text-[14px] sm:text-base md:text-lg text-muted-foreground leading-relaxed">
                          {isAboveMarket && calc ? (
                            <>That's ${fmt(increaseAmount * 12)} more per year than a market-rate increase would be. A fair counter-offer is {calc.counterLow === calc.counterHigh ? `$${fmt(calc.counterLow)}/mo` : `$${fmt(calc.counterLow)}–$${fmt(calc.counterHigh)}/mo`}.</>
                          ) : isNuancedAtMarket && medianCompRent ? (
                            <>Your proposed rent of ${fmt(newRent)} is still below the local median of ${fmt(medianCompRent)} for similar units nearby.</>
                          ) : isFair ? (
                            <>At ${fmt(newRent)}/mo, you'll be within the typical range for {brLabel} rentals in {city}.</>
                          ) : (
                            <>At ${fmt(newRent)}/mo, you're getting a competitive deal compared to similar units in {city}.</>
                          )}
                        </p>
                      </div>
                    }
                  />
                );
              })()}

              {/* ── Stat dashboard strip ── */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="mt-5 sm:mt-6 w-full grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 max-w-[540px]"
              >
                {[
                  { label: 'You pay now', value: `$${fmt(formData.currentRent)}`, color: 'text-foreground' },
                  { label: 'They want', value: `$${fmt(newRent)}`, color: isAboveMarket ? 'text-destructive' : isBelowMarket ? 'text-verdict-good' : 'text-foreground' },
                  { label: 'Area trend', value: `${marketYoy > 0 ? '+' : ''}${marketYoy}%`, color: 'text-foreground' },
                  { label: 'Your increase', value: `${increasePct}%`, color: verdictColor },
                ].map((stat) => (
                    <div
                      key={stat.label}
                      className="text-center rounded-lg border border-border/80 bg-card px-2 sm:px-3 py-3 sm:py-4 flex flex-col justify-between"
                      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
                    >
                      <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">{stat.label}</p>
                      <p className={`font-display text-[20px] sm:text-[24px] md:text-[28px] tracking-tight tabular-nums ${stat.color}`} style={{ letterSpacing: '-0.02em', lineHeight: 1 }}>
                        {stat.value}
                      </p>
                    </div>
                ))}
              </motion.div>

              {/* Data Confidence Badge */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.25, duration: 0.4 }}
                className="mt-4"
              >
                <DataConfidenceBadge level={confidence.level} note={confidence.note} />
                <p className="text-[11px] text-muted-foreground/60 mt-2 text-center leading-relaxed">
                  This analysis is for informational purposes only and does not constitute legal, financial, or real estate advice.{' '}
                  <Link to="/methodology" className="underline hover:text-muted-foreground transition-colors">See methodology</Link>
                </p>
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
        <div className="max-w-[620px] mx-auto px-5 sm:px-6">

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
                  <>
                    <div className="context-row-highlight mt-2">
                      <span className="context-label">Fair counter-offer</span>
                      <span className="context-value text-verdict-good font-bold">
                        {calc.counterLow === calc.counterHigh
                          ? `$${fmt(calc.counterLow)}/mo`
                          : `$${fmt(calc.counterLow)}–$${fmt(calc.counterHigh)}/mo`}
                      </span>
                    </div>
                    {medianCompRent && calc.counterLow > medianCompRent && (
                      <div className="mt-2 px-3 py-2 rounded-md bg-accent/50 border border-border/50">
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          Note: Your counter range (${fmt(calc.counterLow)}–${fmt(calc.counterHigh)}) is above the area median of ${fmt(medianCompRent)} for similar units. You may have additional negotiating room.
                        </p>
                      </div>
                    )}
                  </>
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

              {/* ━━━ Market Snapshot ━━━ */}
              {hasIncrease && (
                <MarketSnapshot
                  rcTotalListings={rcMarket.rcTotalListings}
                  rcNewListings={rcMarket.rcNewListings}
                  rcAvgDaysOnMarket={rcMarket.rcAvgDaysOnMarket}
                  alVacancy={rentData.alVacancy}
                />
              )}

            </div>
          </section>
        )}

        {/* ━━━ COMPARABLE LISTINGS ━━━ */}
        {hasIncrease && medianCompRent && hasEnoughComps && (
          <motion.section id="section-comps" {...fade(0.15)} className="py-12 -mx-2 px-2 rounded-2xl" style={{ background: 'hsl(var(--comps-bg))' }}>
            <h2 className="results-section-header mb-2">
              How Your Rent Compares to Nearby Units
            </h2>
            <p className="text-[12px] text-muted-foreground text-center mb-6">
              Showing {outlierResult?.filtered.length ?? 0} comparable rental{(outlierResult?.filtered.length ?? 0) !== 1 ? 's' : ''}{compRadius.label ? ` ${compRadius.label}` : ''}, sorted by relevance.
            </p>

            {/* Cross-source consistency note — only when comp median diverges significantly from HUD benchmark */}
            {consistencyNote && (
              <div className="px-4 py-3 rounded-md border border-border bg-muted/50 text-[12px] text-muted-foreground leading-relaxed mb-6">
                {consistencyNote}
              </div>
            )}

            <CompsList
              proposedRent={newRent}
              comparables={outlierResult?.filtered ?? rentcast.data!.comparables}
              medianCompRent={medianCompRent}
              brLabel={brLabel}
              city={city}
              state={rentData.state}
              zip={rentData.zip}
              bedrooms={formData.bedrooms}
              userUnit={propertyData ? {
                address: formData.fullAddress,
                bedrooms: propertyData.bedrooms,
                bathrooms: propertyData.bathrooms,
                squareFootage: propertyData.squareFootage,
              } : null}
            />

            {/* Outlier notice */}
            {outlierResult && outlierResult.outliers.length > 0 && (
              <div className="mt-4 space-y-1">
                {outlierResult.outliers.map((comp, i) => (
                  <div key={`outlier-${i}`} className="flex items-start justify-between gap-4 px-4 py-2 rounded-md opacity-50">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground truncate">{comp.formattedAddress}</p>
                      <p className="text-[10px] text-muted-foreground/60">
                        Excluded from analysis — {comp.rent !== null && medianCompRent && comp.rent > medianCompRent ? 'significantly above' : 'significantly below'} local median
                      </p>
                    </div>
                    {comp.rent !== null && (
                      <span className="text-xs text-muted-foreground line-through">${fmt(comp.rent)}/mo</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </motion.section>
        )}
        {!hasEnoughComps && !rentcast.loading && (
          <motion.section {...fade(0.15)} className="py-12">
            <CompLinks zip={rentData.zip} city={rentData.city} state={rentData.state} bedrooms={formData.bedrooms} />
          </motion.section>
        )}

        {/* ━━━ Know Your Rights — only if rent control applies ━━━ */}
        {hasRentControl && (
          <motion.section id="section-rights" {...fade(0.17)} className="pt-8 pb-4">
            <div className="evidence-card">
              <RentControlCard
                state={rentData.state}
                city={rentData.city}
                zip={rentData.zip}
                increasePct={increasePct}
                address={formData.fullAddress}
              />
            </div>
          </motion.section>
        )}

        {/* ━━━ ABOVE MARKET PATH: Letter → Share → Email ━━━ */}
        {isAboveMarket && (
          <>
            {/* Negotiation Letter */}
            {hasIncrease && calc && (
              <motion.section id="section-letter" {...fade(0.19)} className="pt-8 pb-8">
                <LetterGate
                  leadContext={leadContext}
                  prefilledEmail={capturedEmail}
                  onEmailCaptured={setCapturedEmail}
                >
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
                    reportUrl={reportUrl}
                    onGenerateReport={() => {
                      const btn = document.querySelector('[data-share-report-btn]') as HTMLButtonElement;
                      btn?.click();
                    }}
                    compMedian={medianCompRent}
                    compCount={outlierResult?.filtered.length ?? 0}
                    compRadius={compRadius.label ? compRadius.label.replace('within ', '') : undefined}
                    trendSource={rentData.alYoY !== null && rentData.alYoY !== undefined ? 'Apartment List' : rentData.zillowMonthly !== null ? 'Zillow' : 'HUD'}
                    trendArea={rentData.alRegion || rentData.city}
                    rcMedianRent={rcMarket.rcMedianRent}
                    rcTotalListings={rcMarket.rcTotalListings}
                    rcAvgDaysOnMarket={rcMarket.rcAvgDaysOnMarket}
                    alVacancy={rentData.alVacancy}
                    f50Value={rentData.f50 && bedroomNum >= 0 && bedroomNum <= 4 ? rentData.f50[bedroomNum] : null}
                    fairnessScore={fairnessScore?.total ?? null}
                    tierLabel={fairnessScore?.tierLabel ?? null}
                    maxCompDistance={compRadius.maxDistance}
                    momentumDirection={rentData.zillowDirection || (rentData.hvd ? rentData.hvd : null)}
                  />
                </LetterGate>
              </motion.section>
            )}

            {/* Share Hub */}
            {hasIncrease && (
              <motion.section id="section-share" {...fade(0.21)} className="pt-8 pb-4">
                <h2 className="results-section-header mb-6">Share Your Analysis</h2>
                <div className="flex justify-center">
                  <ShareHub
                    reportPayload={shareReportPayload}
                    onLinkGenerated={setReportUrl}
                    analysisId={analysisId}
                    leadEmail={capturedEmail || undefined}
                    zipCode={rentData.zip}
                    city={rentData.city}
                    state={rentData.state}
                    bedroomNum={bedroomNum}
                    increasePct={increasePct}
                    marketYoy={marketYoy}
                    verdict="above"
                    headline={
                      isPath1
                        ? `My landlord is asking for $${fmt(newRent - (calc?.counterHigh ?? 0))}/mo more than the market supports.`
                        : `Rents near me moved ${marketYoy}% but my landlord wants ${increasePct}%.`
                    }
                    stats={[
                      { label: 'You pay now', value: `$${fmt(formData.currentRent)}` },
                      { label: 'They want', value: `$${fmt(newRent)}`, color: 'hsl(0, 72%, 51%)' },
                      { label: 'Area trend', value: `${marketYoy > 0 ? '+' : ''}${marketYoy}%` },
                      { label: 'Your increase', value: `${increasePct}%`, color: 'hsl(0, 72%, 51%)' },
                    ]}
                  />
                </div>
              </motion.section>
            )}

            {/* Inline email capture — only if not yet captured via letter gate */}
            {!capturedEmail && (
              <section className="pb-12 pt-4">
                <div className="rounded-xl px-5 sm:px-8 py-5 sm:py-6 text-center" style={{ background: 'hsl(var(--secondary))' }}>
                  <EmailCapture
                    city={city}
                    captureSource="letter_plus_reminder"
                    prefilledEmail={capturedEmail}
                    onEmailCaptured={setCapturedEmail}
                    leadContext={leadContext}
                    verdict="above"
                    heading="Get this letter + a renewal reminder"
                    subtext="We'll email you this letter and remind you 60 days before your lease is up."
                  />
                </div>
              </section>
            )}
          </>
        )}

        {/* ━━━ BELOW / FAIR MARKET PATH: Reassurance + Move costs → Email ━━━ */}
        {!isAboveMarket && hasIncrease && (
          <>
            {/* Reassurance message */}
            <motion.section {...fade(0.19)} className="pt-2 pb-4">
              <div className="px-5 py-5 rounded-xl border border-verdict-good/20 bg-verdict-good/5 text-center">
                <p className="text-base font-medium text-foreground leading-relaxed">
                  {isBelowMarket
                    ? "Your landlord's ask is below market. Renewing at this rate is a solid decision."
                    : "Your landlord's ask is at market. Renewing at this rate is a solid decision."}
                </p>
              </div>
            </motion.section>

            {/* Estimated cost to move (for context, no negotiation framing) */}
            {medianCompRent && hasEnoughComps && (
              <motion.section id="section-move" {...fade(0.21)} className="pt-4 pb-4">
                <h2 className="results-section-header mb-6">Estimated Cost to Move</h2>
                <ShouldYouMove
                  proposedRent={newRent}
                  currentRent={formData.currentRent}
                  comparables={outlierResult?.filtered ?? rentcast.data!.comparables}
                  medianCompRent={medianCompRent}
                  brLabel={brLabel}
                  city={city}
                  state={rentData.state}
                  zip={rentData.zip}
                  bedrooms={formData.bedrooms}
                  counterOffer={null}
                  isAboveMarket={false}
                  onScrollToLetter={() => {}}
                />
              </motion.section>
            )}

            {/* Inline email capture */}
            <section id="section-email-capture" className="pb-6 pt-4">
              <div className="rounded-xl px-5 sm:px-8 py-5 sm:py-6 text-center" style={{ background: 'hsl(var(--secondary))' }}>
                <EmailCapture
                  city={city}
                  captureSource="lease_reminder"
                  prefilledEmail={capturedEmail}
                  onEmailCaptured={setCapturedEmail}
                  leadContext={leadContext}
                  verdict={isBelowMarket ? 'below' : 'at_market'}
                  heading="Want a heads up before next year's renewal?"
                  subtext={`We'll send you updated market data for ${city} before your next renewal.`}
                />
              </div>
            </section>

            {/* Share — neighbors only, no landlord tab */}
            <motion.section id="section-share" {...fade(0.23)} className="pt-4 pb-10">
              <h2 className="results-section-header mb-6">Share This Tool</h2>
              <div className="flex justify-center">
                <ShareHub
                  reportPayload={shareReportPayload}
                  onLinkGenerated={setReportUrl}
                  analysisId={analysisId}
                  leadEmail={capturedEmail || undefined}
                  zipCode={rentData.zip}
                  city={rentData.city}
                  state={rentData.state}
                  bedroomNum={bedroomNum}
                  increasePct={increasePct}
                  marketYoy={marketYoy}
                  verdict={isFair ? 'fair' : 'below'}
                  headline={
                    isFair
                      ? `My rent increase is right at market.`
                      : `My rent increase is below the area trend.`
                  }
                  stats={[
                    { label: 'You pay now', value: `$${fmt(formData.currentRent)}` },
                    { label: 'They want', value: `$${fmt(newRent)}`, color: isBelowMarket ? 'hsl(151, 50%, 38%)' : undefined },
                    { label: 'Area trend', value: `${marketYoy > 0 ? '+' : ''}${marketYoy}%` },
                    { label: 'Your increase', value: `${increasePct}%`, color: isFair ? 'hsl(45, 80%, 45%)' : 'hsl(151, 50%, 38%)' },
                  ]}
                />
              </div>
            </motion.section>
          </>
        )}

        {/* ━━━ No increase path — just email capture ━━━ */}
        {!hasIncrease && (
          <section className="pb-12 pt-4">
            <div className="rounded-xl px-5 sm:px-8 py-5 sm:py-6 text-center" style={{ background: 'hsl(var(--secondary))' }}>
              <EmailCapture
                city={city}
                captureSource="lease_reminder"
                prefilledEmail={capturedEmail}
                onEmailCaptured={setCapturedEmail}
                leadContext={leadContext}
              />
            </div>
          </section>
        )}

        </div>
      </div>
    </>
  );
};

export default RentResults;
