import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import RentForm, { RentFormData } from '@/components/RentForm';
import RentResults from '@/components/RentResults';
import { lookupZip, RentData, rentDatabase } from '@/data/rentData';
import { toast } from 'sonner';
import { ArrowDown } from 'lucide-react';

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
      <nav className="flex items-center justify-between px-6 md:px-10 py-5">
        <span className="font-display text-2xl text-foreground tracking-tight">
          Rent<span className="text-accent">Check</span>
        </span>
        <span className="data-label hidden sm:block">
          HUD FY2025 · Census ACS 2022
        </span>
      </nav>

      {/* Hero */}
      <header className="px-6 md:px-10 pt-12 md:pt-24 pb-16 md:pb-32 max-w-3xl mx-auto">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="data-label mb-4"
        >
          Free rent analysis tool
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="font-display text-5xl md:text-7xl lg:text-8xl text-foreground leading-[0.95] tracking-tight"
        >
          Are you overpaying
          <br />
          for your apartment?
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-6 text-lg md:text-xl text-muted-foreground max-w-lg leading-relaxed"
        >
          Enter your rent. We'll compare it against federal and census data for your zip code — and tell you whether to renew or move.
        </motion.p>
        {!results && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-10 flex items-center gap-2 text-muted-foreground"
          >
            <ArrowDown className="w-4 h-4 animate-bounce" />
            <span className="text-sm font-medium">Start below</span>
          </motion.div>
        )}
      </header>

      {/* Main Content */}
      <main className="max-w-xl mx-auto px-6 md:px-10 pb-24">
        <AnimatePresence mode="wait">
          {!results ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.4 }}
              className="brand-card"
            >
              <RentForm onSubmit={handleSubmit} />
            </motion.div>
          ) : (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.4 }}
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
      <footer className="border-t border-border px-6 md:px-10 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 max-w-3xl mx-auto">
        <span className="font-display text-lg text-foreground">
          Rent<span className="text-accent">Check</span>
        </span>
        <p className="text-xs text-muted-foreground text-center sm:text-right max-w-sm">
          Data: HUD Small Area Fair Market Rents (FY2025) and Census ACS 5-Year Estimates (2022). For informational purposes only.
        </p>
      </footer>
    </div>
  );
};

export default Index;
