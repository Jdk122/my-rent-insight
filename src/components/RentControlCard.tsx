import { getRentControlForZip, getApplicableCap, getNoticeRequirement, RentControlResult } from '@/data/rentControlData';
import { Gavel, ExternalLink, AlertTriangle, ShieldCheck } from 'lucide-react';

interface RentControlCardProps {
  zip: string;
  increasePct: number;
}

const RentControlCard = ({ zip, increasePct }: RentControlCardProps) => {
  const result: RentControlResult = getRentControlForZip(zip);
  const cap = getApplicableCap(result);
  const notice = getNoticeRequirement(result);

  if (!result.stateLaw && !result.cityLaw) return null;

  const hasCap = !!cap;

  return (
    <div className="brand-card-legal space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0" style={{ background: 'hsl(var(--accent-indigo) / 0.1)' }}>
          <Gavel className="w-4 h-4" style={{ color: 'hsl(var(--accent-indigo))' }} />
        </div>
        <div>
          <p className="data-label mb-0">Legal Context</p>
          <h3 className="font-display text-xl text-foreground leading-tight">
            Rent laws in your area
          </h3>
        </div>
      </div>

      <div className="divide-y divide-border">
        {hasCap && cap && (
          <>
            <div className="data-row">
              <span className="data-row-label">Rent control</span>
              <span className="data-row-value text-verdict-good flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Yes — {cap.jurisdiction}
              </span>
            </div>
            <div className="data-row">
              <span className="data-row-label">Max increase</span>
              <span className="data-row-value text-sm">{cap.maxIncreaseFormula}</span>
            </div>
            <div className="data-row items-start">
              <span className="data-row-label">Applies to</span>
              <span className="text-foreground text-right text-xs max-w-[55%] leading-relaxed">
                {cap.applicability}
              </span>
            </div>
          </>
        )}

        {!hasCap && (
          <div className="data-row">
            <span className="data-row-label">Rent control</span>
            <span className="font-mono text-sm text-muted-foreground">No statutory cap</span>
          </div>
        )}

        {notice && (
          <div className="data-row">
            <span className="data-row-label">Required notice</span>
            <span className="data-row-value">{notice.days} days</span>
          </div>
        )}
      </div>

      {hasCap && cap?.maxIncreasePct && increasePct > cap.maxIncreasePct && (
        <div className="flex items-start gap-2 p-3 rounded-lg" style={{ background: 'hsl(var(--accent-indigo) / 0.06)', border: '1px solid hsl(var(--accent-indigo) / 0.15)' }}>
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: 'hsl(var(--accent-indigo))' }} />
          <p className="text-xs text-foreground leading-relaxed">
            Your increase of {increasePct}% may exceed the legal maximum.
          </p>
        </div>
      )}

      {(result.cityLaw?.notes || result.stateLaw?.notes) && (
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          {result.cityLaw?.notes || result.stateLaw?.notes}
        </p>
      )}

      {cap?.ordinanceUrl && (
        <a
          href={cap.ordinanceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[11px] font-mono hover:underline"
          style={{ color: 'hsl(var(--accent-indigo))' }}
        >
          View ordinance <ExternalLink className="w-2.5 h-2.5" />
        </a>
      )}
    </div>
  );
};

export default RentControlCard;
