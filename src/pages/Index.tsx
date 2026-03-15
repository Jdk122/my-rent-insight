import { useState, useRef, useEffect, useMemo, lazy, Suspense } from 'react';
import { ChevronRight, MessageSquareText, Calculator } from 'lucide-react';
import { usePrerenderReady } from '@/hooks/usePrerenderReady';
import { useSearchParams, Link } from 'react-router-dom';


const LocationSearch = lazy(() => import('@/components/LocationSearch'));

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
import SEO from '@/components/SEO';
import LoadingAnalysis from '@/components/LoadingAnalysis';
import { getDemoData } from '@/data/demoData';
import { getRememberedEmail, rememberEmail } from '@/lib/emailMemory';

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

  const [isAboveMarket, setIsAboveMarket] = useState(false);

  const hasIncrease = !!(results && results.formData.rentIncrease && results.formData.rentIncrease > 0);

  const handleSubmit = async (data: RentFormData) => {
    setIsLoading(true);
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
        description="Check if your rent increase is fair in 10 seconds. Compare your landlord's proposed increase to HUD fair market rent data for 38,600+ zip codes. Free negotiation letter included."
        canonical="/"
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "WebApplication",
            "name": "RenewalReply Rent Increase Tool",
            "url": "https://www.renewalreply.com",
            "description": "Free tool to check if your rent increase is fair using HUD Fair Market Rents, Zillow rent trends, and real nearby listings for 38,600+ US zip codes.",
            "applicationCategory": "FinanceApplication",
            "operatingSystem": "Web",
            "browserRequirements": "Requires JavaScript",
            "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
            "featureList": [
              "Compare rent increases to HUD Fair Market Rent",
              "Generate free negotiation letter",
              "Coverage for 38,600+ US zip codes",
              "Uses HUD SAFMR, Zillow ZORI, and real comparable listings"
            ],
            "author": { "@type": "Organization", "name": "RenewalReply" }
          },
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": [
              {
                "@type": "Question",
                "name": "How do I know if my rent increase is fair?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Compare your proposed rent to the HUD Fair Market Rent for your zip code. RenewalReply checks your rent increase against HUD Fair Market Rent data, Zillow rent trends, and real comparable listings near your address."
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
                  "text": "Yes, RenewalReply is free to use. Enter your email only if you want your full report and negotiation package delivered instantly."
                }
              },
              {
                "@type": "Question",
                "name": "How many zip codes does RenewalReply cover?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "RenewalReply covers 38,600+ US zip codes using HUD Fair Market Rent data, making it one of the most comprehensive rent fairness tools available."
                }
              }
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
          {results && hasIncrease && isAboveMarket && !capturedEmail && (
            <button
              onClick={() => {
                const target = document.getElementById('section-letter');
                if (target) {
                  target.scrollIntoView({ behavior: 'smooth' });
                } else {
                  window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                }
              }}
              className="bg-primary text-primary-foreground px-3 sm:px-4 py-2 rounded-lg text-[12px] sm:text-[13px] font-semibold hover:brightness-90 transition-all duration-150 shadow-sm shadow-primary/20 whitespace-nowrap"
            >
              <span className="hidden sm:inline">Get my letter →</span>
              <span className="sm:hidden">Get letter →</span>
            </button>
          )}
          {results && hasIncrease && isAboveMarket && capturedEmail && (
            <button
              onClick={() => {
                const letterEl = document.querySelector('[data-letter-content]');
                if (letterEl) {
                  navigator.clipboard.writeText(letterEl.textContent || '');
                  import('sonner').then(({ toast }) => toast.success('Copied to clipboard'));
                }
              }}
              className="bg-primary text-primary-foreground px-3 sm:px-4 py-2 rounded-lg text-[12px] sm:text-[13px] font-semibold hover:brightness-90 transition-all duration-150 shadow-sm shadow-primary/20 whitespace-nowrap"
            >
              <span className="hidden sm:inline">Copy your letter →</span>
              <span className="sm:hidden">Copy letter →</span>
            </button>
          )}
          {results && !(hasIncrease && isAboveMarket) && !capturedEmail && (
            <button
              onClick={() => {
                const target = document.getElementById('section-letter')
                  || document.getElementById('section-email-capture')
                  || document.querySelector('[id^="section-share"]');
                if (target) {
                  target.scrollIntoView({ behavior: 'smooth' });
                } else {
                  window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                }
              }}
              className="bg-primary text-primary-foreground px-3 sm:px-4 py-2 rounded-lg text-[12px] sm:text-[13px] font-semibold hover:brightness-90 transition-all duration-150 shadow-sm shadow-primary/20 whitespace-nowrap"
            >
              <span className="hidden sm:inline">Save my results →</span>
              <span className="sm:hidden">Save results →</span>
            </button>
          )}
          {results && !(hasIncrease && isAboveMarket) && capturedEmail && (
            <button
              onClick={() => {
                document.getElementById('section-share')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="bg-primary text-primary-foreground px-3 sm:px-4 py-2 rounded-lg text-[12px] sm:text-[13px] font-semibold hover:brightness-90 transition-all duration-150 shadow-sm shadow-primary/20 whitespace-nowrap"
            >
              <span className="hidden sm:inline">Share this tool →</span>
              <span className="sm:hidden">Share →</span>
            </button>
          )}
          <Link
            to="/what-should-i-pay"
            className="text-muted-foreground hover:text-foreground text-[12px] sm:text-[13px] font-medium transition-colors whitespace-nowrap hidden md:inline-block"
          >
            Check Asking Price →
          </Link>
        </div>
      </nav>

      {/* Spacer for fixed nav */}
      <div className="h-[52px] sm:h-[56px]" />

      {isLoading ? (
        <LoadingAnalysis />
      ) : !results ? (
        <main className="max-w-[620px] md:max-w-[860px] mx-auto px-5 sm:px-6 pt-6 sm:pt-14 md:pt-10 pb-10 sm:pb-14 md:pb-16">
          <div className="md:grid md:grid-cols-[1fr_390px] md:gap-8 md:items-center">
            {/* Left column: sales message */}
            <div>
              <h1 className="font-display text-[1.85rem] sm:text-[clamp(2rem,5vw,3rem)] md:text-[42px] text-foreground leading-[1.08] md:leading-[1.12] tracking-tight font-extrabold" style={{ letterSpacing: '-0.025em' }}>
                Is your rent increase <span className="text-primary">above&nbsp;market?</span>
              </h1>
              <p className="mt-2 sm:mt-3 md:mt-3 text-[15px] sm:text-lg md:text-[18px] text-muted-foreground md:text-foreground/70 max-w-[540px] leading-relaxed font-normal tracking-tight md:whitespace-nowrap">
                Find out in 10 seconds — free, no account needed.
              </p>

              {/* Value props */}
              <div className="mt-3 sm:mt-5 md:mt-6 flex flex-col gap-1.5 sm:gap-2 md:gap-3 max-w-[480px]">
                <div className="flex items-start gap-2">
                  <span className="text-primary mt-0.5 shrink-0"><MessageSquareText size={15} className="md:w-[18px] md:h-[18px]" /></span>
                  <span className="text-[14px] md:text-[16px] text-muted-foreground md:text-foreground/60"><strong className="text-foreground font-bold">Negotiation letter</strong> backed by your local data</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-primary mt-0.5 shrink-0"><Calculator size={15} className="md:w-[18px] md:h-[18px]" /></span>
                  <span className="text-[14px] md:text-[16px] text-muted-foreground md:text-foreground/60"><strong className="text-foreground font-bold">Counter-offer range</strong> from real comps nearby</span>
                </div>
              </div>


              <Suspense fallback={null}>
                <div className="mt-4 sm:mt-6 md:mt-4">
                  <SocialProofCounter />
                </div>
              </Suspense>

              {/* Data source bar — desktop only */}
              <div className="hidden md:block mt-3">
                <div className="border-t border-border/60 pt-3 pb-2 px-1">
                  <p className="text-[11px] text-foreground/40 tracking-wide whitespace-nowrap">
                    HUD FMR · Zillow ZORI · Apt List · Live Comps · DHCR
                  </p>
                </div>
              </div>
            </div>

            {/* Right column: form card */}
            <section id="main-content" className="mt-3 sm:mt-6 md:mt-0" aria-label="Rent increase checker">
              <div>
                <RentForm key={formKey} onSubmit={handleSubmit} isLoading={isLoading} prefill={prefill} />
              </div>
              {/* Data source bar — mobile only */}
              <div className="mt-4 max-w-[540px] mx-auto md:hidden">
                <div className="border-t border-border/40 pt-3 pb-2 px-1 text-center">
                  <p className="text-[11px] text-muted-foreground/50 tracking-wide">
                    HUD Fair Market Rent · Zillow ZORI · Apartment List · Live Comps · DHCR
                  </p>
                </div>
              </div>
            </section>
          </div>
        </main>
      ) : (
        <div ref={resultsRef}>
          <Suspense fallback={<LoadingAnalysis />}>
          <RentResults
            formData={results.formData}
            rentData={results.rentData}
            isDemo={!!searchParams.get('demo')}
            propertyData={propertyLookup.data}
            propertyLoading={propertyLookup.loading}
            propertyError={propertyLookup.error}
            onReset={() => { setResults(null); setFormKey(k => k + 1); setCapturedEmailRaw(getRememberedEmail()); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            onScrollToTop={() => {
              setResults(null);
              setFormKey(k => k + 1);
              setCapturedEmailRaw(getRememberedEmail());
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            capturedEmail={capturedEmail}
            onEmailCaptured={setCapturedEmail}
            onVerdictReady={setIsAboveMarket}
          />
          </Suspense>
        </div>
      )}

      {/* How It Works + FAQ — only on landing */}
      {!results && !isLoading && (
        <Suspense fallback={null}>
          <HowItWorks />

            {/* ━━━ Renter Guides (educate) ━━━ */}
            <section className="max-w-[820px] mx-auto px-5 sm:px-6 pt-10 pb-14 sm:pb-16 border-t border-border/40">
              <h2 className="font-display text-[22px] sm:text-[26px] text-foreground tracking-tight text-center mb-2" style={{ letterSpacing: '-0.02em' }}>
                Renter Guides
              </h2>
              <p className="text-[15px] text-muted-foreground text-center max-w-[440px] mx-auto mb-8 leading-relaxed">
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
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 text-sm">
                <Link to="/what-should-i-pay" className="text-primary hover:underline font-medium">Check what rent should cost →</Link>
                <Link to="/rent-data" className="text-primary hover:underline font-medium">Browse rent data by city →</Link>
              </div>
            </section>

          <HomeFAQ />

            {/* ━━━ Explore Rent Data (discover) ━━━ */}
            <section className="max-w-[820px] mx-auto px-5 sm:px-6 pt-10 pb-14 sm:pb-16 border-t border-border/40">
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
