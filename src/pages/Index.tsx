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

const Index = () => {
  const [results, setResults] = useState<{ formData: RentFormData; rentData: RentLookupResult } | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [navScrolled, setNavScrolled] = useState(false);
  const [capturedEmail, setCapturedEmail] = useState('');
  const propertyLookup = usePropertyLookup();
  const topRef = useRef<HTMLDivElement>(null);

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
        window.scrollTo({ top: 0, behavior: 'smooth' });

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
        window.scrollTo({ top: 0, behavior: 'smooth' });

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
        canonical="/"
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "WebApplication",
            "name": "RenewalReply",
            "url": "https://renewalreply.com",
            "description": "Compare your rent increase to real market data. Get a free negotiation letter if your landlord is overcharging.",
            "applicationCategory": "FinanceApplication",
            "operatingSystem": "Web",
            "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
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
                  "text": "Enter your address and current rent on RenewalReply. We compare your increase to HUD Fair Market Rents, Census data, and Zillow trends for your zip code to determine if it's above, at, or below market rate."
                }
              },
              {
                "@type": "Question",
                "name": "Is RenewalReply free?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Yes. Checking your rent increase and generating a negotiation letter are completely free."
                }
              }
            ]
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
        <span className="font-display text-xl font-bold text-primary tracking-tight cursor-pointer hover:scale-105 transition-transform duration-200" style={{ letterSpacing: '-0.02em' }} onClick={() => { setResults(null); window.scrollTo({ top: 0 }); }}>
          Renewal<span className="font-normal text-accent">Reply</span>
        </span>
        <div className="flex items-center gap-3">
          {results && (
            <button onClick={() => setResults(null)} className="text-[13px] text-muted-foreground hover:text-foreground transition-colors">
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
            <main className="max-w-[620px] mx-auto px-6 pt-16 md:pt-24 pb-32">
              <h1 className="font-display text-[clamp(3rem,8vw,5rem)] text-foreground leading-[1.05] tracking-tight" style={{ letterSpacing: '-0.02em' }}>
                Is your rent increase <span className="text-primary">fair?</span>
              </h1>
              <p className="mt-6 text-xl md:text-2xl text-foreground/60 max-w-[620px] leading-relaxed font-medium">
                Find out instantly. Get a data-backed negotiation letter if it's not.
              </p>
              <section className="mt-10" aria-label="Rent increase checker">
                <RentForm onSubmit={handleSubmit} isLoading={isLoading} />
                <SocialProofCounter />
              </section>
            </main>
          </motion.div>
        ) : (
          <motion.div
            key="results"
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
              onReset={() => setResults(null)}
              onScrollToTop={() => {
                setResults(null);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              capturedEmail={capturedEmail}
              onEmailCaptured={setCapturedEmail}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="mt-auto border-t border-border px-6 py-6 text-center">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Sources: HUD SAFMR FY2025, Census ACS 2023, Zillow ZORI, FRED, DHCR · Analysis powered by RenewalReply · For informational purposes only · Not legal or financial advice ·{' '}
          <button onClick={() => setContactOpen(true)} className="underline hover:text-foreground transition-colors">Contact us</button>
        </p>
      </footer>

      <ContactModal open={contactOpen} onOpenChange={setContactOpen} />
    </div>
  );
};

export default Index;
