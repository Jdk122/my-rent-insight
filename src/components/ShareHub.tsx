import { useState, useRef } from 'react';
import { Link2, Check, Copy, Share2, MessageCircle, Mail, Facebook, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { generateShortId } from '@/lib/shortId';
import { trackEvent } from '@/lib/analytics';
import { toast } from 'sonner';

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
  verdict?: 'above' | 'fair' | 'below';
  headline: string;
  stats: { label: string; value: string; color?: string }[];
}

type ActivePanel = null | 'landlord' | 'neighbors';

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
}: ShareHubProps) => {
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);

  // ── Report link state (shared by both paths) ──
  const [reportUrl, setReportUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

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

  const handleShareLandlord = async () => {
    trackEvent('share_landlord', { zip: zipCode });
    trackEvent('report_link_generated', { zip_code: zipCode, verdict });
    const url = reportUrl || await generateReportLink();
    if (url) {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      toast.success('Link copied — send it to your landlord!');
      setActivePanel('landlord');
    }
  };

  const handleShareNeighbors = async () => {
    trackEvent('share_neighbors', { zip: zipCode });
    trackEvent('report_link_generated', { zip_code: zipCode, verdict });
    const url = reportUrl || await generateReportLink();
    if (url) {
      setActivePanel('neighbors');
    }
  };

  // ── Neighbor message content ──
  const brLabel = bedroomNum === 0 ? 'Studio' : bedroomNum === 1 ? '1-bedroom' : bedroomNum === 2 ? '2-bedroom' : bedroomNum === 3 ? '3-bedroom' : '4-bedroom';
  const marketSign = marketYoy > 0 ? '+' : '';
  const shareUrl = reportUrl || `https://renewalreply.com/?utm_source=share&utm_medium=building&utm_campaign=viral_loop&utm_content=${zipCode}`;

  const smsBody = `Hey — I just checked our building's rent increase against market data. ${brLabel} rents in ${zipCode} moved ${marketSign}${marketYoy}% this year. My landlord wants ${increasePct}%. Check yours: ${shareUrl}`;
  const whatsappBody = `Did you get your renewal letter yet? 👀\n\n${brLabel} rents in ${zipCode} moved ${marketSign}${marketYoy}% this year. My landlord is asking for ${increasePct}%.\n\nCheck yours: ${shareUrl}`;
  const emailSubject = `Worth checking — is our rent increase fair in ${city}?`;
  const emailBody = `Hey,\n\nI ran my address through a rent fairness tool and thought you'd want to know.\n\n${brLabel} rents in ${zipCode} (${city}, ${state}) moved ${marketSign}${marketYoy}% this year. My landlord is asking for ${increasePct}%.\n\nCheck yours here: ${shareUrl}`;

  const handleSMS = () => { trackEvent('share_clicked', { share_method: 'sms' }); window.open(`sms:?&body=${encodeURIComponent(smsBody)}`); };
  const handleWhatsApp = () => { trackEvent('share_clicked', { share_method: 'whatsapp' }); window.open(`https://wa.me/?text=${encodeURIComponent(whatsappBody)}`); };
  const handleNeighborEmail = () => { trackEvent('share_clicked', { share_method: 'email' }); window.open(`mailto:?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`); };
  const handleTwitter = () => {
    trackEvent('share_clicked', { share_method: 'twitter' });
    const tweetText = `Just checked — ${brLabel} rents in ${zipCode} (${city}) moved ${marketSign}${marketYoy}% this year. My landlord wants ${increasePct}%. Free tool:`;
    window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(shareUrl)}`, '_blank');
  };
  const handleFacebook = () => { trackEvent('share_clicked', { share_method: 'facebook' }); window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank'); };
  const handleNeighborCopy = async () => {
    trackEvent('share_clicked', { share_method: 'copy_link' });
    try {
      await navigator.clipboard.writeText(shareUrl);
      setNeighborCopied(true);
      setTimeout(() => setNeighborCopied(false), 2500);
      toast.success('Copied to clipboard!');
    } catch {
      toast.error('Copy failed — try selecting and copying manually.');
    }
  };

  return (
    <div className="w-full max-w-[540px]">
      {/* Two side-by-side buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleShareLandlord}
          disabled={generating}
          className="flex-1 inline-flex items-center justify-center gap-2 border border-border px-5 py-3 rounded-lg text-sm font-medium text-foreground hover:border-foreground transition-colors disabled:opacity-50"
        >
          <Link2 size={16} />
          {generating && activePanel !== 'neighbors' ? 'Generating…' : copied ? 'Link copied!' : 'Share with landlord'}
        </button>
        <button
          onClick={handleShareNeighbors}
          disabled={generating}
          className="flex-1 inline-flex items-center justify-center gap-2 border border-border px-5 py-3 rounded-lg text-sm font-medium text-foreground hover:border-foreground transition-colors disabled:opacity-50"
        >
          <Users size={16} />
          {generating && activePanel === 'neighbors' ? 'Generating…' : 'Share with neighbors'}
        </button>
      </div>

      {/* Context line */}
      <p className="text-[12px] text-muted-foreground/70 text-center mt-2.5">
        Generate a shareable link to your full analysis — comps, market data, and fair offer.
      </p>

      {/* Landlord: show copied URL */}
      {activePanel === 'landlord' && reportUrl && (
        <div className="mt-4 flex items-center gap-2 justify-center">
          <div className="flex items-center gap-2 bg-secondary rounded-lg px-4 py-2.5 text-sm text-foreground/80 max-w-[280px] overflow-hidden">
            <Link2 size={14} className="shrink-0 text-muted-foreground" />
            <span className="truncate">{reportUrl}</span>
          </div>
          <button
            onClick={async () => {
              await navigator.clipboard.writeText(reportUrl);
              setCopied(true);
              setTimeout(() => setCopied(false), 2500);
              toast.success('Link copied!');
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:brightness-90 transition-all shadow-sm shadow-primary/20"
          >
            {copied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy</>}
          </button>
        </div>
      )}

      {/* Neighbors: sharing channels */}
      {activePanel === 'neighbors' && (
        <div className="mt-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-2.5">
            <button onClick={handleSMS} className="flex items-center justify-center gap-2 px-3.5 py-3 rounded-lg border border-border bg-card text-sm font-medium text-foreground hover:border-foreground/40 hover:shadow-sm transition-all">
              <MessageCircle size={16} /> Text
            </button>
            <button onClick={handleWhatsApp} className="flex items-center justify-center gap-2 px-3.5 py-3 rounded-lg border border-border bg-card text-sm font-medium text-foreground hover:border-foreground/40 hover:shadow-sm transition-all">
              <MessageCircle size={16} /> WhatsApp
            </button>
            <button onClick={handleNeighborEmail} className="flex items-center justify-center gap-2 px-3.5 py-3 rounded-lg border border-border bg-card text-sm font-medium text-foreground hover:border-foreground/40 hover:shadow-sm transition-all">
              <Mail size={16} /> Email
            </button>
            <button onClick={handleTwitter} className="flex items-center justify-center gap-2 px-3.5 py-3 rounded-lg border border-border bg-card text-sm font-medium text-foreground hover:border-foreground/40 hover:shadow-sm transition-all">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg> X
            </button>
            <button onClick={handleFacebook} className="flex items-center justify-center gap-2 px-3.5 py-3 rounded-lg border border-border bg-card text-sm font-medium text-foreground hover:border-foreground/40 hover:shadow-sm transition-all">
              <Facebook size={16} /> Facebook
            </button>
            <button onClick={handleNeighborCopy} className="flex items-center justify-center gap-2 px-3.5 py-3 rounded-lg border border-border bg-card text-sm font-medium text-foreground hover:border-foreground/40 hover:shadow-sm transition-all">
              {neighborCopied ? <><Check size={16} /> Copied!</> : <><Copy size={16} /> Copy</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShareHub;
