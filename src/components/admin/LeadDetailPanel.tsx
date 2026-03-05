import { useEffect, useState } from 'react';
import { X, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface LeadDetailPanelProps {
  analysis: any;
  onClose: () => void;
}

const fmt = (n: number | null | undefined) =>
  n != null ? `$${Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—';

const pct = (n: number | null | undefined) =>
  n != null ? `${Number(n).toFixed(1)}%` : '—';

const bool = (v: boolean | null | undefined) =>
  v === true ? '✓ Yes' : v === false ? '✗ No' : '—';

export default function LeadDetailPanel({ analysis, onClose }: LeadDetailPanelProps) {
  const [events, setEvents] = useState<any[]>([]);
  const [sharedReport, setSharedReport] = useState<any>(null);

  const lead = analysis.leads?.[0] ?? null;

  useEffect(() => {
    if (!analysis.id) return;

    supabase
      .from('lead_events' as any)
      .select('*')
      .eq('analysis_id', analysis.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setEvents(data as any[]); });

    if (analysis.results_shared) {
      supabase
        .from('shared_reports' as any)
        .select('short_id, created_at')
        .eq('analysis_id', analysis.id)
        .limit(1)
        .then(({ data }) => { if (data?.[0]) setSharedReport(data[0]); });
    }
  }, [analysis.id, analysis.results_shared]);

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="mb-5">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{title}</h4>
      <div className="space-y-1">{children}</div>
    </div>
  );

  const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex justify-between text-sm py-1 border-b border-border/50">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground font-medium text-right max-w-[55%] truncate">{value ?? '—'}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-card border-l border-border shadow-xl overflow-y-auto">
        <div className="sticky top-0 bg-card border-b border-border px-5 py-3 flex items-center justify-between z-10">
          <h3 className="font-display font-semibold text-foreground">Analysis Detail</h3>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4">
          <Section title="Property">
            <Row label="Address" value={analysis.address || '—'} />
            <Row label="City" value={analysis.city} />
            <Row label="State" value={analysis.state} />
            <Row label="Zip" value={analysis.zip} />
            <Row label="Bedrooms" value={analysis.bedrooms} />
          </Section>

          <Section title="Rent Analysis">
            <Row label="Current Rent" value={fmt(analysis.current_rent)} />
            <Row label="Proposed Rent" value={fmt(analysis.proposed_rent)} />
            <Row label="Increase" value={pct(analysis.increase_pct)} />
            <Row label="Market Trend" value={pct(analysis.market_trend_pct)} />
            <Row label="Fairness Score" value={analysis.fairness_score ?? '—'} />
            <Row label="Verdict" value={analysis.verdict_label ?? '—'} />
            <Row label="Dollar Overpayment" value={
              analysis.dollar_overpayment != null
                ? `${fmt(analysis.dollar_overpayment)}/mo (${fmt(analysis.dollar_overpayment * 12)}/yr)`
                : '—'
            } />
            <Row label="Counter-Offer Range" value={
              analysis.counter_offer_low != null && analysis.counter_offer_high != null
                ? `${fmt(analysis.counter_offer_low)} – ${fmt(analysis.counter_offer_high)}/mo`
                : '—'
            } />
          </Section>

          <Section title="Data Sources">
            <Row label="Comp Median Rent" value={fmt(analysis.comp_median_rent)} />
            <Row label="HUD FMR" value={fmt(analysis.hud_fmr_value)} />
            <Row label="Comps Count" value={analysis.comps_count ?? '—'} />
            <Row label="Comps Position" value={analysis.comps_position ?? '—'} />
            <Row label="Confidence" value={analysis.confidence_level ?? '—'} />
            <Row label="Sale Data Found" value={bool(analysis.sale_data_found)} />
            <Row label="Cache Hit" value={bool(analysis.cache_hit)} />
            <Row label="Rent Stabilized" value={bool(analysis.rent_stabilized)} />
          </Section>

          <Section title="Engagement">
            <Row label="Letter Generated" value={bool(analysis.letter_generated)} />
            <Row label="Letter Tone" value={analysis.letter_tone ?? '—'} />
            <Row label="Results Shared" value={bool(analysis.results_shared)} />
            {sharedReport && (
              <Row label="Report Link" value={
                <a
                  href={`/report/${sharedReport.short_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  View <ExternalLink className="w-3 h-3" />
                </a>
              } />
            )}
          </Section>

          <Section title="Attribution">
            <Row label="UTM Source" value={analysis.utm_source ?? 'Direct'} />
            <Row label="UTM Medium" value={analysis.utm_medium ?? '—'} />
            <Row label="UTM Campaign" value={analysis.utm_campaign ?? '—'} />
            <Row label="Submitted" value={new Date(analysis.created_at).toLocaleString()} />
          </Section>

          {lead && (
            <Section title="Lead Data">
              <Row label="Email" value={lead.email} />
              <Row label="Capture Source" value={lead.capture_source ?? '—'} />
              <Row label="Lease Expires" value={
                lead.lease_expiration_month && lead.lease_expiration_year
                  ? `${lead.lease_expiration_month}/${lead.lease_expiration_year}`
                  : '—'
              } />
              <Row label="Partner Opt-In" value={bool(lead.partner_opt_in)} />
              <Row label="Unsubscribed" value={bool(lead.unsubscribed)} />
              <Row label="Outcome" value={lead.outcome ?? '—'} />
              <Row label="Reminder Sent" value={lead.reminder_sent_at ? new Date(lead.reminder_sent_at).toLocaleDateString() : '—'} />
              <Row label="Followup Sent" value={lead.followup_sent_at ? new Date(lead.followup_sent_at).toLocaleDateString() : '—'} />
            </Section>
          )}

          {events.length > 0 && (
            <Section title={`Lead Events (${events.length})`}>
              {events.map((ev: any) => (
                <div key={ev.id} className="flex justify-between text-sm py-1 border-b border-border/50">
                  <span className="text-muted-foreground">{ev.event_type}</span>
                  <span className="text-foreground text-xs">{new Date(ev.created_at).toLocaleString()}</span>
                </div>
              ))}
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}
