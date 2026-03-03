import { useState, useRef, useEffect, useMemo } from 'react';
import RentForm, { RentFormData } from '@/components/RentForm';
import RentResults from '@/components/RentResults';
import { lookupRentData, loadFredTrend, RentLookupResult } from '@/data/rentData';
import { calculateFairnessScore } from '@/lib/fairnessScore';
import { usePropertyLookup } from '@/hooks/usePropertyLookup';
import { toast } from 'sonner';
import { trackEvent } from '@/lib/analytics';
import SocialProofCounter from '@/components/SocialProofCounter';
import ContactModal from '@/components/ContactModal';
import LoadingAnalysis from '@/components/LoadingAnalysis';
import SEO from '@/components/SEO';
import HomeFAQ from '@/components/HomeFAQ';
import SEOFooter from '@/components/SEOFooter';

const Index = () => {
  const [results, setResults] = useState<{ formData: RentFormData; rentData: RentLookupResult } | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [navScrolled, setNavScrolled] = useState(false);
  const [capturedEmail, setCapturedEmail] = useState('');
  const [formKey, setFormKey] = useState(0);
  const propertyLookup = usePropertyLookup();
  const topRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!results) { setNavScrolled(false); return; }
    const onScroll = () => setNavScrolled(window.scrollY > window.innerHeight * 0.7);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [results]);

  const isAboveMarket = useMemo(() => {
    if (!results) return false;
    const { formData, rentData } = results;
    const increaseAmount = formData.rentIncrease
      ? formData.increaseIsPercent
        ? Math.round(formData.currentRent * (formData.rentIncrease / 100))
        : formData.rentIncrease
      : 0;
    if (increaseAmount <= 0) return false;
    const increasePct = formData.rentIncrease
      ? formData.increaseIsPercent
        ? formData.rentIncrease
        : Math.round((formData.rentIncrease / formData.currentRent) * 1000) / 10
      : 0;
    const newRent = formData.currentRent + increaseAmount;
    const score = calculateFairnessScore({
      increasePct,
      marketYoY: rentData.yoyChange,
      proposedRent: newRent,
      currentRent: formData.currentRent,
      compMedian: null,
      fmr: rentData.fmr,
      medianIncome: rentData.medianIncome,
      zillowMonthly: rentData.zillowMonthly,
    });
    return score.total < 60;
  }, [results]);

  const hasIncrease = !!(results && results.formData.rentIncrease && results.formData.rentIncrease > 0);

  const handleSubmit = async (data: RentFormData) => {
    setIsLoading(true);
    setCapturedEmail('');

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
        trackEvent('form_submitted', { zip, bedrooms: data.bedrooms, has_address: true });
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
        trackEvent('form_submitted', { zip: data.zip, bedrooms: data.bedrooms, has_address: false });
        trackEvent('address_entered', { method: 'zip_only' });
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
        title="Is Your Rent Increase Fair? Free Rent Increase Calculator | RenewalReply"
        description="Check if your rent increase is fair in 10 seconds. Compare your landlord's proposed increase to HUD fair market rent data for 58,000+ zip codes. Free negotiation letter included."
        canonical="/"
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "WebApplication",
            "name": "RenewalReply Rent Increase Calculator",
            "url": "https://www.renewalreply.com",
            "description": "Free tool to check if your rent increase is fair using HUD, Census, and Zillow data for 58,000+ US zip codes.",
            "applicationCategory": "FinanceApplication",
            "operatingSystem": "Web",
            "browserRequirements": "Requires JavaScript",
            "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
            "featureList": [
              "Compare rent increases to HUD Fair Market Rent",
              "Generate free negotiation letter",
              "Coverage for 58,000+ US zip codes",
              "Uses HUD SAFMR, Zillow ZORI, and Census data"
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
                  "text": "Compare your proposed rent to the HUD Fair Market Rent for your zip code. RenewalReply checks your rent increase against HUD SAFMR data, Zillow rent indices, and Census data to determine if your increase is in line with local market conditions."
                }
              },
              {
                "@type": "Question",
                "name": "What data does RenewalReply use?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "RenewalReply uses HUD Small Area Fair Market Rents (SAFMR) for FY2026, Zillow Observed Rent Index (ZORI), Census American Community Survey (ACS) 2023 data, and FRED mortgage rate data to give you a complete picture of your local rental market."
                }
              },
              {
                "@type": "Question",
                "name": "Is RenewalReply free?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Yes. RenewalReply is completely free. You can check if your rent increase is fair and get a data-backed negotiation letter at no cost."
                }
              },
              {
                "@type": "Question",
                "name": "How many zip codes does RenewalReply cover?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "RenewalReply covers over 58,000 US zip codes using HUD Fair Market Rent data, making it one of the most comprehensive rent fairness tools available."
                }
              }
            ]
          }
        ]}
      />
      {/* Sticky Nav */}
      <nav
        className={`fixed top-0 left-0 right-0 z-[60] flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 transition-all duration-200 ${
          results && !navScrolled ? 'bg-transparent' : 'bg-card'
        }`}
        style={{
          boxShadow: !results || !navScrolled ? 'none' : '0 1px 3px rgba(0,0,0,0.08)',
        }}
      >
        <span className="font-display text-lg sm:text-xl font-bold text-primary tracking-tight cursor-pointer hover:scale-105 transition-transform duration-200 shrink-0" style={{ letterSpacing: '-0.02em' }} onClick={() => { setResults(null); setFormKey(k => k + 1); setCapturedEmail(''); window.scrollTo({ top: 0 }); }}>
          Renewal<span className="font-normal text-accent">Reply</span>
        </span>
        <div className="flex items-center gap-2 sm:gap-3">
          {results && (
            <button onClick={() => { setResults(null); setFormKey(k => k + 1); setCapturedEmail(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="text-[12px] sm:text-[13px] text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap">
              ← New check
            </button>
          )}
          {results && hasIncrease && isAboveMarket && (
            <button
              onClick={() => {
                document.getElementById('section-letter')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="bg-primary text-primary-foreground px-3 sm:px-4 py-2 rounded-lg text-[12px] sm:text-[13px] font-semibold hover:brightness-90 transition-all duration-150 shadow-sm shadow-primary/20 whitespace-nowrap"
            >
              <span className="hidden sm:inline">Get your letter →</span>
              <span className="sm:hidden">Get letter →</span>
            </button>
          )}
          {results && !(hasIncrease && isAboveMarket) && (
            <button
              onClick={() => {
                const target = document.getElementById('section-email-capture')
                  || document.querySelector('[id^="section-share"]')
                  || document.getElementById('section-evidence');
                target?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="bg-primary text-primary-foreground px-3 sm:px-4 py-2 rounded-lg text-[12px] sm:text-[13px] font-semibold hover:brightness-90 transition-all duration-150 shadow-sm shadow-primary/20 whitespace-nowrap"
            >
              <span className="hidden sm:inline">Set a reminder →</span>
              <span className="sm:hidden">Reminder →</span>
            </button>
          )}
        </div>
      </nav>

      {/* Spacer for fixed nav */}
      <div className="h-[56px]" />

      {isLoading ? (
        <LoadingAnalysis />
      ) : !results ? (
        <main className="max-w-[620px] mx-auto px-6 pt-16 md:pt-24 pb-16">
          <h1 className="font-display text-[clamp(3rem,8vw,5rem)] text-foreground leading-[1.05] tracking-tight" style={{ letterSpacing: '-0.02em' }}>
            Is your rent increase <span className="text-primary">fair?</span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-foreground/50 max-w-[540px] leading-relaxed font-normal tracking-tight">
            See what apartments near you are actually renting for, calculate your savings if you move, and get a negotiation letter if you stay<span className="text-primary font-medium"> — instantly</span>.
          </p>
          <section className="mt-10" aria-label="Rent increase checker">
            <RentForm key={formKey} onSubmit={handleSubmit} isLoading={isLoading} />
            <SocialProofCounter />
          </section>
        </main>
      ) : (
        <div ref={resultsRef}>
          <RentResults
            formData={results.formData}
            rentData={results.rentData}
            propertyData={propertyLookup.data}
            propertyLoading={propertyLookup.loading}
            propertyError={propertyLookup.error}
            onReset={() => { setResults(null); setFormKey(k => k + 1); setCapturedEmail(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            onScrollToTop={() => {
              setResults(null);
              setFormKey(k => k + 1);
              setCapturedEmail('');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            capturedEmail={capturedEmail}
            onEmailCaptured={setCapturedEmail}
          />
        </div>
      )}

      {/* FAQ — only on landing */}
      {!results && !isLoading && <HomeFAQ />}

      <SEOFooter onContactClick={() => setContactOpen(true)} />

      <ContactModal open={contactOpen} onOpenChange={setContactOpen} />
    </div>
  );
};

export default Index;
