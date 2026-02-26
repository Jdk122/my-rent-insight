import { useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Check } from 'lucide-react';

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

interface EmailCaptureProps {
  city?: string;
}

const EmailCapture = ({ city }: EmailCaptureProps) => {
  const [email, setEmail] = useState('');
  const [leaseMonth, setLeaseMonth] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSubmitted(true);
    toast.success("You're on the list.");
  };

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="py-4"
      >
        <div className="inline-flex items-center justify-center w-8 h-8 rounded-full mb-3" style={{ background: 'hsl(var(--accent-green) / 0.1)' }}>
          <Check className="w-4 h-4 text-verdict-good" />
        </div>
        <h3 className="font-display text-lg font-semibold text-foreground">You're all set</h3>
        <p className="text-xs text-muted-foreground mt-1.5 max-w-xs mx-auto">
          We'll send you updated market data{leaseMonth ? ` 60 days before your lease renews in ${leaseMonth}` : ' before your lease renews'}.
        </p>
      </motion.div>
    );
  }

  return (
    <div>
      <h2 className="font-display text-xl font-semibold text-foreground mb-1.5" style={{ letterSpacing: '-0.01em' }}>
        Get reminded before your lease is up
      </h2>
      <p className="text-sm text-muted-foreground mb-5">
        We'll send updated market data for {city || 'your area'} 60 days before your renewal.
      </p>
      <form onSubmit={handleSubmit} className="flex gap-2 max-w-[440px] mx-auto mb-3">
        <input
          type="email"
          placeholder="you@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="flex-1 px-4 py-3 text-sm border border-border rounded bg-card text-foreground outline-none focus:border-foreground transition-colors placeholder:text-muted-foreground/50"
        />
        <button type="submit" className="bg-primary text-primary-foreground px-5 py-3 rounded text-sm font-semibold hover:opacity-90 transition-opacity whitespace-nowrap">
          Remind me
        </button>
      </form>
      <select
        value={leaseMonth}
        onChange={(e) => setLeaseMonth(e.target.value)}
        className="w-full max-w-[440px] mx-auto block px-4 py-3 text-sm border border-border rounded bg-card text-muted-foreground outline-none focus:border-foreground focus:text-foreground transition-colors cursor-pointer appearance-none"
      >
        <option disabled value="">Lease expiration month</option>
        {months.map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>
    </div>
  );
};

export default EmailCapture;
