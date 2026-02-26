import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Check } from 'lucide-react';

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const EmailCapture = () => {
  const [email, setEmail] = useState('');
  const [leaseMonth, setLeaseMonth] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !leaseMonth) return;
    setSubmitted(true);
    toast.success("You're on the list.");
  };

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center py-6"
      >
        <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-verdict-good/10 mb-3">
          <Check className="w-4 h-4 text-verdict-good" />
        </div>
        <h3 className="font-display text-lg text-foreground">You're all set</h3>
        <p className="text-xs text-muted-foreground mt-1.5 max-w-xs mx-auto">
          We'll send you an updated report 60 days before your lease renews in {leaseMonth}.
        </p>
      </motion.div>
    );
  }

  return (
    <div>
      <h2 className="font-display text-xl text-foreground mb-1">Stay Updated</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Get fresh rent data 60 days before your lease expires.
      </p>
      <form onSubmit={handleSubmit} className="space-y-2.5">
        <Input
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-10 font-mono text-sm bg-background"
          required
        />
        <Select value={leaseMonth} onValueChange={setLeaseMonth}>
          <SelectTrigger className="h-10 bg-background text-sm">
            <SelectValue placeholder="Lease expiration month" />
          </SelectTrigger>
          <SelectContent>
            {months.map((m) => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="submit" className="w-full h-10 text-sm font-semibold rounded-lg">
          Remind Me
        </Button>
      </form>
    </div>
  );
};

export default EmailCapture;
