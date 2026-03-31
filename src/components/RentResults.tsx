import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Info } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { RentFormData } from './RentForm';
import { RentLookupResult, bedroomLabels, calculateResults, getCounterOffer } from '@/data/rentData';
import ShareHub from './ShareHub';

import { CompsList } from './ShouldYouMove';
import NegotiationLetter from './NegotiationLetter';
import RentControlCard from './RentControlCard';
import { PropertyLookupResult, PropertyLookupError } from '@/hooks/usePropertyLookup';
import { getRentControlByStateCity, getApplicableCap, isNycZip, checkBuildingEligibility } from '@/data/rentControlData';
import { getUtilityNote, getBrokerFeeInfo } from '@/lib/contextualFlags';
import { useRentcast } from '@/hooks/useRentcast';
import { useRentcastMarket } from '@/hooks/useRentcastMarket';
import { useHcrLookup } from '@/hooks/useHcrLookup';
import { supabase } from '@/integrations/supabase/client';
import SectionNav from './SectionNav';
import { trackEvent, trackAdsConversion } from '@/lib/analytics';
import { getUtmParams } from '@/lib/utm';
import { getSessionId } from '@/lib/sessionId';
import { checkAnalysisDedup } from '@/lib/analysisDedup';
import DataConfidenceBadge from './DataConfidenceBadge';
import { assessConfidence, detectOutliers, checkCrossSourceConsistency, getCompRadius, filterFurnished, deduplicateComps, applySeasonalAdjustment } from '@/lib/dataQuality';
import { calculateFairnessScore, scoreToVerdict, FairnessScoreResult } from '@/lib/fairnessScore';
import { calculateCompConfidence, computeCompIqr, medianOf, CompConfidenceResult } from '@/lib/compConfidence';
import { getBuildingRange } from '@/lib/buildingRange';
import { calculateCompositeTrend } from '@/lib/compositeTrend';
import FairnessScoreGauge, { ComponentSourceInfo } from './FairnessScoreGauge';
import MarketSnapshot from './MarketSnapshot';
import NextStepsSection, { ListingsBlock } from './NextStepsSection';
import { useRentcastListings } from '@/hooks/useRentcastListings';
import IntentFork from './IntentFork';
import PartnerCTA from './PartnerCTA';
import MoveCTA from './MoveCTA';
import ExitIntentModal from './ExitIntentModal';
import MobileScrollPrompt from './MobileScrollPrompt';
import PostConversionFlow from './PostConversionFlow';
import LeaseReminderCapture from './LeaseReminderCapture';
import FeedbackWidget from './FeedbackWidget';
import SocialProofLine from './SocialProofLine';
import ReportGate from './ReportGate';
import PreGateCompPreview from './PreGateCompPreview';
import EmailReportPrompt from './EmailReportPrompt';
import { EMAIL_GATE_ENABLED, GATE_VARIANT } from '@/lib/featureFlags';
import { DEAL_CITIES } from '@/data/dealsCities';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { demoRentcast } from '@/data/demoData';

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
  isDemo?: boolean;
}

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

const fade = (delay: number) => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] as const },
});

const RentResults = ({ formData, rentData, propertyData, propertyLoading, propertyError, onReset, onScrollToTop, capturedEmail: externalEmail, onEmailCaptured: externalOnEmail, onVerdictReady, isDemo = false }: RentResultsProps) => {
  const [internalEmail, setInternalEmail] = useState('');
  const capturedEmail = externalEmail ?? internalEmail;
  const isUnlocked = !!capturedEmail || !EMAIL_GATE_ENABLED;
  const setCapturedEmail = (email: string) => {
    setInternalEmail(email);
    externalOnEmail?.(email);
  };
  const [{ analysisId, isDuplicateAnalysis }] = useState(() => {
    const brNum = formData.bedrooms === 'studio' ? 0 : formData.bedrooms === 'oneBr' ? 1 : formData.bedrooms === 'twoBr' ? 2 : formData.bedrooms === 'threeBr' ? 3 : 4;
    const result = checkAnalysisDedup(formData.fullAddress || null, rentData.zip, brNum, formData.currentRent, 'renewal');
    return { analysisId: result.analysisId, isDuplicateAnalysis: result.isDuplicate };
  });
  const [reportUrl, setReportUrl] = useState<string | null>(null);
  const [dismissedRentWarning, setDismissedRentWarning] = useState(false);
  const [selectedIntent, setSelectedIntent] = useState<'stay' | 'move' | null>(null);
  const analysisLogged = useRef(isDuplicateAnalysis);
  const gateViewedRef = useRef(false);

  // Rehydrate user_intent from analyses on mount
  useEffect(() => {
    if (!analysisId) return;
    supabase
      .from('analyses')
      .select('user_intent' as any)
      .eq('id', analysisId)
      .single()
      .then(({ data }) => {
        const intent = (data as any)?.user_intent;
        if (intent === 'stay' || intent === 'move') {
          setSelectedIntent(intent);
        }
      });
  }, [analysisId]);

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

  // calc is computed later, after bldg and medianCompRent are available

  const newRent = formData.currentRent + increaseAmount;
  const compositeTrendResult = useMemo(() => calculateCompositeTrend({
    alYoY: rentData.alYoY,
    zoriYoY: rentData.zoriYoY,
    zoriSource: rentData.zoriGeoLevel,
    hudYoY: rentData.yoyChange,
  }), [rentData.alYoY, rentData.zoriYoY, rentData.zoriGeoLevel, rentData.yoyChange]);

  const marketYoy = compositeTrendResult.compositeTrend;
  
  const excessAnnual = hasIncrease
    ? Math.round(formData.currentRent * ((increasePct - marketYoy) / 100) * 12)
    : 0;
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

  const rentcastRaw = useRentcast(rentData.zip, formData.bedrooms, formData.fullAddress, !isDemo);
  const rentcast = isDemo ? { data: demoRentcast, loading: false, error: null } : rentcastRaw;
  const rcMarket = useRentcastMarket(rentData.zip, formData.bedrooms, !isDemo);
  const hcrLookup = useHcrLookup(formData.fullAddress, rentData.zip, !isDemo);
  const hasRentcastComps = rentcast.data && rentcast.data.comparables.length > 0;

  // ━━━ Preprocessing: deduplicate & filter furnished ━━━
  const { cleanedComps, furnishedComps } = useMemo(() => {
    if (!rentcast.data?.comparables) return { cleanedComps: [], furnishedComps: [] };
    const deduped = deduplicateComps(rentcast.data.comparables);
    const { unfurnished, furnished } = filterFurnished(deduped);
    const exactBrMatch = unfurnished.filter(c => c.bedrooms === bedroomNum);
    const nearBrMatch = unfurnished.filter(c => c.bedrooms !== bedroomNum);
    const prioritized = exactBrMatch.length >= 3
      ? [...exactBrMatch, ...nearBrMatch]
      : unfurnished;
    // Apply seasonal adjustment using state
    const seasonallyAdjusted = applySeasonalAdjustment(prioritized, rentData.state);
    return { cleanedComps: seasonallyAdjusted, furnishedComps: furnished };
  }, [rentcast.data, bedroomNum, rentData.state]);

  // ━━━ Outlier detection ━━━
  const subjectSqft = propertyData?.squareFootage ?? null;
  const outlierResult = useMemo(() => {
    if (cleanedComps.length === 0) return null;
    return detectOutliers(cleanedComps, subjectSqft);
  }, [cleanedComps, subjectSqft]);

  const medianCompRent = useMemo<number | null>(() => {
    if (outlierResult && outlierResult.filtered.length >= 2) {
      return outlierResult.median;
    }
    if (rentcast.data?.rentEstimate) return rentcast.data.rentEstimate;
    return null;
  }, [outlierResult, rentcast.data]);

  const hasEnoughComps = outlierResult ? outlierResult.filtered.length >= 3 : false;
  const isHighRent = formData.currentRent > rentData.fmr * 1.5;

  // ━━━ Building range ━━━
  const bldg = useMemo(() => getBuildingRange(
    outlierResult?.filtered ?? cleanedComps,
    formData.fullAddress ?? null,
    bedroomNum,
  ), [outlierResult, cleanedComps, formData.fullAddress, bedroomNum]);

  // ━━━ Same-unit-line median ━━━
  const sameLineMedian = useMemo(() => {
    if (!bldg.hasBuildingData) return null;
    const sameLineComps = bldg.buildingComps.filter(
      (c: any) => c.isSameUnitLine && c.rent != null && c.rent > 0
    );
    if (sameLineComps.length < 2) return null;
    const rents = sameLineComps.map((c: any) => c.rent!).sort((a: number, b: number) => a - b);
    const mid = Math.floor(rents.length / 2);
    return rents.length % 2 === 0
      ? (rents[mid - 1] + rents[mid]) / 2
      : rents[mid];
  }, [bldg]);

  // ━━━ Calc (moved after bldg and medianCompRent) ━━━
  const calc = useMemo(() => {
    if (!hasIncrease) return null;
    return calculateResults(
      formData.currentRent, increasePct, formData.movingCosts, rentData,
    );
  }, [formData.currentRent, increasePct, formData.movingCosts, rentData, hasIncrease]);

  // ━━━ Counter-offer (trend-based with built-in negotiation room) ━━━
  const counterOffer = useMemo(() => {
    if (!hasIncrease) return null;
    return getCounterOffer(formData.currentRent, marketYoy);
  }, [hasIncrease, formData.currentRent, marketYoy]);

  const counterExceedsProposed = counterOffer
    ? counterOffer.counterLow >= newRent
    : false;

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

  // ━━━ Fairness Score ━━━
  const asyncDataReady = !rentcast.loading && !rcMarket.loading;

  const allSameBuilding = useMemo(() => {
    const filtered = outlierResult?.filtered ?? [];
    return filtered.length > 0 && filtered.every(c => c.isSameBuilding);
  }, [outlierResult]);

  // ━━━ v2.3: Comp Confidence + IQR ━━━
  const compIqrData = useMemo(() => {
    const filtered = outlierResult?.filtered ?? [];
    return computeCompIqr(filtered);
  }, [outlierResult]);

  const compConfidence = useMemo<CompConfidenceResult | null>(() => {
    const filtered = outlierResult?.filtered ?? [];
    if (filtered.length === 0 && !bldg.hasBuildingData) return null;

    const sameLineComps = bldg.hasBuildingData
      ? bldg.buildingComps.filter((c: any) => c.isSameUnitLine && c.rent != null && c.rent > 0)
      : [];
    const buildingCompsWithRent = bldg.hasBuildingData
      ? bldg.buildingComps.filter((c: any) => c.rent != null && c.rent > 0)
      : [];
    const buildingBrMatched = bldg.hasBuildingData
      ? buildingCompsWithRent.filter((c: any) => c.bedrooms === bedroomNum)
      : [];
    const nearbyBrMatched = filtered.filter(
      c => !c.isSameBuilding && c.bedrooms === bedroomNum && c.distance != null && c.distance <= 0.5
    );

    const distances = filtered
      .map(c => c.distance)
      .filter((d): d is number => d !== null);
    const medianDist = distances.length > 0 ? medianOf(distances) : null;
    const daysOldValues = filtered
      .map(c => c.daysOld)
      .filter((d): d is number => d !== null);
    const medDaysOld = daysOldValues.length > 0 ? medianOf(daysOldValues) : null;

    return calculateCompConfidence({
      comps: filtered,
      subjectAddress: formData.fullAddress ?? null,
      sameLineCompCount: sameLineComps.length,
      buildingCompCount: buildingCompsWithRent.length,
      buildingBedroomMatchCount: buildingBrMatched.length,
      nearbyBedroomMatchCount: nearbyBrMatched.length,
      medianCompDistance: medianDist,
      compIqrRatio: compIqrData?.iqrRatio ?? null,
      medianDaysOld: medDaysOld,
    });
  }, [outlierResult, bldg, bedroomNum, formData.fullAddress, compIqrData]);

  // ZORI zip rent for market tier detection
  const zoriZipRent = useMemo(() => {
    // Use rcMarket median as primary, since ZORI rent level isn't directly in rentData
    // zoriYoY is a % change, not an absolute rent. rcMedianRent serves as the local market median.
    return rcMarket.rcMedianRent ?? null;
  }, [rcMarket.rcMedianRent]);

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
      buildingMedian: bldg.hasBuildingData ? bldg.buildingMedian : null,
      buildingCompCount: bldg.hasBuildingData ? bldg.buildingComps.length : null,
      sameLineMedian,
      allSameBuilding,
      // v2.3 additions
      compConfidence,
      compP25: compIqrData?.p25 ?? null,
      compP75: compIqrData?.p75 ?? null,
      compIqrRatio: compIqrData?.iqrRatio ?? null,
      zoriZipRent,
      comps: outlierResult?.filtered ?? null,
    });
  }, [hasIncrease, asyncDataReady, increasePct, marketYoy, newRent, medianCompRent, outlierResult, rentData.fmr, rentData.zillowMonthly, rentData.hvd, rentData.alYoY, rentData.alMoM, rentData.f50, rcMarket.rcMedianRent, rcMarket.rcTotalListings, compositeTrendResult, bldg, sameLineMedian, allSameBuilding, compConfidence, compIqrData, zoriZipRent]);

  // ━━━ Comp-overpayment detection ━━━
  const compOverpayment = useMemo(() => {
    if (!hasIncrease || !medianCompRent || medianCompRent <= 0) return null;
    const rentBearingComps = (outlierResult?.filtered ?? []).filter(c => c.rent != null && c.rent > 0);
    if (rentBearingComps.length < 5) return null;
    const overPct = (newRent - medianCompRent) / medianCompRent;
    if (overPct < 0.15) return null;
    const dollarOver = Math.round(newRent - medianCompRent);
    return { overPct: Math.round(overPct * 100), dollarOver, compCount: rentBearingComps.length };
  }, [hasIncrease, medianCompRent, newRent, outlierResult]);

  // ━━━ Low-comp guardrail ━━━
  const isCompDeficient = useMemo(() => {
    if (!hasIncrease || !fairnessScore) return false;
    const compComponent = fairnessScore.components.find(c => c.id === 'comps');
    if (!compComponent) return true;
    return compComponent.max <= 10;
  }, [hasIncrease, fairnessScore]);

  // Override confidence to 'limited' when comp contribution is negligible
  const effectiveConfidence = useMemo(() => {
    if (isCompDeficient && confidence.level !== 'limited') {
      return {
        ...confidence,
        level: 'limited' as const,
        note: 'This analysis reflects market trend alignment. Limited comparable listings were available for direct rent comparison.',
      };
    }
    return confidence;
  }, [isCompDeficient, confidence]);

  // ━━━ Premium unit detection ━━━
  const isPremiumUnit = bldg.hasBuildingData &&
    bldg.buildingMedian > 0 &&
    formData.currentRent > bldg.buildingMedian * 1.20;

  // ━━━ Verdict with building override (premium-aware) ━━━
  const refinedVerdict = useMemo(() => {
    if (!fairnessScore) return null;
    return scoreToVerdict(fairnessScore.total);
  }, [fairnessScore]);

  const buildingOverride = useMemo(() => {
    if (!bldg.hasBuildingData || bldg.buildingComps.length < 3) return null;
    // Don't override for premium units — their rent is legitimately above building average
    if (isPremiumUnit) return null;
    if (newRent > bldg.buildingHigh) return 'above' as const;
    if (newRent < bldg.buildingLow) return 'below' as const;
    return null;
  }, [bldg, newRent, isPremiumUnit]);

  const effectiveVerdict = buildingOverride ?? refinedVerdict;
  const isAboveMarket = effectiveVerdict === 'above';
  const isFair = effectiveVerdict === 'at-market';
  const isBelowMarket = effectiveVerdict === 'below';

  const rentcastListings = useRentcastListings(
    rentData.zip,
    bedroomNum,
    analysisId,
    isUnlocked && effectiveVerdict !== 'below',
  );

  useEffect(() => {
    if (effectiveVerdict) onVerdictReady?.(isAboveMarket);
  }, [effectiveVerdict]);

  // Gate viewed analytics — fires once per analysis
  useEffect(() => {
    if (!EMAIL_GATE_ENABLED || capturedEmail || gateViewedRef.current) return;
    const el = document.getElementById('section-gate');
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !gateViewedRef.current) {
          gateViewedRef.current = true;
          trackEvent('gate_viewed', {
            verdict_type: isAboveMarket ? 'above' : isFair ? 'at-market' : 'below',
            analysis_version: 'gated_results_v1',
            gate_variant: GATE_VARIANT,
          });
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [capturedEmail, isAboveMarket, isFair]);

  // Report unlocked analytics
  useEffect(() => {
    if (capturedEmail) {
      trackEvent('report_unlocked', {
        verdict_type: isAboveMarket ? 'above' : isFair ? 'at-market' : 'below',
        analysis_version: EMAIL_GATE_ENABLED ? 'gated_results_v1' : 'ungated_v1',
        gate_variant: GATE_VARIANT,
      });
    } else if (!EMAIL_GATE_ENABLED) {
      trackEvent('report_shown_ungated', {
        verdict_type: isAboveMarket ? 'above' : isFair ? 'at-market' : 'below',
        analysis_version: 'ungated_v1',
        gate_variant: GATE_VARIANT,
      });
    }
  }, [capturedEmail]);

  const isNuancedAtMarket = isFair && increasePct - marketYoy > 2 && medianCompRent != null && newRent <= medianCompRent;
  const proposedFarBelowMedian = medianCompRent != null && newRent < medianCompRent * 0.8;

  const isBelowFmrHighIncrease = useMemo(() => {
    if (!hasIncrease || !fairnessScore) return false;
    const bedroomNum = ['studio', '1br', '2br', '3br', '4br'].indexOf(formData.bedrooms);
    const f50Value = rentData.f50 && bedroomNum >= 0 && bedroomNum <= 4 ? rentData.f50[bedroomNum] : 0;
    const upper = (rcMarket.rcMedianRent && rcMarket.rcTotalListings && rcMarket.rcTotalListings >= 10)
      ? rcMarket.rcMedianRent
      : (f50Value && f50Value > 0) ? f50Value
      : rentData.fmr * 1.15;
    const effectiveUpper = Math.max(upper, rentData.fmr);
    const rentBelowUpper = newRent <= effectiveUpper;
    const increaseWellAboveTrend = increasePct > marketYoy * 1.5 && increasePct - marketYoy >= 3;
    return rentBelowUpper && increaseWellAboveTrend && effectiveVerdict !== 'above';
  }, [hasIncrease, fairnessScore, formData.bedrooms, rentData, rcMarket, newRent, increasePct, marketYoy, effectiveVerdict]);

  const verdictColor = isAboveMarket ? 'text-destructive' : isFair ? 'text-verdict-fair' : 'text-verdict-good';
  const verdictLabel = !hasIncrease
    ? 'No Increase'
    : fairnessScore ? fairnessScore.tierLabel : 'At Market';

  const city = rentData.city;
  const brLabel = bedroomLabels[formData.bedrooms].toLowerCase();

  // ━━━ Extreme rent warning (display-only, never affects scoring) ━━━
  const fmrMap = rentData?.fmr;
  const fmrForBedroom =
    (typeof formData.bedrooms !== 'undefined' && fmrMap?.[formData.bedrooms] != null
      ? fmrMap[formData.bedrooms]
      : fmrMap?.[1]) ?? null;
  const rentToFmrRatio =
    fmrForBedroom && fmrForBedroom > 0 ? formData.currentRent / fmrForBedroom : null;
  const isExtremelyHigh = rentToFmrRatio !== null && rentToFmrRatio > 5;
  const isExtremelyLow = rentToFmrRatio !== null && rentToFmrRatio < 0.15;
  const showRentWarning =
    !dismissedRentWarning && (isExtremelyHigh || isExtremelyLow);

  // ━━━ High pain detection for gate aggressiveness ━━━
  const isHighPain = isAboveMarket;

  // ━━━ All comps ━━━
  const allComps = outlierResult?.filtered ?? cleanedComps;
  const compsWithRent = allComps.filter(c => c.rent !== null && c.rent > 0);


  // ━━━ Analytics tracking ━━━
  useEffect(() => {
    trackEvent('analysis_completed', { tool: 'renewal', zip: rentData.zip, verdict: verdictLabel, score: fairnessScore?.total ?? null, gate_variant: GATE_VARIANT });
  }, []);

  // Reset rent warning dismissal on new analysis
  useEffect(() => {
    setDismissedRentWarning(false);
  }, [formData.currentRent, formData.bedrooms, rentData?.fmr]);

  // ━━━ Anonymous analysis logging ━━━
  useEffect(() => {
    if (analysisLogged.current) return;
    if (isDemo) { analysisLogged.current = true; return; }
    if (hasIncrease && fairnessScore === null) return;
    if (rentcast.loading) return;
    analysisLogged.current = true;

    const compsPosition = medianCompRent
      ? (newRent > medianCompRent ? 'above' : 'below')
      : hasEnoughComps === false ? 'insufficient' : null;

    const showCounter = counterOffer && !counterExceedsProposed;
    const counterStr = showCounter
      ? (counterOffer.counterLow === counterOffer.counterHigh ? `$${fmt(counterOffer.counterLow)}` : `$${fmt(counterOffer.counterLow)}–$${fmt(counterOffer.counterHigh)}`)
      : null;

    const dollarOverpayment = hasIncrease && showCounter
      ? Math.max(0, Math.round(newRent - counterOffer.counterLow))
      : 0;

    const utm = getUtmParams();
    const inferredPropertyType = rentcast.data?.propertyType ?? null;
    const compsCount = rentcast.data?.comparables?.length ?? 0;

    const anomalyFlags: string[] = [];
    if (increasePct > 50) anomalyFlags.push('extreme_increase');
    if (formData.currentRent < 300) anomalyFlags.push('very_low_rent');
    if (formData.currentRent > 15000) anomalyFlags.push('very_high_rent');
    if (compsCount === 0) anomalyFlags.push('no_comps');
    if (effectiveConfidence.level === 'limited') anomalyFlags.push('low_confidence');

    supabase.from('analyses').insert({
      id: analysisId,
      session_id: getSessionId(),
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
      counter_offer_low: counterOffer?.counterLow ?? null,
      counter_offer_high: counterOffer?.counterHigh ?? null,
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
            effective_confidence_level: effectiveConfidence.level ?? null,
            comp_median_rent: medianCompRent ?? null,
            hud_fmr_value: rentData.fmr ?? null,
            analysis_id: analysisId,
          },
        }).catch(() => {});
      }
    });

  }, [hasIncrease, fairnessScore, rentcast.loading]);

  // ━━━ Lazy-update analysis record ━━━
  const updateAnalysis = useCallback((fields: Record<string, any>) => {
    if (!analysisId || isDemo) return;
    supabase.from('analyses').update(fields as any).eq('id', analysisId).then(() => {});
  }, [analysisId, isDemo]);

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
    fairCounterOffer: counterOffer && !counterExceedsProposed ? (counterOffer.counterLow === counterOffer.counterHigh ? `$${fmt(counterOffer.counterLow)}` : `$${fmt(counterOffer.counterLow)}–$${fmt(counterOffer.counterHigh)}`) : undefined,
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

  const rentControlCap = useMemo(() => {
    const result = getRentControlByStateCity(rentData.state, rentData.city);
    return getApplicableCap(result);
  }, [rentData.state, rentData.city]);

  /** Whether the specific building plausibly qualifies for rent control */
  const buildingEligibility = useMemo(() => {
    if (!rentControlCap) return 'unknown' as const;
    return checkBuildingEligibility(rentControlCap, propertyData ? {
      yearBuilt: propertyData.yearBuilt ?? null,
      units: propertyData.units ?? null,
      propertyType: propertyData.propertyType ?? null,
      dhcrMatch: hcrLookup.result?.found === true && hcrLookup.result?.stabilized === true,
    } : null);
  }, [rentControlCap, propertyData, hcrLookup.result]);

  const utilityNote = useMemo(() => getUtilityNote(propertyData, rentData.state), [propertyData, rentData.state]);

  const brokerFee = useMemo(() => getBrokerFeeInfo(rentData.state, rentData.city), [rentData.state, rentData.city]);

  const navSections = useMemo(() => {
    const sections = [{ id: 'section-verdict', label: 'Verdict' }];
    if (!isUnlocked) {
      sections.push({ id: 'section-gate', label: 'Report' });
    } else {
      if (hasIncrease && medianCompRent && hasEnoughComps) {
        sections.push({ id: 'section-comps', label: 'Comps' });
      }
      if (hasRentControl) {
        sections.push({ id: 'section-rights', label: 'Rights' });
      }
      if (hasIncrease && calc) {
        sections.push({ id: 'section-letter', label: 'Letter' });
      }
      sections.push({ id: 'section-share', label: 'Share' });
    }
    return sections;
  }, [isUnlocked, capturedEmail, hasIncrease, medianCompRent, hasEnoughComps, calc, hasRentControl]);

  const shareReportPayload = useMemo(() => ({
    zip: rentData.zip,
    address: formData.fullAddress || null,
    bedrooms: bedroomNum,
    currentRent: formData.currentRent,
    proposedIncrease: increasePct,
    increaseType: 'percent' as const,
    reportData: {
      city: rentData.city, state: rentData.state, newRent, increasePct, marketYoy,
      fmr: rentData.fmr, verdict: effectiveVerdict ?? '',
      counterLow: counterOffer?.counterLow ?? null, counterHigh: counterOffer?.counterHigh ?? null,
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
      {isUnlocked && <SectionNav sections={navSections} />}

      {/* Exit Intent Modal (desktop only) — safety net */}
      <ExitIntentModal
        capturedEmail={capturedEmail}
        leadContext={leadContext}
        verdictLabel={verdictLabel}
        zip={rentData.zip}
        city={city}
        onEmailCaptured={setCapturedEmail}
        shareReportPayload={shareReportPayload}
        onReportGenerated={(url) => { setReportUrl(url); }}
      />

      {/* Mobile Scroll Prompt (mobile only) — re-engagement */}
      <MobileScrollPrompt
        capturedEmail={capturedEmail}
        leadContext={leadContext}
        verdictLabel={verdictLabel}
        zip={rentData.zip}
        city={city}
        onEmailCaptured={setCapturedEmail}
        toolType="renewal"
        shareReportPayload={shareReportPayload}
        onReportGenerated={(url) => { setReportUrl(url); }}
      />

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           PHASE 1: FREE CREDIBILITY LAYER
         ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {showRentWarning && (
        <div className="mx-auto max-w-md mb-4 px-4 py-3 rounded-lg border border-amber-300/50 bg-amber-50/50 dark:bg-amber-950/20 text-center relative">
          <button
            type="button"
            onClick={() => setDismissedRentWarning(true)}
            aria-label="Dismiss warning"
            className="absolute right-2 top-2 text-amber-700 dark:text-amber-300 text-sm"
          >
            ×
          </button>
          <p className="text-sm text-amber-800 dark:text-amber-200 pr-5">
            {isExtremelyHigh
              ? `Your entered rent ($${fmt(formData.currentRent)}/mo) is significantly above the typical range for this area. Results may be less accurate. Double-check your numbers.`
              : `Your entered rent ($${fmt(formData.currentRent)}/mo) is significantly below the typical range for this area. Results may be less accurate. Double-check your numbers.`
            }
          </p>
        </div>
      )}
      <div
        className="w-full"
        style={{ background: 'hsl(var(--verdict-bg))' }}
      >
        <div className="max-w-[620px] mx-auto px-5 sm:px-6">
          <motion.section
            id="section-verdict"
            {...fade(0)}
            className="min-h-0 sm:min-h-[50vh] flex flex-col items-center justify-center text-center py-4 sm:py-12"
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
                  <div className={!isUnlocked ? '[&_[data-score-details]]:max-md:hidden [&_[data-score-basis]]:max-md:hidden [&_[data-score-label]]:max-md:hidden' : ''}>
                  <FairnessScoreGauge
                    topNote={isBelowFmrHighIncrease ? (
                      <div className="rounded-lg border border-blue-200 bg-blue-50/50 dark:border-blue-900/50 dark:bg-blue-950/20 p-3">
                        <div className="flex gap-2.5">
                          <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-[12px] font-medium text-foreground mb-0.5">Important context about your rent</p>
                            <p className="text-[11px] text-muted-foreground leading-relaxed">
                              Your rent is currently below the area median for similar units. However, area medians include units of all conditions and amenity levels, including renovated units and buildings with more amenities. A lower rent may already reflect fair value for your specific unit. Regardless, a {increasePct}% increase is significantly above the local rent trend of {marketYoy}%, which gives you room to negotiate the rate of increase.
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : undefined}
                    score={fairnessScore}
                    componentSources={sources}
                    contextNotes={
                      <>
                        {fairnessScore?.extremeIncreaseCeilingApplied && (
                          <div className="rounded-lg border border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20 p-3">
                            <div className="flex gap-2.5">
                              <Info className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                              <p className="text-[11px] text-muted-foreground leading-relaxed">
                                <span className="font-medium text-foreground">Why this score was adjusted:</span> Even though your proposed rent is still below market, the size of the increase itself is unusually aggressive relative to local trends.
                              </p>
                            </div>
                          </div>
                        )}
                        {compOverpayment && fairnessScore && fairnessScore.total >= 60 && (
                          <div className="rounded-lg border border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20 p-3">
                            <div className="flex gap-2.5">
                              <Info className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                              <p className="text-[11px] text-muted-foreground leading-relaxed">
                                <span className="font-medium text-foreground">Your increase tracks the {marketYoy > 0 ? '+' : ''}{marketYoy}% area trend</span>, but your proposed rent of ${fmt(newRent)} is ${fmt(compOverpayment.dollarOver)}/mo above the median for similar {bedroomLabels[formData.bedrooms].toLowerCase()}s nearby (${fmt(medianCompRent!)} based on {compOverpayment.compCount} comparable listings). Your unit may justify a premium, but it's worth knowing where you stand.
                              </p>
                            </div>
                          </div>
                        )}
                        {rentControlCap && hasIncrease && rentControlCap.maxIncreaseFormula && buildingEligibility !== 'ineligible' && (
                          (() => {
                            const approxPrefix = rentControlCap.isFormulaCap ? 'approximately ' : '';
                            const likelyWord = rentControlCap.isFormulaCap ? ' likely' : '';
                            const softNote = buildingEligibility === 'unknown' && !propertyData
                              ? ` Enter your full address to check if your building qualifies.`
                              : buildingEligibility === 'unknown'
                              ? ` This may apply depending on your building's age and size.`
                              : '';

                            if (rentControlCap.maxIncreasePct != null && increasePct > rentControlCap.maxIncreasePct) {
                              return (
                                <p className="text-[12px] font-medium text-destructive">
                                  ⚠️ {rentControlCap.jurisdiction} limits annual rent increases to {approxPrefix}{rentControlCap.maxIncreasePct}%. Your increase of {increasePct}%{likelyWord} exceeds this limit.{softNote}
                                </p>
                              );
                            } else if (rentControlCap.maxIncreasePct != null) {
                              return (
                                <p className="text-[11px] text-muted-foreground">
                                  {rentControlCap.jurisdiction} limits annual rent increases to {approxPrefix}{rentControlCap.maxIncreasePct}%. Your increase of {increasePct}% is within this limit.{softNote}
                                </p>
                              );
                            } else {
                              return (
                                <p className="text-[11px] text-muted-foreground">
                                  {rentControlCap.jurisdiction} has rent control laws that may apply to your building depending on its age and size.
                                </p>
                              );
                            }
                          })()
                        )}
                        {isAboveMarket && brokerFee.brokerFeeMarket && hasIncrease && (
                          <p className="text-[11px] text-muted-foreground">
                            Keep in mind: moving in {brokerFee.brokerFeeCity} typically involves a broker fee of ~${fmt(Math.round(formData.currentRent))}. Factor this into your stay-vs-move decision.
                          </p>
                        )}
                        {isAboveMarket && hasIncrease && brokerFee.brokerFeeCity === 'NYC' && !brokerFee.brokerFeeMarket && (
                          <p className="text-[11px] text-muted-foreground">
                            NYC's FARE Act eliminated most tenant-paid broker fees in 2025. If your landlord won't negotiate, moving is more affordable than it used to be.
                          </p>
                        )}
                      </>
                    }
                    dynamicMessage={
                      <div className="space-y-2">
                        <h1
                          className="font-display text-[1.35rem] sm:text-[clamp(1.5rem,4.5vw,2.2rem)] text-foreground leading-[1.15] tracking-tight text-balance"
                          style={{ letterSpacing: '-0.02em' }}
                        >
                          {isAboveMarket && calc ? (
                            <>Your rent increase is <span className="text-destructive">above market.</span></>
                          ) : isFair ? (
                            isNuancedAtMarket || (increasePct > marketYoy + 1.5 && medianCompRent && newRent <= medianCompRent) ? (
                              <>Your rent is <span className="text-verdict-fair">still at market.</span></>
                            ) : isCompDeficient ? (
                              <>Your increase <span className="text-verdict-fair">tracks the area trend.</span></>
                            ) : (
                              <>Your rent increase is <span className="text-verdict-fair">right at market.</span></>
                            )
                          ) : increasePct > 0 ? (
                            <>{isCompDeficient
                              ? <>Your increase is <span className="text-verdict-fair">in line with trends.</span></>
                              : <>Your rent increase is <span className="text-verdict-good">below market.</span></>
                            }</>
                          ) : (
                            <>Good news — <span className="text-verdict-good">your rent isn't going up.</span></>
                          )}
                        </h1>
                        <p className="text-sm sm:text-base md:text-lg text-muted-foreground leading-relaxed">
                          {isAboveMarket && calc ? (
                            counterExceedsProposed
                              ? <>Based on market data, your proposed rent may be more reasonable than the increase rate suggests.</>
                              : bldg.hasBuildingData && bldg.buildingComps.length >= 3 ? (
                                isUnlocked
                                  ? <>Other units in your building rent for ${fmt(bldg.buildingLow)}{bldg.buildingLow !== bldg.buildingHigh ? `–$${fmt(bldg.buildingHigh)}` : ''}/month. At ${fmt(newRent)}/mo, your rent is {newRent > bldg.buildingHigh ? 'above' : 'at the top of'} this range.</>
                                  : <>Comparable units near you rent for less than your proposed price.</>
                              ) : isUnlocked
                                ? <>Rents moved {marketYoy}%. Your landlord wants {increasePct}%. That's ${fmt(increaseAmount * 12)} more per year.</>
                                : <>Rents moved {marketYoy}%. Your landlord wants {increasePct}%.</>
                          ) : isFair ? (
                            isCompDeficient ? (
                              <>At ${fmt(newRent)}/mo with a {increasePct}% increase, your rate of increase tracks the {marketYoy}% area trend for {brLabel} rentals in {city}.</>
                            ) : isNuancedAtMarket || increasePct > marketYoy + 1.5 ? (
                              medianCompRent ? (
                                isUnlocked
                                  ? <>Your {increasePct}% increase is above the {marketYoy}% area trend, but at ${fmt(newRent)}/mo you're {newRent <= medianCompRent ? `still below the $${fmt(medianCompRent)} local median` : `within range for ${brLabel} rentals in ${city}`}.</>
                                  : <>Your {increasePct}% increase is above the {marketYoy}% area trend, but at ${fmt(newRent)}/mo you're still within range for {brLabel} rentals in {city}.</>
                              ) : (
                                <>Your {increasePct}% increase is above the {marketYoy}% area trend, but at ${fmt(newRent)}/mo you're still within the typical range for {brLabel} rentals in {city}.</>
                              )
                            ) : (
                              <>At ${fmt(newRent)}/mo, your {increasePct}% increase tracks the {marketYoy}% area trend for {brLabel} rentals in {city}.</>
                            )
                          ) : increasePct > 0 ? (
                            isCompDeficient
                              ? <>At ${fmt(newRent)}/mo with a {increasePct}% increase, your rate of increase is below the {marketYoy}% area trend for {brLabel} rentals in {city}.</>
                              : <>At ${fmt(newRent)}/mo, your rent is below the local market average for {brLabel} rentals in {city}. Even with a {increasePct}% increase, you're getting a competitive deal.</>
                          ) : (
                            <>Rents in {city} moved {marketYoy}% this year. Your landlord keeping your rent at ${fmt(formData.currentRent)}/mo means you're coming out ahead.</>
                          )}
                        </p>
                        {!isUnlocked && isAboveMarket && Math.abs(increasePct - marketYoy) < 2 && (
                          <p className="text-sm text-muted-foreground mt-2">
                            Even if your increase matches area trends, your starting rent may already be above comparable units.
                          </p>
                        )}
                        {isAboveMarket && bldg.hasBuildingData && bldg.buildingComps.length >= 3 && calc && !counterExceedsProposed && (
                          <p className="text-xs text-muted-foreground/70 mt-1">
                            Area rents moved {marketYoy}% this year.
                          </p>
                        )}
                        {isUnlocked && isNycZip(rentData.zip) && hasIncrease && (
                          <p className="text-xs text-muted-foreground/70 mt-2">
                            Live in a rent-stabilized apartment? Your increase may be legally capped.{' '}
                            <button
                              onClick={() => document.getElementById('section-rights')?.scrollIntoView({ behavior: 'smooth' })}
                              className="underline hover:text-muted-foreground transition-colors"
                            >
                              check your rights below
                            </button>.
                          </p>
                        )}
                        {rentcast.data?.detectedBedrooms != null && rentcast.data.detectedBedrooms !== bedroomNum && (
                          <p className="text-[11px] text-muted-foreground/60 mt-2 italic">
                            Our data suggests this may be a {rentcast.data.detectedBedrooms === 0 ? 'studio' : `${rentcast.data.detectedBedrooms}-bedroom`} unit. Results are based on your selection.
                          </p>
                        )}
                      </div>
                    }
                  />
                  </div>
                );
              })()}




              {/* ── Stat dashboard strip ── */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className={`mt-2 sm:mt-4 w-full grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 max-w-[540px] ${!isUnlocked ? 'order-[4] md:order-none' : ''}`}
              >
                {!isUnlocked && (
                  <p className="md:hidden col-span-2 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground text-center mb-1">
                    Your full report
                  </p>
                )}
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
                      className={`text-center rounded-lg border px-2 sm:px-3 py-2.5 sm:py-4 flex flex-col items-center min-h-[68px] sm:min-h-[84px] ${stat.highlight ? 'border-destructive/30 bg-destructive/5' : 'border-border/60 sm:border-border/80 bg-card'}`}
                      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
                    >
                      <p className="text-[9px] sm:text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1 min-h-[24px] flex items-end">{stat.label}</p>
                      <p className={`font-display text-[20px] sm:text-[24px] md:text-[28px] tracking-tight tabular-nums mt-auto ${stat.color}`} style={{ letterSpacing: '-0.02em', lineHeight: 1 }}>
                        {stat.value}
                      </p>
                      <span className="block h-[14px] shrink-0" />
                    </div>
                ))}
              </motion.div>




               {isUnlocked && compsWithRent.length > 0 && (
                <div className="sm:hidden flex flex-col items-center justify-center mt-3 mx-2 py-2.5 px-4 rounded-lg border border-primary/15 bg-primary/5 text-center">
                  <span className="text-sm font-medium text-foreground">{compsWithRent.length} matched comps support your result</span>
                  <span className="text-sm font-semibold text-primary mt-0.5">Your negotiation letter is ready ↓</span>
                  <span className="text-xs text-muted-foreground mt-0.5">Full comps, counter-offer guidance, and market data below.</span>
                </div>
              )}


              {/* ── Email gate (moved from Phase 2) ── */}
               {!isUnlocked && (
                <section id="section-gate" className="py-3 sm:py-8">
                  <ReportGate
                    toolType="renewal"
                    compsCount={compsWithRent.length}
                    verdictLabel={verdictLabel}
                    isHighPain={isHighPain}
                    verdict={isAboveMarket ? 'above' : isFair ? 'at-market' : isBelowMarket ? 'below' : 'none'}
                    leadContext={leadContext}
                    analysisId={analysisId}
                    zip={rentData.zip}
                    city={city}
                    onEmailCaptured={setCapturedEmail}
                    prefilledEmail={capturedEmail}
                    shareReportPayload={shareReportPayload}
                    onReportGenerated={(url) => { setReportUrl(url); }}
                    marketYoy={marketYoy}
                    monthlyOverpayment={
                      isAboveMarket && counterOffer && !counterExceedsProposed
                        ? Math.max(0, Math.round(newRent - counterOffer.counterLow))
                        : null
                    }
                    belowFmrHighIncrease={isBelowFmrHighIncrease}
                    increasePct={increasePct}
                  />
                </section>
              )}

              {/* Blurred skeleton preview below gate */}
               {!isUnlocked && (
                <div className="mt-4 w-full max-w-[540px] mx-auto relative order-[5] md:order-none" aria-hidden="true">
                  <div className="rounded-lg border border-border/60 bg-card p-4 space-y-3" style={{ filter: 'blur(5px)', userSelect: 'none', pointerEvents: 'none' }}>
                    <div className="flex justify-between items-center py-2 border-b border-border/40">
                      <div className="flex flex-col gap-1">
                        <div className="h-3.5 w-40 bg-muted-foreground/20 rounded" />
                        <div className="h-3 w-24 bg-muted-foreground/10 rounded" />
                      </div>
                      <div className="h-4 w-20 bg-muted-foreground/20 rounded" />
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-border/40">
                      <div className="flex flex-col gap-1">
                        <div className="h-3.5 w-36 bg-muted-foreground/20 rounded" />
                        <div className="h-3 w-28 bg-muted-foreground/10 rounded" />
                      </div>
                      <div className="h-4 w-20 bg-muted-foreground/20 rounded" />
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <div className="flex flex-col gap-1">
                        <div className="h-3.5 w-44 bg-muted-foreground/20 rounded" />
                        <div className="h-3 w-20 bg-muted-foreground/10 rounded" />
                      </div>
                      <div className="h-4 w-20 bg-muted-foreground/20 rounded" />
                    </div>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-semibold text-muted-foreground bg-background/80 px-4 py-2 rounded-full border border-border/60">
                      Enter your email above to unlock
                    </span>
                  </div>
                </div>
              )}

               <div className={`mt-4 flex flex-col items-center gap-2 ${!isUnlocked ? 'order-[6] md:order-none' : ''}`}>
                <button onClick={onReset} className="text-xs text-muted-foreground/50 md:text-muted-foreground hover:text-foreground transition-colors">
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

              <div className={`mt-6 w-full grid grid-cols-2 gap-3 max-w-[400px] ${!isUnlocked ? 'order-[4] md:order-none' : ''}`}>
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

              <p className={`text-[13px] text-muted-foreground/70 mt-4 max-w-[440px] leading-relaxed ${!isUnlocked ? 'order-[4] md:order-none' : ''}`}>
                {marketYoy > 3
                  ? `Rents in ${city} went up ${marketYoy}% this year. Staying flat is a win. Scroll down to see the full market data.`
                  : marketYoy > 0
                  ? `Rents in ${city} are up ${marketYoy}% this year. Your landlord keeping your rent flat means you're getting a better deal over time.`
                  : `Rents in ${city} are ${marketYoy < 0 ? `down ${Math.abs(marketYoy)}%` : 'flat'} this year. Your rent is holding steady with the market.`
                }
              </p>



              {isUnlocked && compsWithRent.length > 0 && (
                <div className="sm:hidden flex flex-col items-center justify-center mt-3 mx-2 py-2.5 px-4 rounded-lg border border-primary/15 bg-primary/5 text-center">
                  <span className="text-sm font-medium text-foreground">{compsWithRent.length} matched comps support your result</span>
                  <span className="text-sm font-semibold text-primary mt-0.5">Your negotiation letter is ready ↓</span>
                  <span className="text-xs text-muted-foreground mt-0.5">Full comps, counter-offer guidance, and market data below.</span>
                </div>
              )}


              {/* ── Email gate (no-increase path) ── */}
              {!isUnlocked && (
                <section id="section-gate" className="py-8">
                  <ReportGate
                    toolType="renewal"
                    compsCount={compsWithRent.length}
                    verdictLabel={verdictLabel}
                    isHighPain={false}
                    verdict="none"
                    leadContext={leadContext}
                    analysisId={analysisId}
                    zip={rentData.zip}
                    city={city}
                    onEmailCaptured={setCapturedEmail}
                    prefilledEmail={capturedEmail}
                    shareReportPayload={shareReportPayload}
                    onReportGenerated={(url) => { setReportUrl(url); }}
                    marketYoy={marketYoy}
                  />

                  {/* Blurred skeleton preview below gate */}
                  <div className="mt-4 w-full max-w-[540px] mx-auto relative" aria-hidden="true">
                    <div className="rounded-lg border border-border/60 bg-card p-4 space-y-3" style={{ filter: 'blur(5px)', userSelect: 'none', pointerEvents: 'none' }}>
                      <div className="flex justify-between items-center py-2 border-b border-border/40">
                        <div className="flex flex-col gap-1">
                          <div className="h-3.5 w-40 bg-muted-foreground/20 rounded" />
                          <div className="h-3 w-24 bg-muted-foreground/10 rounded" />
                        </div>
                        <div className="h-4 w-20 bg-muted-foreground/20 rounded" />
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-border/40">
                        <div className="flex flex-col gap-1">
                          <div className="h-3.5 w-36 bg-muted-foreground/20 rounded" />
                          <div className="h-3 w-28 bg-muted-foreground/10 rounded" />
                        </div>
                        <div className="h-4 w-20 bg-muted-foreground/20 rounded" />
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <div className="flex flex-col gap-1">
                          <div className="h-3.5 w-44 bg-muted-foreground/20 rounded" />
                          <div className="h-3 w-20 bg-muted-foreground/10 rounded" />
                        </div>
                        <div className="h-4 w-20 bg-muted-foreground/20 rounded" />
                      </div>
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-sm font-semibold text-muted-foreground bg-background/80 px-4 py-2 rounded-full border border-border/60">
                        Enter your email above to unlock
                      </span>
                    </div>
                  </div>
                </section>
              )}

              <div className={`mt-4 flex flex-col items-center gap-2 ${!isUnlocked ? 'order-[6] md:order-none' : ''}`}>
                <button onClick={onReset} className="text-xs text-muted-foreground/50 md:text-muted-foreground hover:text-foreground transition-colors">
                  ← Check a different address
                </button>
              </div>
            </>
          )}
        </motion.section>
        </div>
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           PHASE 3: EVERYTHING UNLOCKED (after email)
         ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="w-full bg-card">
        <div className="max-w-[620px] mx-auto px-5 sm:px-6">
        {isUnlocked && (
          <>
            {/* Action Insight removed — verdict callout is now at end of evidence section */}

            {/* ━━━ EVIDENCE SECTION ━━━ */}
            <section id="section-evidence" className="pt-6 sm:pt-10 pb-4 sm:pb-8">
              <motion.h2 {...fade(0.05)} className="results-section-header mb-6">
                {hasIncrease ? 'The Evidence' : 'What the Market Says'}
              </motion.h2>




              <div className="space-y-6">
                {/* Property Profile Card */}
                {propertyData && (
                  <motion.div {...fade(0.06)} className="evidence-card">
                    <h3 className="evidence-card-header">Your Landlord's Property</h3>
                    <p className="text-sm text-muted-foreground">
                      {formData.fullAddress}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {propertyData.propertyType && `${propertyData.propertyType}`}
                      {propertyData.yearBuilt && ` · Built ${propertyData.yearBuilt}`}
                      {propertyData.bedrooms && ` · ${propertyData.bedrooms} bed`}
                      {propertyData.bathrooms && ` / ${propertyData.bathrooms} bath`}
                      {propertyData.squareFootage && ` · ${propertyData.squareFootage.toLocaleString()} sqft`}
                    </p>
                    {propertyData.lastSalePrice && propertyData.lastSaleDate && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Purchased {new Date(propertyData.lastSaleDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} for ${propertyData.lastSalePrice.toLocaleString()}
                      </p>
                    )}
                  </motion.div>
                )}

                {/* Card A: Market Context */}
                <motion.div {...fade(0.08)} className="evidence-card">
                  <h3 className="evidence-card-header">What the Market Says</h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    {city}, {rentData.state} · {bedroomLabels[formData.bedrooms]}
                    {rentcast.data?.propertyType && <> · {rentcast.data.propertyType}</>}
                  </p>
                  {utilityNote && (
                    <p className="text-sm text-muted-foreground mb-4 flex items-start gap-1.5">
                      <span className="shrink-0 mt-0.5">ℹ️</span>
                      {utilityNote}
                    </p>
                  )}

                  <div className={`context-row ${rowIdx++ % 2 === 0 ? 'context-row-even' : 'context-row-odd'}`}>
                    <span className="context-label">{city} rents this year</span>
                    <span className="context-value">
                      {marketYoy > 0 ? '+' : ''}{marketYoy}%
                      {rentData.yoyCapped && <span className="context-sub"> (capped)</span>}
                      <span className="context-sub"> ({compositeTrendResult.sourceCount >= 2 ? 'composite: ' + compositeTrendResult.sources.map(s => s.label).join(', ') : compositeTrendResult.primarySource})</span>
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
                        ${fmt(formData.currentRent)} · {
                          formData.currentRent < calc.typicalRangeLow
                            ? 'below this range'
                            : formData.currentRent > calc.typicalRangeHigh
                            ? 'above this range'
                            : 'within this range'
                        }
                      </span>
                    </div>
                  )}
                  {isAboveMarket && counterOffer && !counterExceedsProposed && (
                    <>
                      <div className="context-row-highlight mt-2">
                        <span className="context-label">Fair counter-offer</span>
                        <span className="context-value text-verdict-good font-bold">
                          {counterOffer.counterLow === counterOffer.counterHigh
                            ? `$${fmt(counterOffer.counterLow)}/mo`
                            : `$${fmt(counterOffer.counterLow)}–$${fmt(counterOffer.counterHigh)}/mo`}
                        </span>
                      </div>
                      {medianCompRent && counterOffer.counterLow > medianCompRent && (
                        <div className="mt-2 px-3 py-2 rounded-md bg-accent/50 border border-border/50">
                          <p className="text-[11px] text-muted-foreground leading-relaxed">
                            Note: Your counter range (${fmt(counterOffer.counterLow)}–${fmt(counterOffer.counterHigh)}) is above the area median of ${fmt(medianCompRent)} for similar units. You may have additional negotiating room.
                          </p>
                        </div>
                      )}
                    </>
                  )}
                  {isAboveMarket && counterExceedsProposed && (
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
                      HUD benchmark estimate. Actual market trends may differ.
                    </p>
                  )}
                  {rentData.yoySource === 'hud' && rentData.priorSource === 'm' && (
                    <p className="text-[11px] text-muted-foreground mt-1">Based on {rentData.metro} area average trend.</p>
                  )}
                  {rentData.yoySource === 'hud' && rentData.priorSource === 'n' && (
                    <p className="text-[11px] text-muted-foreground mt-1">Note: This uses the national rent trend because local data is limited for this area.</p>
                  )}
                  {bldg.hasBuildingData && (
                    <p className="text-sm text-muted-foreground mt-3 flex items-start gap-1.5">
                      <span className="shrink-0 mt-0.5">🏢</span>
                      Other {bldg.bedroomFilterLabel ? `${bldg.bedroomFilterLabel} ` : ''}units in this building rent for ${fmt(bldg.buildingLow)}
                      {bldg.buildingLow !== bldg.buildingHigh && ` – $${fmt(bldg.buildingHigh)}`}/month
                    </p>
                  )}
                </motion.div>

                {/* Market Snapshot */}
                {hasIncrease && (
                  <MarketSnapshot
                    rcTotalListings={rcMarket.rcTotalListings}
                    rcNewListings={rcMarket.rcNewListings}
                    rcAvgDaysOnMarket={rcMarket.rcAvgDaysOnMarket}
                    alVacancy={rentData.alVacancy}
                  />
                )}

                {/* Counteroffer CTA — end of evidence */}
                {hasIncrease && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.4 }}
                    className={`mt-6 w-full border-l-4 pl-4 py-3 rounded-r-md ${
                      isAboveMarket
                        ? 'border-destructive/60 bg-destructive/5'
                        : isBelowMarket
                        ? 'border-verdict-good/60 bg-verdict-good/5'
                        : 'border-blue-400/60 bg-blue-50/50 dark:bg-blue-950/20'
                    }`}
                  >
                    <p className="text-base font-medium text-foreground leading-relaxed">
                      {isAboveMarket
                        ? 'Your counteroffer is ready. Scroll down for your negotiation letter.'
                        : isBelowMarket
                        ? "Your rent is below market, but you can still negotiate for value. See your options below."
                        : 'Renters who negotiate with data save an average of $1,200/year. Your letter is ready below.'}
                    </p>
                  </motion.div>
                )}
              </div>
            </section>

            {/* ━━━ Soft email capture — post-evidence (when gate is off and email not yet captured) ━━━ */}
            {!EMAIL_GATE_ENABLED && !capturedEmail && (
              <EmailReportPrompt
                analysisId={analysisId}
                leadContext={leadContext}
                verdictLabel={verdictLabel}
                zip={rentData.zip}
                city={city}
                onEmailCaptured={setCapturedEmail}
                toolType="renewal"
                shareReportPayload={shareReportPayload}
                onReportGenerated={(url) => { setReportUrl(url); }}
                placement="post_evidence"
              />
            )}

            {hasIncrease && medianCompRent && hasEnoughComps && (
              <motion.section id="section-comps" {...fade(0.15)} className="py-6 sm:py-12 -mx-2 px-2 rounded-2xl" style={{ background: 'hsl(var(--comps-bg))' }}>
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

                {utilityNote && (
                  <p className="text-xs text-muted-foreground mb-4 px-4 flex items-start gap-1.5">
                    <span className="shrink-0 mt-0.5">ℹ️</span>
                    {utilityNote}
                  </p>
                )}

                <CompsList
                  proposedRent={newRent}
                  comparables={allComps}
                  furnishedComps={furnishedComps}
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
                  gated={false}
                />

                {/* Outlier notice */}
                {outlierResult && outlierResult.outliers.length > 0 && (
                  <div className="mt-4 space-y-1">
                    {outlierResult.outliers.map((comp, i) => (
                      <div key={`outlier-${i}`} className="flex items-start justify-between gap-4 px-4 py-2 rounded-md opacity-50">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-muted-foreground truncate">{comp.formattedAddress}</p>
                          <p className="text-[10px] text-muted-foreground/60">
                            Excluded from analysis: {comp.rent !== null && medianCompRent && comp.rent > medianCompRent ? 'significantly above' : 'significantly below'} local median
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

            {/* ━━━ Universal rent reporting CTA ━━━ */}
            {isUnlocked && (
              <section className="py-3 sm:py-4">
                <PartnerCTA
                  variant="rent_reporting"
                  analysisId={analysisId}
                  verdict={verdictLabel}
                  toolUsed="renewal"
                  city={city}
                  zip={rentData.zip}
                  placement="post_comps_universal"
                />
              </section>
            )}

            {hasIncrease && (
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
                listings={rentcastListings.data?.listings ?? []}
                listingsLoading={rentcastListings.loading}
                compAddresses={compsWithRent.map(c => c.formattedAddress)}
              />
            )}

            {/* ━━━ Intent Fork — data collection only (fair/below-market path) ━━━ */}
            {hasIncrease && !isAboveMarket && isUnlocked && (
              <section className="pt-6 pb-4">
                <IntentFork
                  analysisId={analysisId}
                  verdict={verdictLabel}
                  toolUsed="renewal"
                  city={city}
                  zip={rentData.zip}
                  placement="post_verdict"
                  selectedIntent={selectedIntent}
                  onIntentSelected={setSelectedIntent}
                />
              </section>
            )}

            {/* ━━━ Know Your Rights (accordion) ━━━ */}
            {hasRentControl && (
              <motion.section id="section-rights" {...fade(0.17)} className="pt-8 pb-4">
                <Accordion type="single" collapsible>
                  <AccordionItem value="rights" className="border-none">
                    <AccordionTrigger className="hover:no-underline py-3 px-4 rounded-lg border border-border bg-card">
                      <div className="flex items-center gap-2 text-left">
                        <span className="text-base">⚖️</span>
                        <span className="text-[13px] font-semibold text-foreground">
                          Your area has rent regulations that may apply
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-3 pb-0">
                      <div className="evidence-card">
                        <RentControlCard
                          state={rentData.state}
                          city={rentData.city}
                          zip={rentData.zip}
                          increasePct={increasePct}
                          address={formData.fullAddress}
                        />
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </motion.section>
            )}

            {/* ━━━ NEGOTIATION LETTER — fully visible ━━━ */}
            {hasIncrease && calc && (isAboveMarket || isFair || isBelowMarket) && (
              <motion.section id="section-letter" {...fade(0.19)} className="pt-8 pb-8">
                {isFair && !isAboveMarket && !isBelowMarket && (
                  <p className="text-sm text-muted-foreground mb-4 text-center max-w-[480px] mx-auto">
                    Even a fair increase is worth negotiating. Landlords expect it, and avoiding turnover is worth more to them than $50-100/month.
                  </p>
                )}
                {isBelowMarket && (
                  <p className="text-sm text-muted-foreground mb-4 text-center max-w-[480px] mx-auto">
                    Your landlord is offering below-market terms. That's leverage. Here's how to lock in this rate or negotiate extras like a longer lease, a unit upgrade, or a repair you've been waiting on.
                  </p>
                )}
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
                  counterLow={counterOffer?.counterLow ?? 0}
                  counterHigh={counterOffer?.counterHigh ?? 0}
                  counterLowPercent={counterOffer?.counterLowPercent ?? 0}
                  counterHighPercent={counterOffer?.counterHighPercent ?? 0}
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
                  letterTone={isAboveMarket ? 'aggressive' : (isBelowFmrHighIncrease ? 'aggressive' : isFair ? 'collaborative' : 'strategic')}
                  onLetterGenerated={handleLetterGenerated}
                  comparables={rentcast.data?.comparables}
                  belowFmrHighIncrease={isBelowFmrHighIncrease}
                />
              </motion.section>
            )}

            {/* ━━━ Soft email capture — post-letter (when gate is off, email not yet captured, and has letter) ━━━ */}
            {!EMAIL_GATE_ENABLED && !capturedEmail && hasIncrease && (
              <EmailReportPrompt
                analysisId={analysisId}
                leadContext={leadContext}
                verdictLabel={verdictLabel}
                zip={rentData.zip}
                city={city}
                onEmailCaptured={setCapturedEmail}
                toolType="renewal"
                shareReportPayload={shareReportPayload}
                onReportGenerated={(url) => { setReportUrl(url); }}
                placement="post_letter"
              />
            )}

            {/* ━━━ Moving help CTA (above-market, after listings) ━━━ */}
            {hasIncrease && isAboveMarket && isUnlocked && (
              <section className="py-4 space-y-3">
                <PartnerCTA
                  variant="moving_help"
                  analysisId={analysisId}
                  verdict={verdictLabel}
                  toolUsed="renewal"
                  city={city}
                  zip={rentData.zip}
                  placement="post_listings"
                />
                {(() => {
                  const matchedCity = DEAL_CITIES.find(c => c.zips.includes(rentData.zip));
                  const dealsHref = matchedCity ? `/deals/${matchedCity.slug}` : '/deals';
                  const dealsLabel = matchedCity
                    ? `Browse more apartments in ${matchedCity.neighborhood || matchedCity.name} →`
                    : 'Browse more apartments in your area →';
                  return (
                    <div className="text-center">
                      <Link
                        to={dealsHref}
                        onClick={() => trackEvent('internal_click', { link_type: 'browse_deals', city, zip: rentData.zip, placement: 'post_listings' })}
                        className="text-xs text-primary hover:underline font-medium"
                      >
                        {dealsLabel}
                      </Link>
                    </div>
                  );
                })()}
              </section>
            )}

            {/* ━━━ Intent Fork — data collection only (above-market path) ━━━ */}
            {hasIncrease && isAboveMarket && isUnlocked && (
              <section className="pt-6 pb-4">
                <IntentFork
                  analysisId={analysisId}
                  verdict={verdictLabel}
                  toolUsed="renewal"
                  city={city}
                  zip={rentData.zip}
                  placement="post_letter"
                  selectedIntent={selectedIntent}
                  onIntentSelected={setSelectedIntent}
                />
              </section>
            )}




            {/* ━━━ Lease reminder — universal, utility-first ━━━ */}
            {isUnlocked && (
              <section className="pb-4 pt-2">
                {capturedEmail ? (
                  <PostConversionFlow
                    email={capturedEmail}
                    leadContext={leadContext}
                    verdictLabel={verdictLabel}
                    zip={rentData.zip}
                  />
                ) : (
                  <LeaseReminderCapture
                    leadContext={leadContext}
                    verdictLabel={verdictLabel}
                    zip={rentData.zip}
                    city={city}
                    onEmailCaptured={setCapturedEmail}
                    toolType="renewal"
                  />
                )}
              </section>
            )}

            <p className="text-[11px] text-muted-foreground/60 text-center mb-2">
              See something that doesn't look right?{' '}
              <a href="mailto:james@renewalreply.com?subject=Data%20issue%20report&body=Address%3A%20%0AZip%3A%20%0AWhat%20looks%20wrong%3A%20" className="underline hover:text-muted-foreground transition-colors">
                Report a data issue
              </a>
            </p>

            {/* ━━━ Feedback widget ━━━ */}
            <FeedbackWidget
              analysisId={analysisId}
              page="renewal_results"
              verdictSnapshot={verdictLabel}
              scoreSnapshot={fairnessScore?.total ?? null}
              confidenceSnapshot={effectiveConfidence.level}
            />

            {/* ━━━ Data Confidence + Disclaimer ━━━ */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="pt-4 pb-2"
            >
              <DataConfidenceBadge level={effectiveConfidence.level} note={effectiveConfidence.note} />
              <p className="text-[11px] text-muted-foreground/60 mt-2 text-center leading-relaxed">
                This analysis is for informational purposes only and does not constitute legal, financial, or real estate advice.{' '}
                <Link to="/methodology" className="underline hover:text-muted-foreground transition-colors">See methodology</Link>
              </p>
            </motion.div>

            {/* ━━━ Share ━━━ */}
            <motion.section id="section-share" {...fade(0.23)} className="pt-4 pb-10">
              <h2 className="results-section-header mb-6">
                {isAboveMarket ? 'Share Your Analysis' : 'Share This Tool'}
              </h2>
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
                  increasePct={hasIncrease ? increasePct : 0}
                  marketYoy={marketYoy}
                  verdict={isAboveMarket ? 'above' : isFair ? 'fair' : isBelowMarket ? 'below' : 'none'}
                  headline={
                    isAboveMarket && isPath1
                      ? `My landlord is asking for $${fmt(newRent - (counterOffer?.counterHigh ?? 0))}/mo more than the market supports.`
                      : isAboveMarket
                      ? `Rents near me moved ${marketYoy}% but my landlord wants ${increasePct}%.`
                      : isFair
                      ? `My rent increase is right at market.`
                      : isBelowMarket
                      ? `My rent is below market, even with a ${increasePct}% increase.`
                      : `My rent isn't going up — and rents in ${city} moved ${marketYoy}%.`
                  }
                  stats={
                    hasIncrease
                      ? [
                          { label: 'Current rent', value: `$${fmt(formData.currentRent)}` },
                          { label: 'Proposed rent', value: `$${fmt(newRent)}`, color: isAboveMarket ? 'hsl(0, 72%, 51%)' : isBelowMarket ? 'hsl(151, 50%, 38%)' : undefined },
                          { label: 'Area trend', value: `${marketYoy > 0 ? '+' : ''}${marketYoy}%` },
                          { label: 'Your increase', value: `${increasePct}%`, color: isAboveMarket ? 'hsl(0, 72%, 51%)' : isFair ? 'hsl(45, 80%, 45%)' : 'hsl(151, 50%, 38%)' },
                        ]
                      : [
                          { label: 'Current rent', value: `$${fmt(formData.currentRent)}` },
                          { label: 'Area trend', value: `${marketYoy > 0 ? '+' : ''}${marketYoy}%` },
                        ]
                  }
                />
              </div>
            </motion.section>

            {/* ━━━ Related Guides ━━━ */}
            <motion.section {...fade(0.24)} className="pt-2 pb-6">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 text-center">Related Guides</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Link to="/guides/how-to-negotiate-rent-increase" className="rounded-lg border border-border bg-card p-4 hover:border-primary/30 transition-colors">
                  <p className="text-[13px] font-semibold text-foreground">How to Negotiate a Rent Increase</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Counter-offer math, email template, and scripts</p>
                </Link>
                <Link to="/guides/rent-increase-laws-by-state" className="rounded-lg border border-border bg-card p-4 hover:border-primary/30 transition-colors">
                  <p className="text-[13px] font-semibold text-foreground">Rent Increase Laws by State</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Caps, notice periods, and your rights</p>
                </Link>
              </div>
            </motion.section>

            {/* Cross-link to WSIP */}
            {isAboveMarket && (
              <motion.div {...fade(0.25)} className="pb-6 text-center">
                <p className="text-sm text-muted-foreground mb-1">Thinking about moving?</p>
                <Link
                  to="/what-should-i-pay"
                  className="text-sm text-primary font-semibold hover:underline"
                >
                  Check what you'd pay somewhere else →
                </Link>
              </motion.div>
            )}
          </>
        )}

        </div>
      </div>
    </>
  );
};

export default RentResults;
