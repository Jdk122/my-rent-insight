import { useState } from 'react';
import { Check, Copy, MessageCircle, Mail } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { generateShortId } from '@/lib/shortId';
import { trackEvent } from '@/lib/analytics';
import { toast } from 'sonner';

/** Clipboard helper with fallback for mobile browsers */
const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    // Fallback for mobile / non-secure contexts
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
};

interface ShareHubProps {
  reportPayload: {
    zip: string;
    address: string | null;
    bedrooms: number;
    currentRent: number;
    proposedIncrease: number;
    increaseType: 'dollar' | 'percent';
    reportData: Record<string, any>;
  };
  onLinkGenerated?: (url: string) => void;
  analysisId?: string | null;
  leadEmail?: string;
  zipCode: string;
  city: string;
  state: string;
  bedroomNum: number;
  increasePct: number;
  marketYoy: number;
  verdict?: 'above' | 'fair' | 'below' | 'none';
  headline: string;
  stats: { label: string; value: string; color?: string }[];
  neighborsLabel?: string;
}

const ShareHub = ({
  reportPayload,
  onLinkGenerated,
  analysisId,
  leadEmail,
  zipCode,
  city,
  state,
  bedroomNum,
  increasePct,
  marketYoy,
  verdict = 'above',
  neighborsLabel = 'Share with neighbors',
}: ShareHubProps) => {
  // ── Report link state ──
  const [reportUrl, setReportUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  // ── Neighbors: copy state ──
  const [neighborCopied, setNeighborCopied] = useState(false);

  const generateReportLink = async (): Promise<string | null> => {
    if (reportUrl) return reportUrl;
    setGenerating(true);
    try {
      const shortId = generateShortId();
      const { error } = await supabase.from('shared_reports' as any).insert({
        short_id: shortId,
        zip_code: reportPayload.zip,
        address: reportPayload.address,
        bedrooms: reportPayload.bedrooms,
        current_rent: reportPayload.currentRent,
        proposed_increase: reportPayload.proposedIncrease,
        increase_type: reportPayload.increaseType,
        report_data: reportPayload.reportData,
        analysis_id: analysisId || null,
        lead_email: leadEmail || null,
      } as any);
      if (error) throw error;
      const url = `${window.location.origin}/report/${shortId}`;
      setReportUrl(url);
      onLinkGenerated?.(url);
      return url;
    } catch (err) {
      console.error('Failed to create shared report:', err);
      toast.error('Failed to generate report link. Please try again.');
      return null;
    } finally {
      setGenerating(false);
    }
  };




  // ── Neighbor message content ──
  const brLabel = bedroomNum === 0 ? 'Studio' : bedroomNum === 1 ? '1-bedroom' : bedroomNum === 2 ? '2-bedroom' : bedroomNum === 3 ? '3-bedroom' : '4-bedroom';
  const marketSign = marketYoy > 0 ? '+' : '';
  const shareUrl = reportUrl || `https://www.renewalreply.com/?utm_source=share&utm_medium=building&utm_campaign=viral_loop&utm_content=${zipCode}`;

  const smsBody = `Hey — I just checked our building's rent increase against market data. ${brLabel} rents in ${zipCode} moved ${marketSign}${marketYoy}% this year. My landlord wants ${increasePct}%. Check yours: ${shareUrl}`;
  const whatsappBody = `Did you get your renewal letter yet? 👀\n\n${brLabel} rents in ${zipCode} moved ${marketSign}${marketYoy}% this year. My landlord is asking for ${increasePct}%.\n\nCheck yours: ${shareUrl}`;
  const emailSubject = `Worth checking — is our rent increase fair in ${city}?`;
  const emailBody = `Hey,\n\nI ran my address through a rent fairness tool and thought you'd want to know.\n\n${brLabel} rents in ${zipCode} (${city}, ${state}) moved ${marketSign}${marketYoy}% this year. My landlord is asking for ${increasePct}%.\n\nCheck yours here: ${shareUrl}`;

  const handleSMS = () => { trackEvent('report_shared', { method: 'sms' }); window.open(`sms:?&body=${encodeURIComponent(smsBody)}`); };
  const handleWhatsApp = () => { trackEvent('report_shared', { method: 'whatsapp' }); window.open(`https://wa.me/?text=${encodeURIComponent(whatsappBody)}`); };
  const handleNeighborEmail = () => { trackEvent('report_shared', { method: 'email' }); window.open(`mailto:?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`); };
  const handleNeighborCopy = async () => {
    trackEvent('report_shared', { method: 'copy_link' });
    const ok = await copyToClipboard(shareUrl);
    if (ok) {
      setNeighborCopied(true);
      setTimeout(() => setNeighborCopied(false), 2500);
      toast.success('Copied to clipboard!');
    } else {
      toast.error('Copy failed — try selecting and copying manually.');
    }
  };

  return (
    <div className="w-full max-w-[540px]">
      {/* Neighbors: sharing channels — always visible */}
      <div>
        <p className="text-[13px] text-muted-foreground mb-1.5 text-center">Know someone dealing with a rent increase?</p>
        <div className="grid grid-cols-4 gap-2">
          <button onClick={handleSMS} aria-label="Share via text message" className="flex min-h-11 items-center justify-center gap-1.5 px-3 rounded-full border border-border text-[12px] font-medium text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors">
            <MessageCircle size={13} /> Text
          </button>
          <button onClick={handleWhatsApp} aria-label="Share via WhatsApp" className="flex min-h-11 items-center justify-center gap-1.5 px-3 rounded-full border border-border text-[12px] font-medium text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors">
            <MessageCircle size={13} /> WhatsApp
          </button>
          <button onClick={handleNeighborEmail} aria-label="Share via email" className="flex min-h-11 items-center justify-center gap-1.5 px-3 rounded-full border border-border text-[12px] font-medium text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors">
            <Mail size={13} /> Email
          </button>
          <button onClick={handleNeighborCopy} aria-label="Copy share link" className="flex min-h-11 items-center justify-center gap-1.5 px-3 rounded-full border border-border text-[12px] font-medium text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors">
            {neighborCopied ? <><Check size={13} /> Copied!</> : <><Copy size={13} /> Copy</>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShareHub;
