import { useState, useRef, useEffect, useMemo, lazy, Suspense, useCallback } from 'react';
import { ChevronRight, MessageSquareText, Calculator, Building2 } from 'lucide-react';
import { usePrerenderReady } from '@/hooks/usePrerenderReady';
import { useSearchParams, Link } from 'react-router-dom';
import { getAnalysisFingerprint, addPaidAnalysis, isAnalysisPaid } from '@/lib/analysisFingerprint';
import SampleResultCard from '@/components/SampleResultCard';
import { supabase } from '@/integrations/supabase/client';
import { notifySubmission } from '@/lib/notifySubmission';
const LocationSearch = lazy(() => import('@/components/LocationSearch'));
const BrowseDealsSection = lazy(() => import('@/components/BrowseDealsSection'));

const POPULAR_CITIES = [
  { city: 'New York', stateSlug: 'new-york', citySlug: 'new-york' },
  { city: 'Los Angeles', stateSlug: 'california', citySlug: 'los-angeles' },
  { city: 'Chicago', stateSlug: 'illinois', citySlug: 'chicago' },
  { city: 'Houston', stateSlug: 'texas', citySlug: 'houston' },
  { city: 'Phoenix', stateSlug: 'arizona', citySlug: 'phoenix' },
  { city: 'Philadelphia', stateSlug: 'pennsylvania', citySlug: 'philadelphia' },
  { city: 'San Diego', stateSlug: 'california', citySlug: 'san-diego' },
  { city: 'Dallas', stateSlug: 'texas', citySlug: 'dallas' },
];
import RentForm, { RentFormData, RentFormPrefill } from '@/components/RentForm';
import { lookupRentData, loadFredTrend, RentLookupResult } from '@/data/rentData';
import { usePropertyLookup } from '@/hooks/usePropertyLookup';
import { toast } from 'sonner';
import { trackEvent } from '@/lib/analytics';
import { EMAIL_GATE_ENABLED } from '@/lib/featureFlags';
import SEO from '@/components/SEO';
import LoadingAnalysis from '@/components/LoadingAnalysis';
import { getDemoData } from '@/data/demoData';
import { getRememberedEmail, rememberEmail } from '@/lib/emailMemory';
import { getUtmParams } from '@/lib/utm';

// Lazy-load heavy below-fold components to reduce initial bundle
const RentResults = lazy(() => import('@/components/RentResults'));
const SocialProofCounter = lazy(() => import('@/components/SocialProofCounter'));
const ContactModal = lazy(() => import('@/components/ContactModal'));
const HomeFAQ = lazy(() => import('@/components/HomeFAQ'));
const HowItWorks = lazy(() => import('@/components/HowItWorks'));
const SEOFooter = lazy(() => import('@/components/SEOFooter'));


const Index = () => {
  const [searchParams] = useSearchParams();
  const [results, setResults] = useState<{ formData: RentFormData; rentData: RentLookupResult } | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [navScrolled, setNavScrolled] = useState(false);
  const [capturedEmail, setCapturedEmailRaw] = useState(() => searchParams.get('demo') ? '' : getRememberedEmail());
  const setCapturedEmail = (email: string) => {
    setCapturedEmailRaw(email);
    if (email) rememberEmail(email);
  };
  const [formKey, setFormKey] = useState(0);
  const propertyLookup = usePropertyLookup();
  const topRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const [isPaid, setIsPaid] = useState(false);
  const [paidFallbackMsg, setPaidFallbackMsg] = useState<string | null>(null);

  // Handle ?paid=true return from Stripe
  useEffect(() => {
    if (!searchParams.has('paid') || searchParams.get('paid') !== 'true') return;
    const sessionId = searchParams.get('session_id') || '';

    try {
      const raw = localStorage.getItem('rr_checkout_state');
      if (raw) {
        const savedState = JSON.parse(raw);
        const age = Date.now() - (savedState.timestamp || 0);
        if (age < 3600000) { // 1 hour
          setResults({ formData: savedState.formData, rentData: savedState.rentData });
          if (savedState.capturedEmail) setCapturedEmailRaw(savedState.capturedEmail);

          addPaidAnalysis({
            sessionId,
            fingerprint: savedState.analysisFingerprint,
            timestamp: Date.now(),
          });
          setIsPaid(true);

          // Clean URL
          window.history.replaceState({}, '', window.location.pathname);
          localStorage.removeItem('rr_checkout_state');

          // GA4 + Supabase events using restored values
          trackEvent('purchase_completed', { verdict: savedState.verdict, zip: savedState.formData.zip });
          import('@/integrations/supabase/client').then(({ supabase }) => {
            supabase.from('lead_events' as any).insert({
              event_type: 'purchase_completed',
              email: savedState.capturedEmail || 'anonymous@checkout',
              zip: savedState.formData.zip,
              verdict: savedState.verdict,
            }).then(() => {});
          });

          // Scroll to letter after short delay
          setTimeout(() => {
            document.getElementById('section-letter')?.scrollIntoView({ behavior: 'smooth' });
          }, 500);
          return;
        }
      }
    } catch { /* ignore parse errors */ }

    // Fallback: no valid state
    window.history.replaceState({}, '', window.location.pathname);
    setPaidFallbackMsg('Payment received! Run your analysis again and your letter will unlock automatically.');
  }, []);

  // Restore results from checkout state when user returns without paying (back button / cancel)
  useEffect(() => {
    if (searchParams.has('paid')) return; // handled above
    if (results) return; // already have results
    try {
      const raw = localStorage.getItem('rr_checkout_state');
      if (raw) {
        const savedState = JSON.parse(raw);
        const age = Date.now() - (savedState.timestamp || 0);
        if (age < 3600000 && savedState.formData && savedState.rentData) {
          setResults({ formData: savedState.formData, rentData: savedState.rentData });
          if (savedState.capturedEmail) setCapturedEmailRaw(savedState.capturedEmail);
        }
      }
    } catch { /* ignore */ }
  }, []);

  // Demo mode: ?demo=above|fair|below|none
  useEffect(() => {
    const demo = searchParams.get('demo');
    const demoData = getDemoData(demo);
    if (demoData && !results) {
      setResults(demoData);
    }
  }, [searchParams]);

  // Read URL params for pre-fill (from reminder emails)
  const prefill = useMemo<RentFormPrefill | undefined>(() => {
    const zip = searchParams.get('zip');
    const bedrooms = searchParams.get('bedrooms');
    const rent = searchParams.get('rent');
    const address = searchParams.get('address');
    if (!zip && !bedrooms && !rent && !address) return undefined;
    return {
      zip: zip || undefined,
      bedrooms: bedrooms !== null ? parseInt(bedrooms, 10) : undefined,
      rent: rent !== null ? parseInt(rent, 10) : undefined,
      address: address || undefined,
    };
  }, [searchParams]);

  useEffect(() => {
    if (!results) { setNavScrolled(false); return; }
    const onScroll = () => setNavScrolled(window.scrollY > window.innerHeight * 0.7);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [results]);

  usePrerenderReady(!isLoading);

  const [verdictStr, setVerdictStr] = useState<'above' | 'at-market' | 'below'>('at-market');
  const isAboveMarket = verdictStr === 'above';

  const hasIncrease = !!(results && results.formData.rentIncrease && results.formData.rentIncrease > 0);
  const isUnlocked = !!capturedEmail || !EMAIL_GATE_ENABLED;

  // Check if current analysis matches a previously paid fingerprint
  useEffect(() => {
    if (!results) return;
    const fp = getAnalysisFingerprint(results.formData);
    if (isAnalysisPaid(fp)) {
      setIsPaid(true);
    }
  }, [results]);

  const handlePaid = useCallback((walletEmail?: string) => {
    if (!results) return;
    const fp = getAnalysisFingerprint(results.formData);
    addPaidAnalysis({ sessionId: 'wallet-' + Date.now(), fingerprint: fp, timestamp: Date.now() });
    setIsPaid(true);

    const email = walletEmail || capturedEmail || 'anonymous@checkout';

    if (walletEmail && !capturedEmail) {
      setCapturedEmailRaw(walletEmail);
      rememberEmail(walletEmail);
    }

    trackEvent('purchase_completed', { verdict: verdictStr, zip: results.formData.zip });
    supabase.from('lead_events' as any).insert({
      event_type: 'purchase_completed',
      email,
      zip: results.formData.zip,
      verdict: verdictStr,
    }).then(() => {});

    if (walletEmail) {
      const utm = getUtmParams();
      const fd = results.formData;
      const rd = results.rentData;
      const increasePct = fd.rentIncrease && fd.currentRent
        ? fd.increaseIsPercent
          ? fd.rentIncrease
          : ((fd.rentIncrease / fd.currentRent) * 100)
        : null;

      const leadParams = {
        p_email: walletEmail,
        p_analysis_id: null,
        p_capture_source: 'stripe_express_checkout',
        p_address: fd.fullAddress || null,
        p_city: rd.city || null,
        p_state: rd.state || null,
        p_zip: fd.zip || null,
        p_bedrooms: fd.bedrooms ?? null,
        p_current_rent: fd.currentRent ?? null,
        p_proposed_rent: fd.currentRent && fd.rentIncrease
          ? fd.increaseIsPercent
            ? Math.round(fd.currentRent * (1 + fd.rentIncrease / 100))
            : fd.currentRent + fd.rentIncrease
          : null,
        p_increase_pct: increasePct ?? null,
        p_verdict: verdictStr || null,
        p_utm_source: utm.utm_source || null,
        p_utm_medium: utm.utm_medium || null,
        p_utm_campaign: utm.utm_campaign || null,
        p_fairness_score: null,
        p_comp_median_rent: null,
        p_hud_fmr_value: rd.fmr ?? null,
        p_tool_type: 'renewal',
      } as any;

      supabase.rpc('upsert_lead', leadParams).then(({ error: rpcError }) => {
        if (rpcError) {
          console.warn('[lead] upsert_lead failed (wallet):', rpcError.message);
        }
      });
    }

    setTimeout(() => {
      document.getElementById('section-letter')?.scrollIntoView({ behavior: 'smooth' });
    }, 300);
  }, [results, capturedEmail, verdictStr]);

  const handleSubmit = async (data: RentFormData) => {
    setIsLoading(true);
    setIsPaid(false); // Reset paid state for new analysis
    setPaidFallbackMsg(null);
    setCapturedEmailRaw(getRememberedEmail());

    try {
      if (data.fullAddress) {
        const propResult = await propertyLookup.lookup(data.fullAddress).catch(() => null);
        const zip = propResult?.zipCode || data.zip;
        const rentData = await lookupRentData(zip, data.bedrooms);
        if (!rentData) {
          toast.error(`We don't have rent data for that area yet. Try entering your 5-digit zip code instead.`);
          setIsLoading(false);
          return;
        }

        setResults({ formData: { ...data, zip }, rentData });
        trackEvent('analysis_started', { tool: 'renewal', zip, bedrooms: data.bedrooms, has_address: true });
        setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);

        loadFredTrend(rentData.metro).then((fredTrend) => {
          if (fredTrend) {
            setResults((prev) =>
              prev ? { ...prev, rentData: { ...prev.rentData, fredTrend } } : prev
            );
          }
        });
      } else {
        const rentData = await lookupRentData(data.zip, data.bedrooms);
        if (!rentData) {
          toast.error(`We don't have data for ${data.zip} yet. Try a nearby zip code.`);
          setIsLoading(false);
          return;
        }

        setResults({ formData: data, rentData });
        trackEvent('analysis_started', { tool: 'renewal', zip: data.zip, bedrooms: data.bedrooms, has_address: false });
        setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);

        loadFredTrend(rentData.metro).then((fredTrend) => {
          if (fredTrend) {
            setResults((prev) =>
              prev ? { ...prev, rentData: { ...prev.rentData, fredTrend } } : prev
            );
          }
        });
      }
    } catch (err) {
      toast.error('Something went wrong loading rent data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-x-hidden" ref={topRef}>
      <SEO
        title="Is Your Rent Increase Fair? Free Rent Check Tool | RenewalReply"
        description="Check if your rent increase is fair in 10 seconds. Get your counter-offer range, local comps, and market evidence. 38,600+ ZIP codes covered."
        canonical="/"
        jsonLd={[
          {
            "@type": "WebApplication",
            "name": "RenewalReply Rent Increase Tool",
            "url": "https://www.renewalreply.com",
            "description": "Free tool to check if your rent increase is fair using real nearby listings, Zillow rent trends, and HUD Fair Market Rents for 38,600+ US zip codes.",
            "applicationCategory": "FinanceApplication",
            "operatingSystem": "Web",
            "browserRequirements": "Requires JavaScript",
            "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
            "featureList": [
              "Compare rent increases to HUD Fair Market Rent",
              "Generate negotiation reply",
              "Coverage for 38,600+ US zip codes",
              "Uses HUD SAFMR, Zillow ZORI, and real comparable listings"
            ],
            "author": { "@type": "Organization", "name": "RenewalReply" }
          },
          {
            "@type": "FAQPage",
            "mainEntity": [
              {
                "@type": "Question",
                "name": "Is my rent increase fair?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "A rent increase is generally fair if it aligns with the year-over-year rent trend in your area. RenewalReply's free Fairness Score tool compares your specific increase to local market trends from Apartment List, Zillow ZORI, and HUD data, plus real comparable listings near your address. Enter your ZIP code, bedroom count, and rent details to get an instant score across 38,600+ US zip codes."
                }
              },
              {
                "@type": "Question",
                "name": "How do I know if my rent increase is fair?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Compare your proposed rent to real comparable listings near your address. RenewalReply checks your rent increase against nearby listings, Zillow rent trends, and HUD Fair Market Rent data for your zip code."
                }
              },
              {
                "@type": "Question",
                "name": "What data does RenewalReply use?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "RenewalReply uses HUD Small Area Fair Market Rents (SAFMR) for FY2026, Zillow Observed Rent Index (ZORI), Apartment List rent trends, and real-time comparable rental listings to give you a complete picture of your local rental market."
                }
              },
              {
                "@type": "Question",
                "name": "Is RenewalReply free?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "The rent analysis is completely free, including your fairness score, market evidence, and comparable rents. Your exact counter-offer number and a personalized negotiation reply are available for $4.99."
                }
              },
              {
                "@type": "Question",
                "name": "How many zip codes does RenewalReply cover?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "RenewalReply covers 38,600+ US zip codes using real nearby listings, Zillow rent trends, and HUD Fair Market Rent data, making it one of the most comprehensive rent fairness tools available."
                }
              }
            ]
          },
          {
            "@type": "Organization",
            "name": "RenewalReply",
            "url": "https://www.renewalreply.com",
            "logo": "https://www.renewalreply.com/renewalreply-logo-square.png",
            "description": "Free rent fairness analysis and apartment deal scoring for renters across 38,600+ US zip codes.",
            "sameAs": [
              "https://www.tiktok.com/@rentfacts",
              "https://www.instagram.com/rentfacts"
            ]
          }
        ]}
      />
      {/* Sticky Nav */}
      <nav
        className={`fixed top-0 left-0 right-0 z-[60] flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 transition-all duration-200 animate-fade-in ${
          results && !navScrolled ? 'bg-transparent' : 'bg-card'
        }`}
        style={{
          boxShadow: !results || !navScrolled ? 'none' : '0 1px 3px rgba(0,0,0,0.08)',
        }}
      >
        <img
          src="/renewalreply-wordmark.png"
          alt="RenewalReply"
          width="140"
          height="24"
          fetchPriority="high"
          className="h-5 sm:h-6 w-auto object-contain cursor-pointer hover:scale-105 transition-transform duration-200 shrink-0"
          onClick={() => { setResults(null); setFormKey(k => k + 1); setCapturedEmailRaw(getRememberedEmail()); window.scrollTo({ top: 0 }); }}
        />
        <div className="flex items-center gap-2 sm:gap-3">
          {results && (
            <button onClick={() => { setResults(null); setFormKey(k => k + 1); setCapturedEmailRaw(getRememberedEmail()); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="text-[12px] sm:text-[13px] text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap">
              ← New check
            </button>
          )}
          {results && hasIncrease && isAboveMarket && !isUnlocked && (
            <button
              onClick={() => {
                document.getElementById('section-gate')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="max-md:hidden bg-primary text-primary-foreground px-3 sm:px-4 py-2 rounded-lg text-[12px] sm:text-[13px] font-semibold hover:brightness-90 transition-all duration-150 shadow-sm shadow-primary/20 whitespace-nowrap"
            >
              <span className="hidden sm:inline">Get my letter →</span>
              <span className="sm:hidden">Get letter →</span>
            </button>
          )}
          {results && hasIncrease && isAboveMarket && isUnlocked && (
            <button
              onClick={() => {
                document.getElementById('section-letter')?.scrollIntoView({ behavior: 'smooth' });
                const letterEl = document.querySelector('[data-letter-content]');
                if (letterEl) {
                  navigator.clipboard.writeText(letterEl.textContent || '').then(() => {
                    import('sonner').then(({ toast }) => toast.success('Letter copied to clipboard!'));
                  }).catch(() => {});
                }
              }}
              className="max-md:hidden bg-primary text-primary-foreground px-3 sm:px-4 py-2 rounded-lg text-[12px] sm:text-[13px] font-semibold hover:brightness-90 transition-all duration-150 shadow-sm shadow-primary/20 whitespace-nowrap"
            >
              <span className="hidden sm:inline">Copy your letter →</span>
              <span className="sm:hidden">Copy letter →</span>
            </button>
          )}
          {results && !(hasIncrease && isAboveMarket) && !isUnlocked && (
            <button
              onClick={() => {
                document.getElementById('section-gate')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="max-md:hidden bg-primary text-primary-foreground px-3 sm:px-4 py-2 rounded-lg text-[12px] sm:text-[13px] font-semibold hover:brightness-90 transition-all duration-150 shadow-sm shadow-primary/20 whitespace-nowrap"
            >
              <span className="hidden sm:inline">Save my results →</span>
              <span className="sm:hidden">Save results →</span>
            </button>
          )}
          {results && !(hasIncrease && isAboveMarket) && isUnlocked && (
            <button
              onClick={() => {
                document.getElementById('section-share')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="max-md:hidden bg-primary text-primary-foreground px-3 sm:px-4 py-2 rounded-lg text-[12px] sm:text-[13px] font-semibold hover:brightness-90 transition-all duration-150 shadow-sm shadow-primary/20 whitespace-nowrap"
            >
              <span className="hidden sm:inline">Share this tool →</span>
              <span className="sm:hidden">Share →</span>
            </button>
          )}
          {!results && (
            <>
              <Link
                to="/deals"
                className="text-muted-foreground hover:text-foreground text-[12px] sm:text-[13px] font-medium transition-colors whitespace-nowrap"
              >
                Deals
              </Link>
              <Link
                to="/guides"
                className="text-muted-foreground hover:text-foreground text-[12px] sm:text-[13px] font-medium transition-colors whitespace-nowrap"
              >
                Guides
              </Link>
              <Link
                to="/what-should-i-pay"
                className="text-muted-foreground hover:text-foreground text-[12px] sm:text-[13px] font-medium transition-colors whitespace-nowrap hidden lg:inline-block"
              >
                Check Asking Price →
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* Spacer for fixed nav */}
      <div className="h-[48px] sm:h-[56px]" />

      {isLoading ? (
        <LoadingAnalysis />
      ) : !results ? (
        <main className="max-w-[620px] lg:max-w-[960px] mx-auto px-5 sm:px-6 pt-6 sm:pt-14 lg:pt-[90px] pb-10 sm:pb-14 lg:pb-16">
          <div className="lg:grid lg:grid-cols-[1fr_380px] lg:gap-8 lg:items-start">
            {/* Left column: sales message */}
            <div>
              <h1 className="font-display text-[1.85rem] sm:text-[clamp(2rem,5vw,3rem)] lg:text-[clamp(44px,4vw,56px)] text-foreground leading-[1.08] lg:leading-[1.08] tracking-tight font-extrabold" style={{ letterSpacing: '-0.03em' }}>
                Is your rent increase <span className="text-primary">above&nbsp;market?</span>
              </h1>
              <p className="mt-2 sm:mt-3 lg:mt-5 text-[15px] sm:text-lg lg:text-[clamp(19px,1.7vw,24px)] text-muted-foreground lg:text-foreground/60 max-w-[700px] leading-relaxed font-normal tracking-tight lg:whitespace-nowrap">
                Find out in 10 seconds. Free, no account needed.
              </p>

              {/* Value props */}
              <div className="mt-3 sm:mt-5 lg:mt-7 flex flex-col gap-1.5 sm:gap-2 lg:gap-3.5 max-w-[600px]">
                <div className="flex items-start gap-2 lg:gap-3">
                  <span className="text-primary mt-0.5 shrink-0"><MessageSquareText size={15} className="lg:w-[22px] lg:h-[22px]" /></span>
                  <span className="text-[14px] lg:text-[clamp(17px,1.4vw,21px)] text-muted-foreground lg:text-foreground/55 leading-snug lg:whitespace-nowrap"><span className="text-[14px] lg:text-[clamp(17px,1.4vw,21px)] text-muted-foreground lg:text-foreground/55 leading-snug lg:whitespace-nowrap"><strong className="text-foreground font-bold">Negotiation reply</strong> you can send to your landlord</span></span>
                </div>
                <div className="flex items-start gap-2 lg:gap-3">
                  <span className="text-primary mt-0.5 shrink-0"><Calculator size={15} className="lg:w-[22px] lg:h-[22px]" /></span>
                  <span className="text-[14px] lg:text-[clamp(17px,1.4vw,21px)] text-muted-foreground lg:text-foreground/55 leading-snug lg:whitespace-nowrap"><strong className="text-foreground font-bold">Counter-offer range</strong> from real comps nearby</span>
                </div>
                <div className="flex items-start gap-2 lg:gap-3">
                  <span className="text-primary mt-0.5 shrink-0"><Building2 size={15} className="lg:w-[22px] lg:h-[22px]" /></span>
                  <span className="text-[14px] lg:text-[clamp(17px,1.4vw,21px)] text-muted-foreground lg:text-foreground/55 leading-snug lg:whitespace-nowrap"><strong className="text-foreground font-bold">Available apartments</strong> nearby that could save you money</span>
                </div>
              </div>


              {/* Sample result preview — desktop only */}
              <div className="hidden md:block mt-5 lg:mt-6">
                <SampleResultCard />
              </div>

              {/* Data source bar — desktop only */}
              <div className="hidden lg:block mt-5">
                <div className="border-t border-border/50 pt-4 pb-2 text-center">
                  <p className="text-[13px] text-muted-foreground/80 tracking-wide whitespace-nowrap">
                    Powered by: Live Comps · Zillow ZORI · Apartment List · HUD FMR · DHCR
                  </p>
                </div>
              </div>
            </div>

            {/* Right column: form card */}
            <section id="main-content" className="mt-3 sm:mt-6 lg:mt-4" aria-label="Rent increase checker">
              <div>
                <RentForm key={formKey} onSubmit={handleSubmit} isLoading={isLoading} prefill={prefill} />
              </div>
              <Suspense fallback={null}>
                <div className="mt-2 flex justify-center">
                  <SocialProofCounter />
                </div>
              </Suspense>
              {/* Data source bar — mobile/tablet only */}
              <div className="mt-4 max-w-[540px] mx-auto lg:hidden">
                <div className="border-t border-border/40 pt-3 pb-2 px-1 text-center">
                  <p className="text-[11px] text-muted-foreground/70 tracking-wide">
                    Live Comps · Zillow ZORI · Apartment List · HUD Fair Market Rent · DHCR
                  </p>
                </div>
              </div>
            </section>
          </div>
        </main>
      ) : (
        <div ref={resultsRef}>
          {paidFallbackMsg && (
            <div className="max-w-md mx-auto mt-4 px-4 py-3 rounded-lg border border-green-300/50 bg-green-50/50 text-center">
              <p className="text-sm text-green-800">{paidFallbackMsg}</p>
            </div>
          )}
          <Suspense fallback={<LoadingAnalysis />}>
          <RentResults
            formData={results.formData}
            rentData={results.rentData}
            isDemo={!!searchParams.get('demo')}
            propertyData={propertyLookup.data}
            propertyLoading={propertyLookup.loading}
            propertyError={propertyLookup.error}
            isPaid={isPaid}
            onPaid={handlePaid}
            onReset={() => { setResults(null); setIsPaid(false); setFormKey(k => k + 1); setCapturedEmailRaw(getRememberedEmail()); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            onScrollToTop={() => {
              setResults(null);
              setIsPaid(false);
              setFormKey(k => k + 1);
              setCapturedEmailRaw(getRememberedEmail());
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            capturedEmail={capturedEmail}
            onEmailCaptured={setCapturedEmail}
            onVerdictReady={setVerdictStr}
          />
          </Suspense>
        </div>
      )}

      {/* How It Works + FAQ — only on landing */}
      {!results && !isLoading && (
        <Suspense fallback={null}>
          <HowItWorks />

            {/* ━━━ Browse Apartment Deals ━━━ */}
            <Suspense fallback={null}>
              <BrowseDealsSection />
            </Suspense>

            {/* ━━━ Renter Guides (educate) ━━━ */}
            <section className="max-w-[820px] mx-auto px-5 sm:px-6 pt-6 pb-8 border-t border-border/40">
              <h2 className="font-display text-[22px] sm:text-[26px] text-foreground tracking-tight text-center mb-2" style={{ letterSpacing: '-0.02em' }}>
                Renter Guides
              </h2>
              <p className="text-[15px] text-muted-foreground text-center max-w-[440px] mx-auto mb-6 leading-relaxed">
                Learn how to save money on your next lease.
              </p>
              <div className="space-y-3">
                <Link to="/guides/how-to-negotiate-rent-increase" className="group flex items-center gap-4 rounded-xl border border-border/60 border-l-[3px] border-l-primary bg-card px-5 py-4 hover:bg-primary/[0.03] hover:shadow-md hover:shadow-primary/[0.06] transition-all duration-200">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground text-[15px] group-hover:text-primary transition-colors">How to Negotiate a Rent Increase</h3>
                    <p className="text-[13px] text-muted-foreground leading-relaxed mt-1">Counter-offer math, email templates, and step-by-step scripts</p>
                  </div>
                  <ChevronRight className="text-primary/50 group-hover:text-primary shrink-0 transition-all duration-200 group-hover:translate-x-0.5" size={18} />
                </Link>
                <Link to="/guides/what-should-i-pay-for-rent" className="group flex items-center gap-4 rounded-xl border border-border/60 border-l-[3px] border-l-primary bg-card px-5 py-4 hover:bg-primary/[0.03] hover:shadow-md hover:shadow-primary/[0.06] transition-all duration-200">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground text-[15px] group-hover:text-primary transition-colors">What Should I Pay for Rent?</h3>
                    <p className="text-[13px] text-muted-foreground leading-relaxed mt-1">How to evaluate any asking price using real market benchmarks</p>
                  </div>
                  <ChevronRight className="text-primary/50 group-hover:text-primary shrink-0 transition-all duration-200 group-hover:translate-x-0.5" size={18} />
                </Link>
                <Link to="/guides/rent-increase-laws-by-state" className="group flex items-center gap-4 rounded-xl border border-border/60 border-l-[3px] border-l-primary bg-card px-5 py-4 hover:bg-primary/[0.03] hover:shadow-md hover:shadow-primary/[0.06] transition-all duration-200">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground text-[15px] group-hover:text-primary transition-colors">Rent Increase Laws by State</h3>
                    <p className="text-[13px] text-muted-foreground leading-relaxed mt-1">Caps, notice periods, and your rights in all 50 states</p>
                  </div>
                  <ChevronRight className="text-primary/50 group-hover:text-primary shrink-0 transition-all duration-200 group-hover:translate-x-0.5" size={18} />
                </Link>
              </div>
              <div className="mt-5 flex flex-col sm:flex-row items-center justify-center gap-4 text-sm">
                <Link to="/what-should-i-pay" className="text-primary hover:underline font-medium">Check what rent should cost →</Link>
                <Link to="/rent-data" className="text-primary hover:underline font-medium">Browse rent data by city →</Link>
              </div>
            </section>

          <HomeFAQ />

            {/* ━━━ Explore Rent Data (discover) ━━━ */}
            <section className="max-w-[820px] mx-auto px-5 sm:px-6 pt-6 pb-10 border-t border-border/40">
              <h2 className="font-display text-[22px] sm:text-[26px] text-foreground tracking-tight text-center mb-2" style={{ letterSpacing: '-0.02em' }}>
                Explore Rent Data
              </h2>
              <p className="text-[15px] text-muted-foreground text-center max-w-[480px] mx-auto mb-6 leading-relaxed">
                Search rent data for any city, state, or zip code in the U.S.
              </p>
              <Suspense fallback={null}>
                <LocationSearch className="max-w-lg mx-auto" />
              </Suspense>
              <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-2">
                {POPULAR_CITIES.map(pc => (
                  <Link
                    key={pc.city}
                    to={`/rent-data/${pc.stateSlug}/${pc.citySlug}`}
                    className="text-center rounded-lg border border-border/60 bg-card px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
                  >
                    {pc.city}
                  </Link>
                ))}
              </div>
              <div className="mt-5 text-center">
                <Link to="/rent-data" className="text-sm text-primary hover:underline font-medium">View all states →</Link>
              </div>
            </section>
        </Suspense>
      )}

      <Suspense fallback={null}>
        <SEOFooter onContactClick={() => setContactOpen(true)} />
      </Suspense>

      {contactOpen && (
        <Suspense fallback={null}>
          <ContactModal open={contactOpen} onOpenChange={setContactOpen} />
        </Suspense>
      )}
    </div>
  );
};

export default Index;
