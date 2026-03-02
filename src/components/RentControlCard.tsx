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
      <h3 className="evidence-card-header">Know Your Rights</h3>

      {hasCap && cap ? (
        <div className="mt-3">
          {/* NYC stabilization check prompt */}
          {cap.jurisdiction === 'New York City' && (
            <div className="px-4 py-3 rounded-lg border border-primary/30 bg-primary/5 mb-4">
              <p className="text-sm font-medium text-foreground">
                ⚡ Is your apartment rent-stabilized?
              </p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                About 1 million NYC units are rent-stabilized. If yours is, your landlord can only raise rent by the RGB-approved amount — not the market rate. Check your lease for "rent stabilized" language, or{' '}
                <a href="https://apps.hcr.ny.gov/BuildingSearch/" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:no-underline">
                  look up your building here
                </a>.
              </p>
            </div>
          )}

          {/* Exceedance warning */}
          {exceedsCap && (
            <div className="px-4 py-3 rounded-lg border border-destructive/30 bg-destructive/5 mb-4">
              <p className="text-sm font-medium text-destructive">
                Your proposed increase of {increasePct}% may exceed the local cap.
              </p>
            </div>
          )}

          {/* Structured details */}
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="px-4 py-3 bg-muted/30 border-b border-border">
              <p className="text-sm font-semibold text-foreground">{cap.jurisdiction}</p>
              <p className="text-sm text-foreground mt-1">
                Rent increases capped at <strong>{cap.maxIncreaseFormula}</strong> per year
              </p>
            </div>

            <div className="divide-y divide-border">
              <div className="px-4 py-3 flex gap-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground w-28 flex-shrink-0 pt-0.5">Applies to</span>
                <span className="text-sm text-foreground">{cap.applicability}</span>
              </div>
              {cap.exemptions && (
                <div className="px-4 py-3 flex gap-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground w-28 flex-shrink-0 pt-0.5">Exemptions</span>
                  <span className="text-sm text-foreground">{cap.exemptions}</span>
                </div>
              )}
              {notice && (
                <div className="px-4 py-3 flex gap-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground w-28 flex-shrink-0 pt-0.5">Required notice</span>
                  <span className="text-sm text-foreground">{notice.days} days ({notice.source})</span>
                </div>
              )}
              {cap.notes && (
                <div className="px-4 py-3">
                  <p className="text-sm text-muted-foreground leading-relaxed">{cap.notes}</p>
                </div>
              )}
            </div>
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
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="px-4 py-3 bg-muted/30 border-b border-border">
              <p className="text-sm font-semibold text-foreground">{result.stateLaw.jurisdiction}</p>
              <p className="text-sm text-foreground mt-1">
                No statewide rent increase cap, but some cities may have local protections.
              </p>
            </div>
            <div className="divide-y divide-border">
              {notice && (
                <div className="px-4 py-3 flex gap-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground w-28 flex-shrink-0 pt-0.5">Required notice</span>
                  <span className="text-sm text-foreground">{notice.days} days</span>
                </div>
              )}
              {result.stateLaw.notes && (
                <div className="px-4 py-3">
                  <p className="text-sm text-muted-foreground">{result.stateLaw.notes}</p>
                </div>
              )}
            </div>
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
