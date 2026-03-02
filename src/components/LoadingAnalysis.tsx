import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const messages = [
  'Checking your market…',
  'Pulling comparable listings…',
  'Analyzing your increase…',
];

const LoadingAnalysis = () => {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIdx((prev) => (prev + 1) % messages.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-32 gap-6">
      {/* Spinner */}
      <div className="w-10 h-10 rounded-full border-[3px] border-border border-t-primary animate-spin" />

      {/* Rotating message */}
      <AnimatePresence mode="wait">
        <motion.p
          key={idx}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25 }}
          className="text-sm text-muted-foreground font-medium"
        >
          {messages[idx]}
        </motion.p>
      </AnimatePresence>
    </div>
  );
};

export default LoadingAnalysis;
