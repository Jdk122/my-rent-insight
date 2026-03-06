import { useState, useEffect, useCallback, useMemo } from 'react';
import { Loader2, Download, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Search, Filter, Check, X, AlertTriangle, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import AdminPasswordGate from '@/components/admin/AdminPasswordGate';
import AdminNav from '@/components/admin/AdminNav';
import LeadDetailPanel from '@/components/admin/LeadDetailPanel';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

const fmt = (n: number | null | undefined) =>
  n != null ? `$${Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—';

const PAGE_SIZE = 50;

// ── Lead Quality Tag Logic ──
function getLeadQualityTag(analysis: any): { label: string; color: string; emoji: string; rank: number } {
  const overpay = analysis.dollar_overpayment ?? 0;
  const hasEmail = !!analysis.leads?.[0]?.email;
  const leaseMonth = analysis.leads?.[0]?.lease_expiration_month;
  const leaseYear = analysis.leads?.[0]?.lease_expiration_year;
  const letterGen = analysis.letter_generated === true;

  let leaseWithin90 = false;
  if (leaseMonth && leaseYear) {
    const leaseDate = new Date(leaseYear, leaseMonth - 1, 1);
    const now = new Date();
    const diffMs = leaseDate.getTime() - now.getTime();
    leaseWithin90 = diffMs >= 0 && diffMs <= 90 * 24 * 60 * 60 * 1000;
  }

  if (overpay >= 300 && hasEmail && leaseWithin90) return { label: 'Hot', color: 'bg-red-500/15 text-red-600 border-red-500/30', emoji: '🔴', rank: 0 };
  if (overpay >= 100 && (hasEmail || letterGen)) return { label: 'Warm', color: 'bg-orange-500/15 text-orange-600 border-orange-500/30', emoji: '🟠', rank: 1 };
  if (overpay > 0) return { label: 'Cool', color: 'bg-blue-500/15 text-blue-600 border-blue-500/30', emoji: '🔵', rank: 2 };
  return { label: 'Fair', color: 'bg-gray-500/10 text-muted-foreground border-border', emoji: '⚪', rank: 3 };
}

function verdictColor(v: string | null) {
  if (!v) return 'bg-muted text-muted-foreground';
  if (['Excellent', 'Fair'].includes(v)) return 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30';
  if (v === 'Moderate') return 'bg-yellow-500/15 text-yellow-700 border-yellow-500/30';
  return 'bg-red-500/15 text-red-700 border-red-500/30';
}

function confidenceBadge(c: string | null) {
  if (c === 'High') return 'bg-emerald-500/15 text-emerald-700';
  if (c === 'Moderate') return 'bg-yellow-500/15 text-yellow-700';
  return 'bg-orange-500/15 text-orange-700';
}

// ── Anomaly detection ──
interface Anomaly { id: string; type: string; detail: string }

function detectAnomalies(rows: any[]): Record<string, Anomaly[]> {
  const results: Record<string, Anomaly[]> = {
    'Score vs Overpayment Mismatch (High Score, High Overpay)': [],
    'Score vs Overpayment Mismatch (Low Score, No Overpay)': [],
    'Possible Duplicate': [],
    'Suspicious Rent': [],
    'Extreme Increase': [],
  };

  const byKey: Record<string, any[]> = {};

  for (const r of rows) {
    if (r.fairness_score > 80 && (r.dollar_overpayment ?? 0) > 300) {
      results['Score vs Overpayment Mismatch (High Score, High Overpay)'].push({ id: r.id, type: 'score_overpay_high', detail: `Score ${r.fairness_score}, Overpay ${fmt(r.dollar_overpayment)}` });
    }
    if (r.fairness_score != null && r.fairness_score < 20 && (r.dollar_overpayment ?? 0) <= 0) {
      results['Score vs Overpayment Mismatch (Low Score, No Overpay)'].push({ id: r.id, type: 'score_overpay_low', detail: `Score ${r.fairness_score}, Overpay ${fmt(r.dollar_overpayment)}` });
    }
    if (r.current_rent != null && (r.current_rent < 100 || r.current_rent > 20000)) {
      results['Suspicious Rent'].push({ id: r.id, type: 'rent_range', detail: `Rent: ${fmt(r.current_rent)}` });
    }
    if (r.increase_pct != null && r.increase_pct > 100) {
      results['Extreme Increase'].push({ id: r.id, type: 'increase', detail: `${r.increase_pct}% increase` });
    }
    // Duplicate detection
    const key = `${r.address || ''}|${r.bedrooms}|${r.current_rent}`;
    if (r.address) {
      if (!byKey[key]) byKey[key] = [];
      byKey[key].push(r);
    }
  }

  for (const group of Object.values(byKey)) {
    if (group.length < 2) continue;
    group.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    for (let i = 1; i < group.length; i++) {
      const diffMin = (new Date(group[i].created_at).getTime() - new Date(group[i - 1].created_at).getTime()) / 60000;
      if (diffMin <= 5) {
        results['Possible Duplicate'].push({ id: group[i].id, type: 'duplicate', detail: `${group[i].address}, ${diffMin.toFixed(0)}min apart` });
      }
    }
  }

  return results;
}

// ── CSV Export ──
function downloadCSV(rows: any[], filename: string) {
  const headers = [
    'Date', 'Address', 'Zip', 'City', 'State', 'Bedrooms', 'Current Rent', 'Proposed Rent',
    'Increase %', 'Fairness Score', 'Verdict', 'Overpayment', 'Letter', 'Shared',
    'Email', 'Lease Month', 'Lease Year', 'UTM Source', 'Confidence', 'Lead Quality',
  ];
  const csvRows = [headers.join(',')];
  for (const r of rows) {
    const lead = r.leads?.[0];
    const tag = getLeadQualityTag(r);
    csvRows.push([
      new Date(r.created_at).toLocaleDateString(),
      `"${(r.address || '').replace(/"/g, '""')}"`,
      r.zip || '', r.city || '', r.state || '',
      r.bedrooms ?? '', r.current_rent ?? '', r.proposed_rent ?? '',
      r.increase_pct ?? '', r.fairness_score ?? '', r.verdict_label || '',
      r.dollar_overpayment ?? '', r.letter_generated ? 'Yes' : 'No',
      r.results_shared ? 'Yes' : 'No', lead?.email || '',
      lead?.lease_expiration_month ?? '', lead?.lease_expiration_year ?? '',
      r.utm_source || 'Direct', r.confidence_level || '', tag.label,
    ].join(','));
  }
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Main Component ──
export default function AdminLeadDashboard() {
  return (
    <div className="min-h-screen bg-background">
      <AdminNav />
      <AdminPasswordGate>
        <DashboardContent />
      </AdminPasswordGate>
    </div>
  );
}

function DashboardContent() {
  // ── Stats ──
  const [stats, setStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // ── Table ──
  const [rows, setRows] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [sortCol, setSortCol] = useState('created_at');
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedRow, setSelectedRow] = useState<any>(null);

  // ── Filters ──
  const [filterZip, setFilterZip] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterVerdict, setFilterVerdict] = useState<string[]>([]);
  const [filterQuality, setFilterQuality] = useState<string[]>([]);
  const [filterHasEmail, setFilterHasEmail] = useState<'all' | 'yes' | 'no'>('all');
  const [filterLetter, setFilterLetter] = useState<'all' | 'yes' | 'no'>('all');
  const [filterBedrooms, setFilterBedrooms] = useState('');
  const [filterUtm, setFilterUtm] = useState('');
  const [filterConfidence, setFilterConfidence] = useState<string[]>([]);
  const [filterStabilized, setFilterStabilized] = useState<'all' | 'yes' | 'no' | 'unknown'>('all');
  const [showFilters, setShowFilters] = useState(false);

  // ── Anomalies ──
  const [anomalyRows, setAnomalyRows] = useState<any[]>([]);
  const [anomalyLoading, setAnomalyLoading] = useState(false);

  // ── Referral Clicks ──
  const [referralClicks, setReferralClicks] = useState<any[]>([]);
  const [referralLoading, setReferralLoading] = useState(false);
  const [referralSummary, setReferralSummary] = useState<{ link_type: string; count: number }[]>([]);
  const [showRecentClicks, setShowRecentClicks] = useState(false);

  // Load stats
  useEffect(() => {
    setStatsLoading(true);
    supabase.rpc('admin_dashboard_stats' as any).then(({ data }: any) => {
      setStats(data);
      setStatsLoading(false);
    });
  }, []);

  // Load anomaly data
  useEffect(() => {
    setAnomalyLoading(true);
    supabase
      .from('analyses' as any)
      .select('id, address, bedrooms, current_rent, dollar_overpayment, fairness_score, increase_pct, created_at')
      .order('created_at', { ascending: false })
      .limit(1000)
      .then(({ data }: any) => {
        setAnomalyRows(data || []);
        setAnomalyLoading(false);
      });
  }, []);

  // Load referral clicks
  useEffect(() => {
    setReferralLoading(true);
    supabase
      .from('referral_clicks' as any)
      .select('id, analysis_id, email, link_type, zip, created_at')
      .order('created_at', { ascending: false })
      .limit(500)
      .then(({ data }: any) => {
        const clicks = data || [];
        setReferralClicks(clicks);

        // Build summary by link_type
        const counts: Record<string, number> = {};
        for (const c of clicks) {
          counts[c.link_type] = (counts[c.link_type] || 0) + 1;
        }
        const summary = Object.entries(counts)
          .map(([link_type, count]) => ({ link_type, count }))
          .sort((a, b) => b.count - a.count);
        setReferralSummary(summary);
        setReferralLoading(false);
      });
  }, []);

  // Build and execute query
  const fetchRows = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('analyses' as any)
      .select(
        'id, address, city, state, zip, bedrooms, current_rent, proposed_rent, increase_pct, fairness_score, verdict_label, dollar_overpayment, letter_generated, letter_tone, results_shared, confidence_level, rent_stabilized, utm_source, utm_medium, utm_campaign, created_at, counter_offer_low, counter_offer_high, comp_median_rent, hud_fmr_value, comps_count, comps_position, fair_counter_offer, sale_data_found, market_trend_pct, cache_hit, markup_multiplier, leads(id, email, lease_expiration_month, lease_expiration_year, partner_opt_in, capture_source, unsubscribed, outcome, reminder_sent_at, followup_sent_at, created_at)',
        { count: 'exact' }
      ) as any;

    // Apply filters
    if (filterZip) query = query.ilike('zip', `%${filterZip}%`);
    if (filterCity) query = query.ilike('city', `%${filterCity}%`);
    if (filterVerdict.length > 0) query = query.in('verdict_label', filterVerdict);
    if (filterLetter === 'yes') query = query.eq('letter_generated', true);
    if (filterLetter === 'no') query = query.eq('letter_generated', false);
    if (filterBedrooms) query = query.eq('bedrooms', parseInt(filterBedrooms));
    if (filterUtm) query = query.ilike('utm_source', `%${filterUtm}%`);
    if (filterConfidence.length > 0) query = query.in('confidence_level', filterConfidence);
    if (filterStabilized === 'yes') query = query.eq('rent_stabilized', true);
    if (filterStabilized === 'no') query = query.eq('rent_stabilized', false);
    if (filterStabilized === 'unknown') query = query.is('rent_stabilized', null);

    query = query.order(sortCol, { ascending: sortAsc });
    query = query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    const { data, count } = await query;
    let results = (data || []) as any[];

    // Client-side filters for joined data
    if (filterHasEmail === 'yes') results = results.filter((r: any) => r.leads?.[0]?.email);
    if (filterHasEmail === 'no') results = results.filter((r: any) => !r.leads?.[0]?.email);

    // Client-side quality tag filter
    if (filterQuality.length > 0) {
      results = results.filter((r: any) => filterQuality.includes(getLeadQualityTag(r).label));
    }

    setRows(results);
    setTotalCount(count || 0);
    setLoading(false);
  }, [page, sortCol, sortAsc, filterZip, filterCity, filterVerdict, filterQuality, filterHasEmail, filterLetter, filterBedrooms, filterUtm, filterConfidence, filterStabilized]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  // CSV export (fetch all filtered, no pagination)
  const handleExport = async () => {
    let query = supabase
      .from('analyses' as any)
      .select('id, address, city, state, zip, bedrooms, current_rent, proposed_rent, increase_pct, fairness_score, verdict_label, dollar_overpayment, letter_generated, results_shared, confidence_level, utm_source, created_at, leads(email, lease_expiration_month, lease_expiration_year)') as any;

    if (filterZip) query = query.ilike('zip', `%${filterZip}%`);
    if (filterCity) query = query.ilike('city', `%${filterCity}%`);
    if (filterVerdict.length > 0) query = query.in('verdict_label', filterVerdict);
    if (filterLetter === 'yes') query = query.eq('letter_generated', true);
    if (filterLetter === 'no') query = query.eq('letter_generated', false);

    query = query.order('created_at', { ascending: false }).limit(5000);
    const { data } = await query;
    if (data) downloadCSV(data, `renewalreply-leads-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const handleSort = (col: string) => {
    if (sortCol === col) setSortAsc(!sortAsc);
    else { setSortCol(col); setSortAsc(false); }
    setPage(0);
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (sortCol !== col) return null;
    return sortAsc ? <ChevronUp className="w-3 h-3 inline ml-0.5" /> : <ChevronDown className="w-3 h-3 inline ml-0.5" />;
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // ── Anomalies ──
  const anomalies = useMemo(() => detectAnomalies(anomalyRows), [anomalyRows]);
  const totalAnomalies = Object.values(anomalies).reduce((sum, arr) => sum + arr.length, 0);

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-8">
      <h1 className="text-2xl font-display font-bold text-foreground">Lead Dashboard</h1>

      {/* ━━━ Summary Cards ━━━ */}
      {statsLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading stats…</div>
      ) : stats ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <StatCard label="Total Submissions" value={stats.total_submissions} />
          <StatCard label="Last 30 Days" value={stats.submissions_30d} />
          <StatCard label="Today" value={stats.submissions_today} />
          <StatCard label="Unique Zips" value={stats.unique_zips} />
          <StatCard label="% Unfair/Excessive" value={stats.total_submissions > 0 ? `${Math.round((stats.unfair_excessive_count / stats.total_submissions) * 100)}%` : '0%'} />
          <StatCard label="Avg Overpayment" value={fmt(stats.avg_overpayment)} />
          <StatCard label="% Letter Generated" value={stats.total_submissions > 0 ? `${Math.round((stats.letter_count / stats.total_submissions) * 100)}%` : '0%'} />
          <StatCard label="% Shared" value={stats.total_submissions > 0 ? `${Math.round((stats.shared_count / stats.total_submissions) * 100)}%` : '0%'} />
          <StatCard label="Total Leads (email)" value={stats.total_leads} />
          <StatCard label="Email Capture Rate" value={stats.total_submissions > 0 ? `${Math.round((stats.total_leads_all / stats.total_submissions) * 100)}%` : '0%'} />
          <StatCard label="% Partner Opt-In" value={stats.total_leads_all > 0 ? `${Math.round((stats.partner_optin_count / stats.total_leads_all) * 100)}%` : '0%'} />
        </div>
      ) : null}

      {/* ━━━ Conversion Funnel ━━━ */}
      {stats && (
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-3">Conversion Funnel</h2>
          <div className="flex flex-wrap items-center gap-2">
            <FunnelStep label="Tool Completed" count={stats.total_submissions} />
            <FunnelArrow from={stats.total_submissions} to={stats.above_market_count} />
            <FunnelStep label="Above Market" count={stats.above_market_count} />
            <FunnelArrow from={stats.above_market_count} to={stats.letter_count} />
            <FunnelStep label="Letter Generated" count={stats.letter_count} />
            <FunnelArrow from={stats.letter_count} to={stats.total_leads_all} />
            <FunnelStep label="Email Captured" count={stats.total_leads_all} />
            <FunnelArrow from={stats.total_leads_all} to={stats.shared_count} />
            <FunnelStep label="Shared" count={stats.shared_count} />
          </div>
        </div>
      )}

      {/* ━━━ Referral Clicks ━━━ */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
          <ExternalLink className="w-5 h-5 text-primary" />
          Referral Clicks
          {referralClicks.length > 0 && <span className="text-sm font-normal text-muted-foreground">({referralClicks.length} total)</span>}
        </h2>
        {referralLoading ? (
          <div className="text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin inline mr-1" /> Loading…</div>
        ) : referralSummary.length === 0 ? (
          <p className="text-sm text-muted-foreground">No referral clicks recorded yet.</p>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
              {referralSummary.map((s) => {
                const labelMap: Record<string, string> = {
                  agent_matching: '🏠 Agent Matching',
                  moving_quotes: '🚚 Moving Quotes',
                  mortgage_check: '🔑 Mortgage Check',
                  renters_insurance: '🛡️ Renters Insurance',
                  mortgage_banner: '🏦 Mortgage Banner',
                };
                return (
                  <div key={s.link_type} className="border border-border rounded-lg p-3 bg-card">
                    <div className="text-xs text-muted-foreground mb-1">{labelMap[s.link_type] || s.link_type}</div>
                    <div className="text-lg font-semibold text-foreground">{s.count}</div>
                  </div>
                );
              })}
            </div>

            {/* Unique emails that clicked */}
            {(() => {
              const emailClicks = referralClicks.filter((c: any) => c.email);
              const uniqueEmails = new Set(emailClicks.map((c: any) => c.email));
              return (
                <div className="text-sm text-muted-foreground mb-3">
                  <span className="font-medium text-foreground">{uniqueEmails.size}</span> identified leads clicked referral links
                </div>
              );
            })()}

            {/* Recent clicks table */}
            <button
              onClick={() => setShowRecentClicks(!showRecentClicks)}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
            >
              {showRecentClicks ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {showRecentClicks ? 'Hide' : 'Show'} Recent Clicks
            </button>

            {showRecentClicks && (
              <div className="border border-border rounded-lg overflow-x-auto bg-card">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Date</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Link Type</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Email</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Zip</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Analysis</th>
                    </tr>
                  </thead>
                  <tbody>
                    {referralClicks.slice(0, 50).map((c: any) => {
                      const labelMap: Record<string, string> = {
                        agent_matching: '🏠 Agent',
                        moving_quotes: '🚚 Movers',
                        mortgage_check: '🔑 Mortgage',
                        renters_insurance: '🛡️ Insurance',
                        mortgage_banner: '🏦 Mortgage Banner',
                      };
                      return (
                        <tr key={c.id} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="px-3 py-2 whitespace-nowrap text-xs">{new Date(c.created_at).toLocaleString()}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-xs">{labelMap[c.link_type] || c.link_type}</td>
                          <td className="px-3 py-2 text-xs max-w-[160px] truncate" title={c.email || ''}>{c.email || '—'}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-xs">{c.zip || '—'}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-xs font-mono">{c.analysis_id ? c.analysis_id.slice(0, 8) : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* ━━━ Lead Table ━━━ */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-foreground">Analyses ({totalCount})</h2>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowFilters(!showFilters)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted transition-colors">
              <Filter className="w-3.5 h-3.5" /> Filters {showFilters ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            <button onClick={handleExport} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted transition-colors">
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 mb-4 p-3 border border-border rounded-lg bg-card">
            <FilterInput label="Zip" value={filterZip} onChange={(v) => { setFilterZip(v); setPage(0); }} />
            <FilterInput label="City" value={filterCity} onChange={(v) => { setFilterCity(v); setPage(0); }} />
            <FilterInput label="UTM Source" value={filterUtm} onChange={(v) => { setFilterUtm(v); setPage(0); }} />
            <FilterSelect label="Bedrooms" value={filterBedrooms} onChange={(v) => { setFilterBedrooms(v); setPage(0); }} options={[
              { label: 'All', value: '' }, { label: 'Studio', value: '0' }, { label: '1BR', value: '1' },
              { label: '2BR', value: '2' }, { label: '3BR', value: '3' }, { label: '4BR', value: '4' },
            ]} />
            <FilterSelect label="Has Email" value={filterHasEmail} onChange={(v: any) => { setFilterHasEmail(v); setPage(0); }} options={[
              { label: 'All', value: 'all' }, { label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' },
            ]} />
            <FilterSelect label="Letter" value={filterLetter} onChange={(v: any) => { setFilterLetter(v); setPage(0); }} options={[
              { label: 'All', value: 'all' }, { label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' },
            ]} />
            <FilterMultiSelect label="Verdict" selected={filterVerdict} onChange={(v) => { setFilterVerdict(v); setPage(0); }}
              options={['Excellent', 'Fair', 'Moderate', 'Unfair', 'Excessive']} />
            <FilterMultiSelect label="Quality" selected={filterQuality} onChange={(v) => { setFilterQuality(v); setPage(0); }}
              options={['Hot', 'Warm', 'Cool', 'Fair']} />
            <FilterMultiSelect label="Confidence" selected={filterConfidence} onChange={(v) => { setFilterConfidence(v); setPage(0); }}
              options={['High', 'Moderate', 'Limited']} />
            <FilterSelect label="Rent Stabilized" value={filterStabilized} onChange={(v: any) => { setFilterStabilized(v); setPage(0); }} options={[
              { label: 'All', value: 'all' }, { label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }, { label: 'Unknown', value: 'unknown' },
            ]} />
          </div>
        )}

        {/* Table */}
        <div className="border border-border rounded-lg overflow-x-auto bg-card">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  {[
                    { col: 'created_at', label: 'Date' },
                    { col: 'address', label: 'Address' },
                    { col: 'zip', label: 'Zip' },
                    { col: 'city', label: 'City' },
                    { col: 'bedrooms', label: 'BR' },
                    { col: 'current_rent', label: 'Rent' },
                    { col: 'proposed_rent', label: 'Proposed' },
                    { col: 'increase_pct', label: '↑%' },
                    { col: 'fairness_score', label: 'Score' },
                    { col: 'verdict_label', label: 'Verdict' },
                    { col: 'dollar_overpayment', label: 'Overpay' },
                    { col: 'letter_generated', label: 'Letter' },
                    { col: 'results_shared', label: 'Shared' },
                    { col: '', label: 'Email' },
                    { col: '', label: 'Lease' },
                    { col: 'utm_source', label: 'UTM' },
                    { col: 'confidence_level', label: 'Conf' },
                    { col: '', label: 'Quality' },
                  ].map((h, i) => (
                    <th
                      key={i}
                      className={`px-2 py-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap ${h.col ? 'cursor-pointer hover:text-foreground' : ''}`}
                      onClick={() => h.col && handleSort(h.col)}
                    >
                      {h.label}<SortIcon col={h.col} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r: any) => {
                  const lead = r.leads?.[0];
                  const tag = getLeadQualityTag(r);
                  return (
                    <tr
                      key={r.id}
                      className="border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => setSelectedRow(r)}
                    >
                      <td className="px-2 py-2 whitespace-nowrap text-xs">{new Date(r.created_at).toLocaleDateString()}</td>
                      <td className="px-2 py-2 max-w-[120px] truncate" title={r.address || ''}>{r.address || '—'}</td>
                      <td className="px-2 py-2 whitespace-nowrap">{r.zip || '—'}</td>
                      <td className="px-2 py-2 whitespace-nowrap">{r.city || '—'}</td>
                      <td className="px-2 py-2">{r.bedrooms ?? '—'}</td>
                      <td className="px-2 py-2 whitespace-nowrap">{fmt(r.current_rent)}</td>
                      <td className="px-2 py-2 whitespace-nowrap">{fmt(r.proposed_rent)}</td>
                      <td className="px-2 py-2">{r.increase_pct != null ? `${Number(r.increase_pct).toFixed(1)}%` : '—'}</td>
                      <td className="px-2 py-2">{r.fairness_score ?? '—'}</td>
                      <td className="px-2 py-2">
                        {r.verdict_label ? (
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-medium border ${verdictColor(r.verdict_label)}`}>
                            {r.verdict_label}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap">{r.dollar_overpayment != null ? fmt(r.dollar_overpayment) : '—'}</td>
                      <td className="px-2 py-2 text-center">{r.letter_generated ? <Check className="w-3.5 h-3.5 text-emerald-600 inline" /> : <X className="w-3.5 h-3.5 text-muted-foreground/40 inline" />}</td>
                      <td className="px-2 py-2 text-center">{r.results_shared ? <Check className="w-3.5 h-3.5 text-emerald-600 inline" /> : <X className="w-3.5 h-3.5 text-muted-foreground/40 inline" />}</td>
                      <td className="px-2 py-2 max-w-[100px] truncate text-xs" title={lead?.email || ''}>{lead?.email || '—'}</td>
                      <td className="px-2 py-2 whitespace-nowrap text-xs">{lead?.lease_expiration_month && lead?.lease_expiration_year ? `${lead.lease_expiration_month}/${lead.lease_expiration_year}` : '—'}</td>
                      <td className="px-2 py-2 whitespace-nowrap text-xs">{r.utm_source || 'Direct'}</td>
                      <td className="px-2 py-2">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-medium ${confidenceBadge(r.confidence_level)}`}>
                          {r.confidence_level || 'Unknown'}
                        </span>
                      </td>
                      <td className="px-2 py-2">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-medium border ${tag.color}`}>
                          {tag.emoji} {tag.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr><td colSpan={18} className="px-4 py-8 text-center text-muted-foreground">No results found</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-3">
            <span className="text-sm text-muted-foreground">
              Page {page + 1} of {totalPages} ({totalCount} total)
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page === 0}
                onClick={() => setPage(p => p - 1)}
                className="p-1.5 border border-border rounded hover:bg-muted disabled:opacity-30 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage(p => p + 1)}
                className="p-1.5 border border-border rounded hover:bg-muted disabled:opacity-30 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ━━━ Data Integrity ━━━ */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-yellow-500" />
          Data Integrity {totalAnomalies > 0 && <span className="text-sm font-normal text-muted-foreground">({totalAnomalies} issues)</span>}
        </h2>
        {anomalyLoading ? (
          <div className="text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin inline mr-1" /> Scanning…</div>
        ) : (
          <div className="space-y-2">
            {Object.entries(anomalies).map(([type, items]) => (
              <Collapsible key={type}>
                <CollapsibleTrigger className="flex items-center gap-2 w-full text-left px-3 py-2 border border-border rounded-lg hover:bg-muted/50 transition-colors">
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">{type}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${items.length > 0 ? 'bg-yellow-500/15 text-yellow-700' : 'bg-muted text-muted-foreground'}`}>
                    {items.length}
                  </span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  {items.length === 0 ? (
                    <p className="text-sm text-muted-foreground px-3 py-2">No issues found</p>
                  ) : (
                    <div className="ml-6 mt-1 space-y-1">
                      {items.slice(0, 20).map((item, i) => (
                        <div key={i} className="text-xs text-muted-foreground py-0.5">
                          <span className="font-mono">{item.id.slice(0, 8)}</span> — {item.detail}
                        </div>
                      ))}
                      {items.length > 20 && <p className="text-xs text-muted-foreground">… and {items.length - 20} more</p>}
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        )}
      </div>

      {/* Detail Panel */}
      {selectedRow && <LeadDetailPanel analysis={selectedRow} onClose={() => setSelectedRow(null)} />}
    </div>
  );
}

// ── Sub-components ──

function StatCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="border border-border rounded-lg p-3 bg-card">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className="text-lg font-semibold text-foreground">{value}</div>
    </div>
  );
}

function FunnelStep({ label, count }: { label: string; count: number }) {
  return (
    <div className="border border-border rounded-lg px-4 py-2 bg-card text-center min-w-[100px]">
      <div className="text-lg font-bold text-foreground">{count.toLocaleString()}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

function FunnelArrow({ from, to }: { from: number; to: number }) {
  const pct = from > 0 ? Math.round((to / from) * 100) : 0;
  return (
    <div className="text-center px-1">
      <div className="text-muted-foreground">→</div>
      <div className="text-[10px] text-muted-foreground">{pct}%</div>
    </div>
  );
}

function FilterInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-[11px] text-muted-foreground mb-0.5 block">{label}</label>
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/50" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full pl-7 pr-2 py-1.5 text-sm border border-border rounded bg-background text-foreground outline-none focus:border-foreground transition-colors"
          placeholder={`Filter ${label.toLowerCase()}…`}
        />
      </div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { label: string; value: string }[] }) {
  return (
    <div>
      <label className="text-[11px] text-muted-foreground mb-0.5 block">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-1.5 text-sm border border-border rounded bg-background text-foreground outline-none focus:border-foreground transition-colors appearance-none cursor-pointer"
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function FilterMultiSelect({ label, selected, onChange, options }: { label: string; selected: string[]; onChange: (v: string[]) => void; options: string[] }) {
  const toggle = (opt: string) => {
    onChange(selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt]);
  };

  return (
    <div>
      <label className="text-[11px] text-muted-foreground mb-0.5 block">{label}</label>
      <div className="flex flex-wrap gap-1">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => toggle(opt)}
            className={`px-1.5 py-0.5 text-[11px] rounded border transition-colors ${
              selected.includes(opt)
                ? 'bg-primary/15 text-primary border-primary/30'
                : 'bg-background text-muted-foreground border-border hover:border-foreground'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}
