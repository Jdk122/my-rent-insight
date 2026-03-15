import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { trackEvent } from '@/lib/analytics';
import { getUtmParams } from '@/lib/utm';
import { CheckCircle } from 'lucide-react';

interface RenewalReminderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  zip?: string;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const currentYear = new Date().getFullYear();
const YEARS = [currentYear, currentYear + 1, currentYear + 2];

const RenewalReminderModal = ({ open, onOpenChange, zip }: RenewalReminderModalProps) => {
  const [email, setEmail] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !email.includes('@') || !email.includes('.')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!month || !year) {
      setError('Please select your lease expiration month and year.');
      return;
    }

    setLoading(true);
    try {
      const utm = getUtmParams();
      const { error: rpcError } = await supabase.rpc('upsert_lead', {
        p_email: email,
        p_capture_source: 'seo_reminder_modal',
        p_zip: zip || null,
        p_lease_expiration_month: parseInt(month),
        p_lease_expiration_year: parseInt(year),
        p_tool_type: 'renewal',
        p_utm_source: utm.utm_source || null,
        p_utm_medium: utm.utm_medium || null,
        p_utm_campaign: utm.utm_campaign || null,
      });

      if (rpcError) {
        console.error('[reminder-modal] upsert_lead error:', rpcError);
        setError('Something went wrong. Please try again.');
        setLoading(false);
        return;
      }

      trackEvent('lease_info_saved', { action: 'reminder_set', tool: 'renewal', zip });

      setSubmitted(true);
    } catch (err) {
      console.error('[reminder-modal] unexpected error:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = (val: boolean) => {
    if (!val) {
      // Reset on close
      setTimeout(() => {
        setSubmitted(false);
        setEmail('');
        setMonth('');
        setYear('');
        setError('');
      }, 300);
    }
    onOpenChange(val);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {submitted ? (
          <div className="text-center py-4">
            <CheckCircle className="w-10 h-10 text-verdict-good mx-auto mb-3" />
            <DialogHeader>
              <DialogTitle className="font-display text-xl">Reminder set!</DialogTitle>
              <DialogDescription className="text-muted-foreground text-sm mt-2">
                We'll email you ~60 days before your lease expires with fresh market data so you're ready to negotiate.
              </DialogDescription>
            </DialogHeader>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-xl">Set a Renewal Reminder</DialogTitle>
              <DialogDescription className="text-muted-foreground text-sm">
                We'll send you market data before your lease expires — so you're prepared when your landlord sends a renewal.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-2">
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Email</label>
                <Input
                  type="email"
                  placeholder="you@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Lease expires</label>
                  <Select value={month} onValueChange={setMonth}>
                    <SelectTrigger>
                      <SelectValue placeholder="Month" />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((m, i) => (
                        <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">&nbsp;</label>
                  <Select value={year} onValueChange={setYear}>
                    <SelectTrigger>
                      <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent>
                      {YEARS.map((y) => (
                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Setting reminder…' : 'Set Reminder →'}
              </Button>
              <p className="text-[11px] text-muted-foreground text-center">
                One email, ~60 days before expiration. No spam.{' '}
                <a href="/privacy" className="underline">Privacy Policy</a>
              </p>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default RenewalReminderModal;
