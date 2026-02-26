import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import RentForm, { RentFormData } from '@/components/RentForm';
import RentResults from '@/components/RentResults';
import { lookupZip, RentData, rentDatabase } from '@/data/rentData';
import { toast } from 'sonner';

const availableZips = Object.keys(rentDatabase).join(', ');

const Index = () => {
  const [results, setResults] = useState<{ formData: RentFormData; rentData: RentData } | null>(null);

  const handleSubmit = (data: RentFormData) => {
    const rentData = lookupZip(data.zip);
    if (!rentData) {
      toast.error(`No data for ${data.zip} yet. Available: ${availableZips}`);
      return;
    }
    setResults({ formData: data, rentData });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 md:px-10 py-4 border-b border-border/60">
        <span className="font-display text-xl text-foreground tracking-tight">
          Rent<span className="text-accent">Check</span>
        </span>
        <span className="data-label hidden sm:block">
          HUD FY2025 · Census ACS
        </span>
      </nav>

      {/* Hero — tight, editorial */}
      <header className="px-6 md:px-10 pt-16 md:pt-28 pb-12 md:pb-20 max-w-2xl mx-auto">
        <AnimatePresence mode="wait">
          {!results ? (
            <motion.div
              key="hero"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.4 }}
            >
              <h1 className="font-display text-[clamp(2.5rem,7vw,5rem)] text-foreground leading-[0.92] tracking-tight">
                Is your rent
                <br />
                increase <span className="text-accent">fair?</span>
              </h1>
              <p className="mt-5 text-base md:text-lg text-muted-foreground max-w-md leading-relaxed">
                Compare your landlord's number against federal data.
                Get the facts, a negotiation letter, and your next move.
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="results-header"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <p className="data-label mb-2">Your Results</p>
              <h1 className="font-display text-3xl md:text-4xl text-foreground leading-tight tracking-tight">
                {results.rentData.city}, {results.rentData.state} {results.rentData.zip}
              </h1>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Main Content */}
      <main className="max-w-xl mx-auto px-6 md:px-10 pb-24">
        <AnimatePresence mode="wait">
          {!results ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.35 }}
            >
              <RentForm onSubmit={handleSubmit} />
            </motion.div>
          ) : (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
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
      </main>

      {/* Footer */}
      <footer className="border-t border-border/60 px-6 md:px-10 py-6">
        <div className="max-w-2xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="font-display text-base text-foreground">
            Rent<span className="text-accent">Check</span>
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
