import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Bell, Check } from 'lucide-react';

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
        className="brand-card text-center py-10"
      >
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-verdict-good/10 mb-4">
          <Check className="w-5 h-5 text-verdict-good" />
        </div>
        <h3 className="font-display text-xl text-foreground">You're all set</h3>
        <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto">
          We'll send you an updated rent report 60 days before your lease renews in {leaseMonth}.
        </p>
      </motion.div>
    );
  }

  return (
    <div className="brand-card">
      <div className="flex items-start gap-3 mb-5">
        <div className="flex items-center justify-center w-9 h-9 rounded-md bg-secondary shrink-0 mt-0.5">
          <Bell className="w-4 h-4 text-foreground" />
        </div>
        <div>
          <h3 className="font-display text-lg text-foreground leading-tight">
            Get your updated report before you renew
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Fresh rent data, 60 days before your lease expires.
          </p>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Input
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-11 font-mono text-sm bg-background"
          required
        />
        <Select value={leaseMonth} onValueChange={setLeaseMonth}>
          <SelectTrigger className="h-11 bg-background">
            <SelectValue placeholder="Lease expiration month" />
          </SelectTrigger>
          <SelectContent>
            {months.map((m) => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="submit" className="w-full h-11 font-semibold">
          Remind Me
        </Button>
      </form>
    </div>
  );
};

export default EmailCapture;
