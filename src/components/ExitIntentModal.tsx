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
import { Link } from 'react-router-dom';

interface ExitIntentModalProps {
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

const SESSION_KEY = 'rr_exit_intent_shown';

const ExitIntentModal = ({ capturedEmail, leadContext, verdictLabel, zip, city, onEmailCaptured, toolType = 'renewal', shareReportPayload, onReportGenerated }: ExitIntentModalProps) => {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const firedRef = useRef(false);

  useEffect(() => {
    // Only desktop, only once per session
    if (typeof window === 'undefined') return;
    if (window.innerWidth < 768) return;
    if (sessionStorage.getItem(SESSION_KEY)) return;

    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY > 10) return; // Only when leaving toward top
      if (firedRef.current) return;
      firedRef.current = true;
      sessionStorage.setItem(SESSION_KEY, '1');
      setOpen(true);

      if (capturedEmail) {
        trackEvent('prompt_shown', { prompt: 'exit_intent', tool: toolType, verdict: verdictLabel, zip, type: 'share' });
      } else {
        trackEvent('prompt_shown', { prompt: 'exit_intent', tool: toolType, verdict: verdictLabel, zip, type: 'capture' });
      }
    };

    document.addEventListener('mouseleave', handleMouseLeave);
    return () => document.removeEventListener('mouseleave', handleMouseLeave);
  }, [capturedEmail, verdictLabel, zip]);

  const handleDismiss = () => {
    trackEvent('prompt_dismissed', { prompt: 'exit_intent', zip });
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
        p_capture_source: 'exit_intent',
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
        console.warn('[lead] upsert_lead FK retry (exit_intent):', rpcError.message);
        ({ error: rpcError } = await supabase.rpc('upsert_lead', { ...leadParams, p_analysis_id: null }));
      }
      if (rpcError) console.error('[lead] upsert_lead failed (exit_intent):', rpcError.message);

      const evtPayload = {
        email: normalizedEmail,
        analysis_id: leadContext?.analysisId || null,
        event_type: 'exit_intent',
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
      if (evtError) console.error('[lead] lead_events insert failed (exit_intent):', evtError.message);
    } catch (err) {
      console.error('[lead] exit_intent unexpected error:', err);
    }

    onEmailCaptured(normalizedEmail);
    trackEvent('email_captured', { gate: 'exit_intent', tool: toolType, verdict: verdictLabel, zip });
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
      // Re-notify with captured email
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
      }, 'exit_intent_email_capture');
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4" onClick={handleDismiss}>
      <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" />
      <div
        className="relative bg-card rounded-xl border border-border shadow-2xl max-w-[420px] w-full p-6 sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={handleDismiss} className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors">
          <X className="w-5 h-5" />
        </button>

        {capturedEmail ? (
          // Share prompt
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
            <div className="flex flex-col gap-2 max-w-[280px] mx-auto">
              <button onClick={() => handleShare('text')} className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors">
                <MessageCircle className="w-4 h-4" /> Share via Text
              </button>
              <button onClick={() => handleShare('email')} className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors">
                <Mail className="w-4 h-4" /> Share via Email
              </button>
              <button onClick={() => handleShare('copy')} className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors">
                <Link2 className="w-4 h-4" /> Copy Link
              </button>
            </div>
          </div>
        ) : (
          // Email capture
          <div className="text-center space-y-4">
            <h3 className="font-display text-lg font-semibold text-foreground">
              {toolType === 'wsip'
                ? 'Don\'t sign a lease without the data.'
                : 'Don\'t negotiate without your data.'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {toolType === 'wsip'
                ? 'We\'ll email your full market comparison so you have it when you tour.'
                : 'We\'ll email your full analysis and negotiation letter so you have it when you\'re ready.'}
            </p>
            <form onSubmit={handleSubmit} className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="you@email.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); if (error) setError(''); }}
                  autoFocus
                  autoComplete="email"
                  className={`flex-1 min-w-0 px-4 py-3 text-sm border rounded-lg bg-card text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 ${
                    error ? 'border-destructive' : 'border-border focus:border-foreground'
                  }`}
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-primary text-primary-foreground px-4 py-3 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity whitespace-nowrap disabled:opacity-60"
                >
                  {loading ? 'Sending…' : 'Send my analysis →'}
                </button>
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
            </form>
            <button onClick={handleDismiss} className="text-xs text-muted-foreground hover:text-foreground transition-colors underline">
              No thanks
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExitIntentModal;
