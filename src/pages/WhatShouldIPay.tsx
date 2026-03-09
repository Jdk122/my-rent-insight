import { useState, useRef, useEffect, useMemo, lazy, Suspense } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { lookupRentData, RentLookupResult, bedroomLabels, BedroomType } from '@/data/rentData';
import { useRentcast } from '@/hooks/useRentcast';
import { useRentcastMarket } from '@/hooks/useRentcastMarket';
import { calculateCompositeTrend } from '@/lib/compositeTrend';
import { assessConfidence, detectOutliers, filterFurnished, deduplicateComps } from '@/lib/dataQuality';
import { supabase } from '@/integrations/supabase/client';
import { trackEvent, trackAdsConversion } from '@/lib/analytics';
import { getUtmParams } from '@/lib/utm';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { MapPin, TrendingUp, TrendingDown, Clock, Building2, CheckCircle, AlertTriangle, Minus } from 'lucide-react';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import DataConfidenceBadge from '@/components/DataConfidenceBadge';
import SectionNav from '@/components/SectionNav';
import SocialProofLine from '@/components/SocialProofLine';
import PostConversionFlow from '@/components/PostConversionFlow';
import SEO from '@/components/SEO';
import PageNav from '@/components/PageNav';
import { LeadContext } from '@/components/EmailCapture';

const ExitIntentModal = lazy(() => import('@/components/ExitIntentModal'));
const SEOFooter = lazy(() => import('@/components/SEOFooter'));
const ShareHub = lazy(() => import('@/components/ShareHub'));

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });
const fmtCurrency = (n: number) => `$${fmt(n)}`;

const bedroomOptions: { value: BedroomType; label: string }[] = [
  { value: 'studio', label: 'Studio' },
  { value: 'oneBr', label: '1 Bedroom' },
  { value: 'twoBr', label: '2 Bedrooms' },
  { value: 'threeBr', label: '3 Bedrooms' },
  { value: 'fourBr', label: '4+ Bedrooms' },
];

const bedroomToNum: Record<BedroomType, number> = {
  studio: 0, oneBr: 1, twoBr: 2, threeBr: 3, fourBr: 4,
};

const fade = (delay: number) => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] as const },
});

const WhatShouldIPay = () => {
  const [searchParams] = useSearchParams();

  // Form state
  const [address, setAddress] = useState('');
  const [zip, setZip] = useState(searchParams.get('zip') || '');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [fullAddress, setFullAddress] = useState<string | null>(null);
  const [bedrooms, setBedrooms] = useState<BedroomType>(
    (searchParams.get('bedrooms') as BedroomType) || 'oneBr'
  );
  const [askingRent, setAskingRent] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Results state
  const [rentData, setRentData] = useState<RentLookupResult | null>(null);
  const [capturedEmail, setCapturedEmail] = useState('');
  const [analysisId] = useState<string>(() => crypto.randomUUID());
  const analysisLogged = useRef(false);

  const topRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const askingPrice = askingRent ? parseInt(askingRent.replace(/[^0-9]/g, ''), 10) || null : null;

  const handleAddressSelect = (components: { street: string; unit: string; city: string; state: string; zip: string; fullAddress: string }) => {
    setZip(components.zip);
    setCity(components.city);
    setState(components.state);
    setFullAddress(components.fullAddress);
    setAddress(components.fullAddress);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!zip || zip.length < 5) {
      toast.error('Please enter a valid address or ZIP code.');
      return;
    }
    setIsLoading(true);
    trackEvent('wsip_form_submitted', { zip, bedrooms });

    try {
      const data = await lookupRentData(zip, bedrooms);
      if (!data) {
        toast.error("We don't have data for that ZIP code yet.");
        setIsLoading(false);
        return;
      }
      setRentData(data);
      if (!city && data.city) setCity(data.city);
      if (!state && data.state) setState(data.state);
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Reset
  const handleReset = () => {
    setRentData(null);
    analysisLogged.current = false;
    topRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div ref={topRef} className="min-h-screen flex flex-col bg-background">
      <PageNav ctaLink="/" ctaText="Check Your Renewal →" />

      <SEO
        title={rentData
          ? `What Should I Pay for Rent in ${city || 'My Area'}? | Fair Rent Calculator | RenewalReply`
          : 'What Should I Pay for Rent? | Fair Rent Calculator | RenewalReply'}
        description={rentData
          ? `See fair rent ranges, comparable listings, and market conditions for ${city || 'your area'}. Know before you sign.`
          : 'Find out what you should actually pay for rent. Compare asking prices to market data, nearby listings, and HUD benchmarks.'}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'WebApplication',
          name: 'What Should I Pay? — Fair Rent Calculator',
          url: 'https://my-rent-insight.lovable.app/what-should-i-pay',
          description: 'Check if an asking rent is fair using HUD data, comparable listings, and local market trends.',
          applicationCategory: 'FinanceApplication',
          operatingSystem: 'Any',
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        }}
      />

      {/* Hero + Form */}
      {!rentData && (
        <main className="flex-1 flex items-center justify-center px-4 py-12 sm:py-20">
          <div className="w-full max-w-lg text-center">
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-foreground tracking-tight mb-3" style={{ letterSpacing: '-0.02em' }}>
              What Should I Pay for Rent?
            </h1>
            <p className="text-base text-muted-foreground mb-8 max-w-md mx-auto">
              Enter an address or ZIP code and we'll show you the fair range based on market data and comparable listings.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4 text-left">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Address or ZIP Code</label>
                <AddressAutocomplete onSelect={handleAddressSelect} />
                {!fullAddress && (
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Or enter a ZIP code"
                    value={zip}
                    onChange={(e) => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
                    className="mt-2 w-full px-4 py-3 text-sm border border-border rounded-lg bg-card text-foreground outline-none focus:border-foreground transition-colors placeholder:text-muted-foreground/50"
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Bedrooms</label>
                <select
                  value={bedrooms}
                  onChange={(e) => setBedrooms(e.target.value as BedroomType)}
                  className="w-full px-4 py-3 text-sm border border-border rounded-lg bg-card text-foreground outline-none focus:border-foreground transition-colors"
                >
                  {bedroomOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  What rent are they asking? <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="$2,500"
                  value={askingRent}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^0-9]/g, '');
                    if (!raw) { setAskingRent(''); return; }
                    setAskingRent('$' + parseInt(raw, 10).toLocaleString());
                  }}
                  className="w-full px-4 py-3 text-sm border border-border rounded-lg bg-card text-foreground outline-none focus:border-foreground transition-colors placeholder:text-muted-foreground/50"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-primary text-primary-foreground py-3.5 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm shadow-primary/20 disabled:opacity-50"
              >
                {isLoading ? 'Analyzing…' : 'Show Me Fair Rent →'}
              </button>
            </form>

            <div className="mt-4">
              <SocialProofLine />
            </div>
          </div>
        </main>
      )}

      {/* Results */}
      {rentData && (
        <div ref={resultsRef}>
          <WsipResults
            rentData={rentData}
            zip={zip}
            city={city || rentData.city}
            state={state || rentData.state}
            bedrooms={bedrooms}
            fullAddress={fullAddress}
            askingPrice={askingPrice}
            capturedEmail={capturedEmail}
            setCapturedEmail={setCapturedEmail}
            analysisId={analysisId}
            analysisLogged={analysisLogged}
            onReset={handleReset}
          />
        </div>
      )}

      <Suspense fallback={null}>
        <SEOFooter />
      </Suspense>
    </div>
  );
};

// ─── Results Section ───

interface WsipResultsProps {
  rentData: RentLookupResult;
  zip: string;
  city: string;
  state: string;
  bedrooms: BedroomType;
  fullAddress: string | null;
  askingPrice: number | null;
  capturedEmail: string;
  setCapturedEmail: (email: string) => void;
  analysisId: string;
  analysisLogged: React.MutableRefObject<boolean>;
  onReset: () => void;
}

const WsipResults = ({
  rentData, zip, city, state, bedrooms, fullAddress,
  askingPrice, capturedEmail, setCapturedEmail,
  analysisId, analysisLogged, onReset,
}: WsipResultsProps) => {
  const brLabel = bedroomLabels[bedrooms].toLowerCase();
  const bedroomNum = bedroomToNum[bedrooms];

  // Hooks
  const rentcast = useRentcast(zip, bedrooms, fullAddress);
  const rcMarket = useRentcastMarket(zip, bedrooms);

  // Composite trend
  const compositeTrendResult = useMemo(() => calculateCompositeTrend({
    alYoY: rentData.alYoY,
    zoriYoY: rentData.zoriYoY,
    zoriSource: rentData.zoriGeoLevel,
    hudYoY: rentData.yoyChange,
  }), [rentData]);

  const marketYoy = compositeTrendResult.compositeTrend;

  // Comps processing
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

  // Fair range calculation
  const fmr = rentData.fmr;
  const rangeLow = fmr;
  const rangeHigh = useMemo(() => {
    const compCeiling = medianCompRent ? Math.round(medianCompRent * 1.15) : null;
    const rcCeiling = rcMarket.rcMedianRent ? Math.round(rcMarket.rcMedianRent * 1.15) : null;
    return compCeiling || rcCeiling || Math.round(fmr * 1.30);
  }, [fmr, medianCompRent, rcMarket.rcMedianRent]);

  // Verdict on asking price
  const askingVerdict = useMemo(() => {
    if (!askingPrice) return null;
    if (askingPrice < rangeLow) return 'below';
    if (askingPrice <= rangeHigh) return 'fair';
    return 'above';
  }, [askingPrice, rangeLow, rangeHigh]);

  const verdictLabel = askingVerdict === 'below' ? 'Great Deal' : askingVerdict === 'fair' ? 'Fair Price' : askingVerdict === 'above' ? 'Overpriced' : 'Range';

  // Confidence
  const confidence = useMemo(() => assessConfidence({
    hasHud: true,
    compCount: outlierResult?.filtered.length ?? 0,
    maxCompDistance: null,
    hasZillow: rentData.zillowMonthly !== null,
    hasCensus: rentData.censusMedianRent !== null,
  }), [outlierResult, rentData]);

  // Comp gate state
  const allComps = outlierResult?.filtered ?? cleanedComps;
  const compsWithRent = allComps.filter(c => c.rent !== null && c.rent > 0);
  const displayableTotal = Math.min(compsWithRent.length, 6);
  const visibleCount = Math.min(displayableTotal, 3);
  const visibleComps = compsWithRent.slice(0, visibleCount);
  const gatedComps = displayableTotal > visibleCount ? compsWithRent.slice(visibleCount) : [];
  const [compsUnlocked, setCompsUnlocked] = useState(false);
  const [tipsUnlocked, setTipsUnlocked] = useState(false);
  const [compEmail, setCompEmail] = useState('');
  const [compEmailError, setCompEmailError] = useState('');
  const [compEmailLoading, setCompEmailLoading] = useState(false);
  const compGateRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (capturedEmail) { setCompsUnlocked(true); setTipsUnlocked(true); }
  }, [capturedEmail]);

  // Market condition editorial
  const marketCondition = useMemo(() => {
    const vacancy = rentData.alVacancy;
    const daysOnMarket = rcMarket.rcAvgDaysOnMarket;
    if (vacancy !== null && vacancy !== undefined && vacancy > 7) return "renter's";
    if (daysOnMarket !== null && daysOnMarket > 45) return "renter's";
    if (vacancy !== null && vacancy !== undefined && vacancy < 4 && daysOnMarket !== null && daysOnMarket < 20) return "landlord's";
    return 'balanced';
  }, [rentData.alVacancy, rcMarket.rcAvgDaysOnMarket]);

  // Lead context
  const leadContext = useMemo<LeadContext>(() => ({
    analysisId,
    address: fullAddress,
    city, state, zip,
    bedrooms: bedroomNum,
    currentRent: askingPrice ?? undefined,
    compMedianRent: medianCompRent ?? null,
    hudFmrValue: fmr ?? null,
  }), [analysisId, fullAddress, city, state, zip, bedroomNum, askingPrice, medianCompRent, fmr]);

  // Analytics
  useEffect(() => {
    trackEvent('wsip_results_viewed', { zip, verdict: verdictLabel });
  }, []);

  // Log analysis
  useEffect(() => {
    if (analysisLogged.current) return;
    if (rentcast.loading || rcMarket.loading) return;
    analysisLogged.current = true;

    const utm = getUtmParams();
    supabase.from('analyses').insert({
      id: analysisId,
      address: fullAddress || null,
      city, state, zip,
      bedrooms: bedroomNum,
      current_rent: askingPrice ?? null,
      proposed_rent: askingPrice ?? null,
      increase_pct: null,
      market_trend_pct: marketYoy,
      fairness_score: null,
      comp_median_rent: medianCompRent ?? null,
      hud_fmr_value: fmr ?? null,
      verdict_label: verdictLabel,
      utm_source: utm.utm_source || null,
      utm_medium: utm.utm_medium || null,
      utm_campaign: utm.utm_campaign || null,
      confidence_level: confidence.level ?? null,
      results_shared: false,
      letter_generated: false,
      comps_count: compsWithRent.length,
      tool_type: 'wsip',
      anomaly_flags: [],
    } as any).then(({ error }) => {
      if (error) console.error('[WSIP] Analysis insert failed:', error.message);
    });
  }, [rentcast.loading, rcMarket.loading]);

  // Comp gate submission
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
        p_analysis_id: analysisId || null,
        p_capture_source: 'wsip_comp_gate',
        p_address: fullAddress || null,
        p_city: city || null,
        p_state: state || null,
        p_zip: zip || null,
        p_bedrooms: bedroomNum ?? null,
        p_current_rent: askingPrice ?? null,
        p_verdict: verdictLabel || null,
        p_utm_source: utm.utm_source || null,
        p_utm_medium: utm.utm_medium || null,
        p_utm_campaign: utm.utm_campaign || null,
        p_comp_median_rent: medianCompRent ?? null,
        p_hud_fmr_value: fmr ?? null,
      } as any);

      await supabase.from('lead_events' as any).insert({
        email: compEmail.trim(),
        analysis_id: analysisId || null,
        event_type: 'wsip_comp_gate',
        address: fullAddress || null,
        zip: zip || null,
        current_rent: askingPrice ?? null,
        verdict: verdictLabel || null,
        comp_median_rent: medianCompRent ?? null,
        hud_fmr_value: fmr ?? null,
      } as any);
    } catch { /* silent */ }

    setCapturedEmail(compEmail.trim());
    setCompsUnlocked(true);
    setTipsUnlocked(true);
    setCompEmailLoading(false);
    trackEvent('wsip_comp_gate_converted', { verdict: verdictLabel, zip_code: zip });
    trackEvent('email_submitted', { verdict: verdictLabel, zip_code: zip, source: 'wsip_comp_gate' });
    trackAdsConversion();
    toast.success('All comps unlocked!');
  };

  // Tips gate submission
  const [tipsEmail, setTipsEmail] = useState('');
  const [tipsEmailError, setTipsEmailError] = useState('');
  const [tipsEmailLoading, setTipsEmailLoading] = useState(false);

  const handleTipsGateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tipsEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(tipsEmail.trim())) {
      setTipsEmailError('Please enter a valid email.');
      return;
    }
    setTipsEmailError('');
    setTipsEmailLoading(true);

    const utm = getUtmParams();
    try {
      await supabase.rpc('upsert_lead', {
        p_email: tipsEmail.trim(),
        p_analysis_id: analysisId || null,
        p_capture_source: 'wsip_tips_gate',
        p_address: fullAddress || null,
        p_city: city || null,
        p_state: state || null,
        p_zip: zip || null,
        p_bedrooms: bedroomNum ?? null,
        p_current_rent: askingPrice ?? null,
        p_verdict: verdictLabel || null,
        p_utm_source: utm.utm_source || null,
        p_utm_medium: utm.utm_medium || null,
        p_utm_campaign: utm.utm_campaign || null,
        p_comp_median_rent: medianCompRent ?? null,
        p_hud_fmr_value: fmr ?? null,
      } as any);

      await supabase.from('lead_events' as any).insert({
        email: tipsEmail.trim(),
        analysis_id: analysisId || null,
        event_type: 'wsip_tips_gate',
        address: fullAddress || null,
        zip: zip || null,
        current_rent: askingPrice ?? null,
        verdict: verdictLabel || null,
        comp_median_rent: medianCompRent ?? null,
        hud_fmr_value: fmr ?? null,
      } as any);
    } catch { /* silent */ }

    setCapturedEmail(tipsEmail.trim());
    setCompsUnlocked(true);
    setTipsUnlocked(true);
    setTipsEmailLoading(false);
    trackEvent('wsip_tips_unlocked', { verdict: verdictLabel, zip_code: zip });
    trackEvent('email_submitted', { verdict: verdictLabel, zip_code: zip, source: 'wsip_tips_gate' });
    trackAdsConversion();
    toast.success('Tips unlocked!');
  };

  // Nav sections
  const navSections = useMemo(() => {
    const sections = [{ id: 'section-range', label: 'Fair Range' }];
    sections.push({ id: 'section-market', label: 'Market' });
    if (compsWithRent.length > 0) sections.push({ id: 'section-comps', label: 'Comps' });
    if (askingPrice && askingVerdict === 'above') sections.push({ id: 'section-tips', label: 'Tips' });
    sections.push({ id: 'section-share', label: 'Share' });
    return sections;
  }, [compsWithRent.length, askingPrice, askingVerdict]);

  const locationLabel = city ? `${city}, ${state}` : `ZIP ${zip}`;

  return (
    <main className="flex-1">
      <SectionNav sections={navSections} />

      <Suspense fallback={null}>
        <ExitIntentModal
          capturedEmail={capturedEmail}
          leadContext={leadContext}
          verdictLabel={verdictLabel}
          zip={zip}
          city={city}
          onEmailCaptured={(email) => {
            setCapturedEmail(email);
            setCompsUnlocked(true);
            setTipsUnlocked(true);
            trackEvent('wsip_exit_intent_converted');
          }}
        />
      </Suspense>

      {/* Section 1: Fair Rent Range */}
      <section id="section-range" className="max-w-2xl mx-auto px-4 sm:px-6 pt-8 pb-10">
        <motion.div {...fade(0)} className="text-center mb-6">
          <button onClick={onReset} className="text-xs text-primary hover:underline mb-4 inline-block">← New search</button>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground tracking-tight mb-2" style={{ letterSpacing: '-0.02em' }}>
            Fair Rent Range
          </h2>
          <p className="text-sm text-muted-foreground">
            For a {brLabel} in {locationLabel}
          </p>
        </motion.div>

        {/* Range bar */}
        <motion.div {...fade(0.2)} className="rounded-xl border border-border bg-card p-6 mb-4">
          <div className="text-center mb-6">
            <p className="font-display text-3xl sm:text-4xl font-bold text-foreground tracking-tight" style={{ letterSpacing: '-0.02em' }}>
              {fmtCurrency(rangeLow)} — {fmtCurrency(rangeHigh)}
              <span className="text-base font-normal text-muted-foreground"> / mo</span>
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Based on HUD Fair Market Rent and comparable listings
            </p>
          </div>

          {/* Visual range bar */}
          {askingPrice && (
            <div className="mt-4">
              <div className="relative h-3 rounded-full bg-muted overflow-visible">
                {/* Fair range highlight */}
                <div
                  className="absolute top-0 h-full rounded-full bg-verdict-good/30"
                  style={{
                    left: '0%',
                    width: '100%',
                  }}
                />
                {/* Asking price marker */}
                {(() => {
                  const span = rangeHigh - rangeLow;
                  const extendedLow = rangeLow - span * 0.2;
                  const extendedHigh = rangeHigh + span * 0.4;
                  const totalSpan = extendedHigh - extendedLow;
                  const rangeStartPct = ((rangeLow - extendedLow) / totalSpan) * 100;
                  const rangeWidthPct = (span / totalSpan) * 100;
                  const markerPct = Math.max(2, Math.min(98, ((askingPrice - extendedLow) / totalSpan) * 100));
                  const markerColor = askingVerdict === 'below' ? 'bg-verdict-good' : askingVerdict === 'fair' ? 'bg-verdict-fair' : 'bg-destructive';

                  return (
                    <>
                      {/* Reposition fair range */}
                      <div
                        className="absolute top-0 h-full rounded-full bg-verdict-good/20 border border-verdict-good/30"
                        style={{ left: `${rangeStartPct}%`, width: `${rangeWidthPct}%` }}
                      />
                      {/* Marker */}
                      <div
                        className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full ${markerColor} border-2 border-card shadow-md`}
                        style={{ left: `${markerPct}%`, transform: `translate(-50%, -50%)` }}
                      />
                    </>
                  );
                })()}
              </div>
              <div className="flex justify-between mt-1.5 text-[11px] text-muted-foreground">
                <span>{fmtCurrency(rangeLow)}</span>
                <span>{fmtCurrency(rangeHigh)}</span>
              </div>
            </div>
          )}

          {/* Verdict */}
          {askingPrice && askingVerdict && (
            <motion.div {...fade(0.3)} className="mt-5 text-center">
              {askingVerdict === 'below' && (
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-verdict-good/10 text-verdict-good">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm font-semibold">Great deal. {fmtCurrency(askingPrice)} is below market.</span>
                </div>
              )}
              {askingVerdict === 'fair' && (
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-verdict-fair/10 text-verdict-fair">
                  <Minus className="w-4 h-4" />
                  <span className="text-sm font-semibold">Fair price. {fmtCurrency(askingPrice)} is within the normal range.</span>
                </div>
              )}
              {askingVerdict === 'above' && (
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-destructive/10 text-destructive">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-sm font-semibold">
                    Overpriced. Similar units rent for {fmtCurrency(askingPrice - rangeHigh)} less.
                  </span>
                </div>
              )}
            </motion.div>
          )}
        </motion.div>

        <div className="flex justify-center">
          <DataConfidenceBadge level={confidence.level} note={confidence.note} />
        </div>
      </section>

      {/* Section 2: Market Conditions */}
      <section id="section-market" className="max-w-2xl mx-auto px-4 sm:px-6 py-8 border-t border-border">
        <motion.div {...fade(0)}>
          <h2 className="font-display text-xl font-semibold text-foreground tracking-tight mb-5">Market Conditions</h2>

          <div className="grid grid-cols-2 gap-3 mb-5">
            {/* Rent trend */}
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Area Rent Trend</p>
              <div className="flex items-center gap-1.5">
                {marketYoy > 0 ? <TrendingUp className="w-4 h-4 text-destructive" /> : marketYoy < 0 ? <TrendingDown className="w-4 h-4 text-verdict-good" /> : <Minus className="w-4 h-4 text-muted-foreground" />}
                <span className="font-display text-xl font-bold tabular-nums text-foreground">
                  {marketYoy > 0 ? '+' : ''}{marketYoy.toFixed(1)}%
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">year-over-year</p>
            </div>

            {/* Vacancy */}
            {rentData.alVacancy != null && (
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Vacancy Rate</p>
                <p className="font-display text-xl font-bold tabular-nums text-foreground">{rentData.alVacancy.toFixed(1)}%</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Apartment List</p>
              </div>
            )}

            {/* Days on market */}
            {rcMarket.rcAvgDaysOnMarket != null && (
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Avg. Days on Market</p>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="font-display text-xl font-bold tabular-nums text-foreground">{rcMarket.rcAvgDaysOnMarket}</span>
                </div>
              </div>
            )}

            {/* Active listings */}
            {rcMarket.rcTotalListings != null && (
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Active Listings</p>
                <div className="flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  <span className="font-display text-xl font-bold tabular-nums text-foreground">{rcMarket.rcTotalListings}</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">in {zip}</p>
              </div>
            )}
          </div>

          {/* Editorial */}
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-foreground">
              This is a <strong>{marketCondition} market</strong>.
              {marketCondition === "renter's" && ' Higher vacancy and slower leasing give renters more negotiating power.'}
              {marketCondition === "landlord's" && ' Low vacancy and fast leasing mean landlords hold more power.'}
              {marketCondition === 'balanced' && ' Supply and demand are relatively balanced in this area.'}
            </p>
          </div>
        </motion.div>
      </section>

      {/* Section 3: Nearby Comparables (gated) */}
      {compsWithRent.length > 0 && (
        <section id="section-comps" className="max-w-2xl mx-auto px-4 sm:px-6 py-8 border-t border-border">
          <motion.div {...fade(0)}>
            <h2 className="font-display text-xl font-semibold text-foreground tracking-tight mb-5">Nearby Comparables</h2>

            {/* Visible comps */}
            <div className="space-y-1">
              {visibleComps.map((comp, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.3 }}
                  className={`flex items-start justify-between gap-4 px-4 py-3 rounded-md ${i % 2 === 0 ? 'bg-muted/40' : ''}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate flex items-center gap-1.5">
                      <MapPin className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                      {comp.formattedAddress}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {comp.bedrooms !== null && `${comp.bedrooms === 0 ? 'Studio' : `${comp.bedrooms}BR`}`}
                      {comp.bathrooms !== null && ` · ${comp.bathrooms}BA`}
                      {comp.squareFootage !== null && ` · ${fmt(comp.squareFootage)} sqft`}
                      {comp.distance !== null && ` · ${comp.distance.toFixed(1)} mi`}
                    </p>
                  </div>
                  {comp.rent !== null && (
                    <span className="text-sm font-semibold text-foreground whitespace-nowrap">
                      ${fmt(comp.rent)}/mo
                    </span>
                  )}
                </motion.div>
              ))}
            </div>

            {/* Comp gate */}
            {gatedComps.length > 0 && !compsUnlocked && (
              <div ref={compGateRef} className="mt-4">
                {/* Blurred preview */}
                <div className="relative">
                  <div className="space-y-1 blur-sm select-none pointer-events-none">
                    {gatedComps.slice(0, 3).map((comp, i) => (
                      <div key={i} className={`flex items-start justify-between gap-4 px-4 py-3 rounded-md ${i % 2 === 0 ? 'bg-muted/40' : ''}`}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{comp.formattedAddress}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {comp.bedrooms !== null && `${comp.bedrooms === 0 ? 'Studio' : `${comp.bedrooms}BR`}`}
                          </p>
                        </div>
                        <span className="text-sm font-semibold text-foreground">${fmt(comp.rent ?? 0)}/mo</span>
                      </div>
                    ))}
                  </div>

                  {/* Gate overlay */}
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-transparent via-card/80 to-card rounded-lg">
                    <form onSubmit={handleCompGateSubmit} className="bg-card border border-border rounded-xl p-5 shadow-lg max-w-sm w-full mx-4">
                      <p className="text-sm font-semibold text-foreground mb-1">
                        {gatedComps.length} more comparable rentals nearby
                      </p>
                      <p className="text-xs text-muted-foreground mb-3">Enter your email to see all comps</p>
                      <div className="flex gap-2">
                        <input
                          type="email"
                          placeholder="you@email.com"
                          value={compEmail}
                          onChange={(e) => setCompEmail(e.target.value)}
                          className="flex-1 min-w-0 px-3 py-2.5 text-sm border border-border rounded-lg bg-card text-foreground outline-none focus:border-foreground transition-colors placeholder:text-muted-foreground/50"
                        />
                        <button
                          type="submit"
                          disabled={compEmailLoading}
                          className="bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity whitespace-nowrap shrink-0 disabled:opacity-50"
                        >
                          Unlock →
                        </button>
                      </div>
                      {compEmailError && <p className="text-xs text-destructive mt-1.5">{compEmailError}</p>}
                    </form>
                  </div>
                </div>
              </div>
            )}

            {/* Unlocked gated comps */}
            {compsUnlocked && gatedComps.length > 0 && (
              <div className="space-y-1 mt-1">
                {gatedComps.map((comp, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04, duration: 0.3 }}
                    className={`flex items-start justify-between gap-4 px-4 py-3 rounded-md ${(visibleCount + i) % 2 === 0 ? 'bg-muted/40' : ''}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate flex items-center gap-1.5">
                        <MapPin className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                        {comp.formattedAddress}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {comp.bedrooms !== null && `${comp.bedrooms === 0 ? 'Studio' : `${comp.bedrooms}BR`}`}
                        {comp.bathrooms !== null && ` · ${comp.bathrooms}BA`}
                        {comp.squareFootage !== null && ` · ${fmt(comp.squareFootage)} sqft`}
                        {comp.distance !== null && ` · ${comp.distance.toFixed(1)} mi`}
                      </p>
                    </div>
                    {comp.rent !== null && (
                      <span className="text-sm font-semibold text-foreground whitespace-nowrap">
                        ${fmt(comp.rent)}/mo
                      </span>
                    )}
                  </motion.div>
                ))}
              </div>
            )}

            {medianCompRent && (
              <p className="text-xs text-muted-foreground mt-3">
                Median comp rent: <strong>{fmtCurrency(medianCompRent)}</strong> · Source: Rentcast
              </p>
            )}
          </motion.div>
        </section>
      )}

      {/* Section 4: Negotiation Tips (gated — only if asking is above range) */}
      {askingPrice && askingVerdict === 'above' && (
        <section id="section-tips" className="max-w-2xl mx-auto px-4 sm:px-6 py-8 border-t border-border">
          <motion.div {...fade(0)}>
            <h2 className="font-display text-xl font-semibold text-foreground tracking-tight mb-3">Negotiation Tips</h2>
            <p className="text-sm text-muted-foreground mb-5">
              Based on market data, here's how to negotiate this listing down:
            </p>

            {tipsUnlocked ? (
              <div className="space-y-4">
                <div className="space-y-3">
                  <div className="rounded-lg border border-border bg-card p-4">
                    <p className="text-sm text-foreground">
                      📊 The fair range for a {brLabel} in {locationLabel} is <strong>{fmtCurrency(rangeLow)} – {fmtCurrency(rangeHigh)}</strong>. The asking price of {fmtCurrency(askingPrice)} is {fmtCurrency(askingPrice - rangeHigh)} above this range.
                    </p>
                  </div>

                  {rcMarket.rcTotalListings != null && rcMarket.rcTotalListings > 3 && (
                    <div className="rounded-lg border border-border bg-card p-4">
                      <p className="text-sm text-foreground">
                        🏘️ There are <strong>{rcMarket.rcTotalListings} active listings</strong> in this ZIP code, giving you options.
                      </p>
                    </div>
                  )}

                  {rcMarket.rcAvgDaysOnMarket != null && rcMarket.rcAvgDaysOnMarket > 15 && (
                    <div className="rounded-lg border border-border bg-card p-4">
                      <p className="text-sm text-foreground">
                        ⏱️ Units sit for <strong>{rcMarket.rcAvgDaysOnMarket} days on average</strong> — the landlord has incentive to deal.
                      </p>
                    </div>
                  )}

                  {marketYoy < 0 && (
                    <div className="rounded-lg border border-border bg-card p-4">
                      <p className="text-sm text-foreground">
                        📉 Rents in this area are <strong>declining ({marketYoy.toFixed(1)}% YoY)</strong> — use this as leverage.
                      </p>
                    </div>
                  )}
                </div>

                {/* Template email */}
                <div className="rounded-lg border border-border bg-card p-5">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2 font-semibold">Template email to the landlord</p>
                  <div className="text-sm text-foreground/90 leading-relaxed space-y-3 bg-muted/30 rounded-lg p-4">
                    <p>Hi,</p>
                    <p>
                      Thank you for showing me the unit. I'm very interested, but wanted to discuss the asking rent of {fmtCurrency(askingPrice)}/month.
                    </p>
                    <p>
                      Based on my research, comparable {brLabel}s in {locationLabel} are renting for {fmtCurrency(rangeLow)}–{fmtCurrency(rangeHigh)}/month.
                      {medianCompRent && ` The median rent for similar units nearby is ${fmtCurrency(medianCompRent)}.`}
                    </p>
                    <p>
                      Would you consider {fmtCurrency(rangeHigh)}/month? I'm ready to sign a lease quickly and am a responsible tenant.
                    </p>
                    <p>Looking forward to hearing from you.</p>
                  </div>
                  <button
                    onClick={() => {
                      const text = `Hi,\n\nThank you for showing me the unit. I'm very interested, but wanted to discuss the asking rent of ${fmtCurrency(askingPrice)}/month.\n\nBased on my research, comparable ${brLabel}s in ${locationLabel} are renting for ${fmtCurrency(rangeLow)}–${fmtCurrency(rangeHigh)}/month.${medianCompRent ? ` The median rent for similar units nearby is ${fmtCurrency(medianCompRent)}.` : ''}\n\nWould you consider ${fmtCurrency(rangeHigh)}/month? I'm ready to sign a lease quickly and am a responsible tenant.\n\nLooking forward to hearing from you.`;
                      navigator.clipboard.writeText(text);
                      toast.success('Copied to clipboard!');
                      trackEvent('letter_copied', { source: 'wsip' });
                    }}
                    className="mt-3 text-xs text-primary font-semibold hover:underline"
                  >
                    Copy to clipboard →
                  </button>
                </div>

                {/* Post-conversion flow */}
                <PostConversionFlow
                  email={capturedEmail}
                  leadContext={leadContext}
                  verdictLabel={verdictLabel}
                  zip={zip}
                />
              </div>
            ) : (
              /* Tips gate */
              <div className="relative">
                <div className="space-y-3 blur-sm select-none pointer-events-none">
                  <div className="rounded-lg border border-border bg-card p-4">
                    <p className="text-sm text-foreground">📊 The fair range for a {brLabel} in {locationLabel} is...</p>
                  </div>
                  <div className="rounded-lg border border-border bg-card p-4">
                    <p className="text-sm text-foreground">🏘️ There are X active listings in this ZIP...</p>
                  </div>
                  <div className="rounded-lg border border-border bg-card p-5">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2 font-semibold">Template email</p>
                    <p className="text-sm text-foreground/90">Hi, Thank you for showing me the unit...</p>
                  </div>
                </div>
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-transparent via-card/80 to-card rounded-lg">
                  <form onSubmit={handleTipsGateSubmit} className="bg-card border border-border rounded-xl p-5 shadow-lg max-w-sm w-full mx-4">
                    <p className="text-sm font-semibold text-foreground mb-1">
                      Unlock negotiation tips & email template
                    </p>
                    <p className="text-xs text-muted-foreground mb-3">Data-backed tips to negotiate this listing down</p>
                    <div className="flex gap-2">
                      <input
                        type="email"
                        placeholder="you@email.com"
                        value={tipsEmail}
                        onChange={(e) => setTipsEmail(e.target.value)}
                        className="flex-1 min-w-0 px-3 py-2.5 text-sm border border-border rounded-lg bg-card text-foreground outline-none focus:border-foreground transition-colors placeholder:text-muted-foreground/50"
                      />
                      <button
                        type="submit"
                        disabled={tipsEmailLoading}
                        className="bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity whitespace-nowrap shrink-0 disabled:opacity-50"
                      >
                        Unlock →
                      </button>
                    </div>
                    {tipsEmailError && <p className="text-xs text-destructive mt-1.5">{tipsEmailError}</p>}
                    <SocialProofLine />
                  </form>
                </div>
              </div>
            )}
          </motion.div>
        </section>
      )}

      {/* Post-conversion (non-above path) */}
      {capturedEmail && (!askingPrice || askingVerdict !== 'above') && (
        <section className="max-w-2xl mx-auto px-4 sm:px-6 py-8 border-t border-border">
          <PostConversionFlow
            email={capturedEmail}
            leadContext={leadContext}
            verdictLabel={verdictLabel}
            zip={zip}
          />
        </section>
      )}

      {/* Share Section */}
      <section id="section-share" className="max-w-2xl mx-auto px-4 sm:px-6 py-8 border-t border-border">
        <motion.div {...fade(0)} className="text-center">
          <h2 className="font-display text-xl font-semibold text-foreground tracking-tight mb-2">Share This Analysis</h2>
          <p className="text-sm text-muted-foreground mb-5">
            Know someone apartment hunting in {locationLabel}? Share this tool.
          </p>
          <Suspense fallback={null}>
            <ShareHub
              reportPayload={{
                zip,
                address: fullAddress || null,
                bedrooms: bedroomNum,
                currentRent: askingPrice ?? 0,
                proposedIncrease: 0,
                increaseType: 'percent' as const,
                reportData: {
                  city, state,
                  rangeLow, rangeHigh,
                  askingPrice,
                  askingVerdict,
                  marketYoy,
                  fmr,
                  medianCompRent,
                  bedroomLabel: bedroomLabels[bedrooms],
                },
              }}
              zip={zip}
              city={city}
              state={state}
              brLabel={brLabel}
              analysisId={analysisId}
              verdictLabel={verdictLabel}
              capturedEmail={capturedEmail}
              medianCompRent={medianCompRent}
              askingRent={askingPrice ?? 0}
              fairnessScore={null}
            />
          </Suspense>
        </motion.div>
      </section>

      {/* Cross-link to renewal tool */}
      <section className="max-w-2xl mx-auto px-4 sm:px-6 py-8 border-t border-border text-center">
        <p className="text-sm text-muted-foreground mb-2">Already have a lease?</p>
        <Link
          to={`/?zip=${zip}&bedrooms=${bedrooms}`}
          className="text-sm text-primary font-semibold hover:underline"
        >
          Check if your rent increase is fair →
        </Link>
      </section>
    </main>
  );
};

export default WhatShouldIPay;
