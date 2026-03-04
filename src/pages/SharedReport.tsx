import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { bedroomLabels, BedroomType } from '@/data/rentData';
import { trackEvent } from '@/lib/analytics';
import SEO from '@/components/SEO';
import SEOFooter from '@/components/SEOFooter';
import PageNav from '@/components/PageNav';

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

interface ReportData {
  zip: string;
  city: string;
  state: string;
  currentRent: number;
  newRent: number;
  increasePct: number;
  marketYoy: number;
  fmr: number;
  verdict: string;
  counterLow: number | null;
  counterHigh: number | null;
  censusMedianRent: number | null;
  medianIncome: number | null;
  bedroomLabel: string;
  zillowMonthly: number | null;
  zillowDirection: string | null;
  yoySourceLabel: string;
  typicalRangeLow: number | null;
  typicalRangeHigh: number | null;
  rentStabilized: boolean | null;
  rentControlNote: string | null;
  comparables: any[] | null;
  medianCompRent: number | null;
  address: string | null;
}

const SharedReport = () => {
  const { shortId } = useParams<{ shortId: string }>();
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [createdAt, setCreatedAt] = useState<string>('');

  useEffect(() => {
    if (!shortId) return;
    trackEvent('report_viewed', { short_id: shortId });

    (async () => {
      const { data, error: err } = await supabase.rpc('get_shared_report' as any, { p_short_id: shortId }) as any;
      const row = Array.isArray(data) ? data[0] : data;

      if (err || !row) {
        setError(true);
        setLoading(false);
        return;
      }

      const rd = row.report_data as Record<string, any>;
      setCreatedAt(new Date(row.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }));
      setReport({
        zip: row.zip_code,
        city: rd.city || '',
        state: rd.state || '',
        currentRent: Number(row.current_rent),
        newRent: rd.newRent || 0,
        increasePct: rd.increasePct || 0,
        marketYoy: rd.marketYoy || 0,
        fmr: rd.fmr || 0,
        verdict: rd.verdict || '',
        counterLow: rd.counterLow ?? null,
        counterHigh: rd.counterHigh ?? null,
        censusMedianRent: rd.censusMedianRent ?? null,
        medianIncome: rd.medianIncome ?? null,
        bedroomLabel: rd.bedroomLabel || '',
        zillowMonthly: rd.zillowMonthly ?? null,
        zillowDirection: rd.zillowDirection ?? null,
        yoySourceLabel: rd.yoySourceLabel || '',
        typicalRangeLow: rd.typicalRangeLow ?? null,
        typicalRangeHigh: rd.typicalRangeHigh ?? null,
        rentStabilized: rd.rentStabilized ?? null,
        rentControlNote: rd.rentControlNote ?? null,
        comparables: rd.comparables ?? null,
        medianCompRent: rd.medianCompRent ?? null,
        address: row.address,
      });
      setLoading(false);
    })();
  }, [shortId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading report…</div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <PageNav hideCta />
        <main className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
          <h1 className="font-display text-2xl text-foreground">Report not found</h1>
          <p className="text-muted-foreground">This report link may be invalid or expired.</p>
          <Link to="/" className="text-primary hover:underline">← Go to RenewalReply</Link>
        </main>
        <SEOFooter />
      </div>
    );
  }

  const locationLabel = report.address || `Zip code ${report.zip}`;
  const verdictColor = report.verdict === 'above' ? 'text-destructive' : report.verdict === 'at-market' ? 'text-verdict-fair' : 'text-verdict-good';
  const verdictText = report.verdict === 'above' ? 'Above Market' : report.verdict === 'at-market' ? 'At Market' : 'Below Market';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEO
        title={`Rent Increase Analysis — ${locationLabel} | RenewalReply`}
        description={`Data-backed rent increase analysis for ${locationLabel}. Proposed increase: ${report.increasePct}%. Market trend: ${report.marketYoy}%.`}
        noindex
      />

      <PageNav />

      <main className="max-w-[620px] mx-auto px-6 py-10 flex-1 w-full">
        {/* Title */}
        <h1 className="font-display text-[clamp(1.5rem,4vw,2rem)] text-foreground leading-tight tracking-tight mb-1">
          Rent Increase Analysis
        </h1>
        <p className="text-muted-foreground text-sm mb-1">{locationLabel} — {report.bedroomLabel}</p>
        <p className="text-xs text-muted-foreground/60 mb-8">Generated {createdAt}</p>

        {/* Verdict */}
        <div className="rounded-xl border border-border bg-card p-6 mb-8" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Verdict</p>
          <p className={`font-display text-2xl tracking-tight ${verdictColor}`}>{verdictText}</p>
          <p className="text-sm text-muted-foreground mt-2">
            The market moved {report.marketYoy > 0 ? '+' : ''}{report.marketYoy}% this year. The proposed increase is {report.increasePct}%.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
            {[
              { label: 'Current rent', value: `$${fmt(report.currentRent)}` },
              { label: 'Proposed rent', value: `$${fmt(report.newRent)}`, color: report.verdict === 'above' ? 'text-destructive' : undefined },
              { label: 'Area trend', value: `${report.marketYoy > 0 ? '+' : ''}${report.marketYoy}%` },
              { label: 'Proposed increase', value: `${report.increasePct}%`, color: verdictColor },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-border/80 bg-background px-3 py-3 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">{s.label}</p>
                <p className={`font-display text-xl tracking-tight tabular-nums ${s.color || 'text-foreground'}`}>{s.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Market Data */}
        <div className="rounded-xl border border-border bg-card p-6 mb-8" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <h2 className="font-display text-lg tracking-tight text-foreground mb-4">Market Data</h2>

          <div className="divide-y divide-border">
            <Row label="HUD Fair Market Rent (FY2026)" value={`$${fmt(report.fmr)}/mo`} />
            <Row label={`${report.city} year-over-year change`} value={`${report.marketYoy > 0 ? '+' : ''}${report.marketYoy}%`} />
            {report.zillowMonthly !== null && (
              <Row label="Monthly trend" value={`${report.zillowMonthly > 0 ? '+' : ''}${report.zillowMonthly}%/mo ${report.zillowDirection === 'rising' ? '↑' : report.zillowDirection === 'falling' ? '↓' : '→'}`} />
            )}
            {report.typicalRangeLow && report.typicalRangeHigh && (
              <Row label={`Typical ${report.bedroomLabel.toLowerCase()} range`} value={`$${fmt(report.typicalRangeLow)} – $${fmt(report.typicalRangeHigh)}`} />
            )}
            {report.censusMedianRent !== null && (
              <Row label="Census median rent" value={`$${fmt(report.censusMedianRent)}/mo`} />
            )}
            {report.medianIncome !== null && (
              <Row label="Area median household income" value={`$${fmt(report.medianIncome)}/yr`} />
            )}
          </div>

          {report.yoySourceLabel && (
            <p className="text-[11px] text-muted-foreground mt-3">{report.yoySourceLabel}</p>
          )}
        </div>

        {/* Counter-offer */}
        {report.counterLow && report.counterHigh && (
          <div className="rounded-xl border border-border bg-card p-6 mb-8" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <h2 className="font-display text-lg tracking-tight text-foreground mb-2">Data-Backed Counter-Offer Range</h2>
            <p className="text-2xl font-display text-verdict-good tracking-tight">
              {report.counterLow === report.counterHigh
                ? `$${fmt(report.counterLow)}/mo`
                : `$${fmt(report.counterLow)} – $${fmt(report.counterHigh)}/mo`}
            </p>
            <p className="text-sm text-muted-foreground mt-2">Based on the {report.marketYoy}% local market trend applied to the current rent of ${fmt(report.currentRent)}/mo.</p>
          </div>
        )}

        {/* Comparables */}
        {report.comparables && report.comparables.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-6 mb-8" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <h2 className="font-display text-lg tracking-tight text-foreground mb-1">Nearby Comparable Listings</h2>
            <p className="text-xs text-muted-foreground mb-4">{report.comparables.length} similar {report.bedroomLabel.toLowerCase()} units nearby</p>

            {report.medianCompRent && (
              <div className="rounded-lg bg-secondary px-4 py-3 mb-4">
                <p className="text-xs text-muted-foreground">Median comp rent</p>
                <p className="font-display text-xl tracking-tight text-foreground">${fmt(report.medianCompRent)}/mo</p>
              </div>
            )}

            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {report.comparables.slice(0, 8).map((comp: any, i: number) => (
                <div key={i} className="flex justify-between items-center text-sm py-2 border-b border-border/50 last:border-0">
                  <span className="text-foreground/80 truncate max-w-[60%]">{comp.formattedAddress || comp.address || `Unit ${i + 1}`}</span>
                  <span className="tabular-nums font-medium text-foreground">{comp.rent ? `$${fmt(comp.rent)}/mo` : '—'}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rent stabilization */}
        {report.rentStabilized !== null && (
          <div className="rounded-xl border border-border bg-card p-6 mb-8" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <h2 className="font-display text-lg tracking-tight text-foreground mb-2">Rent Regulation Status</h2>
            <p className="text-sm text-foreground/80">
              {report.rentStabilized
                ? 'This building may be subject to rent stabilization. Allowable rent increases are set by the Rent Guidelines Board.'
                : report.rentControlNote || 'No rent stabilization detected for this address.'}
            </p>
          </div>
        )}

        {/* Data sources */}
        <div className="rounded-xl border border-border/60 bg-secondary/50 p-6 mb-8">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Data Sources</h3>
          <ul className="text-xs text-muted-foreground space-y-1.5">
            <li>• HUD Small Area Fair Market Rents (SAFMR) — FY2026</li>
            <li>• Zillow Observed Rent Index (ZORI) — latest available</li>
            <li>• U.S. Census Bureau American Community Survey (ACS) — 2023</li>
            {report.comparables && report.comparables.length > 0 && <li>• Rentcast — comparable rental listings</li>}
          </ul>
        </div>

        {/* CTA */}
        <div className="text-center py-10 border-t border-border">
          <p className="text-lg font-display text-foreground tracking-tight mb-2">Facing a rent increase?</p>
          <p className="text-sm text-muted-foreground mb-5">Check if yours is fair — free, in 10 seconds.</p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-3 rounded-lg text-sm font-semibold hover:brightness-90 transition-all shadow-sm shadow-primary/20"
          >
            Check yours free at RenewalReply →
          </Link>
        </div>
      </main>

      <SEOFooter />
    </div>
  );
};

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between items-center py-2.5 text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className="text-foreground font-medium tabular-nums">{value}</span>
  </div>
);

export default SharedReport;
