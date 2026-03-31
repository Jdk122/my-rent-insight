import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { RentcastComparable } from '@/hooks/useRentcast';
import { compAgeLabel } from '@/lib/compDisplay';
import { EMAIL_GATE_ENABLED } from '@/lib/featureFlags';

interface PreGateCompPreviewProps {
  compsWithRent: RentcastComparable[];
  capturedEmail: string;
  fmt: (n: number) => string;
}

const PreGateCompPreview = ({ compsWithRent, capturedEmail, fmt }: PreGateCompPreviewProps) => {
  const previewComp = useMemo(() => {
    if (capturedEmail || compsWithRent.length < 3) return null;
    const best =
      compsWithRent.find(c => c.isSameUnitLine && c.rent && c.rent > 0) ||
      compsWithRent.find(c => c.isSameBuilding && c.rent && c.rent > 0) ||
      compsWithRent.find(c => c.rent && c.rent > 0);
    return best || null;
  }, [compsWithRent, capturedEmail]);

  if (!previewComp) return null;

  const address = previewComp.formattedAddress || 'Nearby unit';
  const age = compAgeLabel(previewComp.daysOld);
  const remaining = compsWithRent.length - 1;

  const meta: string[] = [];
  if (previewComp.bedrooms !== null) meta.push(`${previewComp.bedrooms} bed`);
  if (previewComp.bathrooms !== null) meta.push(`${previewComp.bathrooms} bath`);
  if (previewComp.squareFootage) meta.push(`${fmt(previewComp.squareFootage)} sqft`);
  if (previewComp.distance !== null && previewComp.distance > 0) meta.push(`${previewComp.distance.toFixed(2)} mi`);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35, duration: 0.4 }}
      className="mt-4 w-full max-w-[540px]"
    >
      <div className="rounded-lg border border-border/80 bg-card px-4 py-3 flex items-start justify-between gap-3" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-foreground truncate">{address}</span>
            {previewComp.isSameUnitLine && (
              <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                Same line
              </span>
            )}
            {previewComp.isSameBuilding && !previewComp.isSameUnitLine && (
              <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-green-500/10 text-green-700 border border-green-500/20">
                Same building
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {meta.length > 0 && (
              <span className="text-xs text-muted-foreground">{meta.join(' · ')}</span>
            )}
            {age && previewComp.daysOld !== null && previewComp.daysOld < 30 && (
              <span className="text-xs text-green-600 font-medium">{age.text}</span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <span className="text-lg font-bold text-foreground">${fmt(previewComp.rent!)}/mo</span>
        </div>
      </div>
      {remaining > 0 && (
        <p className="text-xs text-muted-foreground mt-2 text-center">
          {remaining} more comparable{remaining !== 1 ? 's' : ''} available in your full report
        </p>
      )}
    </motion.div>
  );
};

export default PreGateCompPreview;
