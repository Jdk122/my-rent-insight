import { ConfidenceLevel } from '@/lib/dataQuality';

const colorMap: Record<ConfidenceLevel, { bg: string; text: string; border: string }> = {
  high: { bg: 'bg-verdict-good/10', text: 'text-verdict-good', border: 'border-verdict-good/30' },
  moderate: { bg: 'bg-verdict-fair/10', text: 'text-verdict-fair', border: 'border-verdict-fair/30' },
  limited: { bg: 'bg-destructive/10', text: 'text-destructive', border: 'border-destructive/30' },
};

const labelMap: Record<ConfidenceLevel, string> = {
  high: 'High Confidence',
  moderate: 'Moderate Confidence',
  limited: 'Limited Data',
};

interface DataConfidenceBadgeProps {
  level: ConfidenceLevel;
  note: string | null;
}

const DataConfidenceBadge = ({ level, note }: DataConfidenceBadgeProps) => {
  const colors = colorMap[level];
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider border ${colors.bg} ${colors.text} ${colors.border}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${level === 'high' ? 'bg-verdict-good' : level === 'moderate' ? 'bg-verdict-fair' : 'bg-destructive'}`} />
        {labelMap[level]}
      </span>
      {note && level !== 'high' && (
        <p className="text-[11px] text-muted-foreground/70 text-center max-w-[400px] leading-relaxed">
          {note}
        </p>
      )}
    </div>
  );
};

export default DataConfidenceBadge;
