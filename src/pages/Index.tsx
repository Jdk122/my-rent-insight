import { useState, useRef, useEffect, useMemo, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import RentForm, { RentFormData } from '@/components/RentForm';
import RentResults from '@/components/RentResults';
import { lookupRentData, loadFredTrend, RentLookupResult, calculateResults } from '@/data/rentData';
import { usePropertyLookup } from '@/hooks/usePropertyLookup';
import { toast } from 'sonner';
import { trackEvent } from '@/lib/analytics';
import SaveResultsDropdown from '@/components/SaveResultsDropdown';
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
  const [formKey, setFormKey] = useState(0); // key to force form remount/reset
  const propertyLookup = usePropertyLookup();
  const topRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!results) { setNavScrolled(false); return; }
    const onScroll = () => setNavScrolled(window.scrollY > window.innerHeight * 0.7);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [results]);

  // Compute verdict for navbar CTA
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
    const calc = calculateResults(formData.currentRent, increasePct, formData.movingCosts, rentData);
    return calc?.verdict === 'above';
  }, [results]);

  const hasIncrease = !!(results && results.formData.rentIncrease && results.formData.rentIncrease > 0);

  const handleSubmit = async (data: RentFormData) => {
    setIsLoading(true);
    setCapturedEmail('');

    try {
      if (data.fullAddress) {
        const propResult = await propertyLookup.lookup(data.fullAddress);
        if (!propResult?.zipCode) {
          toast.error("We couldn't find that address. Try entering your 5-digit zip code instead.");
          setIsLoading(false);
          return;
        }

        const zip = propResult.zipCode;
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
        description="Check if your rent increase is fair in 10 seconds. Compare your landlord's proposed increase to HUD fair market rent data for 38,000+ zip codes. Free negotiation letter included."
        canonical="/"
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "WebApplication",
            "name": "RenewalReply Rent Increase Calculator",
            "url": "https://www.renewalreply.com",
            "description": "Free tool to check if your rent increase is fair using HUD, Census, and Zillow data for 38,000+ US zip codes.",
            "applicationCategory": "FinanceApplication",
            "operatingSystem": "Web",
            "browserRequirements": "Requires JavaScript",
            "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
            "featureList": [
              "Compare rent increases to HUD Fair Market Rent",
              "Generate free negotiation letter",
              "Coverage for 38,000+ US zip codes",
              "Uses HUD SAFMR, Zillow ZORI, and Census data"
            ],
            "author": { "@type": "Organization", "name": "RenewalReply" }
          }
        ]}
      />
      {/* Sticky Nav */}
      <nav
        className={`fixed top-0 left-0 right-0 z-[60] flex items-center justify-between px-6 py-4 transition-all duration-200 ${
          results && !navScrolled ? 'bg-transparent' : 'bg-card'
        }`}
        style={{
          boxShadow: !results || !navScrolled ? 'none' : '0 1px 3px rgba(0,0,0,0.08)',
        }}
      >
        <span className="font-display text-xl font-bold text-primary tracking-tight cursor-pointer hover:scale-105 transition-transform duration-200" style={{ letterSpacing: '-0.02em' }} onClick={() => { setResults(null); setFormKey(k => k + 1); setCapturedEmail(''); window.scrollTo({ top: 0 }); }}>
          Renewal<span className="font-normal text-accent">Reply</span>
        </span>
        <div className="flex items-center gap-3">
          {results && (
            <button onClick={() => { setResults(null); setFormKey(k => k + 1); setCapturedEmail(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="text-[13px] text-muted-foreground hover:text-foreground transition-colors">
              ← New check
            </button>
          )}
          {hasIncrease && isAboveMarket && (
            <button
              onClick={() => document.getElementById('section-letter')?.scrollIntoView({ behavior: 'smooth' })}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-[13px] font-semibold hover:brightness-90 transition-all duration-150 shadow-sm shadow-primary/20"
            >
              <span className="hidden sm:inline">Get your letter →</span>
              <span className="sm:hidden">Get letter →</span>
            </button>
          )}
          {hasIncrease && !isAboveMarket && (
            <SaveResultsDropdown
              prefilledEmail={capturedEmail}
              onEmailCaptured={setCapturedEmail}
            />
          )}
        </div>
      </nav>

      {/* Spacer for fixed nav */}
      <div className="h-[56px]" />

      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <LoadingAnalysis />
          </motion.div>
        ) : !results ? (
          <motion.div
            key="landing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <main className="max-w-[620px] mx-auto px-6 pt-16 md:pt-24 pb-16">
              <h1 className="font-display text-[clamp(3rem,8vw,5rem)] text-foreground leading-[1.05] tracking-tight" style={{ letterSpacing: '-0.02em' }}>
                Is your rent increase <span className="text-primary">fair?</span>
              </h1>
              <p className="mt-6 text-xl md:text-2xl text-foreground/60 max-w-[620px] leading-relaxed font-medium">
                Find out instantly. Get a data-backed negotiation letter if it's not.
              </p>
              <section className="mt-10" aria-label="Rent increase checker">
                <RentForm key={formKey} onSubmit={handleSubmit} isLoading={isLoading} />
                <SocialProofCounter />
              </section>
            </main>
          </motion.div>
        ) : (
          <motion.div
            key="results"
            ref={resultsRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
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
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAQ — only on landing */}
      {!results && !isLoading && <HomeFAQ />}

      <SEOFooter onContactClick={() => setContactOpen(true)} />

      <ContactModal open={contactOpen} onOpenChange={setContactOpen} />
    </div>
  );
};

export default Index;
