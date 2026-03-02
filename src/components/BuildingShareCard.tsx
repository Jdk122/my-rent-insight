import { useState, useEffect, useRef } from 'react';
import { Share2, ChevronDown, MessageCircle, Mail, Copy, Check } from 'lucide-react';
import { trackEvent } from '@/lib/analytics';

interface BuildingShareCardProps {
  zipCode: string;
  city: string;
  state: string;
  bedrooms: number;
  increasePct: number;
  marketYoy: number;
}

const getBedroomLabel = (bedrooms: number) => {
  if (bedrooms === 0) return 'Studio';
  return `${bedrooms}BR`;
};

const BuildingShareCard = ({
  zipCode,
  city,
  state,
  bedrooms,
  increasePct,
  marketYoy,
}: BuildingShareCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [mounted, setMounted] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 300);
    return () => clearTimeout(timer);
  }, []);

  const brLabel = getBedroomLabel(bedrooms);
  const isAboveMarket = increasePct > marketYoy;
  const diff = Math.round((increasePct - marketYoy) * 10) / 10;
  const marketSign = marketYoy > 0 ? '+' : '';

  const shareUrl = `https://renewalreply.com/?utm_source=share&utm_medium=building&utm_campaign=viral_loop&utm_content=${zipCode}`;

  // SMS message
  const smsBody = `Hey — I just checked our building's rent increase against market data. ${brLabel} rents in ${zipCode} moved ${marketSign}${marketYoy}% this year. My landlord wants ${increasePct}%.${isAboveMarket ? ` That's ${diff} percentage points above market.` : ''} Took 30 seconds, no signup: ${shareUrl}`;

  // WhatsApp message
  const whatsappBody = `Did you get your renewal letter yet? 👀\n\nI just ran our zip code (${zipCode}) through a rent fairness tool. ${brLabel} rents here moved ${marketSign}${marketYoy}% this year.\n\nMy landlord is asking for ${increasePct}%${isAboveMarket ? ` — that's ${diff} points above the market trend.` : '.'}\n\nFree tool, no signup, 30 seconds: ${shareUrl}`;

  // Email
  const emailSubject = `Worth checking — is our rent increase fair in ${city}?`;
  const emailBody = `Hey,\n\nI just ran my address through a rent fairness tool and thought you'd want to know what I found.\n\n${brLabel} rents in ${zipCode} (${city}, ${state}) moved ${marketSign}${marketYoy}% this year. My landlord is asking for ${increasePct}%${isAboveMarket ? ` — that's ${diff} percentage points above the local market trend` : ', which is in line with the market'}.\n\nThe tool cross-references HUD data, local market trends, and comparable rents nearby. It's free, takes 30 seconds, and doesn't require a signup.\n\nCheck yours here: ${shareUrl}\n\nThought you'd want to know, especially if you got a similar increase.`;

  // Clipboard
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

  const handleCopy = async () => {
    trackEvent('building_share_clicked', { method: 'copy', zip: zipCode });
    try {
      await navigator.clipboard.writeText(clipboardText);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = clipboardText;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleToggle = () => {
    if (!isExpanded) {
      trackEvent('building_share_expanded', { zip: zipCode });
    }
    setIsExpanded((prev) => !prev);
  };

  return (
    <div
      className="w-full max-w-[480px] mx-auto"
      style={{
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(12px)',
        transition: 'opacity 0.4s ease-out, transform 0.4s ease-out',
      }}
    >
      <div
        className="rounded-xl border border-border/80 bg-card overflow-hidden"
        style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
      >
        {/* ── Collapsed header bar ── */}
        <button
          onClick={handleToggle}
          className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-muted/30 transition-colors duration-150"
          aria-expanded={isExpanded}
        >
          <Share2 size={18} className="text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-semibold text-foreground leading-tight">
              Share with your building
            </p>
            <p className="text-[13px] text-muted-foreground leading-snug mt-0.5">
              Your neighbors probably got the same increase
            </p>
          </div>
          <ChevronDown
            size={18}
            className="text-muted-foreground shrink-0 transition-transform duration-300"
            style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
          />
        </button>

        {/* ── Expanded content ── */}
        <div
          ref={contentRef}
          style={{
            maxHeight: isExpanded ? '650px' : '0',
            opacity: isExpanded ? 1 : 0,
            transition: 'max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease',
            overflow: 'hidden',
          }}
        >
          <div className="px-5 pb-5">
            {/* ── Data callout ── */}
            <div
              className="rounded-lg px-4 py-3.5 mb-4"
              style={{ backgroundColor: 'hsl(40, 33%, 96%)' }}
            >
              <p className="text-[13.5px] text-foreground leading-relaxed">
                <strong>{brLabel}</strong> rents in{' '}
                <strong>{zipCode}</strong>{' '}
                <span className="text-muted-foreground">({city}, {state})</span>{' '}
                moved <strong>{marketSign}{marketYoy}%</strong> this year.
                Your landlord is asking for <strong>{increasePct}%</strong>.
                {isAboveMarket && (
                  <> That's{' '}
                    <strong className="text-destructive">{diff} points above</strong> the market trend.</>
                )}
              </p>
            </div>

            {/* ── 2×2 share grid ── */}
            <div className="grid grid-cols-2 gap-2.5 mb-4">
              <button
                onClick={handleSMS}
                className="flex items-center justify-center gap-2 rounded-lg py-3 text-[13.5px] font-semibold text-white transition-colors duration-150"
                style={{ backgroundColor: '#2563EB', minHeight: '44px' }}
              >
                <MessageCircle size={16} />
                Text
              </button>

              <button
                onClick={handleWhatsApp}
                className="flex items-center justify-center gap-2 rounded-lg py-3 text-[13.5px] font-semibold text-white transition-colors duration-150"
                style={{ backgroundColor: '#25D366', minHeight: '44px' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                WhatsApp
              </button>

              <button
                onClick={handleEmail}
                className="flex items-center justify-center gap-2 rounded-lg py-3 text-[13.5px] font-semibold text-white transition-colors duration-150"
                style={{ backgroundColor: '#1A1A18', minHeight: '44px' }}
              >
                <Mail size={16} />
                Email
              </button>

              <button
                onClick={handleCopy}
                className="flex items-center justify-center gap-2 rounded-lg py-3 text-[13.5px] font-semibold border transition-all duration-200"
                style={{
                  minHeight: '44px',
                  backgroundColor: copied ? '#ECFDF5' : 'transparent',
                  color: copied ? '#059669' : 'hsl(var(--foreground))',
                  borderColor: copied ? '#A7F3D0' : 'hsl(var(--border))',
                }}
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>

            {/* ── Preview toggle ── */}
            <button
              onClick={() => setShowPreview((p) => !p)}
              className="text-[12.5px] text-muted-foreground hover:text-foreground transition-colors duration-150 underline underline-offset-2 mb-3"
            >
              {showPreview ? 'Hide preview' : 'Preview what gets shared'}
            </button>

            {showPreview && (
              <div
                className="rounded-lg border border-border/60 px-4 py-3 mb-3"
                style={{ backgroundColor: 'hsl(var(--muted) / 0.3)' }}
              >
                <p className="text-[12.5px] text-muted-foreground whitespace-pre-line leading-relaxed">
                  {smsBody}
                </p>
              </div>
            )}

            {/* ── Trust footer ── */}
            <p className="text-[11.5px] text-muted-foreground/70 text-center">
              Free tool · No signup · No data collected
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BuildingShareCard;
