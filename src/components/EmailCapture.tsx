import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

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
    // In production this would go to a backend
    setSubmitted(true);
    toast.success("You're on the list! We'll email you 60 days before your lease renews.");
  };

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="stat-card text-center"
      >
        <span className="text-3xl">📬</span>
        <h3 className="font-display text-xl mt-3">You're all set!</h3>
        <p className="text-muted-foreground mt-2 text-sm">
          We'll send you an updated rent report 60 days before your lease renews in {leaseMonth}.
        </p>
      </motion.div>
    );
  }

  return (
    <div className="stat-card">
      <div className="flex items-start gap-3 mb-4">
        <span className="text-2xl">📧</span>
        <div>
          <h3 className="font-display text-lg">Get your updated report before you renew</h3>
          <p className="text-sm text-muted-foreground mt-1">
            We'll email you fresh rent data 60 days before your lease expires — so you negotiate from a position of strength.
          </p>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Input
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-11"
          required
        />
        <Select value={leaseMonth} onValueChange={setLeaseMonth}>
          <SelectTrigger className="h-11">
            <SelectValue placeholder="Lease expiration month" />
          </SelectTrigger>
          <SelectContent>
            {months.map((m) => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="submit" className="w-full h-11 font-semibold">
          Remind Me Before I Renew
        </Button>
      </form>
    </div>
  );
};

export default EmailCapture;
