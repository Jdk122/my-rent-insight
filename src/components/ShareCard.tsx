import { useRef, useState, useCallback } from 'react';
import { Download } from 'lucide-react';
import html2canvas from 'html2canvas';
import { trackEvent } from '@/lib/analytics';

interface ShareCardProps {
  score: number;
  tierLabel: string;
  verdict: 'above' | 'fair' | 'below' | 'none';
  increasePct: number;
  marketYoy: number;
  currentRent: number;
  newRent: number;
  city: string;
  state: string;
  zip: string;
  hasIncrease: boolean;
}

const VERDICT_COLORS: Record<ShareCardProps['verdict'], string> = {
  above: '#E24B4A',
  fair: '#EF9F27',
  below: '#1D9E75',
  none: '#1D9E75',
};

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

const ShareCard = ({
  score, tierLabel, verdict, increasePct, marketYoy,
  currentRent, newRent, city, state, zip, hasIncrease,
}: ShareCardProps) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [capturing, setCapturing] = useState(false);

  const color = VERDICT_COLORS[verdict];

  const handleCapture = useCallback(async () => {
    if (!cardRef.current || capturing) return;
    setCapturing(true);
    try {
      if ('fonts' in document) {
        await (document as any).fonts.ready;
      }

      const canvas = await html2canvas(cardRef.current, {
        scale: 1,
        useCORS: true,
        backgroundColor: '#FFFFFF',
        width: 1080,
        height: 1080,
      });

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/png');
      });

      if (!blob) { setCapturing(false); return; }

      const file = new File([blob], 'my-rent-result.png', { type: 'image/png' });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: 'My rent analysis',
            text: 'Is your rent fair? Check yours free at renewalreply.com',
          });
          trackEvent('share_card', { method: 'native_share', verdict, zip });
          setCapturing(false);
          return;
        } catch (e: any) {
          if (e?.name === 'AbortError') { setCapturing(false); return; }
        }
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'my-rent-result.png';
      a.click();
      URL.revokeObjectURL(url);
      trackEvent('share_card', { method: 'download', verdict, zip });
    } catch (err) {
      console.error('Share card capture failed:', err);
    } finally {
      setCapturing(false);
    }
  }, [capturing, verdict, zip]);

  const headlineStat = hasIncrease
    ? `My increase: ${increasePct}% — ${city} avg: ${marketYoy}%`
    : `My rent: $${fmt(currentRent)}/mo — ${city} avg trend: ${marketYoy}%`;

  const pills: string[] = [`Current: $${fmt(currentRent)}`];
  if (hasIncrease) pills.push(`Proposed: $${fmt(newRent)}`);
  pills.push(`Area trend: ${marketYoy}%`);

  return (
    <>
      {/* Off-screen card for capture */}
      <div style={{ position: 'absolute', left: '-9999px', top: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div
          ref={cardRef}
          style={{
            width: 1080,
            height: 1080,
            backgroundColor: '#FFFFFF',
            fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '48px 64px',
            boxSizing: 'border-box',
          }}
        >
          {/* Top bar */}
          <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 28, fontWeight: 600, color: '#1a1a1a', letterSpacing: '-0.5px' }}>
              RenewalReply
            </span>
            <span style={{ fontSize: 22, color: '#888888' }}>
              renewalreply.com
            </span>
          </div>

          {/* Score circle */}
          <div style={{
            width: 220,
            height: 220,
            borderRadius: '50%',
            border: `8px solid ${color}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 20,
          }}>
            <span style={{ fontSize: 80, fontWeight: 700, color: color, lineHeight: 1 }}>
              {score}
            </span>
          </div>

          {/* Verdict label */}
          <span style={{ fontSize: 32, fontWeight: 600, color: color, marginTop: 16 }}>
            {tierLabel}
          </span>

          {/* Headline stat */}
          <span style={{
            fontSize: 32,
            fontWeight: 500,
            color: '#1a1a1a',
            textAlign: 'center',
            marginTop: 24,
            lineHeight: 1.3,
            maxWidth: 900,
          }}>
            {headlineStat}
          </span>

          {/* Stat pills */}
          <div style={{ display: 'flex', gap: 16, marginTop: 28, flexWrap: 'wrap', justifyContent: 'center' }}>
            {pills.map((pill) => (
              <span
                key={pill}
                style={{
                  fontSize: 22,
                  fontWeight: 500,
                  color: '#444444',
                  backgroundColor: '#F3F4F6',
                  borderRadius: 999,
                  padding: '10px 28px',
                }}
              >
                {pill}
              </span>
            ))}
          </div>

          {/* Location */}
          <span style={{ fontSize: 20, color: '#999999', marginTop: 16 }}>
            {city}, {state} {zip}
          </span>

          {/* CTA */}
          <span style={{
            fontSize: 26,
            fontWeight: 600,
            color: '#1a1a1a',
            marginTop: 'auto',
            paddingTop: 24,
            textAlign: 'center',
          }}>
            Is YOUR rent fair? Check free at renewalreply.com
          </span>
        </div>
      </div>

      {/* Visible button */}
      <button
        onClick={handleCapture}
        disabled={capturing}
        className="w-full flex items-center justify-center gap-2 rounded-full border border-border px-4 py-2.5 text-[12px] font-medium text-foreground hover:bg-secondary/80 transition-colors disabled:opacity-50"
      >
        <Download size={14} />
        {capturing ? 'Generating...' : 'Save result card'}
      </button>
    </>
  );
};

export default ShareCard;
