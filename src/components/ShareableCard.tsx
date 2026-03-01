import { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { toast } from 'sonner';

interface ShareableCardProps {
  headline: string;
  stats: { label: string; value: string; color?: string }[];
}

const ShareableCard = ({ headline, stats }: ShareableCardProps) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);

  const generate = async (): Promise<Blob | null> => {
    if (!cardRef.current) return null;
    setGenerating(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        backgroundColor: null,
        useCORS: true,
      });
      return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
    } finally {
      setGenerating(false);
    }
  };

  const handleShare = async () => {
    const blob = await generate();
    if (!blob) return;

    const file = new File([blob], 'rent-result.png', { type: 'image/png' });

    // Try native share on mobile
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({
          title: 'My Rent Analysis',
          text: 'Check yours free at renewalreply.com',
          files: [file],
        });
        return;
      } catch (e) {
        // User cancelled or share failed, fall through to download
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
  };

  return (
    <>
      {/* Hidden card for rendering */}
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
          {/* Brand */}
          <div style={{ marginBottom: 24 }}>
            <span style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 22, fontWeight: 700, color: '#2d6a4f' }}>
              Renewal<span style={{ fontWeight: 400, color: '#c77d3c' }}>Reply</span>
            </span>
          </div>

          {/* Headline */}
          <p style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 22, lineHeight: 1.3, color: '#1a1a1a', marginBottom: 28, letterSpacing: '-0.01em' }}>
            {headline}
          </p>

          {/* Stats grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {stats.map((stat) => (
              <div
                key={stat.label}
                style={{
                  background: 'white',
                  borderRadius: 12,
                  padding: '14px 16px',
                  border: '1px solid hsl(30, 10%, 88%)',
                }}
              >
                <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'hsl(30, 5%, 55%)', marginBottom: 4 }}>
                  {stat.label}
                </p>
                <p style={{
                  fontFamily: "Georgia, 'Times New Roman', serif",
                  fontSize: 26,
                  color: stat.color || '#1a1a1a',
                  letterSpacing: '-0.02em',
                  lineHeight: 1,
                }}>
                  {stat.value}
                </p>
              </div>
            ))}
          </div>

          {/* CTA */}
          <p style={{ marginTop: 28, fontSize: 13, color: 'hsl(30, 5%, 50%)', textAlign: 'center' }}>
            Check yours free → renewalreply.com
          </p>
        </div>
      </div>

      {/* Button */}
      <button
        onClick={handleShare}
        disabled={generating}
        className="inline-flex items-center gap-2 text-base font-semibold text-muted-foreground hover:text-foreground transition-colors duration-150 disabled:opacity-50"
      >
        {generating ? 'Generating…' : '📸 Share your result'}
      </button>
    </>
  );
};

export default ShareableCard;
