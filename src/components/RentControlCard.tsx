import { ExternalLink, Loader2, ShieldCheck } from 'lucide-react';
import { getRentControlByStateCity, getApplicableCap, getNoticeRequirement, RentControlResult } from '@/data/rentControlData';
import { useHcrLookup } from '@/hooks/useHcrLookup';

interface RentControlCardProps {
  state: string;
  city: string;
  zip: string;
  increasePct: number;
  address?: string | null;
}

const RentControlCard = ({ state, city, zip, increasePct, address }: RentControlCardProps) => {
  const result: RentControlResult = getRentControlByStateCity(state, city);
  const cap = getApplicableCap(result);
  const notice = getNoticeRequirement(result);

  const hasCap = !!cap;
  const exceedsCap = hasCap && cap?.maxIncreasePct && increasePct > cap.maxIncreasePct;

  const { result: hcrResult, loading: hcrLoading } = useHcrLookup(address || null, zip);

  return (
    <div>
      <h3 className="evidence-card-header">Know Your Rights</h3>

      {hasCap && cap ? (
        <div className="mt-3">
          {/* HCR stabilization auto-check result */}
          {hcrLoading && address && (
            <div className="px-4 py-3 rounded-lg border border-primary/30 bg-primary/5 mb-4 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Checking if your building is rent-stabilized…</p>
            </div>
          )}

          {hcrResult?.found && hcrResult.stabilized && (
            <div className="px-4 py-3 rounded-lg border border-verdict-good/30 bg-verdict-good/5 mb-4">
              <div className="flex items-start gap-2">
                <ShieldCheck className="w-5 h-5 text-verdict-good flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Your building is rent-stabilized.
                  </p>
                  <p className="text-sm text-foreground/80 mt-1 leading-relaxed">
                    Your legal maximum increase is <strong>3% (1-year)</strong> or <strong>4.5% (2-year)</strong> under the 2025–26 RGB guidelines (Order #57).
                    {increasePct > 4.5 && (
                      <span className="text-destructive font-medium"> Your proposed increase of {increasePct}% exceeds the legal cap.</span>
                    )}
                  </p>
                  {hcrResult.taxBenefit && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Tax benefit program: {hcrResult.taxBenefit}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {hcrResult?.found === false && hcrResult.reason === 'no_match' && address && (
            <div className="px-4 py-3 rounded-lg border border-border bg-muted/30 mb-4">
              <p className="text-sm text-foreground">
                ✅ Your building was <strong>not found</strong> in the DHCR rent-stabilization registry.
              </p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Based on 2024 DHCR registrations. Buildings registered after November 2025 may not appear. The only way to confirm is through HCR directly →{' '}
                <a href="https://portal.hcr.ny.gov/app/ask" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:no-underline">
                  Ask HCR
                </a>
              </p>
            </div>
          )}

          {/* Fallback prompt if no address was provided */}
          {!address && cap.jurisdiction === 'New York City' && (
            <div className="px-4 py-3 rounded-lg border border-primary/30 bg-primary/5 mb-4">
              <p className="text-sm font-medium text-foreground">
                ⚡ Is your apartment rent-stabilized?
              </p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Add your full address above and we'll check automatically. Or{' '}
                <a href="https://apps.hcr.ny.gov/BuildingSearch/" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:no-underline">
                  look up your building here
                </a>.
              </p>
            </div>
          )}

          {/* Exceedance warning (non-stabilized) */}
          {exceedsCap && !(hcrResult?.found && hcrResult.stabilized) && (
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
