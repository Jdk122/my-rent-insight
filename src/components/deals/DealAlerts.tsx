import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { trackEvent } from '@/lib/analytics';
import { getUtmParams } from '@/lib/utm';
import { toast } from 'sonner';

interface DealAlertsProps {
  cityName: string;
  zip: string;
  onEmailCaptured?: (email: string) => void;
}

const DealAlerts = ({ cityName, zip, onEmailCaptured }: DealAlertsProps) => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return;

    setLoading(true);
    const utm = getUtmParams();

    try {
      await supabase.rpc('upsert_lead', {
        p_email: trimmed,
        p_capture_source: 'deals-alert',
        p_city: cityName,
        p_zip: zip,
        p_tool_type: 'wsip',
        p_utm_source: utm.utm_source || null,
        p_utm_medium: utm.utm_medium || null,
        p_utm_campaign: utm.utm_campaign || null,
      } as any);
    } catch (err) {
      console.error('[deals-alert] lead save failed:', err);
    }

    trackEvent('email_captured', { gate: 'deals_alert', city: cityName });
    setSubmitted(true);
    setLoading(false);
    toast.success('You\'re subscribed!');
  };

  if (submitted) {
    return (
      <div className="mt-5 p-4 rounded-lg bg-card border border-border text-center">
        <p className="text-sm font-semibold text-foreground">You're on the list ✓</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          We'll email you when new {cityName} deals drop.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-5 p-4 rounded-lg bg-card border border-border">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <div className="text-sm font-semibold text-foreground mb-0.5">
            Get deals in your inbox
          </div>
          <div className="text-xs text-muted-foreground">
            New {cityName} deals, weekly. Most are gone in days.
          </div>
        </div>
        <div className="flex gap-1.5 shrink-0">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="you@email.com"
            className="w-[180px] px-2.5 py-2 rounded-md border-[1.5px] border-border text-xs outline-none bg-muted/30 focus:border-primary transition-colors placeholder:text-muted-foreground/50"
          />
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-3.5 py-2 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:brightness-90 transition-all whitespace-nowrap disabled:opacity-60"
          >
            {loading ? '…' : 'Subscribe'}
          </button>
        </div>
      </div>
      <p className="text-[10.5px] text-muted-foreground/50 mt-2 text-center sm:text-left">
        Free · Weekly · Unsubscribe anytime
      </p>
    </div>
  );
};

export default DealAlerts;
