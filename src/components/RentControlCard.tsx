import { getRentControlForZip, getApplicableCap, getNoticeRequirement, RentControlResult } from '@/data/rentControlData';
import { ExternalLink, AlertTriangle, ShieldCheck } from 'lucide-react';

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
    <div>
      <h2 className="font-display text-xl text-foreground mb-1">Legal Context</h2>
      <p className="text-[13px] text-muted-foreground mb-4">Rent laws that apply to {zip}</p>

      <div className="divide-y divide-border">
        {hasCap && cap && (
          <>
            <div className="data-row">
              <span className="data-row-label">Rent control</span>
              <span className="data-row-value text-verdict-good flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                {cap.jurisdiction}
              </span>
            </div>
            <div className="data-row">
              <span className="data-row-label">Max increase</span>
              <span className="data-row-value text-[12px]">{cap.maxIncreaseFormula}</span>
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
            <span className="font-mono text-[13px] text-muted-foreground">No statutory cap</span>
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
        <div className="callout callout-warn mt-4">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'hsl(var(--verdict-overpaying))' }} />
          <p className="text-xs text-foreground leading-relaxed">
            Your increase of {increasePct}% may exceed the legal maximum.
          </p>
        </div>
      )}

      {(result.cityLaw?.notes || result.stateLaw?.notes) && (
        <p className="text-[11px] text-muted-foreground leading-relaxed mt-3">
          {result.cityLaw?.notes || result.stateLaw?.notes}
        </p>
      )}

      {cap?.ordinanceUrl && (
        <a
          href={cap.ordinanceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[11px] font-mono mt-3 text-primary hover:underline"
        >
          View ordinance <ExternalLink className="w-2.5 h-2.5" />
        </a>
      )}
    </div>
  );
};

export default RentControlCard;
