import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { trackEvent, trackAdsConversion } from '@/lib/analytics';
import { getUtmParams } from '@/lib/utm';
import { sendConfirmationEmail } from '@/lib/sendConfirmationEmail';
import { generateSharedReport, SharedReportPayload } from '@/lib/generateSharedReport';
import { notifySubmission } from '@/lib/notifySubmission';
import { toast } from 'sonner';
import { X, MessageCircle, Mail, Link2 } from 'lucide-react';
import type { LeadContext } from './EmailCapture';

interface MobileScrollPromptProps {
  capturedEmail: string;
  leadContext?: LeadContext;
  verdictLabel: string;
  zip: string;
  city: string;
  onEmailCaptured: (email: string) => void;
  toolType?: 'renewal' | 'wsip';
  shareReportPayload?: SharedReportPayload;
  onReportGenerated?: (url: string) => void;
}

const SESSION_KEY = 'rr_mobile_scroll_prompt';

const MobileScrollPrompt = ({
  capturedEmail,
  leadContext,
  verdictLabel,
  zip,
  city,
  onEmailCaptured,
  toolType = 'renewal',
  shareReportPayload,
  onReportGenerated,
}: MobileScrollPromptProps) => {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const mountTimeRef = useRef(Date.now());
  const maxScrollRef = useRef(0);
  const firedRef = useRef(false);


  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.innerWidth >= 768) return;
    if (sessionStorage.getItem(SESSION_KEY)) return;

    const handleScroll = () => {
      if (firedRef.current) return;

      const scrollY = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollPct = docHeight > 0 ? scrollY / docHeight : 0;

      // Track maximum scroll position
      if (scrollY > maxScrollRef.current) {
        maxScrollRef.current = scrollY;
        return; // Still scrolling down
      }

      // Check conditions: scrolled past 70%, now scrolling UP by 100px+, 15s elapsed
      const scrolledUp = maxScrollRef.current - scrollY;
      const elapsed = Date.now() - mountTimeRef.current;

      if (
        scrollPct < 0.7 && // Currently above 70% (scrolled back up)
        maxScrollRef.current / docHeight >= 0.7 && // Was past 70%
        scrolledUp >= 100 &&
        elapsed >= 15000
      ) {
        firedRef.current = true;
        sessionStorage.setItem(SESSION_KEY, '1');
        setOpen(true);

        if (capturedEmail) {
          trackEvent('prompt_shown', { prompt: 'mobile_scroll', tool: toolType, verdict: verdictLabel, zip, type: 'share' });
        } else {
          trackEvent('prompt_shown', { prompt: 'mobile_scroll', tool: toolType, verdict: verdictLabel, zip, type: 'capture' });
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [capturedEmail, verdictLabel, zip]);

  const handleDismiss = () => {
    trackEvent('prompt_dismissed', { prompt: 'mobile_scroll', zip });
    setOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email.');
      return;
    }
    setError('');
    setLoading(true);

    const normalizedEmail = email.trim().toLowerCase();
    const utm = getUtmParams();
    try {
      const leadParams = {
        p_email: normalizedEmail,
        p_analysis_id: leadContext?.analysisId || null,
        p_capture_source: 'mobile_scroll_prompt',
        p_address: leadContext?.address || null,
        p_city: leadContext?.city || null,
        p_state: leadContext?.state || null,
        p_zip: leadContext?.zip || null,
        p_bedrooms: leadContext?.bedrooms ?? null,
        p_current_rent: leadContext?.currentRent ?? null,
        p_proposed_rent: leadContext?.proposedRent ?? null,
        p_increase_pct: leadContext?.increasePct ?? null,
        p_verdict: verdictLabel || null,
        p_utm_source: utm.utm_source || null,
        p_utm_medium: utm.utm_medium || null,
        p_utm_campaign: utm.utm_campaign || null,
        p_fairness_score: leadContext?.fairnessScore ?? null,
        p_comp_median_rent: leadContext?.compMedianRent ?? null,
        p_hud_fmr_value: leadContext?.hudFmrValue ?? null,
        p_tool_type: toolType === 'wsip' ? 'wsip' : 'renewal',
      } as any;

      let { error: rpcError } = await supabase.rpc('upsert_lead', leadParams);
      if (rpcError && leadContext?.analysisId) {
        console.warn('[lead] upsert_lead FK retry (mobile_scroll_prompt):', rpcError.message);
        ({ error: rpcError } = await supabase.rpc('upsert_lead', { ...leadParams, p_analysis_id: null }));
      }
      if (rpcError) console.error('[lead] upsert_lead failed (mobile_scroll_prompt):', rpcError.message);

      const evtPayload = {
        email: normalizedEmail,
        analysis_id: leadContext?.analysisId || null,
        event_type: 'mobile_scroll_prompt',
        fairness_score: leadContext?.fairnessScore ?? null,
        address: leadContext?.address || null,
        zip: leadContext?.zip || null,
        current_rent: leadContext?.currentRent ?? null,
        proposed_rent: leadContext?.proposedRent ?? null,
        increase_pct: leadContext?.increasePct ?? null,
        verdict: verdictLabel || null,
        comp_median_rent: leadContext?.compMedianRent ?? null,
        hud_fmr_value: leadContext?.hudFmrValue ?? null,
      } as any;
      let { error: evtError } = await supabase.from('lead_events' as any).insert(evtPayload);
      if (evtError && leadContext?.analysisId) {
        ({ error: evtError } = await supabase.from('lead_events' as any).insert({ ...evtPayload, analysis_id: null }));
      }
      if (evtError) console.error('[lead] lead_events insert failed (mobile_scroll_prompt):', evtError.message);
    } catch (err) {
      console.error('[lead] mobile_scroll_prompt unexpected error:', err);
    }

    onEmailCaptured(normalizedEmail);
    trackEvent('email_captured', { gate: 'mobile_scroll', tool: toolType, verdict: verdictLabel, zip });
    trackAdsConversion(toolType, normalizedEmail);
    setLoading(false);
    setOpen(false);
    toast.success('Sent to your email!');

    // Generate report + send email + re-notify in parallel (non-blocking)
    (async () => {
      let reportUrl: string | null = null;
      if (shareReportPayload) {
        reportUrl = await generateSharedReport(shareReportPayload, leadContext?.analysisId, normalizedEmail);
        if (reportUrl) onReportGenerated?.(reportUrl);
      }
      sendConfirmationEmail({
        email: normalizedEmail,
        city: leadContext?.city || city,
        state: leadContext?.state,
        zip: leadContext?.zip || zip,
        bedrooms: leadContext?.bedrooms,
        toolType: toolType === 'wsip' ? 'wsip' : 'renewal',
        fairnessScore: leadContext?.fairnessScore,
        verdictLabel,
        reportUrl,
      });
      await notifySubmission({
        email: normalizedEmail,
        zip: leadContext?.zip || zip,
        city: leadContext?.city || city,
        state: leadContext?.state || null,
        bedrooms: leadContext?.bedrooms ?? null,
        current_rent: leadContext?.currentRent ?? null,
        proposed_rent: leadContext?.proposedRent ?? null,
        increase_pct: leadContext?.increasePct ?? null,
        fairness_score: leadContext?.fairnessScore ?? null,
        verdict_label: verdictLabel || null,
        address: leadContext?.address || null,
        comp_median_rent: leadContext?.compMedianRent ?? null,
        hud_fmr_value: leadContext?.hudFmrValue ?? null,
        analysis_id: leadContext?.analysisId || null,
      }, 'mobile_scroll_prompt_email_capture');
    })();
  };

  const handleShare = (method: string) => {
    const isWsip = toolType === 'wsip';
    const url = isWsip ? 'https://www.renewalreply.com/what-should-i-pay' : 'https://www.renewalreply.com';
    const text = isWsip
      ? 'Check if that apartment listing is fairly priced. Most are $100-300/mo above market.'
      : 'Check if your rent increase is fair. Most renters overpay $50-150/mo.';
    const subject = isWsip ? 'Is that apartment fairly priced?' : 'Is your rent increase fair?';
    if (method === 'text') {
      window.open(`sms:?body=${encodeURIComponent(text + ' ' + url)}`, '_blank');
    } else if (method === 'email') {
      window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text + '\n\n' + url)}`, '_blank');
    } else if (method === 'copy') {
      navigator.clipboard.writeText(url);
      toast.success('Link copied!');
    }
    trackEvent('report_shared', { method, tool: toolType });
    setOpen(false);
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[90] bg-foreground/30" onClick={handleDismiss} />

      {/* Bottom sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-[100] bg-card rounded-t-2xl border-t border-border shadow-2xl px-5 pb-8 pt-5 animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="w-10 h-1 bg-border rounded-full mx-auto mb-4" />

        <button onClick={handleDismiss} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors">
          <X className="w-5 h-5" />
        </button>

        {capturedEmail ? (
          <div className="text-center space-y-4">
            <h3 className="font-display text-lg font-semibold text-foreground">
              {toolType === 'wsip'
                ? 'Know anyone else browsing apartments?'
                : 'Know someone dealing with a rent increase?'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {toolType === 'wsip'
                ? 'Share this tool. Most listings are $100-300/mo above market.'
                : 'Share this tool. Most renters overpay $50-150/mo.'}
            </p>
            <div className="flex flex-col gap-2">
              <button onClick={() => handleShare('text')} className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors">
                <MessageCircle className="w-4 h-4" /> Share via Text
              </button>
              <button onClick={() => handleShare('email')} className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors">
                <Mail className="w-4 h-4" /> Share via Email
              </button>
              <button onClick={() => handleShare('copy')} className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors">
                <Link2 className="w-4 h-4" /> Copy Link
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <h3 className="font-display text-lg font-semibold text-foreground text-center">
              Don't leave without your data.
            </h3>
            <p className="text-sm text-muted-foreground text-center">
              We'll email your full analysis. Free.
            </p>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="email"
                placeholder="Your email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (error) setError(''); }}
                autoComplete="email"
                className={`w-full h-12 px-4 text-base border rounded-lg bg-card text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 ${
                  error ? 'border-destructive' : 'border-border focus:border-foreground'
                }`}
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-primary-foreground h-12 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {loading ? 'Sending…' : 'Email me my counter-offer →'}
              </button>
              {error && <p className="text-xs text-destructive text-center">{error}</p>}
            </form>
            <button onClick={handleDismiss} className="block mx-auto text-xs text-muted-foreground hover:text-foreground transition-colors underline">
              No thanks
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default MobileScrollPrompt;
