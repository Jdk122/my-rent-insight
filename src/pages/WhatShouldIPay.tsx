import { useState, useRef, useEffect, useMemo, lazy, Suspense } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { lookupRentData, loadFredTrend, RentLookupResult, BedroomType } from '@/data/rentData';
import { usePropertyLookup } from '@/hooks/usePropertyLookup';
import { toast } from 'sonner';
import { trackEvent } from '@/lib/analytics';
import { getWsipDemoData } from '@/data/demoData';
import SEO from '@/components/SEO';
import LoadingAnalysis from '@/components/LoadingAnalysis';
import WsipForm, { WsipFormData } from '@/components/WsipForm';

const WsipResults = lazy(() => import('@/components/WsipResults'));
const SocialProofCounter = lazy(() => import('@/components/SocialProofCounter'));
const ContactModal = lazy(() => import('@/components/ContactModal'));
const WsipFAQ = lazy(() => import('@/components/WsipFAQ'));
const WsipHowItWorks = lazy(() => import('@/components/WsipHowItWorks'));
const SEOFooter = lazy(() => import('@/components/SEOFooter'));

interface WsipResultsState {
  zip: string;
  fullAddress: string | null;
  bedrooms: BedroomType;
  askingRent: number | null;
  rentData: RentLookupResult;
  propertyData: import('@/hooks/usePropertyLookup').PropertyLookupResult | null;
}

const bedroomNumToKey: Record<number, BedroomType> = {
  0: 'studio', 1: 'oneBr', 2: 'twoBr', 3: 'threeBr', 4: 'fourBr',
};

const WhatShouldIPay = () => {
  const [searchParams] = useSearchParams();
  const [results, setResults] = useState<WsipResultsState | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [navScrolled, setNavScrolled] = useState(false);
  const [capturedEmail, setCapturedEmail] = useState('');
  const [formKey, setFormKey] = useState(0);
  const propertyLookup = usePropertyLookup();
  const topRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Demo mode: ?demo=overpriced|fair|deal
  useEffect(() => {
    const demo = searchParams.get('demo');
    const demoData = getWsipDemoData(demo);
    if (demoData && !results) {
      setResults(demoData);
    }
  }, [searchParams]);

  const prefill = useMemo(() => {
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

  const resetAll = () => {
    setResults(null);
    setFormKey(k => k + 1);
    setCapturedEmail('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (data: WsipFormData) => {
    setIsLoading(true);
    setCapturedEmail('');

    try {
      const lookupZip = data.zip;
      let propResult = null;

      if (data.fullAddress) {
        propResult = await propertyLookup.lookup(data.fullAddress).catch(() => null);
      }

      const zip = propResult?.zipCode || lookupZip;
      const rentData = await lookupRentData(zip, data.bedrooms);

      if (!rentData) {
        toast.error(`We don't have rent data for that area yet. Try entering your 5-digit zip code instead.`);
        setIsLoading(false);
        return;
      }

      setResults({
        zip,
        fullAddress: data.fullAddress,
        bedrooms: data.bedrooms,
        askingRent: data.askingRent,
        rentData,
        propertyData: propResult ?? null,
      });

      trackEvent('wsip_form_submitted', { zip, bedrooms: data.bedrooms, has_asking_rent: !!data.askingRent });
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);

      loadFredTrend(rentData.metro).then((fredTrend) => {
        if (fredTrend) {
          setResults((prev) =>
            prev ? { ...prev, rentData: { ...prev.rentData, fredTrend } } : prev
          );
        }
      });
    } catch {
      toast.error('Something went wrong loading rent data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-x-hidden" ref={topRef}>
      <SEO
        title={results
          ? `What Should I Pay for Rent in ${results.rentData.city}? | Fair Rent Range | RenewalReply`
          : 'What Should I Pay for Rent? | Fair Rent Calculator | RenewalReply'}
        description={results
          ? `Find the fair rent range for ${results.bedrooms === 'studio' ? 'studios' : results.bedrooms.replace('Br', '-bedrooms')} in ${results.rentData.city}. Compare asking prices to real comparable listings and market data.`
          : 'Find out what you should actually pay for rent. Compare asking prices to market data, nearby listings, and HUD benchmarks.'}
        canonical="/what-should-i-pay"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'WebApplication',
          name: 'What Should I Pay? — Fair Rent Calculator',
          url: 'https://www.renewalreply.com/what-should-i-pay',
          description: 'Check if an asking rent is fair using HUD data, comparable listings, and local market trends.',
          applicationCategory: 'FinanceApplication',
          operatingSystem: 'Web',
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        }}
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
          onClick={() => { resetAll(); window.scrollTo({ top: 0 }); }}
        />
        <div className="flex items-center gap-2 sm:gap-3">
          {results && (
            <button onClick={resetAll} className="text-[12px] sm:text-[13px] text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap">
              ← New search
            </button>
          )}
          <Link
            to="/"
            className="text-[12px] sm:text-[13px] text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap hidden sm:inline-block"
          >
            Check My Increase →
          </Link>
          {results && !capturedEmail && (
            <button
              onClick={() => {
                const target = document.getElementById('section-comps')
                  || document.getElementById('section-market');
                if (target) {
                  target.scrollIntoView({ behavior: 'smooth' });
                } else {
                  window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                }
              }}
              className="bg-primary text-primary-foreground px-3 sm:px-4 py-2 rounded-lg text-[12px] sm:text-[13px] font-semibold hover:brightness-90 transition-all duration-150 shadow-sm shadow-primary/20 whitespace-nowrap"
            >
              <span className="hidden sm:inline">See all comps →</span>
              <span className="sm:hidden">All comps →</span>
            </button>
          )}
          {results && capturedEmail && (
            <button
              onClick={() => {
                document.getElementById('section-share')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="bg-primary text-primary-foreground px-3 sm:px-4 py-2 rounded-lg text-[12px] sm:text-[13px] font-semibold hover:brightness-90 transition-all duration-150 shadow-sm shadow-primary/20 whitespace-nowrap"
            >
              <span className="hidden sm:inline">Share this →</span>
              <span className="sm:hidden">Share →</span>
            </button>
          )}
        </div>
      </nav>

      {/* Spacer for fixed nav */}
      <div className="h-[52px] sm:h-[56px]" />

      {isLoading ? (
        <LoadingAnalysis />
      ) : !results ? (
        <main className="max-w-[620px] mx-auto px-5 sm:px-6 pt-12 sm:pt-16 md:pt-24 pb-10 sm:pb-14">
          <h1 className="font-display text-[2.25rem] sm:text-[clamp(3rem,8vw,5rem)] text-foreground leading-[1.08] tracking-tight" style={{ letterSpacing: '-0.02em' }}>
            Is that asking price <span className="text-primary">fair?</span>
          </h1>
          <p className="mt-4 sm:mt-6 text-[15px] sm:text-lg md:text-xl text-muted-foreground max-w-[540px] leading-relaxed font-normal tracking-tight">
            Most listings are $100–300/month above market. Enter the address and see what it's actually worth<span className="text-primary font-medium no-underline"> — in 10 seconds.</span>
          </p>
          <section className="mt-8 sm:mt-10" aria-label="Fair rent calculator">
            <WsipForm key={formKey} onSubmit={handleSubmit} isLoading={isLoading} prefill={prefill} />
            <div className="mt-3 max-w-[540px]">
              <div className="border-t border-b border-border/40 py-2.5 px-1">
                <p className="text-[11px] text-muted-foreground/50 text-center mb-1.5 tracking-wide uppercase font-medium">Built on the data landlords use to set your rent — now you can see it too.</p>
                <div className="flex flex-wrap justify-center items-center gap-x-4 sm:gap-x-6 gap-y-1 text-[11px] text-muted-foreground/40 tracking-wide">
                  <span>HUD Fair Market Rent</span>
                  <span>Zillow ZORI</span>
                  <span>Apartment List</span>
                  <span>Rentcast</span>
                </div>
              </div>
            </div>
            <Suspense fallback={null}>
              <SocialProofCounter />
            </Suspense>
          </section>
          <Suspense fallback={null}>
            <WsipHowItWorks />
          </Suspense>
          <Suspense fallback={null}>
            <WsipFAQ />
          </Suspense>

          {/* Noscript fallback for WSIP */}
          <noscript>
            <div style={{ maxWidth: '620px', margin: '0 auto', padding: '40px 24px', fontFamily: 'sans-serif' }}>
              <h2>What Should I Pay for Rent?</h2>
              <p>
                RenewalReply helps you check if a rental listing is fairly priced before you sign.
                Enter an address and bedroom count to see the fair rent range based on HUD Fair Market Rent,
                Zillow rent trends, and real comparable listings. Coverage for 38,000+ US zip codes.
              </p>
            </div>
          </noscript>
        </main>
      ) : (
        <div ref={resultsRef}>
          <Suspense fallback={<LoadingAnalysis />}>
            <WsipResults
              zip={results.zip}
              fullAddress={results.fullAddress}
              bedrooms={results.bedrooms}
              askingRent={results.askingRent}
              rentData={results.rentData}
              capturedEmail={capturedEmail}
              onEmailCaptured={setCapturedEmail}
              onReset={resetAll}
            />
          </Suspense>
        </div>
      )}

      <Suspense fallback={null}>
        <SEOFooter onContactClick={() => setContactOpen(true)} showCityDirectory />
      </Suspense>

      {contactOpen && (
        <Suspense fallback={null}>
          <ContactModal open={contactOpen} onOpenChange={setContactOpen} />
        </Suspense>
      )}
    </div>
  );
};

export default WhatShouldIPay;
