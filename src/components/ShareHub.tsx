import { useState, useRef } from 'react';
import { Link2, Check, Copy, Share2, MessageCircle, Mail, Twitter, Facebook } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { generateShortId } from '@/lib/shortId';
import { trackEvent } from '@/lib/analytics';
import { toast } from 'sonner';
import html2canvas from 'html2canvas';

interface ShareHubProps {
  /* For the report link (landlord path) */
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

  /* For the neighbor/viral path */
  zipCode: string;
  city: string;
  state: string;
  bedroomNum: number;
  increasePct: number;
  marketYoy: number;

  /* Verdict context — controls which tabs/CTAs are shown */
  verdict?: 'above' | 'fair' | 'below';

  /* For image share card */
  headline: string;
  stats: { label: string; value: string; color?: string }[];
}

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

type Tab = 'landlord' | 'neighbors';

const ShareHub = ({
  reportPayload,
  onLinkGenerated,
  zipCode,
  city,
  state,
  bedroomNum,
  increasePct,
  marketYoy,
  verdict = 'above',
  headline,
  stats,
}: ShareHubProps) => {
  const [activeTab, setActiveTab] = useState<Tab>(verdict === 'above' ? 'landlord' : 'neighbors');
  const showLandlordTab = verdict === 'above';

  // ── Landlord: report link state ──
  const [reportUrl, setReportUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  // ── Neighbors: copy state ──
  const [neighborCopied, setNeighborCopied] = useState(false);

  // ── Image share ──
  const cardRef = useRef<HTMLDivElement>(null);
  const [generatingImage, setGeneratingImage] = useState(false);

  // ── Landlord handlers ──
  const handleGenerateReport = async () => {
    if (reportUrl) {
      await copyToClipboard(reportUrl);
      return;
    }
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
      } as any);
      if (error) throw error;

      const url = `${window.location.origin}/report/${shortId}`;
      setReportUrl(url);
      onLinkGenerated?.(url);
      trackEvent('report_shared', { zip: reportPayload.zip });
      await copyToClipboard(url);
    } catch (err) {
      console.error('Failed to create shared report:', err);
      toast.error('Failed to generate report link. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
    toast.success('Link copied!');
  };

  // ── Neighbor message content ──
  const brLabel = bedroomNum === 0 ? 'Studio' : bedroomNum === 1 ? '1-bedroom' : bedroomNum === 2 ? '2-bedroom' : bedroomNum === 3 ? '3-bedroom' : '4-bedroom';
  const isAboveMarket = increasePct > marketYoy;
  const diff = Math.abs(Math.round((increasePct - marketYoy) * 10) / 10);
  const marketSign = marketYoy > 0 ? '+' : '';
  const shareUrl = `https://renewalreply.com/?utm_source=share&utm_medium=building&utm_campaign=viral_loop&utm_content=${zipCode}`;
  const tweetText = `Just checked — ${brLabel} rents in ${zipCode} (${city}) moved ${marketSign}${marketYoy}% this year. My landlord wants ${increasePct}%. Free tool to check yours:`;

  const smsBody = `Hey — I just checked our building's rent increase against market data. ${brLabel} rents in ${zipCode} moved ${marketSign}${marketYoy}% this year. My landlord wants ${increasePct}%.${isAboveMarket ? ` That's ${diff} percentage points above market.` : ''} Took 30 seconds, no signup: ${shareUrl}`;
  const whatsappBody = `Did you get your renewal letter yet? 👀\n\nI just ran our zip code (${zipCode}) through a rent fairness tool. ${brLabel} rents here moved ${marketSign}${marketYoy}% this year.\n\nMy landlord is asking for ${increasePct}%${isAboveMarket ? ` — that's ${diff} points above the market trend.` : '.'}\n\nFree tool, no signup, 30 seconds: ${shareUrl}`;
  const emailSubject = `Worth checking — is our rent increase fair in ${city}?`;
  const emailBody = `Hey,\n\nI just ran my address through a rent fairness tool and thought you'd want to know what I found.\n\n${brLabel} rents in ${zipCode} (${city}, ${state}) moved ${marketSign}${marketYoy}% this year. My landlord is asking for ${increasePct}%${isAboveMarket ? ` — that's ${diff} percentage points above the local market trend` : ', which is in line with the market'}.\n\nThe tool cross-references HUD data, local market trends, and comparable rents nearby. It's free, takes 30 seconds, and doesn't require a signup.\n\nCheck yours here: ${shareUrl}\n\nThought you'd want to know, especially if you got a similar increase.`;
  const clipboardText = `Just checked — ${brLabel} rents in ${zipCode} (${city}) moved ${marketSign}${marketYoy}% this year. My landlord wants ${increasePct}%. Free tool to check yours: ${shareUrl}`;

  const handleSMS = () => {
    trackEvent('building_share_clicked', { method: 'sms', zip: zipCode });
    window.open(`sms:?&body=${encodeURIComponent(smsBody)}`);
  };
  const handleWhatsApp = () => {
    trackEvent('building_share_clicked', { method: 'whatsapp', zip: zipCode });
    window.open(`https://wa.me/?text=${encodeURIComponent(whatsappBody)}`);
  };
  const handleEmail = () => {
    trackEvent('building_share_clicked', { method: 'email', zip: zipCode });
    window.open(`mailto:?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`);
  };
  const handleTwitter = () => {
    trackEvent('building_share_clicked', { method: 'twitter', zip: zipCode });
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(shareUrl)}`, '_blank');
  };
  const handleFacebook = () => {
    trackEvent('building_share_clicked', { method: 'facebook', zip: zipCode });
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank');
  };
  const handleNeighborCopy = async () => {
    trackEvent('building_share_clicked', { method: 'copy', zip: zipCode });
    try {
      await navigator.clipboard.writeText(clipboardText);
      setNeighborCopied(true);
      setTimeout(() => setNeighborCopied(false), 2500);
      toast.success('Copied to clipboard!');
    } catch {
      toast.error('Copy failed — try selecting and copying manually.');
    }
  };

  // ── Image share handler ──
  const handleImageShare = async () => {
    if (!cardRef.current) return;
    setGeneratingImage(true);
    try {
      const canvas = await html2canvas(cardRef.current, { scale: 2, backgroundColor: null, useCORS: true });
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
      if (!blob) return;
      const file = new File([blob], 'rent-result.png', { type: 'image/png' });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ title: 'My Rent Analysis', text: 'Check yours free at renewalreply.com', files: [file] });
          return;
        } catch (e) {
          if ((e as Error).name === 'AbortError') return;
        }
      }
      // Fallback: download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'rent-result.png';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Image saved!');
    } finally {
      setGeneratingImage(false);
    }
  };

  return (
    <div className="w-full max-w-[540px]">
      {/* Hidden card for image generation */}
      <div className="absolute -left-[9999px] top-0" aria-hidden>
        <div
          ref={cardRef}
          style={{
            width: 540,
            padding: 40,
            background: 'linear-gradient(135deg, hsl(45, 30%, 97%), hsl(45, 20%, 93%))',
            borderRadius: 20,
            fontFamily: "Georgia, 'Times New Roman', serif",
          }}
        >
          <div style={{ marginBottom: 24 }}>
            <span style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 22, fontWeight: 700, color: '#2d6a4f' }}>
              Renewal<span style={{ fontWeight: 400, color: '#c77d3c' }}>Reply</span>
            </span>
          </div>
          <p style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 22, lineHeight: 1.3, color: '#1a1a1a', marginBottom: 28, letterSpacing: '-0.01em' }}>
            {headline}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {stats.map((stat) => (
              <div key={stat.label} style={{ background: 'white', borderRadius: 12, padding: '14px 16px', border: '1px solid hsl(30, 10%, 88%)' }}>
                <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'hsl(30, 5%, 55%)', marginBottom: 4 }}>{stat.label}</p>
                <p style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 26, color: stat.color || '#1a1a1a', letterSpacing: '-0.02em', lineHeight: 1 }}>{stat.value}</p>
              </div>
            ))}
          </div>
          <p style={{ marginTop: 28, fontSize: 13, color: 'hsl(30, 5%, 50%)', textAlign: 'center' }}>Check yours free → renewalreply.com</p>
        </div>
      </div>

      {/* Tab switcher — only show tabs when landlord tab is available */}
      {showLandlordTab ? (
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => setActiveTab('landlord')}
            className={`flex-1 px-4 py-2.5 text-[13px] font-semibold transition-colors ${
              activeTab === 'landlord'
                ? 'bg-primary text-primary-foreground'
                : 'bg-card text-muted-foreground hover:text-foreground'
            }`}
          >
            <Link2 size={14} className="inline mr-1.5 -mt-0.5" />
            Send to landlord
          </button>
          <button
            onClick={() => setActiveTab('neighbors')}
            className={`flex-1 px-4 py-2.5 text-[13px] font-semibold transition-colors ${
              activeTab === 'neighbors'
                ? 'bg-primary text-primary-foreground'
                : 'bg-card text-muted-foreground hover:text-foreground'
            }`}
          >
            <Share2 size={14} className="inline mr-1.5 -mt-0.5" />
            Share with neighbors
          </button>
        </div>
      ) : null}

      {/* Tab content */}
      <div className="mt-3">
        {activeTab === 'landlord' && showLandlordTab ? (
          <div className="text-center">
            <p className="text-[13px] text-muted-foreground mb-3">
              Generate a shareable link to your full analysis — comps, market data, and fair offer.
            </p>
            {reportUrl ? (
              <div className="flex items-center gap-2 justify-center">
                <div className="flex items-center gap-2 bg-secondary rounded-lg px-4 py-2.5 text-sm text-foreground/80 max-w-[280px] overflow-hidden">
                  <Link2 size={14} className="shrink-0 text-muted-foreground" />
                  <span className="truncate">{reportUrl}</span>
                </div>
                <button
                  onClick={() => copyToClipboard(reportUrl)}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:brightness-90 transition-all shadow-sm shadow-primary/20"
                >
                  {copied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy</>}
                </button>
              </div>
            ) : (
              <button
                onClick={handleGenerateReport}
                disabled={generating}
                data-share-report-btn
                className="inline-flex items-center gap-2 border border-border px-5 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:border-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                <Link2 size={16} />
                {generating ? 'Generating…' : 'Generate report link'}
              </button>
            )}
          </div>
        ) : (
          <div>
            <p className="text-[13px] text-muted-foreground mb-3 text-center">
              {verdict === 'above'
                ? 'Neighbors facing the same increase? Share so they can check theirs.'
                : 'Share this tool with your neighbors — they might not be as lucky.'}
            </p>

            {/* Channel grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-2.5 mb-3">
              <button
                onClick={handleSMS}
                className="flex items-center justify-center gap-2 px-3.5 py-3 rounded-lg border border-border bg-card text-sm font-medium text-foreground hover:border-foreground/40 hover:shadow-sm transition-all shadow-xs"
              >
                <MessageCircle size={16} /> Text
              </button>
              <button
                onClick={handleWhatsApp}
                className="flex items-center justify-center gap-2 px-3.5 py-3 rounded-lg border border-border bg-card text-sm font-medium text-foreground hover:border-foreground/40 hover:shadow-sm transition-all shadow-xs"
              >
                <MessageCircle size={16} /> WhatsApp
              </button>
              <button
                onClick={handleEmail}
                className="flex items-center justify-center gap-2 px-3.5 py-3 rounded-lg border border-border bg-card text-sm font-medium text-foreground hover:border-foreground/40 hover:shadow-sm transition-all shadow-xs"
              >
                <Mail size={16} /> Email
              </button>
              <button
                onClick={handleTwitter}
                className="flex items-center justify-center gap-2 px-3.5 py-3 rounded-lg border border-border bg-card text-sm font-medium text-foreground hover:border-foreground/40 hover:shadow-sm transition-all shadow-xs"
              >
                <Twitter size={16} /> Twitter
              </button>
              <button
                onClick={handleFacebook}
                className="flex items-center justify-center gap-2 px-3.5 py-3 rounded-lg border border-border bg-card text-sm font-medium text-foreground hover:border-foreground/40 hover:shadow-sm transition-all shadow-xs"
              >
                <Facebook size={16} /> Facebook
              </button>
              <button
                onClick={handleNeighborCopy}
                className="flex items-center justify-center gap-2 px-3.5 py-3 rounded-lg border border-border bg-card text-sm font-medium text-foreground hover:border-foreground/40 hover:shadow-sm transition-all shadow-xs"
              >
                {neighborCopied ? <><Check size={16} /> Copied!</> : <><Copy size={16} /> Copy</>}
              </button>
            </div>

            {/* Image share option */}
            <button
              onClick={handleImageShare}
              disabled={generatingImage}
              className="w-full text-center text-[12.5px] text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2 disabled:opacity-50"
            >
              {generatingImage ? 'Generating image…' : '🔗 Download shareable image'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShareHub;
