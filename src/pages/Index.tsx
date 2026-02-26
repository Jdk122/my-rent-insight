import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import RentForm, { RentFormData } from '@/components/RentForm';
import RentResults from '@/components/RentResults';
import { lookupZip, RentData } from '@/data/rentData';
import { toast } from 'sonner';

const Index = () => {
  const [results, setResults] = useState<{ formData: RentFormData; rentData: RentData } | null>(null);

  const handleSubmit = (data: RentFormData) => {
    const rentData = lookupZip(data.zip);
    if (!rentData) {
      toast.error(`We don't have data for zip code ${data.zip} yet. Try: 10001, 07030, 90024, 94102, 98101, 33131, 78701, etc.`);
      return;
    }
    setResults({ formData: data, rentData });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <header className="hero-section py-12 md:py-20 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <motion.h1
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl lg:text-6xl font-display leading-tight"
          >
            Are you overpaying<br />for rent?
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mt-4 text-lg md:text-xl opacity-80"
          >
            Enter your rent. Find out if you're overpaying. Decide whether to renew or move.
          </motion.p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-xl mx-auto px-4 -mt-6 pb-16 relative z-10">
        <AnimatePresence mode="wait">
          {!results ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="stat-card"
            >
              <RentForm onSubmit={handleSubmit} />
            </motion.div>
          ) : (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
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
      <footer className="text-center py-8 text-sm text-muted-foreground">
        <p>Data sources: HUD Small Area Fair Market Rents (FY2025) · Census ACS 5-Year Estimates (2022)</p>
        <p className="mt-1">RentCheck is for informational purposes only.</p>
      </footer>
    </div>
  );
};

export default Index;
