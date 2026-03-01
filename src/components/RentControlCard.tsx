import { ExternalLink } from 'lucide-react';
import { getRentControlByStateCity, getApplicableCap, getNoticeRequirement, RentControlResult } from '@/data/rentControlData';

interface RentControlCardProps {
  state: string;
  city: string;
  zip: string;
  increasePct: number;
}

const RentControlCard = ({ state, city, zip, increasePct }: RentControlCardProps) => {
  const result: RentControlResult = getRentControlByStateCity(state, city);
  const cap = getApplicableCap(result);
  const notice = getNoticeRequirement(result);

  const hasCap = !!cap;
  const exceedsCap = hasCap && cap?.maxIncreasePct && increasePct > cap.maxIncreasePct;

  return (
    <div>
      <h2 className="section-title">📋 Know Your Rights</h2>

      {hasCap && cap ? (
        <div className="mt-3">
          <div className="px-4 py-4 rounded-lg border border-verdict-good/30 bg-verdict-good/5">
            <p className="text-sm text-foreground leading-relaxed">
              <strong>{cap.jurisdiction}</strong> limits rent increases to <strong>{cap.maxIncreaseFormula}</strong> per year for qualifying units.
              {exceedsCap && (
                <span className="text-verdict-overpaying font-medium">
                  {' '}Your proposed increase of {increasePct}% may exceed this limit.
                </span>
              )}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Applies to: {cap.applicability}
            </p>
            {cap.exemptions && (
              <p className="text-xs text-muted-foreground mt-1">
                Exemptions: {cap.exemptions}
              </p>
            )}
            {notice && (
              <p className="text-xs text-muted-foreground mt-1">
                Required notice: {notice.days} days ({notice.source})
              </p>
            )}
          </div>
          {cap.ordinanceUrl && (
            <a
              href={cap.ordinanceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline mt-3"
            >
              Read the full rule → <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      ) : result.stateLaw ? (
        <div className="mt-3">
          <div className="px-4 py-4 rounded-lg border border-border bg-muted/30">
            <p className="text-sm text-foreground leading-relaxed">
              <strong>{result.stateLaw.jurisdiction}</strong> does not cap rent increases statewide, but some cities do.
              Check your local tenant rights.
            </p>
            {notice && (
              <p className="text-xs text-muted-foreground mt-2">
                Required notice for increases: {notice.days} days
              </p>
            )}
            {result.stateLaw.notes && (
              <p className="text-xs text-muted-foreground mt-1">{result.stateLaw.notes}</p>
            )}
          </div>
          {result.stateLaw.ordinanceUrl && (
            <a
              href={result.stateLaw.ordinanceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline mt-3"
            >
              View state tenant rights → <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      ) : (
        <div className="mt-3">
          <div className="px-4 py-4 rounded-lg border border-border bg-muted/30">
            <p className="text-sm text-foreground leading-relaxed">
              We don't have legal data for your area yet. Check your local tenant rights office.
            </p>
          </div>
          <a
            href="https://www.nolo.com/legal-encyclopedia/renters-rights"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline mt-3"
          >
            Browse tenant rights by state → <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground mt-4">
        This is general information, not legal advice. Laws may have exemptions based on building age, unit count, or lease type.
      </p>
    </div>
  );
};

export default RentControlCard;
