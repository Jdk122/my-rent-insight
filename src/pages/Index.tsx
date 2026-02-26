import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import RentForm, { RentFormData } from '@/components/RentForm';
import RentResults from '@/components/RentResults';
import { lookupZip, RentData, rentDatabase } from '@/data/rentData';
import { toast } from 'sonner';

const zipCount = Object.keys(rentDatabase).length;

const Index = () => {
  const [results, setResults] = useState<{ formData: RentFormData; rentData: RentData } | null>(null);

  const handleSubmit = (data: RentFormData) => {
    const rentData = lookupZip(data.zip);
    if (!rentData) {
      toast.error(`No data for ${data.zip} yet. We currently cover ${zipCount} zip codes across major metros.`);
      return;
    }
    setResults({ formData: data, rentData });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-5 border-b border-border">
        <span className="font-display text-lg font-bold text-foreground tracking-tight cursor-pointer" style={{ letterSpacing: '-0.02em' }} onClick={() => setResults(null)}>
          Rent<span className="font-normal text-muted-foreground">Reply</span>
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
                <RentForm onSubmit={handleSubmit} />
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
              onReset={() => setResults(null)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="mt-auto border-t border-border px-6 py-6 text-center">
        <p className="text-xs text-muted-foreground leading-relaxed">
          RentReply · Sources: HUD SAFMR FY2025, Census ACS 5-Year · For informational purposes only.
        </p>
      </footer>
    </div>
  );
};

export default Index;
