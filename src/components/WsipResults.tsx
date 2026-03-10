import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Copy, Check } from 'lucide-react';
import { RentLookupResult, bedroomLabels, BedroomType } from '@/data/rentData';
import { useRentcast } from '@/hooks/useRentcast';
import { useRentcastMarket } from '@/hooks/useRentcastMarket';
import { supabase } from '@/integrations/supabase/client';
import { trackEvent, trackAdsConversion } from '@/lib/analytics';
import { getUtmParams } from '@/lib/utm';
import { assessConfidence, detectOutliers, getCompRadius, filterFurnished, deduplicateComps } from '@/lib/dataQuality';
import { calculateCompositeTrend } from '@/lib/compositeTrend';
import { calculateFairRange } from '@/lib/fairRange';
import { tierComps, getTierWeights } from '@/lib/compTiering';
import { getBuildingRange } from '@/lib/buildingRange';
import DataConfidenceBadge from './DataConfidenceBadge';
import SectionNav from './SectionNav';
import ExitIntentModal from './ExitIntentModal';
import SocialProofLine from './SocialProofLine';
import PostConversionFlow from './PostConversionFlow';
import ShareHub from './ShareHub';
import WsipCompsList from './WsipCompsList';
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
  capturedEmail,
  onEmailCaptured,
  onReset,
}: WsipResultsProps) => {
  const [analysisId] = useState(() => crypto.randomUUID());
  const [reportUrl, setReportUrl] = useState<string | null>(null);
  const analysisLogged = useRef(false);
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
    return { cleanedComps: prioritized };
  }, [rentcast.data, bedroomNum]);

  const outlierResult = useMemo(() => {
    if (cleanedComps.length === 0) return null;
    return detectOutliers(cleanedComps);
  }, [cleanedComps]);

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
  ), [outlierResult, cleanedComps, fullAddress]);

  // Tier 1 (in-building) shown ungated; others gated
  const tier1Comps = tiering.tier1;
  const nonBuildingComps = allComps.filter(c => c.tier !== 1);
  const nonBuildingWithRent = nonBuildingComps.filter(c => c.rent !== null && c.rent > 0);
  const displayableNonBuilding = Math.min(nonBuildingWithRent.length, 6);
  const visibleNonBuildingCount = Math.min(displayableNonBuilding, 3);
  const visibleNonBuildingComps = nonBuildingComps.slice(0, visibleNonBuildingCount);
  const gatedComps = displayableNonBuilding > visibleNonBuildingCount ? nonBuildingComps.slice(visibleNonBuildingCount) : [];
  const gatedDisplayCount = displayableNonBuilding - visibleNonBuildingCount;

  // ━━━ Fair range (weighted composite with tier overrides) ━━━
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

  // ━━━ Verdict (building override when available) ━━━
  type Verdict = 'below' | 'in-range' | 'above' | null;

  const { verdict, verdictHeadline, verdictSubtitle, savings } = useMemo(() => {
    if (!askingRent) {
      return { verdict: null as Verdict, verdictHeadline: null, verdictSubtitle: null, savings: null };
    }

    // Building-level override when 2+ same-building comps
    if (bldg.hasBuildingData) {
      const { buildingLow: bLow, buildingHigh: bHigh } = bldg;
      let v: Verdict;
      let headline: string;
      let subtitle: string;

      if (askingRent <= bLow) {
        v = 'below';
        headline = "That's a good deal.";
        subtitle = `This is below what other units in this building rent for ($${fmt(bLow)} – $${fmt(bHigh)}).`;
      } else if (askingRent <= bHigh) {
        v = 'in-range';
        headline = "That's fair for this building.";
        subtitle = `Other units here rent for $${fmt(bLow)} – $${fmt(bHigh)}. The asking price of $${fmt(askingRent)} is within this range.`;
      } else if (askingRent <= bHigh * 1.10) {
        v = 'in-range';
        headline = "Slightly above this building's range.";
        subtitle = `Other units here rent for $${fmt(bLow)} – $${fmt(bHigh)}. The asking price of $${fmt(askingRent)} is slightly above — worth negotiating.`;
      } else {
        v = 'above';
        headline = "That's overpriced.";
        subtitle = `The highest-priced similar unit in this building rents for $${fmt(bHigh)}. You could save $${fmt(askingRent - bHigh)}/month by negotiating.`;
      }

      const sav = askingRent > bHigh ? askingRent - bHigh : null;
      return { verdict: v, verdictHeadline: headline, verdictSubtitle: subtitle, savings: sav };
    }

    // Fallback: area fair range
    const v: Verdict = askingRent < fairRangeLow ? 'below' : askingRent > fairRangeHigh ? 'above' : 'in-range';
    return { verdict: v, verdictHeadline: null, verdictSubtitle: null, savings: v === 'above' ? askingRent - fairRangeHigh : null };
  }, [askingRent, bldg, fairRangeLow, fairRangeHigh]);

  const verdictLabel = verdict === 'above' ? 'above' : verdict === 'below' ? 'below' : verdict === 'in-range' ? 'fair' : 'none';

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

  // ━━━ Market editorial (recalibrated) ━━━
  const marketEditorial = useMemo(() => {
    const vacancy = rentData.alVacancy;
    const dom = rcMarket.rcAvgDaysOnMarket;
    if (dom !== null && dom < 25 && vacancy !== null && vacancy < 3) {
      return "This is a competitive market — landlords have pricing power. Move fast on good deals.";
    }
    if ((dom !== null && dom > 50) || (vacancy !== null && vacancy > 6)) {
      return "This is a renter's market — you have leverage to negotiate.";
    }
    return "This market is balanced — negotiate, but be realistic about competing offers.";
  }, [rentData.alVacancy, rcMarket.rcAvgDaysOnMarket]);

  // ━━━ Comp gate state ━━━
  const [compsUnlocked, setCompsUnlocked] = useState(false);
  const [compEmail, setCompEmail] = useState('');
  const [compEmailError, setCompEmailError] = useState('');
  const [compEmailLoading, setCompEmailLoading] = useState(false);
  const compGateRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (capturedEmail) setCompsUnlocked(true);
  }, [capturedEmail]);

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
      { id: 'section-market', label: 'Market' },
    ];
    if (compsWithRent.length > 0) sections.push({ id: 'section-comps', label: 'Comps' });
    if (askingRent && verdict === 'above') sections.push({ id: 'section-playbook', label: 'Negotiate' });
    sections.push({ id: 'section-share', label: 'Share' });
    return sections;
  }, [compsWithRent.length, askingRent, verdict]);

  // ━━━ Analytics ━━━
  useEffect(() => {
    trackEvent('wsip_results_viewed', { zip, bedrooms: bedroomNum, has_asking_rent: !!askingRent });
  }, []);

  // Track comp gate visibility
  useEffect(() => {
    if (gatedComps.length === 0 || compsUnlocked) return;
    const el = compGateRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          trackEvent('wsip_comp_gate_shown', { verdict: verdictLabel, zip_code: zip });
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [gatedComps.length, compsUnlocked, verdictLabel, zip]);

  // ━━━ Log analysis to DB ━━━
  useEffect(() => {
    if (analysisLogged.current) return;
    analysisLogged.current = true;
    const utm = getUtmParams();
    supabase.from('analyses' as any).insert({
      id: analysisId,
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
    } as any).then(() => {});
  }, []);

  // ━━━ Comp gate submit ━━━
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
        p_analysis_id: analysisId,
        p_capture_source: 'wsip_comp_gate',
        p_address: fullAddress || null,
        p_city: rentData.city,
        p_state: rentData.state,
        p_zip: zip,
        p_bedrooms: bedroomNum,
        p_current_rent: askingRent ?? rentData.fmr,
        p_verdict: verdictLabel || null,
        p_utm_source: utm.utm_source || null,
        p_utm_medium: utm.utm_medium || null,
        p_utm_campaign: utm.utm_campaign || null,
        p_comp_median_rent: medianCompRent ?? null,
        p_hud_fmr_value: rentData.fmr,
        p_tool_type: 'wsip',
      } as any);

      await supabase.from('lead_events' as any).insert({
        email: compEmail.trim(),
        analysis_id: analysisId,
        event_type: 'wsip_comp_gate',
        address: fullAddress || null,
        zip,
        current_rent: askingRent ?? rentData.fmr,
        verdict: verdictLabel || null,
        comp_median_rent: medianCompRent ?? null,
        hud_fmr_value: rentData.fmr,
      } as any);
    } catch {
      // silent
    }

    onEmailCaptured(compEmail.trim());
    setCompsUnlocked(true);
    setCompEmailLoading(false);
    trackEvent('wsip_comp_gate_converted', { verdict: verdictLabel, zip_code: zip });
    trackEvent('email_submitted', { verdict: verdictLabel, zip_code: zip, source: 'wsip_comp_gate' });
    trackAdsConversion();
    toast.success('All comps unlocked!');
  };

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

  const emailTemplate = bldg.hasBuildingData
    ? `Hi,

I'm interested in the unit at ${fullAddress || `ZIP ${zip}`}. Based on comparable units in this building renting for $${fmt(bldg.buildingLow)}–$${fmt(bldg.buildingHigh)}, I'd like to propose $${suggestedPrice}/month for the ${brLabel}. I'm ready to sign a lease and can move in quickly.

Happy to discuss — thank you.`
    : `Hi,

I'm interested in the unit at ${fullAddress || `ZIP ${zip}`}. Based on comparable rentals in the area, I'd like to propose $${suggestedPrice}/month for the ${brLabel}. I'm ready to sign a lease and can move in quickly.

Happy to discuss — thank you.`;

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

  // ━━━ Range bar (building override) ━━━
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
      />

      {/* ━━━ SECTION 1: THE VERDICT ━━━ */}
      <div className="w-full" style={{ background: 'hsl(var(--verdict-bg))' }}>
        <div className="max-w-[620px] mx-auto px-5 sm:px-6">
          <motion.section
            id="section-verdict"
            {...fade(0)}
            className="min-h-[45vh] sm:min-h-[50vh] flex flex-col items-center justify-center text-center py-8 sm:py-12"
          >
            {/* Verdict headline */}
            <h1
              className="font-display text-[1.35rem] sm:text-[clamp(1.5rem,4.5vw,2.2rem)] text-foreground leading-[1.15] tracking-tight mb-3 whitespace-nowrap"
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

            {/* Building rent context line */}
            {bldg.hasBuildingData && (
              <p className="text-[13px] sm:text-[15px] font-medium text-verdict-good mb-1">
                Other units in this building rent for ${fmt(bldg.buildingLow)}
                {bldg.buildingLow !== bldg.buildingHigh && ` – $${fmt(bldg.buildingHigh)}`}/month
              </p>
            )}
            {bldg.hasBuildingData && bldg.buildingHigh > fairRangeHigh * 1.15 && (
              <p className="text-[11px] text-muted-foreground mb-2">This building rents above the area average.</p>
            )}
            {bldg.hasBuildingData && bldg.buildingHigh < fairRangeHigh * 0.85 && (
              <p className="text-[11px] text-muted-foreground mb-2">This building rents below the area average — good value for the area.</p>
            )}

            <p className="text-[14px] sm:text-base text-muted-foreground leading-relaxed max-w-[480px] mb-6">
              {verdictSubtitle ? (
                verdictSubtitle
              ) : askingRent ? (
                <>
                  The fair range for {brLabel}s in {city} is ${fmt(fairRangeLow)} – ${fmt(fairRangeHigh)}/month.
                  The asking price of ${fmt(askingRent)} is{' '}
                  {verdict === 'below' ? 'below' : verdict === 'in-range' ? 'within' : 'above'} this range.
                  {savings !== null && savings > 0 && (
                    <> You could save <strong className="text-foreground">${fmt(savings)}/month</strong> (${fmt(savings * 12)}/year) by negotiating.</>
                  )}
                </>
              ) : (
                <>{brLabel}s in {city} typically rent for <strong className="text-foreground">${fmt(fairRangeLow)} – ${fmt(fairRangeHigh)}/month</strong>.</>
              )}
            </p>

            {/* Range bar */}
            <div className="w-full max-w-[480px] mb-6">
              <div className="relative h-8 rounded-full overflow-hidden bg-muted/50">
                {/* Below range zone - green */}
                <div
                  className="absolute top-0 bottom-0 bg-verdict-good/15"
                  style={{ left: 0, width: `${rangeLowPct}%` }}
                />
                {/* In range zone - neutral */}
                <div
                  className="absolute top-0 bottom-0 bg-verdict-fair/20"
                  style={{ left: `${rangeLowPct}%`, width: `${rangeHighPct - rangeLowPct}%` }}
                />
                {/* Above range zone - red */}
                <div
                  className="absolute top-0 bottom-0 bg-destructive/15"
                  style={{ left: `${rangeHighPct}%`, right: 0 }}
                />

                {/* Low marker */}
                <div className="absolute top-0 bottom-0 w-px bg-border" style={{ left: `${rangeLowPct}%` }} />
                {/* High marker */}
                <div className="absolute top-0 bottom-0 w-px bg-border" style={{ left: `${rangeHighPct}%` }} />

                {/* Asking rent dot — only when asking price provided */}
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

            {/* Stat cards — always show all four */}
            <div className="w-full grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 max-w-[540px]">
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

            {/* Confidence badge */}
            <div className="mt-4">
              <DataConfidenceBadge level={confidence.level} note={confidence.note} />
              <p className="text-[11px] text-muted-foreground/60 mt-2 text-center leading-relaxed">
                This analysis is for informational purposes only.{' '}
                <Link to="/methodology" className="underline hover:text-muted-foreground transition-colors">See methodology</Link>
              </p>
            </div>

            {/* CTA */}
            <div className="mt-4 flex flex-col items-center gap-2">
              <button
                onClick={() => document.getElementById('section-market')?.scrollIntoView({ behavior: 'smooth' })}
                className="text-base font-semibold text-primary hover:text-primary/80 transition-colors duration-150"
              >
                See market details ↓
              </button>
              <button onClick={onReset} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                ← Check a different address
              </button>
            </div>
          </motion.section>
        </div>
      </div>

      {/* Transition edge */}
      <div className="w-full h-px" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }} />

      {/* ━━━ CONTENT SECTIONS ━━━ */}
      <div className="w-full bg-card">
        <div className="max-w-[620px] mx-auto px-5 sm:px-6">

          {/* ━━━ SECTION 2: MARKET CONDITIONS ━━━ */}
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
                      ${fmt(askingRent)} — {verdict === 'below' ? 'below range' : verdict === 'in-range' ? 'within range' : 'above range'}
                    </span>
                  </div>
                )}
              </div>

              {/* Market snapshot — always show */}
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

          {/* ━━━ SECTION 3: COMPARABLE LISTINGS — always show ━━━ */}
          {compsWithRent.length > 0 && (
            <motion.section id="section-comps" {...fade(0.15)} className="py-12 -mx-2 px-2 rounded-2xl" style={{ background: 'hsl(var(--comps-bg))' }}>
              <h2 className="results-section-header mb-2">
                What Similar Units Actually Rent For
              </h2>
              <p className="text-[12px] text-muted-foreground text-center mb-6">
                Showing {allComps.length} comparable rental{allComps.length !== 1 ? 's' : ''}{compRadius.label ? ` ${compRadius.label}` : ''}.
              </p>

              {/* Tier 1: in-building comps — always ungated */}
              {tier1Comps.length > 0 && (
                <WsipCompsList
                  comparables={tier1Comps}
                  askingRent={askingRent}
                  medianCompRent={medianCompRent}
                  sectionLabel="In this building"
                />
              )}

              {/* Tier 2-4: nearby comps — gated */}
              {nonBuildingComps.length > 0 && (
                <WsipCompsList
                  comparables={compsUnlocked ? nonBuildingComps : visibleNonBuildingComps}
                  askingRent={askingRent}
                  medianCompRent={medianCompRent}
                  sectionLabel={tier1Comps.length > 0 ? 'Nearby' : undefined}
                />
              )}

              {/* Comp gate */}
              {gatedComps.length > 0 && !compsUnlocked && (
                <div ref={compGateRef} className="mt-4">
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
                    <p className="text-xs text-muted-foreground/50 mt-1">Free. No account required.</p>
                  </div>

                  {/* Blurred rows */}
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
            </motion.section>
          )}

          {/* ━━━ SECTION 4: NEGOTIATION PLAYBOOK (gated, above-market only) ━━━ */}
          {askingRent && verdict === 'above' && (
            <motion.section id="section-playbook" {...fade(0.19)} className="pt-8 pb-8">
              <h2 className="results-section-header mb-6">How to Negotiate This Rent</h2>

              {compsUnlocked ? (
                <div className="evidence-card space-y-4">
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
                </div>
              ) : (
                /* Gated — blurred with email prompt */
                <div className="relative">
                  <div style={{ filter: 'blur(6px)', userSelect: 'none', WebkitUserSelect: 'none', minHeight: '200px' } as React.CSSProperties}>
                    <div className="evidence-card space-y-4">
                      <ul className="space-y-3 text-sm text-foreground">
                        <li className="flex gap-2">
                          <span className="text-primary font-bold shrink-0">•</span>
                          The asking price is above the area median by a significant amount.
                        </li>
                        <li className="flex gap-2">
                          <span className="text-primary font-bold shrink-0">•</span>
                          There are multiple active listings in this ZIP code.
                        </li>
                        <li className="flex gap-2">
                          <span className="text-primary font-bold shrink-0">•</span>
                          Units sit for many days on average — landlords have incentive to negotiate.
                        </li>
                      </ul>
                      <div className="rounded-lg border border-border bg-muted/30 p-4">
                        <p className="text-sm text-foreground">Hi, I'm interested in the unit...</p>
                      </div>
                    </div>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-card rounded-xl border border-border shadow-lg px-6 py-5 max-w-[380px] w-full text-center">
                      <p className="text-sm font-semibold text-foreground mb-1">Unlock negotiation tips & email template</p>
                      <p className="text-xs text-muted-foreground mb-3">Enter your email to see all comps and negotiation playbook</p>
                      <form onSubmit={handleCompGateSubmit} className="flex gap-2">
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
                          {compEmailLoading ? 'Unlocking…' : 'Unlock →'}
                        </button>
                      </form>
                      {compEmailError && <p className="text-xs text-destructive mt-1">{compEmailError}</p>}
                      <div className="mt-2">
                        <SocialProofLine />
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </motion.section>
          )}

          {/* ━━━ SECTION 5: POST-CONVERSION FLOW ━━━ */}
          {capturedEmail && (
            <section className="pb-4 pt-2">
              <WsipPostConversion
                email={capturedEmail}
                leadContext={leadContext}
                verdictLabel={verdictLabel}
                zip={zip}
              />
            </section>
          )}

          {/* Email capture for users who haven't converted yet (no-asking-rent or in-range/below) */}
          {!capturedEmail && (
            <section className="pb-6 pt-4">
              <div className="rounded-xl px-5 sm:px-8 py-5 sm:py-6 text-center" style={{ background: 'hsl(var(--secondary))' }}>
                <h2 className="font-display text-xl font-semibold text-foreground mb-1.5" style={{ letterSpacing: '-0.01em' }}>
                  {askingRent
                    ? verdict === 'above' ? "Get negotiation tips for this listing."
                    : "Track this market."
                    : "Get notified when rents change."}
                </h2>
                <p className="text-sm text-foreground/70 mb-5">
                  We'll send you this analysis and alert you when market conditions change in {city}.
                </p>
                <form onSubmit={handleCompGateSubmit} className="max-w-[440px] mx-auto space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="email"
                      placeholder="you@email.com"
                      value={compEmail}
                      onChange={(e) => { setCompEmail(e.target.value); if (compEmailError) setCompEmailError(''); }}
                      className="flex-1 min-w-0 px-4 py-3 text-sm border border-border rounded-lg bg-card text-foreground outline-none focus:border-foreground transition-colors placeholder:text-muted-foreground/50"
                    />
                    <button
                      type="submit"
                      disabled={compEmailLoading}
                      className="bg-primary text-primary-foreground px-4 sm:px-5 py-3 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm shadow-primary/20 whitespace-nowrap shrink-0 disabled:opacity-60"
                    >
                      Save my results →
                    </button>
                  </div>
                  <div className="mt-2">
                    <SocialProofLine />
                  </div>
                </form>
                <p className="text-[11px] text-muted-foreground/60 text-center mt-2">
                  No spam. Unsubscribe anytime. See our{' '}
                  <Link to="/privacy" className="underline hover:text-foreground transition-colors">Privacy Policy</Link>.
                </p>
              </div>
            </section>
          )}

          {/* ━━━ SECTION 6: SHARE + CROSS-LINK ━━━ */}
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

          {/* Cross-link */}
          <motion.div {...fade(0.25)} className="pb-8 text-center">
            <p className="text-sm text-muted-foreground mb-1">Already have a lease?</p>
            <Link
              to={`/?zip=${zip}&bedrooms=${bedroomNum}`}
              className="text-sm text-primary font-semibold hover:underline"
            >
              Check if your next rent increase is fair →
            </Link>
          </motion.div>

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

    trackEvent('wsip_post_conversion_saved', { verdict: verdictLabel, zip_code: zip, move_timeline: moveTimeline });
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
