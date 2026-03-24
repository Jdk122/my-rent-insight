import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Copy, Check } from 'lucide-react';
import { RentLookupResult, bedroomLabels, BedroomType } from '@/data/rentData';
import { useRentcast } from '@/hooks/useRentcast';
import { useRentcastMarket } from '@/hooks/useRentcastMarket';
import { PropertyLookupResult } from '@/hooks/usePropertyLookup';
import { supabase } from '@/integrations/supabase/client';
import { trackEvent, trackAdsConversion } from '@/lib/analytics';
import { getUtmParams } from '@/lib/utm';
import { getSessionId } from '@/lib/sessionId';
import { checkAnalysisDedup } from '@/lib/analysisDedup';
import { assessConfidence, detectOutliers, getCompRadius, filterFurnished, deduplicateComps, applySeasonalAdjustment } from '@/lib/dataQuality';
import { calculateCompositeTrend } from '@/lib/compositeTrend';
import { getRentControlByStateCity, getApplicableCap, checkBuildingEligibility } from '@/data/rentControlData';
import { getUtilityNote } from '@/lib/contextualFlags';
import { calculateFairRange } from '@/lib/fairRange';
import { tierComps, getTierWeights } from '@/lib/compTiering';
import { getBuildingRange } from '@/lib/buildingRange';
import DataConfidenceBadge from './DataConfidenceBadge';
import SectionNav from './SectionNav';
import ExitIntentModal from './ExitIntentModal';
import MobileScrollPrompt from './MobileScrollPrompt';
import SocialProofLine from './SocialProofLine';
import ShareHub from './ShareHub';
import WsipCompsList from './WsipCompsList';
import ReportGate from './ReportGate';
import PreGateCompPreview from './PreGateCompPreview';
import FeedbackWidget from './FeedbackWidget';
import type { LeadContext } from './EmailCapture';

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

const fade = (delay: number) => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] as const },
});

interface WsipResultsProps {
  zip: string;
  fullAddress: string | null;
  bedrooms: BedroomType;
  askingRent: number | null;
  rentData: RentLookupResult;
  propertyData: PropertyLookupResult | null;
  capturedEmail: string;
  onEmailCaptured: (email: string) => void;
  onReset: () => void;
}

const WsipResults = ({
  zip,
  fullAddress,
  bedrooms,
  askingRent,
  rentData,
  propertyData,
  capturedEmail,
  onEmailCaptured,
  onReset,
}: WsipResultsProps) => {
  const [{ analysisId, isDuplicateAnalysis }] = useState(() => {
    const brNum = bedrooms === 'studio' ? 0 : bedrooms === 'oneBr' ? 1 : bedrooms === 'twoBr' ? 2 : bedrooms === 'threeBr' ? 3 : 4;
    const result = checkAnalysisDedup(fullAddress, zip, brNum, askingRent ?? rentData.fmr, 'wsip');
    return { analysisId: result.analysisId, isDuplicateAnalysis: result.isDuplicate };
  });
  const [reportUrl, setReportUrl] = useState<string | null>(null);
  const analysisLogged = useRef(isDuplicateAnalysis);
  const [templateCopied, setTemplateCopied] = useState(false);

  const city = rentData.city;
  const bedroomNum = bedrooms === 'studio' ? 0 : bedrooms === 'oneBr' ? 1 : bedrooms === 'twoBr' ? 2 : bedrooms === 'threeBr' ? 3 : 4;
  const brLabel = bedroomLabels[bedrooms];

  // ━━━ Data hooks ━━━
  const rentcast = useRentcast(zip, bedrooms, fullAddress);
  const rcMarket = useRentcastMarket(zip, bedrooms);

  // ━━━ Composite trend ━━━
  const compositeTrendResult = useMemo(() => calculateCompositeTrend({
    alYoY: rentData.alYoY,
    zoriYoY: rentData.zoriYoY,
    zoriSource: rentData.zoriGeoLevel,
    hudYoY: rentData.yoyChange,
  }), [rentData.alYoY, rentData.zoriYoY, rentData.zoriGeoLevel, rentData.yoyChange]);
  const marketYoy = compositeTrendResult.compositeTrend;

  // ━━━ Comp processing ━━━
  const { cleanedComps } = useMemo(() => {
    if (!rentcast.data?.comparables) return { cleanedComps: [] };
    const deduped = deduplicateComps(rentcast.data.comparables);
    const { unfurnished } = filterFurnished(deduped);
    const exactBrMatch = unfurnished.filter(c => c.bedrooms === bedroomNum);
    const nearBrMatch = unfurnished.filter(c => c.bedrooms !== bedroomNum);
    const prioritized = exactBrMatch.length >= 3 ? [...exactBrMatch, ...nearBrMatch] : unfurnished;
    // Apply seasonal adjustment using state
    const seasonallyAdjusted = applySeasonalAdjustment(prioritized, rentData.state);
    return { cleanedComps: seasonallyAdjusted };
  }, [rentcast.data, bedroomNum, rentData.state]);

  const outlierResult = useMemo(() => {
    if (cleanedComps.length === 0) return null;
    return detectOutliers(cleanedComps, propertyData?.squareFootage ?? undefined);
  }, [cleanedComps, propertyData?.squareFootage]);

  const medianCompRent = useMemo<number | null>(() => {
    if (outlierResult && outlierResult.filtered.length >= 2) return outlierResult.median;
    if (rentcast.data?.rentEstimate) return rentcast.data.rentEstimate;
    return null;
  }, [outlierResult, rentcast.data]);

  // ━━━ Comp tiering ━━━
  const tiering = useMemo(() => tierComps(
    outlierResult?.filtered ?? cleanedComps,
    fullAddress,
  ), [outlierResult, cleanedComps, fullAddress]);

  const allComps = tiering.tiered;
  const compsWithRent = allComps.filter(c => c.rent !== null && c.rent > 0);

  // ━━━ Building range override ━━━
  const bldg = useMemo(() => getBuildingRange(
    outlierResult?.filtered ?? cleanedComps,
    fullAddress,
    bedroomNum,
  ), [outlierResult, cleanedComps, fullAddress, bedroomNum]);

  const tier1Comps = tiering.tier1;
  const hasBuilding = bldg.hasBuildingData && tier1Comps.length >= 2;
  const nonBuildingComps = allComps.filter(c => c.tier !== 1);

  // ━━━ Fair range ━━━
  const fairRange = useMemo(() => {
    const tierWeights = getTierWeights(tiering.tier1.length);
    const tierOverride = tierWeights ? {
      tier1Rents: tiering.tier1.filter(c => c.rent && c.rent > 0).map(c => c.rent as number),
      otherRents: nonBuildingComps.filter(c => c.rent && c.rent > 0).map(c => c.rent as number),
      ...tierWeights,
    } : null;

    return calculateFairRange({
      compRents: compsWithRent.map(c => c.rent as number),
      hudFmr: rentData.fmr,
      zoriRent: null,
      rcMarketMedian: rcMarket.rcMedianRent,
      tierOverride,
    });
  }, [compsWithRent, rentData.fmr, rcMarket.rcMedianRent, tiering, nonBuildingComps]);
  const fairRangeLow = fairRange.rangeLow;
  const fairRangeHigh = fairRange.rangeHigh;

  // ━━━ Verdict ━━━
  type Verdict = 'below' | 'in-range' | 'above' | null;

  const { verdict, verdictHeadline, verdictSubtitle, savings } = useMemo(() => {
    if (!askingRent) {
      return { verdict: null as Verdict, verdictHeadline: null, verdictSubtitle: null, savings: null };
    }

    if (bldg.hasBuildingData) {
      const { buildingLow: bLow, buildingHigh: bHigh, bedroomFilterLabel } = bldg;
      const unitDesc = bedroomFilterLabel ? `${bedroomFilterLabel} units` : 'units';
      let v: Verdict;
      let headline: string;
      let subtitle: string;

      if (askingRent <= bLow) {
        v = 'below';
        headline = "That's a good deal.";
        subtitle = `This is below what other ${unitDesc} in this building rent for ($${fmt(bLow)} – $${fmt(bHigh)}).`;
      } else if (askingRent <= bHigh) {
        v = 'in-range';
        headline = "That's fair for this building.";
        subtitle = `Other ${unitDesc} here rent for $${fmt(bLow)} – $${fmt(bHigh)}. The asking price of $${fmt(askingRent)} is within this range.`;
      } else if (askingRent <= bHigh * 1.10) {
        v = 'in-range';
        headline = "Slightly above this building's range.";
        subtitle = `Other ${unitDesc} here rent for $${fmt(bLow)} – $${fmt(bHigh)}. The asking price of $${fmt(askingRent)} is slightly above, making it worth negotiating.`;
      } else {
        v = 'above';
        headline = "That's overpriced.";
        subtitle = `The highest-priced similar unit in this building rents for $${fmt(bHigh)}. You could save $${fmt(askingRent - bHigh)}/month by negotiating.`;
      }

      const sav = askingRent > bHigh ? askingRent - bHigh : null;
      return { verdict: v, verdictHeadline: headline, verdictSubtitle: subtitle, savings: sav };
    }

    const v: Verdict = askingRent < fairRangeLow ? 'below' : askingRent > fairRangeHigh ? 'above' : 'in-range';
    return { verdict: v, verdictHeadline: null, verdictSubtitle: null, savings: v === 'above' ? askingRent - fairRangeHigh : null };
  }, [askingRent, bldg, fairRangeLow, fairRangeHigh]);

  const verdictLabel = verdict === 'above' ? 'above' : verdict === 'below' ? 'below' : verdict === 'in-range' ? 'fair' : 'none';

  // ━━━ High pain detection for gate aggressiveness ━━━
  const isHighPain = verdict === 'above';


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

  // ━━━ Rent control cap + building eligibility ━━━
  const rentControlCap = useMemo(() => {
    const result = getRentControlByStateCity(rentData.state, rentData.city);
    return getApplicableCap(result);
  }, [rentData.state, rentData.city]);

  const buildingEligibility = useMemo(() => {
    if (!rentControlCap) return 'unknown' as const;
    return checkBuildingEligibility(rentControlCap, propertyData ? {
      yearBuilt: propertyData.yearBuilt ?? null,
      units: propertyData.units ?? null,
      propertyType: propertyData.propertyType ?? null,
    } : null);
  }, [rentControlCap, propertyData]);

  // ━━━ Contextual flags ━━━
  const utilityNote = useMemo(() => getUtilityNote(propertyData, rentData.state), [propertyData, rentData.state]);

  // ━━━ Market editorial ━━━
  const marketEditorial = useMemo(() => {
    const vacancy = rentData.alVacancy;
    const dom = rcMarket.rcAvgDaysOnMarket;
    if (dom !== null && dom < 25 && vacancy !== null && vacancy < 3) {
      return "This is a competitive market. Landlords have pricing power. Move fast on good deals.";
    }
    if ((dom !== null && dom > 50) || (vacancy !== null && vacancy > 6)) {
      return "This is a renter's market. You have leverage to negotiate.";
    }
    return "This market is balanced. Negotiate, but be realistic about competing offers.";
  }, [rentData.alVacancy, rcMarket.rcAvgDaysOnMarket]);

  // ━━━ Lead context ━━━
  const leadContext = useMemo<LeadContext>(() => ({
    analysisId,
    address: fullAddress,
    city: rentData.city,
    state: rentData.state,
    zip,
    bedrooms: bedroomNum,
    currentRent: askingRent ?? rentData.fmr,
    proposedRent: askingRent ?? undefined,
    hudFmrValue: rentData.fmr,
    compMedianRent: medianCompRent,
  }), [analysisId, fullAddress, rentData, zip, bedroomNum, askingRent, medianCompRent]);

  // ━━━ Nav sections ━━━
  const navSections = useMemo(() => {
    const sections = [
      { id: 'section-verdict', label: 'Verdict' },
    ];
    if (!capturedEmail) {
      sections.push({ id: 'section-gate', label: 'Report' });
    } else {
      sections.push({ id: 'section-market', label: 'Market' });
      if (compsWithRent.length > 0) sections.push({ id: 'section-comps', label: 'Comps' });
      if (askingRent) sections.push({ id: 'section-nextsteps', label: 'Next Steps' });
      sections.push({ id: 'section-share', label: 'Share' });
    }
    return sections;
  }, [capturedEmail, compsWithRent.length, askingRent]);

  // ━━━ Analytics ━━━
  useEffect(() => {
    trackEvent('analysis_completed', { tool: 'wsip', zip, bedrooms: bedroomNum, has_asking_rent: !!askingRent });
  }, []);

  // ━━━ Log analysis to DB ━━━
  useEffect(() => {
    if (analysisLogged.current) return;
    analysisLogged.current = true;
    const utm = getUtmParams();
    supabase.from('analyses' as any).insert({
      id: analysisId,
      session_id: getSessionId(),
      zip,
      address: fullAddress,
      city: rentData.city,
      state: rentData.state,
      bedrooms: bedroomNum,
      current_rent: askingRent ?? rentData.fmr,
      proposed_rent: askingRent,
      hud_fmr_value: rentData.fmr,
      comp_median_rent: medianCompRent,
      comps_count: allComps.length,
      market_trend_pct: marketYoy,
      confidence_level: confidence.level,
      tool_type: 'wsip',
      verdict_label: verdictLabel === 'none' ? null : verdictLabel,
      counter_offer_low: bldg.hasBuildingData ? bldg.buildingLow : null,
      counter_offer_high: bldg.hasBuildingData ? bldg.buildingHigh : null,
      utm_source: utm.utm_source || null,
      utm_medium: utm.utm_medium || null,
      utm_campaign: utm.utm_campaign || null,
    } as any).then(({ error }: any) => {
      if (error) {
        console.error('[WsipResults] Analysis insert failed:', error.message, error);
      } else {
        console.log('[WsipResults] Analysis logged:', analysisId);
      }
    });
  }, []);

  // ━━━ Share report payload ━━━
  const shareReportPayload = useMemo(() => ({
    zip,
    address: fullAddress,
    bedrooms: bedroomNum,
    currentRent: askingRent ?? rentData.fmr,
    proposedIncrease: 0,
    increaseType: 'dollar' as const,
    reportData: {
      city: rentData.city,
      state: rentData.state,
      bedroomLabel: brLabel,
      fairRangeLow,
      fairRangeHigh,
      askingRent,
      verdict: verdictLabel,
      marketYoy,
      medianCompRent,
    },
  }), [zip, fullAddress, bedroomNum, askingRent, rentData, brLabel, fairRangeLow, fairRangeHigh, verdictLabel, marketYoy, medianCompRent]);

  // ━━━ Copy template ━━━
  const suggestedPrice = useMemo(() => {
    if (bldg.hasBuildingData) return fmt(bldg.buildingMedian);
    const compMedian = medianCompRent ?? Infinity;
    const rangeTop = fairRangeHigh;
    const suggested = Math.min(compMedian, rangeTop);
    return fmt(isFinite(suggested) ? suggested : fairRangeLow);
  }, [bldg, medianCompRent, fairRangeHigh, fairRangeLow]);

  // Whether to show negotiation advice (building override can trigger even if area verdict is 'in-range')
  const showNegotiation = verdict === 'above' || (bldg.hasBuildingData && askingRent !== null && askingRent > bldg.buildingHigh);

  const emailTemplate = useMemo(() => {
    const addr = fullAddress || `ZIP ${zip}`;
    const compCount = compsWithRent.length;
    const bedroomDesc = bedroomNum === 0 ? 'studio' : `${bedroomNum}-bedroom`;
    const lines = [
      `Subject: Inquiry About ${addr} · ${brLabel} Listing\n`,
      `Hi,\n`,
      `I'm interested in ${addr} and have been researching comparable units in the area. Based on ${compCount} similar ${bedroomDesc} listings nearby, the typical range is $${fmt(fairRangeLow)}–$${fmt(fairRangeHigh)} per month.`,
    ];
    if (bldg.hasBuildingData) {
      lines.push(`\nOther units in this building are currently listed between $${fmt(bldg.buildingLow)} and $${fmt(bldg.buildingHigh)}.`);
    }
    if (askingRent) {
      lines.push(`\nThe asking price of $${fmt(askingRent)} is above this range. I'd like to discuss whether there's flexibility on the monthly rent. I'm a reliable tenant and ready to move forward quickly if we can agree on terms.`);
    }
    lines.push(`\nThank you for your time.`);
    return lines.join('\n');
  }, [fullAddress, zip, compsWithRent.length, bedroomNum, brLabel, fairRangeLow, fairRangeHigh, bldg, askingRent]);

  const handleCopyTemplate = async () => {
    try {
      await navigator.clipboard.writeText(emailTemplate);
      setTemplateCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setTemplateCopied(false), 2000);
    } catch {
      toast.error('Could not copy');
    }
  };

  // ━━━ Range bar ━━━
  const barLow = bldg.hasBuildingData ? bldg.buildingLow : fairRangeLow;
  const barHigh = bldg.hasBuildingData ? bldg.buildingHigh : fairRangeHigh;
  const barLabel = bldg.hasBuildingData ? 'This Building' : 'Fair Range';
  const rangeBarMin = Math.round(barLow * 0.85);
  const rangeBarMax = Math.round(barHigh * 1.15);
  const rangeSpan = rangeBarMax - rangeBarMin;
  const rangeLowPct = ((barLow - rangeBarMin) / rangeSpan) * 100;
  const rangeHighPct = ((barHigh - rangeBarMin) / rangeSpan) * 100;
  const askingPct = askingRent ? Math.min(100, Math.max(0, ((askingRent - rangeBarMin) / rangeSpan) * 100)) : null;

  const handleResultsShared = useCallback(() => {
    supabase.from('analyses' as any).update({ results_shared: true } as any).eq('id', analysisId).then(() => {});
  }, [analysisId]);

  // ━━━ Market trend label ━━━
  const trendLabel = useMemo(() => {
    if (marketYoy > 1) return `rising at ${marketYoy}%/yr`;
    if (marketYoy < -1) return `cooling at ${marketYoy}%/yr`;
    return `flat at ${marketYoy}%/yr`;
  }, [marketYoy]);

  return (
    <>
      <SectionNav sections={navSections} />

      <ExitIntentModal
        capturedEmail={capturedEmail}
        leadContext={leadContext}
        verdictLabel={verdictLabel}
        zip={zip}
        city={city}
        onEmailCaptured={onEmailCaptured}
        toolType="wsip"
        shareReportPayload={shareReportPayload}
        onReportGenerated={(url) => { setReportUrl(url); }}
      />

      {/* Mobile Scroll Prompt (mobile only) — re-engagement */}
      <MobileScrollPrompt
        capturedEmail={capturedEmail}
        leadContext={leadContext}
        verdictLabel={verdictLabel}
        zip={zip}
        city={city}
        onEmailCaptured={onEmailCaptured}
        toolType="wsip"
        shareReportPayload={shareReportPayload}
        onReportGenerated={(url) => { setReportUrl(url); }}
      />

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           PHASE 1: FREE CREDIBILITY LAYER
         ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="w-full" style={{ background: 'hsl(var(--verdict-bg))' }}>
        <div className="max-w-[620px] mx-auto px-5 sm:px-6">
          <motion.section
            id="section-verdict"
            {...fade(0)}
            className="min-h-0 md:min-h-[50vh] flex flex-col items-center justify-center text-center py-4 sm:py-12"
          >
            {/* Verdict headline */}
            <h1
              className="font-display text-[1.25rem] sm:text-[clamp(1.5rem,4.5vw,2.2rem)] text-foreground leading-[1.15] tracking-tight mb-2"
              style={{ letterSpacing: '-0.02em' }}
            >
              {verdictHeadline ? (
                <span className={verdict === 'below' ? 'text-verdict-good' : verdict === 'above' ? 'text-destructive' : 'text-verdict-fair'}>
                  {verdictHeadline}
                </span>
              ) : (
                <>
                  {verdict === 'below' && <span className="text-verdict-good">That's a good deal.</span>}
                  {verdict === 'in-range' && <span className="text-verdict-fair">That's a fair price.</span>}
                  {verdict === 'above' && <span className="text-destructive">That's overpriced.</span>}
                  {!verdict && <>Here's your fair range.</>}
                </>
              )}
            </h1>

            {/* Property context line */}
            {propertyData && (
              <p className="text-xs text-muted-foreground mb-2">
                {propertyData.propertyType}
                {propertyData.yearBuilt && ` · Built ${propertyData.yearBuilt}`}
                {propertyData.squareFootage && ` · ${propertyData.squareFootage.toLocaleString()} sqft`}
              </p>
            )}
            {rentcast.data?.detectedBedrooms != null && rentcast.data.detectedBedrooms !== bedroomNum && (
              <p className="text-[11px] text-muted-foreground/60 mb-2 italic">
                Our data suggests this may be a {rentcast.data.detectedBedrooms === 0 ? 'studio' : `${rentcast.data.detectedBedrooms}-bedroom`} unit. Results are based on your selection.
              </p>
            )}

            {askingRent && savings !== null && savings > 0 && (
              <p className="text-sm sm:text-lg font-medium text-destructive mb-1">
                ${fmt(savings)}/month above market
              </p>
            )}




            <p className="text-[13px] sm:text-base text-muted-foreground leading-snug max-w-[480px] mb-2 md:mb-4">
              {verdictSubtitle ? (
                verdictSubtitle
              ) : askingRent ? (
                <>
                  The fair range for {brLabel}s in {city} is ${fmt(fairRangeLow)} – ${fmt(fairRangeHigh)}/month.
                  The asking price of ${fmt(askingRent)} is{' '}
                  {verdict === 'below' ? 'below' : verdict === 'in-range' ? 'within' : 'above'} this range.
                </>
              ) : (
                <>{brLabel}s in {city} typically rent for <strong className="text-foreground">${fmt(fairRangeLow)} – ${fmt(fairRangeHigh)}/month</strong>.</>
              )}
            </p>

            {/* Action Insight */}
            {askingRent && verdict && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18, duration: 0.4 }}
                className={`mt-0 mb-1 md:mt-2 md:mb-4 w-full max-w-[480px] border-l-4 pl-3 py-1.5 md:pl-4 md:py-2 rounded-r-md ${
                  verdict === 'above'
                    ? 'border-destructive/60 bg-destructive/5'
                    : verdict === 'below'
                    ? 'border-verdict-good/60 bg-verdict-good/5'
                    : 'border-blue-400/60 bg-blue-50/50 dark:bg-blue-950/20'
                }`}
              >
                <p className="text-xs md:text-base font-medium text-foreground leading-snug md:leading-relaxed">
                  {verdict === 'above'
                    ? 'This listing is priced above comparable units in the area. You have strong data to negotiate a lower price. Your market report is ready below.'
                    : verdict === 'below'
                    ? 'This listing is priced below comparable units — a strong deal. Lock it in before it\'s gone. Get the full comp report to confirm below.'
                    : 'This listing is priced within the fair range — but that doesn\'t mean the price is final. Renters who negotiate before signing save an average of $100/month. See how to approach it below.'
                  }
                </p>
              </motion.div>
            )}

            {/* Rent control note — hidden on mobile (moved below gate) */}
            {rentControlCap && rentControlCap.maxIncreaseFormula && buildingEligibility !== 'ineligible' && (
              <p className="hidden md:block text-xs text-muted-foreground mb-4 max-w-[480px]">
                Note: {rentControlCap.jurisdiction} has rent control regulations that may affect pricing
                {buildingEligibility === 'eligible' ? ' for this building' : ' for eligible buildings in this area'}.
                {buildingEligibility === 'unknown' && !propertyData && ' Enter a full address to check if this building qualifies.'}
              </p>
            )}

            {/* Range bar */}
            <div className="w-full max-w-[480px] mb-3 md:mb-6">
              <div className="relative h-6 md:h-8 rounded-full overflow-hidden bg-muted/50">
                <div className="absolute top-0 bottom-0 bg-verdict-good/15" style={{ left: 0, width: `${rangeLowPct}%` }} />
                <div className="absolute top-0 bottom-0 bg-verdict-fair/20" style={{ left: `${rangeLowPct}%`, width: `${rangeHighPct - rangeLowPct}%` }} />
                <div className="absolute top-0 bottom-0 bg-destructive/15" style={{ left: `${rangeHighPct}%`, right: 0 }} />
                <div className="absolute top-0 bottom-0 w-px bg-border" style={{ left: `${rangeLowPct}%` }} />
                <div className="absolute top-0 bottom-0 w-px bg-border" style={{ left: `${rangeHighPct}%` }} />
                {askingPct !== null && (
                  <div
                    className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-2 border-card shadow-md ${
                      verdict === 'below' ? 'bg-verdict-good' : verdict === 'above' ? 'bg-destructive' : 'bg-verdict-fair'
                    }`}
                    style={{ left: `${askingPct}%` }}
                  />
                )}
              </div>
              <div className="flex justify-between mt-1.5 px-1">
                <span className="text-[11px] text-muted-foreground">${fmt(barLow)}</span>
                <span className="text-[11px] text-muted-foreground/60">{barLabel}</span>
                <span className="text-[11px] text-muted-foreground">${fmt(barHigh)}</span>
              </div>
              {bldg.hasBuildingData && (
                <p className="text-[10px] text-muted-foreground/50 text-center mt-1">
                  Area average: ${fmt(fairRangeLow)} – ${fmt(fairRangeHigh)}
                </p>
              )}
            </div>

            {/* ── MOBILE: proof cue + gate BEFORE stat cards ── */}
            {!capturedEmail && (
              <div className="block md:hidden w-full">
                <div className="text-center mt-2 mb-1">
                  <p className="text-xs text-muted-foreground">
                    {compsWithRent.length > 0
                      ? `Based on ${compsWithRent.length} nearby comps and current market data.`
                      : 'Based on local market data and rent trends.'}
                  </p>
                </div>
                <section id="section-gate" className="py-3">
                  <ReportGate
                    toolType="wsip"
                    compsCount={compsWithRent.length}
                    verdictLabel={verdictLabel}
                    isHighPain={isHighPain}
                    leadContext={leadContext}
                    analysisId={analysisId}
                    zip={zip}
                    city={city}
                    onEmailCaptured={onEmailCaptured}
                    prefilledEmail={capturedEmail}
                    shareReportPayload={shareReportPayload}
                    onReportGenerated={(url) => { setReportUrl(url); }}
                    marketYoy={marketYoy}
                    monthlySavings={savings}
                  />
                </section>
              </div>
            )}

            {/* Stat cards — DESKTOP: show above gate. MOBILE: show below gate */}
            <div className="hidden md:grid w-full grid-cols-4 gap-4 max-w-[540px]">
              <div className="text-center rounded-lg border border-border/80 bg-card px-2 sm:px-3 py-3 sm:py-4" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                  {bldg.hasBuildingData ? 'Range' : 'Fair Range'}
                </p>
                {bldg.hasBuildingData ? (
                  <div>
                    <p className="font-display text-[16px] sm:text-[19px] tracking-tight text-foreground tabular-nums" style={{ letterSpacing: '-0.02em', lineHeight: 1 }}>
                      ${fmt(bldg.buildingLow)}–${fmt(bldg.buildingHigh)}
                    </p>
                    <p className="text-[9px] text-muted-foreground/60 mt-1">This building</p>
                    <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                      Area: ${fmt(fairRangeLow)}–${fmt(fairRangeHigh)}
                    </p>
                  </div>
                ) : (
                  <p className="font-display text-[18px] sm:text-[22px] tracking-tight text-foreground tabular-nums" style={{ letterSpacing: '-0.02em', lineHeight: 1 }}>
                    ${fmt(fairRangeLow)}–${fmt(fairRangeHigh)}
                  </p>
                )}
              </div>
              <div className="text-center rounded-lg border border-border/80 bg-card px-2 sm:px-3 py-3 sm:py-4" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Area Trend</p>
                <p className={`font-display text-[18px] sm:text-[22px] tracking-tight tabular-nums ${marketYoy > 0 ? 'text-destructive' : marketYoy < 0 ? 'text-verdict-good' : 'text-foreground'}`} style={{ letterSpacing: '-0.02em', lineHeight: 1 }}>
                  {marketYoy > 0 ? '+' : ''}{marketYoy}%
                </p>
              </div>
              <div className="text-center rounded-lg border border-border/80 bg-card px-2 sm:px-3 py-3 sm:py-4" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Vacancy Rate</p>
                <p className="font-display text-[18px] sm:text-[22px] tracking-tight text-foreground tabular-nums" style={{ letterSpacing: '-0.02em', lineHeight: 1 }}>
                  {rentData.alVacancy !== null ? `${rentData.alVacancy.toFixed(1)}%` : '—'}
                </p>
              </div>
              <div className="text-center rounded-lg border border-border/80 bg-card px-2 sm:px-3 py-3 sm:py-4" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Days on Market</p>
                <p className="font-display text-[18px] sm:text-[22px] tracking-tight text-foreground tabular-nums" style={{ letterSpacing: '-0.02em', lineHeight: 1 }}>
                  {rcMarket.rcAvgDaysOnMarket !== null ? Math.round(rcMarket.rcAvgDaysOnMarket) : '—'}
                </p>
              </div>
            </div>

            {/* ── Comp teaser line — DESKTOP only above gate ── */}
            {compsWithRent.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.4 }}
                className="hidden md:block mt-5 w-full max-w-[540px]"
              >
                <span className="inline-block border border-border/60 rounded-full px-4 py-1.5 text-sm font-semibold text-foreground/70">
                  {bldg.hasBuildingData && bldg.buildingComps.length >= 2
                    ? `We found ${compsWithRent.length} comps near you, including ${bldg.buildingComps.length} in your building.`
                    : `We found ${compsWithRent.length} comps near you.`
                  }
                </span>
              </motion.div>
            )}

            {/* PreGateCompPreview — DESKTOP only above gate */}
            <div className="hidden md:block">
              <PreGateCompPreview compsWithRent={compsWithRent} capturedEmail={capturedEmail} fmt={fmt} />
            </div>

            {/* ── Email gate — DESKTOP position (after comp preview) ── */}
            {!capturedEmail && (
              <section id="section-gate-desktop" className="py-8 hidden md:block">
                <ReportGate
                  toolType="wsip"
                  compsCount={compsWithRent.length}
                  verdictLabel={verdictLabel}
                  isHighPain={isHighPain}
                  leadContext={leadContext}
                  analysisId={analysisId}
                  zip={zip}
                  city={city}
                  onEmailCaptured={onEmailCaptured}
                  prefilledEmail={capturedEmail}
                  shareReportPayload={shareReportPayload}
                  onReportGenerated={(url) => { setReportUrl(url); }}
                  marketYoy={marketYoy}
                  monthlySavings={savings}
                />
              </section>
            )}

            {/* ── MOBILE: stat cards + comp teaser + preview BELOW gate ── */}
            <div className="block md:hidden w-full">
              <div className="w-full grid grid-cols-2 gap-3 max-w-[540px] mt-4">
                <div className="text-center rounded-lg border border-border/80 bg-card px-2 py-3" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                    {bldg.hasBuildingData ? 'Range' : 'Fair Range'}
                  </p>
                  {bldg.hasBuildingData ? (
                    <div>
                      <p className="font-display text-[16px] tracking-tight text-foreground tabular-nums" style={{ letterSpacing: '-0.02em', lineHeight: 1 }}>
                        ${fmt(bldg.buildingLow)}–${fmt(bldg.buildingHigh)}
                      </p>
                      <p className="text-[9px] text-muted-foreground/60 mt-1">This building</p>
                      <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                        Area: ${fmt(fairRangeLow)}–${fmt(fairRangeHigh)}
                      </p>
                    </div>
                  ) : (
                    <p className="font-display text-[16px] tracking-tight text-foreground tabular-nums" style={{ letterSpacing: '-0.02em', lineHeight: 1 }}>
                      ${fmt(fairRangeLow)}–${fmt(fairRangeHigh)}
                    </p>
                  )}
                </div>
                <div className="text-center rounded-lg border border-border/80 bg-card px-2 py-3" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Area Trend</p>
                  <p className={`font-display text-[16px] tracking-tight tabular-nums ${marketYoy > 0 ? 'text-destructive' : marketYoy < 0 ? 'text-verdict-good' : 'text-foreground'}`} style={{ letterSpacing: '-0.02em', lineHeight: 1 }}>
                    {marketYoy > 0 ? '+' : ''}{marketYoy}%
                  </p>
                </div>
                <div className="text-center rounded-lg border border-border/80 bg-card px-2 py-3" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Vacancy Rate</p>
                  <p className="font-display text-[16px] tracking-tight text-foreground tabular-nums" style={{ letterSpacing: '-0.02em', lineHeight: 1 }}>
                    {rentData.alVacancy !== null ? `${rentData.alVacancy.toFixed(1)}%` : '—'}
                  </p>
                </div>
                <div className="text-center rounded-lg border border-border/80 bg-card px-2 py-3" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Days on Market</p>
                  <p className="font-display text-[16px] tracking-tight text-foreground tabular-nums" style={{ letterSpacing: '-0.02em', lineHeight: 1 }}>
                    {rcMarket.rcAvgDaysOnMarket !== null ? Math.round(rcMarket.rcAvgDaysOnMarket) : '—'}
                  </p>
                </div>
              </div>

              {compsWithRent.length > 0 && (
                <div className="mt-4 w-full max-w-[540px]">
                  <span className="inline-block border border-border/60 rounded-full px-4 py-1.5 text-sm font-semibold text-foreground/70">
                    {bldg.hasBuildingData && bldg.buildingComps.length >= 2
                      ? `We found ${compsWithRent.length} comps near you, including ${bldg.buildingComps.length} in your building.`
                      : `We found ${compsWithRent.length} comps near you.`
                    }
                  </span>
                </div>
              )}

              <PreGateCompPreview compsWithRent={compsWithRent} capturedEmail={capturedEmail} fmt={fmt} />

              {/* Rent control note — mobile position (below gate) */}
              {rentControlCap && rentControlCap.maxIncreaseFormula && buildingEligibility !== 'ineligible' && (
                <p className="text-xs text-muted-foreground mt-4 max-w-[480px]">
                  Note: {rentControlCap.jurisdiction} has rent control regulations that may affect pricing
                  {buildingEligibility === 'eligible' ? ' for this building' : ' for eligible buildings in this area'}.
                  {buildingEligibility === 'unknown' && !propertyData && ' Enter a full address to check if this building qualifies.'}
                </p>
              )}
            </div>

            <div className="mt-4 md:mt-4 flex flex-col items-center gap-2">
              <div className="block md:hidden h-6" aria-hidden />
              <button onClick={onReset} className="text-xs text-muted-foreground/50 md:text-muted-foreground hover:text-foreground transition-colors">
                ← Check a different address
              </button>
            </div>
          </motion.section>
        </div>
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           PHASE 3: EVERYTHING UNLOCKED (after email)
         ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="w-full bg-card">
        <div className="max-w-[620px] mx-auto px-5 sm:px-6">
        {capturedEmail && (
          <>
            {/* ━━━ MARKET CONDITIONS ━━━ */}
            <motion.section id="section-market" {...fade(0.05)} className="pt-10 pb-8">
              <h2 className="results-section-header mb-6">Market Conditions in {city}</h2>

              <div className="space-y-6">
                <div className="evidence-card">
                  <h3 className="evidence-card-header">What the Market Says</h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    {city}, {rentData.state} — {brLabel}
                  </p>

                  <div className="context-row context-row-even">
                    <span className="context-label">{city} rents this year</span>
                    <span className="context-value">
                      {marketYoy > 0 ? '+' : ''}{marketYoy}%
                      <span className="context-sub"> ({compositeTrendResult.sourceCount >= 2
                        ? 'composite — ' + compositeTrendResult.sources.map(s => s.label).join(', ')
                        : compositeTrendResult.primarySource})</span>
                    </span>
                  </div>

                  {rentData.zillowMonthly !== null && rentData.zillowDirection && (
                    <div className="context-row context-row-odd">
                      <span className="context-label">Monthly trend</span>
                      <span className="context-value">
                        {rentData.zillowMonthly > 0 ? '+' : ''}{rentData.zillowMonthly}%/mo
                        <span className="context-sub">
                          {rentData.zillowDirection === 'rising' ? ' ↑ rising' : rentData.zillowDirection === 'falling' ? ' ↓ cooling' : ' → steady'}
                        </span>
                      </span>
                    </div>
                  )}

                  <div className="context-row context-row-even">
                    <span className="context-label">Fair rent range</span>
                    <span className="context-value">
                      ${fmt(fairRangeLow)} – ${fmt(fairRangeHigh)}
                      <span className="context-sub"> (HUD SAFMR + market comps)</span>
                    </span>
                  </div>

                  {askingRent && (
                    <div className={`context-row ${verdict === 'above' ? 'context-row-highlight' : 'context-row-odd'}`}>
                      <span className="context-label">Asking price</span>
                      <span className={`context-value ${verdict === 'above' ? 'text-destructive font-bold' : verdict === 'below' ? 'text-verdict-good font-bold' : ''}`}>
                        ${fmt(askingRent)} — {bldg.hasBuildingData
                          ? (askingRent <= bldg.buildingLow ? "below this building's range"
                            : askingRent <= bldg.buildingHigh ? "within this building's range"
                            : askingRent <= bldg.buildingHigh * 1.10 ? "slightly above this building's range"
                            : "above this building's range")
                          : (verdict === 'below' ? 'below range' : verdict === 'in-range' ? 'within range' : 'above range')}
                      </span>
                    </div>
                  )}
                </div>

                {/* Local Market Snapshot */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15, duration: 0.4 }}
                  className="rounded-lg border border-border bg-card px-4 py-4"
                >
                  <h3 className="text-[13px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Local Market Snapshot</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                    {rcMarket.rcTotalListings !== null && (
                      <div className="flex items-center gap-2.5">
                        <div>
                          <p className="text-[15px] font-semibold text-foreground tabular-nums">{rcMarket.rcTotalListings}</p>
                          <p className="text-[11px] text-muted-foreground leading-tight">
                            Active rentals in your ZIP
                            {rcMarket.rcNewListings !== null && rcMarket.rcNewListings > 0 && (
                              <span className="text-muted-foreground/70"> · +{rcMarket.rcNewListings} new this month</span>
                            )}
                          </p>
                        </div>
                      </div>
                    )}
                    {rcMarket.rcAvgDaysOnMarket !== null && (
                      <div className="flex items-center gap-2.5">
                        <div>
                          <p className={`text-[15px] font-semibold tabular-nums ${
                            rcMarket.rcAvgDaysOnMarket > 50 ? 'text-verdict-good' : rcMarket.rcAvgDaysOnMarket < 25 ? 'text-destructive' : 'text-accent-amber'
                          }`}>{Math.round(rcMarket.rcAvgDaysOnMarket)} days</p>
                          <p className="text-[11px] text-muted-foreground leading-tight">Avg days on market</p>
                        </div>
                      </div>
                    )}
                  </div>
                  <p className="text-[12px] text-muted-foreground leading-relaxed">{marketEditorial}</p>
                </motion.div>
              </div>
            </motion.section>

            {/* ━━━ COMPARABLE LISTINGS — fully visible ━━━ */}
            {compsWithRent.length > 0 && (
              <motion.section id="section-comps" {...fade(0.15)} className="py-12 -mx-2 px-2 rounded-2xl" style={{ background: 'hsl(var(--comps-bg))' }}>
                <h2 className="results-section-header mb-2">
                  What Similar Units Actually Rent For
                </h2>
                <p className="text-[12px] text-muted-foreground text-center mb-4">
                  Showing {allComps.length} comparable rental{allComps.length !== 1 ? 's' : ''}{compRadius.label ? ` ${compRadius.label}` : ''}.
                </p>
                {utilityNote && (
                  <p className="text-[11px] text-muted-foreground/70 text-center mb-6 max-w-[480px] mx-auto italic">
                    💡 {utilityNote}
                  </p>
                )}

                {/* Tier 1: in-building comps */}
                {tier1Comps.length > 0 && (
                  <WsipCompsList
                    comparables={tier1Comps}
                    askingRent={askingRent}
                    medianCompRent={medianCompRent}
                    sectionLabel="In this building"
                    hideMedianLine
                  />
                )}

                {/* Tier 2-4: nearby comps — all visible */}
                {nonBuildingComps.length > 0 && (
                  <WsipCompsList
                    comparables={nonBuildingComps}
                    askingRent={askingRent}
                    medianCompRent={medianCompRent}
                    sectionLabel={tier1Comps.length > 0 ? 'Nearby' : undefined}
                  />
                )}
              </motion.section>
            )}

            {/* ━━━ YOUR NEXT STEPS — fully visible ━━━ */}
            {askingRent && (
              <motion.section id="section-nextsteps" {...fade(0.19)} className="pt-8 pb-8">
                <h2 className="results-section-header mb-6">Your Next Steps</h2>

                <div className="evidence-card space-y-4">
                  {/* NEGOTIATION (overpriced by area OR building range) */}
                  {showNegotiation && (
                    <>
                      <p className="text-sm font-medium text-foreground">How to negotiate this rent down:</p>
                      <ul className="space-y-3 text-sm text-foreground">
                        {bldg.hasBuildingData && askingRent > bldg.buildingHigh && (
                          <li className="flex gap-2">
                            <span className="text-primary font-bold shrink-0">•</span>
                            The highest similar unit in this building rents for ${fmt(bldg.buildingHigh)} — the asking price of ${fmt(askingRent)} is ${fmt(askingRent - bldg.buildingHigh)} above this.
                          </li>
                        )}
                        {bldg.hasBuildingData && (
                          <li className="flex gap-2">
                            <span className="text-primary font-bold shrink-0">•</span>
                            There are {bldg.buildingComps.length} other units in this building, giving you direct comparisons.
                          </li>
                        )}
                        {!bldg.hasBuildingData && (
                          <li className="flex gap-2">
                            <span className="text-primary font-bold shrink-0">•</span>
                            The asking price of ${fmt(askingRent)} is ${fmt(askingRent - (medianCompRent ?? fairRangeHigh))} above the area median of ${fmt(medianCompRent ?? fairRangeHigh)}.
                          </li>
                        )}
                        {rcMarket.rcTotalListings !== null && rcMarket.rcTotalListings > 5 && (
                          <li className="flex gap-2">
                            <span className="text-primary font-bold shrink-0">•</span>
                            There are {rcMarket.rcTotalListings} active listings in this ZIP — mention that you're exploring options.
                          </li>
                        )}
                        {rcMarket.rcAvgDaysOnMarket !== null && (
                          <li className="flex gap-2">
                            <span className="text-primary font-bold shrink-0">•</span>
                            Units sit for {Math.round(rcMarket.rcAvgDaysOnMarket)} days on average — the landlord has incentive to close quickly.
                          </li>
                        )}
                        <li className="flex gap-2">
                          <span className="text-primary font-bold shrink-0">•</span>
                          The market trend is {trendLabel}.
                        </li>
                      </ul>

                      {/* Email template */}
                      <div className="rounded-lg border border-border bg-muted/30 p-4 relative">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Copy-paste email template</p>
                        <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">{emailTemplate}</p>
                        <button
                          onClick={handleCopyTemplate}
                          className="absolute top-3 right-3 p-2 rounded-md hover:bg-muted transition-colors"
                          aria-label="Copy template"
                        >
                          {templateCopied ? <Check className="w-4 h-4 text-verdict-good" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
                        </button>
                      </div>
                    </>
                  )}

                  {/* FAIR */}
                  {!showNegotiation && verdict === 'in-range' && (
                    <>
                      <p className="text-sm font-medium text-foreground">This is a fair price. Here's how to strengthen your application to secure this unit:</p>
                      <ul className="space-y-3 text-sm text-foreground">
                        <li className="flex gap-2">
                          <span className="text-primary font-bold shrink-0">•</span>
                          <strong>Apply quickly.</strong> Fair-priced units go fast. Submit your application the same day you tour, or even before if the listing allows it.
                        </li>
                        <li className="flex gap-2">
                          <span className="text-primary font-bold shrink-0">•</span>
                          <strong>Show you've done your research.</strong> Tell the landlord: "I've looked at the market data and this is in line with comparable units — I'm ready to move forward."
                        </li>
                        <li className="flex gap-2">
                          <span className="text-primary font-bold shrink-0">•</span>
                          <strong>Include references.</strong> A brief note from a previous landlord confirming on-time payments can set you apart from other applicants.
                        </li>
                      </ul>
                    </>
                  )}

                  {/* GOOD DEAL */}
                  {!showNegotiation && verdict === 'below' && (
                    <>
                      <p className="text-sm font-medium text-foreground">This is below market — act fast. Here's how to lock it in:</p>
                      <ul className="space-y-3 text-sm text-foreground">
                        <li className="flex gap-2">
                          <span className="text-primary font-bold shrink-0">•</span>
                          <strong>Apply the same day.</strong> Below-market units attract heavy interest. Don't wait for a second tour — submit your application immediately.
                        </li>
                        <li className="flex gap-2">
                          <span className="text-primary font-bold shrink-0">•</span>
                          <strong>Offer to sign immediately.</strong> Tell the landlord you're ready to sign the lease today. Certainty is valuable to them.
                        </li>
                        <li className="flex gap-2">
                          <span className="text-primary font-bold shrink-0">•</span>
                          <strong>Have your documents ready.</strong> Bring proof of income, ID, references, and any deposit funds. Removing friction speeds up the process.
                        </li>
                      </ul>
                    </>
                  )}
                </div>
              </motion.section>
            )}

            {/* ━━━ Post-conversion flow ━━━ */}
            <section className="pb-4 pt-2">
              <WsipPostConversion
                email={capturedEmail}
                leadContext={leadContext}
                verdictLabel={verdictLabel}
                zip={zip}
              />
            </section>

            <p className="text-[11px] text-muted-foreground/60 text-center mb-2">
              See something that doesn't look right?{' '}
              <a href="mailto:james@renewalreply.com?subject=Data%20issue%20report&body=Address%3A%20%0AZip%3A%20%0AWhat%20looks%20wrong%3A%20" className="underline hover:text-muted-foreground transition-colors">
                Report a data issue
              </a>
            </p>

            {/* ━━━ Feedback widget ━━━ */}
            <FeedbackWidget
              analysisId={analysisId}
              page="wsip_results"
              verdictSnapshot={verdictLabel}
              scoreSnapshot={null}
              confidenceSnapshot={confidence.level}
            />

            {/* ━━━ Data Confidence + Disclaimer ━━━ */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="pt-4 pb-2"
            >
              <DataConfidenceBadge level={confidence.level} note={confidence.note} />
              <p className="text-[11px] text-muted-foreground/60 mt-2 text-center leading-relaxed">
                This analysis is for informational purposes only.{' '}
                <Link to="/methodology" className="underline hover:text-muted-foreground transition-colors">See methodology</Link>
              </p>
            </motion.div>

            {/* ━━━ SHARE + CROSS-LINK ━━━ */}
            <motion.section id="section-share" {...fade(0.23)} className="pt-4 pb-10">
              <h2 className="results-section-header mb-6">Share This Analysis</h2>
              <div className="flex justify-center">
                <ShareHub
                  reportPayload={shareReportPayload}
                  onLinkGenerated={(url) => { setReportUrl(url); handleResultsShared(); }}
                  analysisId={analysisId}
                  leadEmail={capturedEmail || undefined}
                  zipCode={zip}
                  city={city}
                  state={rentData.state}
                  bedroomNum={bedroomNum}
                  increasePct={0}
                  marketYoy={marketYoy}
                  verdict={verdictLabel === 'above' ? 'above' : verdictLabel === 'below' ? 'below' : verdictLabel === 'fair' ? 'fair' : 'none'}
                  headline={`What ${brLabel}s rent for in ${city}`}
                  stats={[
                    { label: 'Fair range', value: `$${fmt(fairRangeLow)}–$${fmt(fairRangeHigh)}` },
                    { label: 'Area trend', value: `${marketYoy > 0 ? '+' : ''}${marketYoy}%` },
                  ]}
                  landlordLabel="Share with listing agent"
                  neighborsLabel="Share with friends"
                />
              </div>
            </motion.section>

            {/* ━━━ Related Guides ━━━ */}
            <motion.section {...fade(0.24)} className="pt-2 pb-6">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 text-center">Related Guides</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Link to="/guides/what-should-i-pay-for-rent" className="rounded-lg border border-border bg-card p-4 hover:border-primary/30 transition-colors">
                  <p className="text-[13px] font-semibold text-foreground">Is This Apartment Overpriced?</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">How to evaluate any asking price with data</p>
                </Link>
                <Link to="/guides/how-to-negotiate-rent-increase" className="rounded-lg border border-border bg-card p-4 hover:border-primary/30 transition-colors">
                  <p className="text-[13px] font-semibold text-foreground">How to Negotiate a Rent Increase</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Counter-offer math, email template, and scripts</p>
                </Link>
              </div>
            </motion.section>

            {/* Cross-link */}
            <motion.div {...fade(0.25)} className="pb-8 text-center">
              <p className="text-sm text-muted-foreground mb-1">Already have a lease?</p>
              <Link
                to="/"
                className="text-sm text-primary font-semibold hover:underline"
              >
                Check if your next rent increase is fair →
              </Link>
            </motion.div>
          </>
        )}

        </div>
      </div>
    </>
  );
};

// ━━━ WSIP-specific post-conversion component ━━━
const WsipPostConversion = ({ email, leadContext, verdictLabel, zip }: {
  email: string;
  leadContext: LeadContext;
  verdictLabel: string;
  zip: string;
}) => {
  const [moveTimeline, setMoveTimeline] = useState('');
  const [partnerOptIn, setPartnerOptIn] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (!moveTimeline && !partnerOptIn) {
      toast('Nothing to save');
      return;
    }

    const utm = getUtmParams();
    try {
      await supabase.rpc('upsert_lead', {
        p_email: email,
        p_analysis_id: leadContext?.analysisId || null,
        p_capture_source: 'wsip_post_conversion',
        p_partner_opt_in: partnerOptIn,
        p_verdict: verdictLabel || null,
        p_utm_source: utm.utm_source || null,
        p_utm_medium: utm.utm_medium || null,
        p_utm_campaign: utm.utm_campaign || null,
        p_comp_median_rent: leadContext?.compMedianRent ?? null,
        p_hud_fmr_value: leadContext?.hudFmrValue ?? null,
        p_tool_type: 'wsip',
      } as any);
    } catch (err) {
      console.error('Post-conversion save failed:', err);
    }

    trackEvent('lease_info_saved', { action: 'lease_saved', tool: 'wsip', zip, verdict: verdictLabel });
    setSaved(true);
    toast.success('Saved!');
  };

  if (saved) {
    return (
      <div className="flex items-center gap-2 py-3">
        <Check className="w-4 h-4 text-verdict-good" />
        <span className="text-sm text-muted-foreground">You're all set.</span>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-lg border border-border bg-card p-4 sm:p-5 space-y-3">
      <p className="text-sm font-semibold text-foreground">When are you looking to move?</p>
      <div className="flex gap-2 max-w-[360px]">
        <select
          value={moveTimeline}
          onChange={(e) => setMoveTimeline(e.target.value)}
          className="flex-1 px-3 py-2.5 text-sm border border-border rounded-lg bg-card text-muted-foreground outline-none focus:border-foreground focus:text-foreground transition-colors cursor-pointer appearance-none"
        >
          <option disabled value="">Select timeline</option>
          <option value="asap">ASAP</option>
          <option value="1-3 months">1–3 months</option>
          <option value="3-6 months">3–6 months</option>
          <option value="just researching">Just researching</option>
        </select>
        <button
          onClick={handleSave}
          className="px-4 py-2.5 rounded-lg text-sm font-medium border border-border text-foreground hover:bg-muted transition-colors whitespace-nowrap"
        >
          Save
        </button>
      </div>
      <label className="flex items-start gap-2 cursor-pointer select-none">
        <input type="checkbox" checked={partnerOptIn} onChange={(e) => setPartnerOptIn(e.target.checked)} className="mt-[3px] accent-primary" />
        <span className="text-xs text-muted-foreground leading-snug">
          I'm open to hearing from trusted partners about housing-related services.
        </span>
      </label>
    </div>
  );
};

export default WsipResults;
