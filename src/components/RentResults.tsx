import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
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
import { getRentControlByStateCity, getApplicableCap, isNycZip } from '@/data/rentControlData';
import { useRentcast } from '@/hooks/useRentcast';
import { useRentcastMarket } from '@/hooks/useRentcastMarket';
import { useHcrLookup } from '@/hooks/useHcrLookup';
import { supabase } from '@/integrations/supabase/client';
import SectionNav from './SectionNav';
import { trackEvent, trackAdsConversion } from '@/lib/analytics';
import { getUtmParams } from '@/lib/utm';
import DataConfidenceBadge from './DataConfidenceBadge';
import { assessConfidence, detectOutliers, checkCrossSourceConsistency, getCompRadius, filterFurnished, deduplicateComps } from '@/lib/dataQuality';
import { calculateFairnessScore, scoreToVerdict, getContextualTierMessage, FairnessScoreResult } from '@/lib/fairnessScore';
import { calculateCompositeTrend } from '@/lib/compositeTrend';
import FairnessScoreGauge, { ComponentSourceInfo } from './FairnessScoreGauge';
import MarketSnapshot from './MarketSnapshot';
import NextStepsSection from './NextStepsSection';
import ExitIntentModal from './ExitIntentModal';
import PostConversionFlow from './PostConversionFlow';
import SocialProofLine from './SocialProofLine';
import { Loader2 } from 'lucide-react';

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
  // Generate analysis ID immediately so lead captures can reference it before the insert fires
  const [analysisId] = useState<string>(() => crypto.randomUUID());
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
  const compositeTrendResult = useMemo(() => calculateCompositeTrend({
    alYoY: rentData.alYoY,
    zoriYoY: rentData.zoriYoY,
    zoriSource: rentData.zoriGeoLevel,
    hudYoY: rentData.yoyChange,
  }), [rentData.alYoY, rentData.zoriYoY, rentData.zoriGeoLevel, rentData.yoyChange]);

  const marketYoy = compositeTrendResult.compositeTrend;
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
  const hcrLookup = useHcrLookup(formData.fullAddress, rentData.zip);
  const hasRentcastComps = rentcast.data && rentcast.data.comparables.length > 0;

  // ━━━ Preprocessing: deduplicate & filter furnished ━━━
  const { cleanedComps, furnishedComps } = useMemo(() => {
    if (!rentcast.data?.comparables) return { cleanedComps: [], furnishedComps: [] };
    const deduped = deduplicateComps(rentcast.data.comparables);
    const { unfurnished, furnished } = filterFurnished(deduped);

    // Prefer exact bedroom matches when we have enough
    const exactBrMatch = unfurnished.filter(c => c.bedrooms === bedroomNum);
    const nearBrMatch = unfurnished.filter(c => c.bedrooms !== bedroomNum);
    const prioritized = exactBrMatch.length >= 3
      ? [...exactBrMatch, ...nearBrMatch]
      : unfurnished;

    return { cleanedComps: prioritized, furnishedComps: furnished };
  }, [rentcast.data, bedroomNum]);

  // ━━━ Outlier detection ━━━
  const outlierResult = useMemo(() => {
    if (cleanedComps.length === 0) return null;
    return detectOutliers(cleanedComps);
  }, [cleanedComps]);

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
  const asyncDataReady = !rentcast.loading && !rcMarket.loading;

  const fairnessScore = useMemo<FairnessScoreResult | null>(() => {
    if (!hasIncrease) return null;
    if (!asyncDataReady) return null;
    return calculateFairnessScore({
      increasePct,
      marketYoY: marketYoy,
      proposedRent: newRent,
      currentRent: formData.currentRent,
      compMedian: medianCompRent,
      compCount: outlierResult?.filtered.length ?? 0,
      fmr: rentData.fmr,
      zillowMonthly: rentData.zillowMonthly,
      hvd: rentData.hvd,
      alYoY: rentData.alYoY,
      alMoM: rentData.alMoM,
      bedroomCount: bedroomNum,
      f50: rentData.f50,
      rcMedianRent: rcMarket.rcMedianRent,
      rcTotalListings: rcMarket.rcTotalListings,
      compositeTrend: compositeTrendResult.compositeTrend,
    });
  }, [hasIncrease, asyncDataReady, increasePct, marketYoy, newRent, medianCompRent, outlierResult, rentData.fmr, rentData.zillowMonthly, rentData.hvd, rentData.alYoY, rentData.alMoM, rentData.f50, rcMarket.rcMedianRent, rcMarket.rcTotalListings, compositeTrendResult]);

  const refinedVerdict = useMemo(() => {
    if (!fairnessScore) return null;
    return scoreToVerdict(fairnessScore.total);
  }, [fairnessScore]);

  const isAboveMarket = refinedVerdict === 'above';
  const isFair = refinedVerdict === 'at-market';
  const isBelowMarket = refinedVerdict === 'below';

  useEffect(() => {
    if (refinedVerdict) onVerdictReady?.(isAboveMarket);
  }, [refinedVerdict]);

  const isNuancedAtMarket = isFair && increasePct - marketYoy > 2 && medianCompRent != null && newRent <= medianCompRent;
  const proposedFarBelowMedian = medianCompRent != null && newRent < medianCompRent * 0.8;

  const verdictColor = isAboveMarket ? 'text-destructive' : isFair ? 'text-verdict-fair' : 'text-verdict-good';
  const verdictLabel = !hasIncrease
    ? 'No Increase'
    : fairnessScore ? fairnessScore.tierLabel : 'At Market';

  const city = rentData.city;
  const brLabel = bedroomLabels[formData.bedrooms].toLowerCase();

  // ━━━ Analytics tracking ━━━
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

    return () => { window.removeEventListener('beforeunload', handleUnload); sectionObserver.disconnect(); };
  }, []);

  // ━━━ Anonymous analysis logging (waits for fairnessScore) ━━━
  useEffect(() => {
    if (analysisLogged.current) return;
    if (hasIncrease && fairnessScore === null) return;
    if (rentcast.loading) return;
    analysisLogged.current = true;

    const compsPosition = medianCompRent
      ? (newRent > medianCompRent ? 'above' : 'below')
      : hasEnoughComps === false ? 'insufficient' : null;

    const showCounter = calc && !calc.counterExceedsProposed;
    const counterStr = showCounter
      ? (calc.counterLow === calc.counterHigh ? `$${fmt(calc.counterLow)}` : `$${fmt(calc.counterLow)}–$${fmt(calc.counterHigh)}`)
      : null;

    const dollarOverpayment = hasIncrease && showCounter
      ? Math.max(0, Math.round(newRent - calc.counterLow))
      : 0;

    const utm = getUtmParams();
    const inferredPropertyType = rentcast.data?.propertyType ?? null;
    const compsCount = rentcast.data?.comparables?.length ?? 0;

    const anomalyFlags: string[] = [];
    if (increasePct > 50) anomalyFlags.push('extreme_increase');
    if (formData.currentRent < 300) anomalyFlags.push('very_low_rent');
    if (formData.currentRent > 15000) anomalyFlags.push('very_high_rent');
    if (compsCount === 0) anomalyFlags.push('no_comps');
    if (confidence.level === 'limited') anomalyFlags.push('low_confidence');

    supabase.from('analyses').insert({
      id: analysisId,
      address: formData.fullAddress || null,
      city: rentData.city,
      state: rentData.state,
      zip: rentData.zip,
      bedrooms: bedroomNum,
      current_rent: formData.currentRent,
      proposed_rent: newRent,
      increase_pct: increasePct,
      market_trend_pct: marketYoy,
      fair_counter_offer: counterStr,
      comps_count: compsCount,
      comps_position: compsPosition,
      sale_data_found: !!propertyData?.lastSalePrice,
      markup_multiplier: null,
      letter_generated: false,
      cache_hit: !!(rentcast.data as any)?.cacheHit || !!(propertyData as any)?.cacheHit,
      fairness_score: fairnessScore?.total ?? null,
      comp_median_rent: medianCompRent ?? null,
      hud_fmr_value: rentData.fmr ?? null,
      dollar_overpayment: dollarOverpayment,
      counter_offer_low: calc?.counterLow ?? null,
      counter_offer_high: calc?.counterHigh ?? null,
      verdict_label: fairnessScore?.tierLabel ?? null,
      utm_source: utm.utm_source || null,
      utm_medium: utm.utm_medium || null,
      utm_campaign: utm.utm_campaign || null,
      confidence_level: confidence.level ?? null,
      results_shared: false,
      letter_tone: null,
      rent_stabilized: null,
      property_type: inferredPropertyType,
      anomaly_flags: anomalyFlags,
    } as any).then(({ error }) => {
      if (error) {
        console.error('[RentResults] Analysis insert failed:', error.message, error);
      } else {
        console.log('[RentResults] Analysis logged:', analysisId);
        supabase.functions.invoke('notify-submission', {
          body: {
            zip: rentData.zip, city: rentData.city, state: rentData.state,
            bedrooms: bedroomNum, current_rent: formData.currentRent,
            proposed_rent: newRent, increase_pct: increasePct,
            fairness_score: fairnessScore?.total ?? null,
            verdict_label: fairnessScore?.tierLabel ?? null,
            address: formData.fullAddress || null,
            confidence_level: confidence.level ?? null,
            comp_median_rent: medianCompRent ?? null,
            hud_fmr_value: rentData.fmr ?? null,
            analysis_id: analysisId,
          },
        }).catch(() => {});
      }
    });

    if (inferredPropertyType) {
      trackEvent('user_property_type', {
        property_type: inferredPropertyType,
        zip_code: rentData.zip,
        bedrooms: bedroomNum,
        verdict: verdictLabel,
      });
    }
  }, [hasIncrease, fairnessScore, rentcast.loading]);

  // ━━━ Lazy-update analysis record ━━━
  const updateAnalysis = useCallback((fields: Record<string, any>) => {
    if (!analysisId) return;
    supabase.from('analyses').update(fields as any).eq('id', analysisId).then(() => {});
  }, [analysisId]);

  useEffect(() => {
    if (hcrLookup.result && analysisId) {
      const stabilized = hcrLookup.result.found && hcrLookup.result.stabilized === true;
      updateAnalysis({ rent_stabilized: stabilized });
    }
  }, [hcrLookup.result, analysisId, updateAnalysis]);

  const handleLetterGenerated = useCallback((tone?: string) => {
    updateAnalysis({ letter_generated: true, letter_tone: tone || 'default' });
  }, [updateAnalysis]);

  const handleResultsShared = useCallback(() => {
    updateAnalysis({ results_shared: true });
  }, [updateAnalysis]);

  const leadContext = useMemo(() => ({
    analysisId,
    address: formData.fullAddress,
    city: rentData.city,
    state: rentData.state,
    zip: rentData.zip,
    bedrooms: bedroomNum,
    currentRent: formData.currentRent,
    proposedRent: newRent,
    increasePct,
    marketTrendPct: marketYoy,
    fairCounterOffer: calc && !calc.counterExceedsProposed ? (calc.counterLow === calc.counterHigh ? `$${fmt(calc.counterLow)}` : `$${fmt(calc.counterLow)}–$${fmt(calc.counterHigh)}`) : undefined,
    compsPosition: medianCompRent ? (newRent > medianCompRent ? 'above' : 'below') : undefined,
    letterGenerated: !!(hasIncrease && isAboveMarket && calc),
    fairnessScore: fairnessScore?.total ?? null,
    compMedianRent: medianCompRent ?? null,
    hudFmrValue: rentData.fmr ?? null,
  }), [analysisId, formData, rentData, newRent, increasePct, marketYoy, calc, medianCompRent, hasIncrease, isAboveMarket, fairnessScore]);

  const hasRentControl = useMemo(() => {
    const result = getRentControlByStateCity(rentData.state, rentData.city);
    return !!getApplicableCap(result);
  }, [rentData.state, rentData.city]);

  const navSections = useMemo(() => {
    const sections = [{ id: 'section-verdict', label: 'Verdict' }];
    sections.push({ id: 'section-evidence', label: 'Evidence' });
    if (hasIncrease && medianCompRent && hasEnoughComps) {
      sections.push({ id: 'section-comps', label: 'Comps' });
    }
    if (hasRentControl) {
      sections.push({ id: 'section-rights', label: 'Rights' });
    }
    if (isAboveMarket || isFair || isBelowMarket) {
      if (hasIncrease && calc) {
        sections.push({ id: 'section-letter', label: 'Letter' });
      }
      if (isAboveMarket) {
        sections.push({ id: 'section-share', label: 'Send' });
      }
    }
    if (!isAboveMarket) {
      if (hasIncrease) {
        sections.push({ id: 'section-share', label: 'Share' });
      }
    }
    return sections;
  }, [hasIncrease, medianCompRent, hasEnoughComps, calc, isAboveMarket, isFair, isBelowMarket, hasRentControl]);

  const annualSavingsForTurnover = useMemo(() => {
    if (!medianCompRent || !hasIncrease) return 0;
    const diff = newRent - medianCompRent;
    return diff > 0 ? Math.round(diff * 12) : 0;
  }, [medianCompRent, newRent, hasIncrease]);
  const proposedRentAboveMedian = medianCompRent ? newRent > medianCompRent : false;

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

  // ━━━ Comp gate state ━━━
  const allComps = outlierResult?.filtered ?? cleanedComps;
  const compsWithRent = allComps.filter(c => c.rent !== null && c.rent > 0);
  const displayableTotal = Math.min(compsWithRent.length, 6);
  const visibleCount = Math.min(displayableTotal, 3);
  const visibleComps = allComps.slice(0, visibleCount);
  const gatedComps = displayableTotal > visibleCount ? allComps.slice(visibleCount) : [];
  const gatedDisplayCount = displayableTotal - visibleCount;
  const [compsUnlocked, setCompsUnlocked] = useState(false);
  const [compEmail, setCompEmail] = useState('');
  const [compEmailError, setCompEmailError] = useState('');
  const [compEmailLoading, setCompEmailLoading] = useState(false);
  const compGateRef = useRef<HTMLDivElement>(null);

  // Auto-unlock comps if email already captured
  useEffect(() => {
    if (capturedEmail) setCompsUnlocked(true);
  }, [capturedEmail]);

  // Track comp gate visibility
  useEffect(() => {
    if (gatedComps.length === 0 || compsUnlocked) return;
    const el = compGateRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          trackEvent('comp_gate_shown', { verdict: verdictLabel, zip_code: rentData.zip });
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [gatedComps.length, compsUnlocked, verdictLabel, rentData.zip]);

  const handleCompGateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!compEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(compEmail.trim())) {
      setCompEmailError('Please enter a valid email.');
      return;
    }
    setCompEmailError('');
    setCompEmailLoading(true);

    const utm = getUtmParams();
    try {
      await supabase.rpc('upsert_lead', {
        p_email: compEmail.trim(),
        p_analysis_id: leadContext?.analysisId || null,
        p_capture_source: 'comp_gate',
        p_address: leadContext?.address || null,
        p_city: leadContext?.city || null,
        p_state: leadContext?.state || null,
        p_zip: leadContext?.zip || null,
        p_bedrooms: leadContext?.bedrooms ?? null,
        p_current_rent: leadContext?.currentRent ?? null,
        p_proposed_rent: leadContext?.proposedRent ?? null,
        p_increase_pct: leadContext?.increasePct ?? null,
        p_verdict: verdictLabel || null,
        p_utm_source: utm.utm_source || null,
        p_utm_medium: utm.utm_medium || null,
        p_utm_campaign: utm.utm_campaign || null,
        p_fairness_score: leadContext?.fairnessScore ?? null,
        p_comp_median_rent: leadContext?.compMedianRent ?? null,
        p_hud_fmr_value: leadContext?.hudFmrValue ?? null,
      } as any);

      await supabase.from('lead_events' as any).insert({
        email: compEmail.trim(),
        analysis_id: leadContext?.analysisId || null,
        event_type: 'comp_gate',
        fairness_score: leadContext?.fairnessScore ?? null,
        address: leadContext?.address || null,
        zip: leadContext?.zip || null,
        current_rent: leadContext?.currentRent ?? null,
        proposed_rent: leadContext?.proposedRent ?? null,
        increase_pct: leadContext?.increasePct ?? null,
        verdict: verdictLabel || null,
        comp_median_rent: leadContext?.compMedianRent ?? null,
        hud_fmr_value: leadContext?.hudFmrValue ?? null,
      } as any);
    } catch {
      // silent
    }

    setCapturedEmail(compEmail.trim());
    setCompsUnlocked(true);
    setCompEmailLoading(false);
    trackEvent('comp_gate_converted', { verdict: verdictLabel, zip_code: rentData.zip });
    trackEvent('email_submitted', { verdict: verdictLabel, zip_code: rentData.zip, source: 'comp_gate' });
    trackAdsConversion();
    toast.success('All comps unlocked!');
  };

  let rowIdx = 0;


  return (
    <>
      <SectionNav sections={navSections} />

      {/* Exit Intent Modal (desktop only) */}
      <ExitIntentModal
        capturedEmail={capturedEmail}
        leadContext={leadContext}
        verdictLabel={verdictLabel}
        zip={rentData.zip}
        city={city}
        onEmailCaptured={setCapturedEmail}
      />

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
          {hasIncrease && !asyncDataReady ? (
              <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                <p className="text-muted-foreground text-sm">Analyzing market data…</p>
              </div>
          ) : hasIncrease && fairnessScore ? (
            <>
              {(() => {
                const sources: ComponentSourceInfo = {};
                if (compositeTrendResult.sourceCount >= 2) {
                  sources.rate = `Source: ${compositeTrendResult.sources.map(s => s.label).join(', ')}`;
                } else if (compositeTrendResult.sourceCount === 1) {
                  sources.rate = `Source: ${compositeTrendResult.primarySource}`;
                } else {
                  sources.rate = 'Source: HUD FMR';
                }
                const compCt = outlierResult?.filtered.length ?? 0;
                if (compCt > 0 && compRadius.label) {
                  sources.comps = `Based on ${compCt} comp${compCt !== 1 ? 's' : ''} ${compRadius.label}`;
                } else if (compCt > 0) {
                  sources.comps = `Based on ${compCt} comparable listing${compCt !== 1 ? 's' : ''}`;
                }
                if (rcMarket.rcMedianRent != null && rcMarket.rcTotalListings != null && rcMarket.rcTotalListings >= 10) {
                  sources.fmr = 'Source: Live market median';
                } else if (rentData.f50 && bedroomNum >= 0 && bedroomNum <= 4 && rentData.f50[bedroomNum] > 0) {
                  sources.fmr = 'Source: HUD 50th percentile';
                } else {
                  sources.fmr = 'Source: HUD FMR';
                }
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
                                  <span className="text-accent-amber">{increasePct}%, {increasePct - Math.abs(marketYoy) > 4 ? 'well above' : 'above'} trend.</span></>
                              ) : marketYoy >= -0.5 && marketYoy <= 0.5 ? (
                                <>Rents near you have been flat — your landlord is asking for{' '}
                                  <span className="text-accent-amber">{increasePct}%, above the current trend.</span></>
                              ) : (
                                <>Rents near you went up {marketYoy}% — your landlord is asking for{' '}
                                  <span className="text-accent-amber">{increasePct}%, {increasePct - marketYoy > 4 ? 'well above' : 'above'} trend.</span></>
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
                            isNuancedAtMarket ? (
                              <>Your increase is above the trend, but your <span className="text-verdict-fair">rent is still at market.</span></>
                            ) : increasePct > marketYoy + 1.5 ? (
                              <>Your increase is a bit high, but your <span className="text-verdict-fair">rent is still reasonable.</span></>
                            ) : (
                              <>Your rent increase is <span className="text-verdict-fair">right at market.</span></>
                            )
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
                            calc.counterExceedsProposed
                              ? <>Based on market data, your proposed rent appears to be in line with or below current market trends.</>
                              : <>That's ${fmt(increaseAmount * 12)} more per year than a market-rate increase would be. A fair counter-offer is {calc.counterLow === calc.counterHigh ? `$${fmt(calc.counterLow)}/mo` : `$${fmt(calc.counterLow)}–$${fmt(calc.counterHigh)}/mo`}.</>
                          ) : isFair ? (
                            increasePct > marketYoy + 1.5 ? (
                              medianCompRent ? (
                                <>Your {increasePct}% increase is above the {marketYoy}% area trend, but at ${fmt(newRent)}/mo your rent {newRent <= medianCompRent ? `is still below the $${fmt(medianCompRent)} local median` : `is within range for ${brLabel} rentals in ${city}`}.</>
                              ) : (
                                <>Your {increasePct}% increase is above the {marketYoy}% area trend, but at ${fmt(newRent)}/mo you're still within the typical range for {brLabel} rentals in {city}.</>
                              )
                            ) : (
                              <>At ${fmt(newRent)}/mo, you'll be within the typical range for {brLabel} rentals in {city}.</>
                            )
                          ) : (
                            <>At ${fmt(newRent)}/mo, you're getting a competitive deal compared to similar units in {city}.</>
                          )}
                        </p>
                        {isNycZip(rentData.zip) && hasIncrease && (
                          <p className="text-xs text-muted-foreground/70 mt-2">
                            Live in a rent-stabilized apartment? Your increase may be legally capped —{' '}
                            <button
                              onClick={() => document.getElementById('section-rights')?.scrollIntoView({ behavior: 'smooth' })}
                              className="underline hover:text-muted-foreground transition-colors"
                            >
                              check your rights below
                            </button>.
                          </p>
                        )}
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
                {(() => {
                  const increaseIsHighGap = increasePct > marketYoy * 2 && increasePct > 0 && marketYoy > 0;
                  return [
                    { label: 'Current rent', value: `$${fmt(formData.currentRent)}`, color: 'text-foreground', sub: null, highlight: false },
                    { label: 'Proposed rent', value: `$${fmt(newRent)}`, color: isAboveMarket ? 'text-destructive' : isBelowMarket ? 'text-verdict-good' : 'text-foreground', sub: null, highlight: false },
                    { label: 'Area trend', value: `${marketYoy > 0 ? '+' : ''}${marketYoy}%`, color: 'text-foreground', sub: null, highlight: false },
                    { label: 'Your increase', value: `${increasePct}%`, color: verdictColor, sub: null, highlight: increaseIsHighGap },
                  ];
                })().map((stat) => (
                    <div
                      key={stat.label}
                      className={`text-center rounded-lg border px-2 sm:px-3 py-3 sm:py-4 flex flex-col justify-between min-h-[76px] sm:min-h-[84px] ${stat.highlight ? 'border-destructive/30 bg-destructive/5' : 'border-border/80 bg-card'}`}
                      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
                    >
                      <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">{stat.label}</p>
                      <p className={`font-display text-[20px] sm:text-[24px] md:text-[28px] tracking-tight tabular-nums ${stat.color}`} style={{ letterSpacing: '-0.02em', lineHeight: 1 }}>
                        {stat.value}
                      </p>
                      {stat.sub ? <p className="text-[9px] text-muted-foreground/60 mt-1">{stat.sub}</p> : <span className="h-[14px]" />}
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
              <h1 className="font-display text-[28px] sm:text-[32px] font-semibold text-foreground leading-tight" style={{ letterSpacing: '-0.02em' }}>
                Good news — your rent isn't going up.
              </h1>
              <p className="text-[15px] sm:text-base text-muted-foreground mt-3 max-w-[480px] leading-relaxed">
                Here's how your current rent of <strong className="text-foreground">${fmt(formData.currentRent)}/mo</strong> compares to what similar {brLabel} apartments are going for in {city}.
              </p>

              <div className="mt-6 w-full grid grid-cols-2 gap-3 max-w-[400px]">
                <div className="text-center rounded-lg border border-border/80 bg-card px-3 py-3" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Your Rent</p>
                  <p className="font-display text-[22px] sm:text-[26px] tracking-tight text-foreground" style={{ letterSpacing: '-0.02em', lineHeight: 1 }}>${fmt(formData.currentRent)}</p>
                </div>
                <div className="text-center rounded-lg border border-border/80 bg-card px-3 py-3" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Area Trend</p>
                  <p className={`font-display text-[22px] sm:text-[26px] tracking-tight ${marketYoy > 0 ? 'text-destructive' : marketYoy < 0 ? 'text-verdict-good' : 'text-foreground'}`} style={{ letterSpacing: '-0.02em', lineHeight: 1 }}>
                    {marketYoy > 0 ? '+' : ''}{marketYoy}%
                  </p>
                </div>
              </div>

              <p className="text-[13px] text-muted-foreground/70 mt-4 max-w-[440px] leading-relaxed">
                {marketYoy > 3
                  ? `Rents in ${city} went up ${marketYoy}% this year — staying flat is a win. Scroll down to see the full market data.`
                  : marketYoy > 0
                  ? `Rents in ${city} are up ${marketYoy}% this year. Your landlord keeping your rent flat means you're getting a better deal over time.`
                  : `Rents in ${city} are ${marketYoy < 0 ? `down ${Math.abs(marketYoy)}%` : 'flat'} this year. Your rent is holding steady with the market.`
                }
              </p>

              <div className="mt-5 flex flex-col items-center gap-2">
                <button
                  onClick={() => document.getElementById('section-evidence')?.scrollIntoView({ behavior: 'smooth' })}
                  className="text-base font-semibold text-primary hover:text-primary/80 transition-colors duration-150"
                >
                  See the market data ↓
                </button>
                <button onClick={onReset} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  ← Check a different address
                </button>
              </div>
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
                <p className="text-xs text-muted-foreground mb-4">
                  {city}, {rentData.state} — {bedroomLabels[formData.bedrooms]}
                  {rentcast.data?.propertyType && <> · {rentcast.data.propertyType}</>}
                </p>

                <div className={`context-row ${rowIdx++ % 2 === 0 ? 'context-row-even' : 'context-row-odd'}`}>
                  <span className="context-label">{city} rents this year</span>
                  <span className="context-value">
                    {marketYoy > 0 ? '+' : ''}{marketYoy}%
                    {rentData.yoyCapped && <span className="context-sub"> (capped)</span>}
                    <span className="context-sub"> ({compositeTrendResult.sourceCount >= 2 ? 'composite — ' + compositeTrendResult.sources.map(s => s.label).join(', ') : compositeTrendResult.primarySource})</span>
                  </span>
                </div>
                {rentData.zillowMonthly !== null && rentData.zillowDirection && (
                  <div className={`context-row ${rowIdx++ % 2 === 0 ? 'context-row-even' : 'context-row-odd'}`}>
                    <span className="context-label">Monthly trend</span>
                    <span className="context-value">
                      {rentData.zillowMonthly > 0 ? '+' : ''}{rentData.zillowMonthly}%/mo
                      <span className="context-sub">
                        {rentData.zillowDirection === 'rising' ? ' ↑ rising' : rentData.zillowDirection === 'falling' ? ' ↓ cooling' : ' → steady'}
                        {' (Zillow ZORI)'}
                      </span>
                    </span>
                  </div>
                )}
                {calc && (
                  <div className={`context-row ${rowIdx++ % 2 === 0 ? 'context-row-even' : 'context-row-odd'}`}>
                    <span className="context-label">What most {brLabel} go for</span>
                    <span className="context-value">
                      ${fmt(calc.typicalRangeLow)} – ${fmt(calc.typicalRangeHigh)}
                      <span className="context-sub"> (HUD SAFMR FY2026)</span>
                    </span>
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
                {isAboveMarket && calc && !calc.counterExceedsProposed && (
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
                {isAboveMarket && calc?.counterExceedsProposed && (
                  <div className="mt-2 px-3 py-2.5 rounded-md bg-verdict-good/10 border border-verdict-good/20">
                    <p className="text-[12px] text-muted-foreground leading-relaxed">
                      Based on market data, your proposed rent appears to be in line with or below current market trends.
                    </p>
                  </div>
                )}

                <p className="text-[11px] text-muted-foreground mt-3">
                  {rentData.yoySourceLabel}
                </p>
                {rentData.yoyReliability === 'government' && (
                  <p className="text-xs text-muted-foreground mt-1">
                    HUD benchmark estimate — actual market trends may differ.
                  </p>
                )}
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

        {/* ━━━ COMPARABLE LISTINGS with comp gate ━━━ */}
        {hasIncrease && medianCompRent && hasEnoughComps && (
          <motion.section id="section-comps" {...fade(0.15)} className="py-12 -mx-2 px-2 rounded-2xl" style={{ background: 'hsl(var(--comps-bg))' }}>
            <h2 className="results-section-header mb-2">
              How Your Rent Compares to Nearby Units
            </h2>
            <p className="text-[12px] text-muted-foreground text-center mb-6">
              Showing {allComps.length} comparable rental{allComps.length !== 1 ? 's' : ''}{compRadius.label ? ` ${compRadius.label}` : ''}, sorted by relevance.
              <span className="text-muted-foreground/60"> (Source: Real-time market listings)</span>
            </p>

            {consistencyNote && (
              <div className="px-4 py-3 rounded-md border border-border bg-muted/50 text-[12px] text-muted-foreground leading-relaxed mb-6">
                {consistencyNote}
              </div>
            )}

            {/* Show first 3 comps via CompsList with only visible comps */}
            <CompsList
              proposedRent={newRent}
              comparables={compsUnlocked ? allComps : visibleComps}
              furnishedComps={compsUnlocked ? furnishedComps : []}
              medianCompRent={medianCompRent}
              hudFmr={rentData.fmr}
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
              gated={gatedComps.length > 0 && !compsUnlocked}
            />

            {/* Comp gate: capture card ABOVE blurred rows */}
            {gatedComps.length > 0 && !compsUnlocked && (
              <div ref={compGateRef} className="mt-4">
                {/* Capture prompt first */}
                <div className="text-center py-4 px-4">
                  <p className="text-sm font-semibold text-foreground mb-1">
                    {gatedDisplayCount} more comparable rental{gatedDisplayCount !== 1 ? 's' : ''} nearby
                  </p>
                  <p className="text-xs text-muted-foreground mb-3">Enter your email to see all comps</p>
                  <form onSubmit={handleCompGateSubmit} className="flex gap-2 max-w-[400px] mx-auto">
                    <input
                      type="email"
                      placeholder="you@email.com"
                      value={compEmail}
                      onChange={(e) => { setCompEmail(e.target.value); if (compEmailError) setCompEmailError(''); }}
                      className={`flex-1 min-w-0 px-4 py-2.5 text-sm border rounded-lg bg-card text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 ${
                        compEmailError ? 'border-destructive' : 'border-border focus:border-foreground'
                      }`}
                    />
                    <button
                      type="submit"
                      disabled={compEmailLoading}
                      className="bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity whitespace-nowrap disabled:opacity-60"
                    >
                      {compEmailLoading ? 'Unlocking…' : 'Unlock all comps →'}
                    </button>
                  </form>
                  {compEmailError && <p className="text-xs text-destructive mt-1">{compEmailError}</p>}
                  <div className="mt-2">
                    <SocialProofLine />
                  </div>
                </div>

                {/* Blurred comp rows below the gate */}
                <div className="relative">
                  <div className="space-y-1" style={{ filter: 'blur(6px)', userSelect: 'none', WebkitUserSelect: 'none' } as React.CSSProperties}>
                    {gatedComps.slice(0, 4).map((comp, i) => (
                      <div key={`gated-${i}`} className={`flex items-start justify-between gap-4 px-4 py-3 rounded-md ${i % 2 === 0 ? 'bg-muted/40' : ''}`}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{comp.formattedAddress}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {comp.bedrooms !== null && `${comp.bedrooms === 0 ? 'Studio' : `${comp.bedrooms}BR`}`}
                            {comp.bathrooms !== null && ` · ${comp.bathrooms}BA`}
                            {comp.distance !== null && ` · ${comp.distance.toFixed(1)} mi`}
                          </p>
                        </div>
                        {comp.rent !== null && (
                          <span className="text-sm font-semibold text-foreground whitespace-nowrap">${fmt(comp.rent)}/mo</span>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="absolute inset-0 pointer-events-none" style={{
                    background: 'linear-gradient(to bottom, hsl(var(--comps-bg) / 0.3) 0%, hsl(var(--comps-bg) / 0.8) 70%, hsl(var(--comps-bg)) 100%)',
                  }} />
                </div>
              </div>
            )}

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

            {/* CompLinks — only post-conversion */}
            {capturedEmail && (
              <div className="mt-6">
                <CompLinks zip={rentData.zip} city={rentData.city} state={rentData.state} bedrooms={formData.bedrooms} verdict={verdictLabel} fairnessScore={fairnessScore?.total} />
              </div>
            )}
          </motion.section>
        )}
        {!hasEnoughComps && !rentcast.loading && capturedEmail && (
          <motion.section {...fade(0.15)} className="py-12">
            <CompLinks zip={rentData.zip} city={rentData.city} state={rentData.state} bedrooms={formData.bedrooms} verdict={verdictLabel} fairnessScore={fairnessScore?.total} />
          </motion.section>
        )}

        {/* ━━━ YOUR NEXT STEPS — only after email capture ━━━ */}
        {hasIncrease && capturedEmail && (
          <NextStepsSection
            isAboveMarket={isAboveMarket}
            fairnessScore={fairnessScore?.total ?? null}
            verdictLabel={verdictLabel}
            zip={rentData.zip}
            bedrooms={bedroomNum}
            currentRent={formData.currentRent}
            proposedRent={newRent}
            propertyType={propertyData?.propertyType}
            city={city}
            state={rentData.state}
            compMedianRent={medianCompRent}
            dollarOverpayment={excessAnnual > 0 ? Math.round(excessAnnual / 12) : null}
            brLabel={brLabel}
            onShareClick={() => {
              document.getElementById('section-share')?.scrollIntoView({ behavior: 'smooth' });
            }}
            analysisId={analysisId}
            capturedEmail={capturedEmail}
          />
        )}

        {/* ━━━ Know Your Rights ━━━ */}
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

        {/* ━━━ NEGOTIATION LETTER (All verdicts with increase) ━━━ */}
        {hasIncrease && calc && (isAboveMarket || isFair || isBelowMarket) && (
          <motion.section id="section-letter" {...fade(0.19)} className="pt-8 pb-8">
            {isFair && !isAboveMarket && !isBelowMarket && (
              <p className="text-sm text-muted-foreground mb-4 text-center max-w-[480px] mx-auto">
                Even a fair increase is worth negotiating. Landlords expect it — and avoiding turnover is worth more to them than $50-100/month.
              </p>
            )}
            {isBelowMarket && (
              <p className="text-sm text-muted-foreground mb-4 text-center max-w-[480px] mx-auto">
                Your landlord is offering below-market terms — that's leverage. Here's how to lock in this rate or negotiate extras like a longer lease, a unit upgrade, or a repair you've been waiting on.
              </p>
            )}
            <LetterGate
                  leadContext={leadContext}
                  prefilledEmail={capturedEmail}
                  onEmailCaptured={setCapturedEmail}
                  verdictLabel={isAboveMarket ? 'above' : isBelowMarket ? 'below' : 'fair'}
                >
                  <NegotiationLetter
                    currentRent={formData.currentRent}
                    newRent={newRent}
                    increasePct={increasePct}
                    marketYoy={marketYoy}
                    fmr={rentData.fmr}
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
                    trendSource={compositeTrendResult.sourceCount >= 2 ? 'multiple market sources' : compositeTrendResult.primarySource}
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
                    letterTone={isAboveMarket ? 'aggressive' : isFair ? 'collaborative' : 'strategic'}
                    onLetterGenerated={handleLetterGenerated}
                    comparables={rentcast.data?.comparables}
                  />
                </LetterGate>
          </motion.section>
        )}

        {/* ━━━ ABOVE MARKET PATH: Share ━━━ */}
        {isAboveMarket && (
          <>
            {hasIncrease && (
              <motion.section id="section-share" {...fade(0.21)} className="pt-8 pb-10">
                <h2 className="results-section-header mb-6">Share Your Analysis</h2>
                <div className="flex justify-center">
                  <ShareHub
                    reportPayload={shareReportPayload}
                    onLinkGenerated={(url) => { setReportUrl(url); handleResultsShared(); }}
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
                      { label: 'Current rent', value: `$${fmt(formData.currentRent)}` },
                      { label: 'Proposed rent', value: `$${fmt(newRent)}`, color: 'hsl(0, 72%, 51%)' },
                      { label: 'Area trend', value: `${marketYoy > 0 ? '+' : ''}${marketYoy}%` },
                      { label: 'Your increase', value: `${increasePct}%`, color: 'hsl(0, 72%, 51%)' },
                    ]}
                  />
                </div>
              </motion.section>
            )}
          </>
        )}

        {/* ━━━ BELOW / FAIR MARKET PATH ━━━ */}
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


            {/* Email capture for fair/below — rewritten copy */}
            {!capturedEmail && (
              <section id="section-email-capture" className="pb-6 pt-4">
                <div className="rounded-xl px-5 sm:px-8 py-5 sm:py-6 text-center" style={{ background: 'hsl(var(--secondary))' }}>
                  <EmailCapture
                    city={city}
                    captureSource="lease_reminder"
                    prefilledEmail={capturedEmail}
                    onEmailCaptured={setCapturedEmail}
                    leadContext={leadContext}
                    verdict={isBelowMarket ? 'below' : 'at_market'}
                    heading={
                      isFair
                        ? "Your increase is fair — but you can still save."
                        : "You're getting a good deal. Lock it in."
                    }
                    subtext={
                      isFair
                        ? "Get a letter to negotiate extras: longer lease, unit upgrades, or maintenance. We'll also alert you before your next renewal."
                        : "We'll send you this analysis and alert you when market conditions change in your area."
                    }
                  />
                </div>
              </section>
            )}

            {/* Post-conversion flow for fair/below */}
            {capturedEmail && (
              <section className="pb-4 pt-2">
                <PostConversionFlow
                  email={capturedEmail}
                  leadContext={leadContext}
                  verdictLabel={verdictLabel}
                  zip={rentData.zip}
                />
              </section>
            )}

            {/* Share */}
            <motion.section id="section-share" {...fade(0.23)} className="pt-4 pb-10">
              <h2 className="results-section-header mb-6">Share This Tool</h2>
              <div className="flex justify-center">
                <ShareHub
                  reportPayload={shareReportPayload}
                  onLinkGenerated={(url) => { setReportUrl(url); handleResultsShared(); }}
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
                    { label: 'Current rent', value: `$${fmt(formData.currentRent)}` },
                    { label: 'Proposed rent', value: `$${fmt(newRent)}`, color: isBelowMarket ? 'hsl(151, 50%, 38%)' : undefined },
                    { label: 'Area trend', value: `${marketYoy > 0 ? '+' : ''}${marketYoy}%` },
                    { label: 'Your increase', value: `${increasePct}%`, color: isFair ? 'hsl(45, 80%, 45%)' : 'hsl(151, 50%, 38%)' },
                  ]}
                />
              </div>
            </motion.section>
          </>
        )}

        {/* ━━━ No increase path — email capture with updated copy ━━━ */}
        {!hasIncrease && (
          <>
            {!capturedEmail ? (
              <section className="pb-12 pt-4">
                <div className="rounded-xl px-5 sm:px-8 py-5 sm:py-6 text-center" style={{ background: 'hsl(var(--secondary))' }}>
                  <EmailCapture
                    city={city}
                    captureSource="lease_reminder"
                    prefilledEmail={capturedEmail}
                    onEmailCaptured={setCapturedEmail}
                    leadContext={leadContext}
                    heading="Your rent could go up next year."
                    subtext={`We'll monitor market data for ${city} and alert you before your next renewal.`}
                  />
                </div>
              </section>
            ) : (
              <section className="pb-12 pt-4">
                <PostConversionFlow
                  email={capturedEmail}
                  leadContext={leadContext}
                  verdictLabel={verdictLabel}
                  zip={rentData.zip}
                />
              </section>
            )}
          </>
        )}

        </div>
      </div>
    </>
  );
};

export default RentResults;
