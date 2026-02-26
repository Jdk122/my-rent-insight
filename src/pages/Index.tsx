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
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 md:px-12 lg:px-20 py-5 border-b border-border/50">
        <span className="font-display text-xl text-foreground tracking-tight cursor-pointer" onClick={() => setResults(null)}>
          Rent<span className="text-primary">Reply</span>
        </span>
        {!results && (
          <span className="text-xs text-muted-foreground hidden sm:block">
            Free rent increase calculator
          </span>
        )}
      </nav>

      <AnimatePresence mode="wait">
        {!results ? (
          <motion.div
            key="landing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
          >
            {/* Landing hero — full width feel */}
            <div className="px-6 md:px-12 lg:px-20 pt-16 md:pt-24 lg:pt-32 pb-12 md:pb-16">
              <div className="max-w-3xl">
                <h1 className="font-display text-[clamp(3rem,8vw,5.5rem)] text-foreground leading-[0.88] tracking-tight">
                  Is your rent
                  <br />
                  increase <span className="text-primary">fair?</span>
                </h1>
                <p className="mt-6 md:mt-8 text-lg md:text-xl text-muted-foreground max-w-lg leading-relaxed">
                  Find out instantly. Get a negotiation letter if it's not.
                </p>
              </div>
            </div>

            {/* Form — centered but not cramped */}
            <div className="px-6 md:px-12 lg:px-20 pb-32">
              <div className="max-w-lg">
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
            transition={{ duration: 0.35 }}
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
      <footer className="border-t border-border px-6 md:px-12 lg:px-20 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="font-display text-base text-foreground">
            Rent<span className="text-primary">Reply</span>
          </span>
          <p className="text-[11px] text-muted-foreground text-center sm:text-right max-w-xs leading-relaxed">
            Sources: HUD SAFMR FY2025, Census ACS 5-Year (2022). For informational purposes only.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
