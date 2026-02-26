import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import RentForm, { RentFormData } from '@/components/RentForm';
import RentResults from '@/components/RentResults';
import { lookupRentData, loadFredTrend, RentLookupResult } from '@/data/rentData';
import { usePropertyLookup } from '@/hooks/usePropertyLookup';
import { toast } from 'sonner';

const Index = () => {
  const [results, setResults] = useState<{ formData: RentFormData; rentData: RentLookupResult } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const propertyLookup = usePropertyLookup();
  const topRef = useRef<HTMLDivElement>(null);

  const handleSubmit = async (data: RentFormData) => {
    setIsLoading(true);

    // If address (not zip-only), start property lookup in parallel
    if (data.fullAddress) {
      propertyLookup.lookup(data.fullAddress).then((propResult) => {
        // If we got a zip from Rentcast and didn't have one, update results
        if (propResult?.zipCode && !data.zip) {
          // Trigger zip-level data lookup with the extracted zip
          lookupRentData(propResult.zipCode, data.bedrooms).then((rentData) => {
            if (rentData) {
              setResults((prev) => {
                if (!prev) return prev;
                return {
                  formData: { ...prev.formData, zip: propResult.zipCode! },
                  rentData,
                };
              });
              // Load FRED trend in background
              loadFredTrend(rentData.metro).then((fredTrend) => {
                if (fredTrend) {
                  setResults((prev) =>
                    prev ? { ...prev, rentData: { ...prev.rentData, fredTrend } } : prev
                  );
                }
              });
            }
          });
        }
      });
    }

    try {
      // For zip-only, proceed normally
      // For address, we may not have zip yet — try with empty zip, results will update when property lookup returns
      if (data.zip) {
        const rentData = await lookupRentData(data.zip, data.bedrooms);
        if (!rentData) {
          toast.error(`We don't have data for ${data.zip} yet. Try a nearby zip code.`);
          setIsLoading(false);
          return;
        }
        setResults({ formData: data, rentData });
        window.scrollTo({ top: 0, behavior: 'smooth' });

        loadFredTrend(rentData.metro).then((fredTrend) => {
          if (fredTrend) {
            setResults((prev) =>
              prev ? { ...prev, rentData: { ...prev.rentData, fredTrend } } : prev
            );
          }
        });
      } else if (data.fullAddress) {
        // Address entered — we need to wait for property lookup to get zip
        // Show a temporary results state; it will update when property lookup completes
        // For now, show loading and wait for property lookup
        const propResult = await propertyLookup.lookup(data.fullAddress);
        if (propResult?.zipCode) {
          const rentData = await lookupRentData(propResult.zipCode, data.bedrooms);
          if (!rentData) {
            toast.error(`We couldn't find rent data for that address. Try entering your 5-digit zip code instead.`);
            setIsLoading(false);
            return;
          }
          setResults({ formData: { ...data, zip: propResult.zipCode }, rentData });
          window.scrollTo({ top: 0, behavior: 'smooth' });

          loadFredTrend(rentData.metro).then((fredTrend) => {
            if (fredTrend) {
              setResults((prev) =>
                prev ? { ...prev, rentData: { ...prev.rentData, fredTrend } } : prev
              );
            }
          });
        } else {
          toast.error("We couldn't find that address. Try entering your 5-digit zip code instead.");
          setIsLoading(false);
          return;
        }
      }
    } catch (err) {
      toast.error('Something went wrong loading rent data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col" ref={topRef}>
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-5 border-b border-border">
        <span className="font-display text-xl font-bold text-primary tracking-tight cursor-pointer hover:scale-105 transition-transform duration-200" style={{ letterSpacing: '-0.02em' }} onClick={() => { setResults(null); }}>
          Rent<span className="font-normal text-accent">Reply</span>
        </span>
        {results && (
          <button onClick={() => setResults(null)} className="text-[13px] text-muted-foreground hover:text-foreground transition-colors">
            ← New check
          </button>
        )}
      </nav>

      <AnimatePresence mode="wait">
        {!results ? (
          <motion.div
            key="landing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="max-w-[620px] mx-auto px-6 pt-16 md:pt-24 pb-32">
              <h1 className="font-display text-[clamp(3rem,8vw,5rem)] text-foreground leading-[1.05] tracking-tight" style={{ letterSpacing: '-0.02em' }}>
                Is your rent increase <span className="text-primary">fair?</span>
              </h1>
              <p className="mt-6 text-xl md:text-2xl text-foreground/60 max-w-md leading-relaxed font-medium">
                Find out instantly. Get a negotiation letter if it's not.
              </p>
              <div className="mt-10">
                <RentForm onSubmit={handleSubmit} isLoading={isLoading} />
              </div>
            </div>
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
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="mt-auto border-t border-border px-6 py-6 text-center">
        <p className="text-xs text-muted-foreground leading-relaxed">
          RentReply · Sources: HUD SAFMR FY2025, Census ACS 2023, Zillow ZORI · For informational purposes only.
        </p>
      </footer>
    </div>
  );
};

export default Index;
