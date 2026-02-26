import { motion } from 'framer-motion';
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

  // Nothing useful to show
  if (!result.stateLaw && !result.cityLaw) return null;

  const hasCap = !!cap;

  return (
    <div className="brand-card space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-md bg-secondary shrink-0 mt-0.5">
          <Gavel className="w-4 h-4 text-foreground" />
        </div>
        <div>
          <p className="data-label mb-0.5">Legal Context</p>
          <h3 className="font-display text-xl text-foreground leading-tight">
            Rent laws in your area
          </h3>
        </div>
      </div>

      <div className="space-y-0 divide-y divide-border text-sm">
        {/* Rent cap info */}
        {hasCap && cap && (
          <>
            <div className="flex justify-between py-3">
              <span className="text-muted-foreground">Rent control</span>
              <span className="font-mono font-semibold text-verdict-good flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Yes — {cap.jurisdiction}
              </span>
            </div>
            <div className="flex justify-between py-3">
              <span className="text-muted-foreground">Max allowable increase</span>
              <span className="font-mono font-semibold text-foreground">
                {cap.maxIncreaseFormula}
              </span>
            </div>
            <div className="flex justify-between py-3">
              <span className="text-muted-foreground">Applies to</span>
              <span className="text-foreground text-right max-w-[60%]">
                {cap.applicability}
              </span>
            </div>
            {cap.exemptions && (
              <div className="flex justify-between py-3">
                <span className="text-muted-foreground">Exemptions</span>
                <span className="text-foreground text-right max-w-[60%]">
                  {cap.exemptions}
                </span>
              </div>
            )}
          </>
        )}

        {!hasCap && (
          <div className="flex justify-between py-3">
            <span className="text-muted-foreground">Rent control</span>
            <span className="font-mono font-semibold text-muted-foreground">
              No statutory cap
            </span>
          </div>
        )}

        {/* Notice requirement */}
        {notice && (
          <div className="flex justify-between py-3">
            <span className="text-muted-foreground">Required notice period</span>
            <span className="font-mono font-semibold text-foreground">
              {notice.days} days ({notice.source})
            </span>
          </div>
        )}
      </div>

      {/* Alert if increase may exceed legal cap */}
      {hasCap && cap?.maxIncreasePct && increasePct > cap.maxIncreasePct && (
        <div className="flex items-start gap-2 p-3 rounded-md bg-accent/10 border border-accent/20">
          <AlertTriangle className="w-4 h-4 text-accent shrink-0 mt-0.5" />
          <p className="text-sm text-foreground">
            Your proposed increase of {increasePct}% may exceed the legal maximum.
            Consider contacting your local tenant rights office.
          </p>
        </div>
      )}

      {/* Notes */}
      {(result.cityLaw?.notes || result.stateLaw?.notes) && (
        <p className="text-xs text-muted-foreground leading-relaxed">
          {result.cityLaw?.notes || result.stateLaw?.notes}
        </p>
      )}

      {/* Ordinance link */}
      {cap?.ordinanceUrl && (
        <a
          href={cap.ordinanceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-accent hover:underline"
        >
          View ordinance <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </div>
  );
};

export default RentControlCard;
