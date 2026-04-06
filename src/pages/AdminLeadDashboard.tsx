import { useState, useEffect, useCallback, useMemo } from 'react';
import { Loader2, Download, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Search, Filter, Check, X, AlertTriangle, ExternalLink, Mail, Users, ThumbsUp, ThumbsDown, MessageSquare, Trash2, ClipboardCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import AdminPasswordGate, { getAdminPassword, clearAdminSession } from '@/components/admin/AdminPasswordGate';
import AdminNav from '@/components/admin/AdminNav';
import LeadDetailPanel from '@/components/admin/LeadDetailPanel';
import SEO from '@/components/SEO';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
      <SEO noindex />
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


  // ── Email List ──
  const [emailLeads, setEmailLeads] = useState<any[]>([]);
  const [emailLeadsLoading, setEmailLeadsLoading] = useState(false);
  const [emailFilterSource, setEmailFilterSource] = useState<string>('all');
  const [emailFilterVerdict, setEmailFilterVerdict] = useState<string>('all');
  const [emailFilterUnsub, setEmailFilterUnsub] = useState<string>('active');
  const [emailFilterToolType, setEmailFilterToolType] = useState<string>('all');
  const [emailSearch, setEmailSearch] = useState('');

  // ── Diagnostic ──
  const [diagData, setDiagData] = useState<any>(null);
  const [diagLoading, setDiagLoading] = useState(false);
  const [lookupEmail, setLookupEmail] = useState('');
  const [lookupData, setLookupData] = useState<any>(null);
  const [lookupLoading, setLookupLoading] = useState(false);

  // ── Feedback ──
  const [feedbackRows, setFeedbackRows] = useState<any[]>([]);
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  // ── Outcomes ──
  const [outcomeRows, setOutcomeRows] = useState<any[]>([]);
  const [outcomeLoading, setOutcomeLoading] = useState(false);
  const [outcomeFilter, setOutcomeFilter] = useState<string>('all');

  // Helper to call admin edge function
  const adminQuery = async (query: string, params?: any) => {
    const password = getAdminPassword();
    const { data, error } = await supabase.functions.invoke('admin-query', {
      body: { password, query, params },
    });
    if (error || data?.error) {
      // Only force re-auth on 403 (wrong password), not transient errors
      const is403 = data?.error === 'Access denied' || (error as any)?.status === 403;
      if (is403) {
        clearAdminSession();
        window.location.reload();
      }
      return null;
    }
    return data;
  };

  // Load stats
  useEffect(() => {
    setStatsLoading(true);
    adminQuery('dashboard_stats').then((data) => {
      if (data) setStats(data);
      setStatsLoading(false);
    });
  }, []);

  // Load anomaly data
  useEffect(() => {
    setAnomalyLoading(true);
    adminQuery('anomaly_data').then((data) => {
      setAnomalyRows(data || []);
      setAnomalyLoading(false);
    });
  }, []);

  // Load referral clicks
  useEffect(() => {
    setReferralLoading(true);
    adminQuery('referral_clicks').then((data) => {
      const clicks = data || [];
      setReferralClicks(clicks);
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


  // Load email list
  useEffect(() => {
    setEmailLeadsLoading(true);
    adminQuery('email_list').then((data) => {
      setEmailLeads(data || []);
      setEmailLeadsLoading(false);
    });
  }, []);

  // Build and execute query
  const fetchRows = useCallback(async () => {
    setLoading(true);
    const result = await adminQuery('leads_filtered', {
      filterZip, filterCity, filterVerdict, filterLetter, filterBedrooms,
      filterUtm, filterConfidence, filterStabilized,
      sortCol, sortAsc, page, pageSize: PAGE_SIZE,
    });
    if (!result) return;

    let results = (result.rows || []) as any[];

    // Client-side filters for joined data
    if (filterHasEmail === 'yes') results = results.filter((r: any) => r.leads?.[0]?.email);
    if (filterHasEmail === 'no') results = results.filter((r: any) => !r.leads?.[0]?.email);

    // Client-side quality tag filter
    if (filterQuality.length > 0) {
      results = results.filter((r: any) => filterQuality.includes(getLeadQualityTag(r).label));
    }

    setRows(results);
    setTotalCount(result.count || 0);
    setLoading(false);
  }, [page, sortCol, sortAsc, filterZip, filterCity, filterVerdict, filterQuality, filterHasEmail, filterLetter, filterBedrooms, filterUtm, filterConfidence, filterStabilized]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  // CSV export (fetch all filtered, no pagination)
  const handleExport = async () => {
    const data = await adminQuery('leads_export', {
      filterZip, filterCity, filterVerdict, filterLetter,
    });
    if (data) downloadCSV(data, `renewalreply-leads-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  // Delete analysis with full cascade
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleDelete = async (analysisId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (confirmDeleteId !== analysisId) {
      setConfirmDeleteId(analysisId);
      return;
    }
    setDeletingId(analysisId);
    const result = await adminQuery('delete_analysis', { analysisId });
    setDeletingId(null);
    setConfirmDeleteId(null);
    if (result?.success) {
      setRows(prev => prev.filter(r => r.id !== analysisId));
      setTotalCount(prev => prev - 1);
      if (selectedRow?.id === analysisId) setSelectedRow(null);
    }
  };

  // Delete lead record
  const [deletingLeadId, setDeletingLeadId] = useState<string | null>(null);
  const [confirmDeleteLeadId, setConfirmDeleteLeadId] = useState<string | null>(null);

  const handleDeleteLead = async (leadId: string, listSetter: React.Dispatch<React.SetStateAction<any[]>>, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (confirmDeleteLeadId !== leadId) {
      setConfirmDeleteLeadId(leadId);
      return;
    }
    setDeletingLeadId(leadId);
    const result = await adminQuery('delete_lead', { leadId });
    setDeletingLeadId(null);
    setConfirmDeleteLeadId(null);
    if (result?.success) {
      listSetter(prev => prev.filter(r => r.id !== leadId));
    }
  };

  // Delete feedback record
  const [deletingFeedbackId, setDeletingFeedbackId] = useState<string | null>(null);
  const [confirmDeleteFeedbackId, setConfirmDeleteFeedbackId] = useState<string | null>(null);

  const handleDeleteFeedback = async (feedbackId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (confirmDeleteFeedbackId !== feedbackId) {
      setConfirmDeleteFeedbackId(feedbackId);
      return;
    }
    setDeletingFeedbackId(feedbackId);
    const result = await adminQuery('delete_feedback', { feedbackId });
    setDeletingFeedbackId(null);
    setConfirmDeleteFeedbackId(null);
    if (result?.success) {
      setFeedbackRows(prev => prev.filter(r => r.id !== feedbackId));
    }
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

  // ── Email list filtering ──
  const filteredEmailLeads = useMemo(() => {
    let list = emailLeads;
    if (emailFilterUnsub === 'active') list = list.filter(l => !l.unsubscribed);
    if (emailFilterUnsub === 'unsub') list = list.filter(l => l.unsubscribed);
    if (emailFilterSource !== 'all') list = list.filter(l => (l.capture_source || 'unknown') === emailFilterSource);
    if (emailFilterVerdict !== 'all') list = list.filter(l => (l.verdict || 'unknown') === emailFilterVerdict);
    if (emailFilterToolType !== 'all') list = list.filter(l => (l.tool_type || 'renewal') === emailFilterToolType);
    if (emailSearch) {
      const q = emailSearch.toLowerCase();
      list = list.filter(l => l.email?.toLowerCase().includes(q) || l.city?.toLowerCase().includes(q) || l.zip?.includes(q));
    }
    return list;
  }, [emailLeads, emailFilterSource, emailFilterVerdict, emailFilterUnsub, emailFilterToolType, emailSearch]);

  const emailSourceCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const l of emailLeads.filter(l => !l.unsubscribed)) {
      const src = l.capture_source || 'unknown';
      counts[src] = (counts[src] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [emailLeads]);

  const handleEmailExport = () => {
    const headers = ['Email', 'Source', 'Tool', 'Date', 'City', 'State', 'Zip', 'Bedrooms', 'Rent', 'Score', 'Verdict', 'Lease Month', 'Lease Year', 'Partner Opt-In', 'UTM Source', 'Status'];
    const csvRows = [headers.join(',')];
    for (const l of filteredEmailLeads) {
      csvRows.push([
        l.email,
        l.capture_source || '',
        l.tool_type || 'renewal',
        new Date(l.created_at).toLocaleDateString(),
        l.city || '', l.state || '', l.zip || '',
        l.bedrooms ?? '',
        l.current_rent ?? '',
        l.fairness_score ?? '',
        l.verdict || '',
        l.lease_expiration_month ?? '',
        l.lease_expiration_year ?? '',
        l.partner_opt_in ? 'Yes' : 'No',
        l.utm_source || '',
        l.unsubscribed ? 'Unsubscribed' : 'Active',
      ].join(','));
    }
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `renewalreply-emails-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-display font-bold text-foreground">Lead Dashboard</h1>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="overview" className="gap-1.5"><Users className="w-3.5 h-3.5" /> Overview</TabsTrigger>
          <TabsTrigger value="emails" className="gap-1.5"><Mail className="w-3.5 h-3.5" /> Email Lists {emailLeads.filter(l => !l.unsubscribed).length > 0 && <span className="ml-1 text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full">{emailLeads.filter(l => !l.unsubscribed).length}</span>}</TabsTrigger>
          <TabsTrigger value="feedback" className="gap-1.5" onClick={() => {
            if (feedbackRows.length === 0 && !feedbackLoading) {
              setFeedbackLoading(true);
              adminQuery('feedback').then((data) => { setFeedbackRows(data || []); setFeedbackLoading(false); });
            }
          }}><MessageSquare className="w-3.5 h-3.5" /> Feedback {feedbackRows.length > 0 && <span className="ml-1 text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full">{feedbackRows.length}</span>}</TabsTrigger>
          <TabsTrigger value="outcomes" className="gap-1.5" onClick={() => {
            if (outcomeRows.length === 0 && !outcomeLoading) {
              setOutcomeLoading(true);
              adminQuery('outcomes').then((data) => { setOutcomeRows(data || []); setOutcomeLoading(false); });
            }
          }}><ClipboardCheck className="w-3.5 h-3.5" /> Outcomes {outcomeRows.length > 0 && <span className="ml-1 text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full">{outcomeRows.length}</span>}</TabsTrigger>
          <TabsTrigger value="diagnostic" className="gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Diagnostic</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-8">

      {/* ━━━ Revenue Cards ━━━ */}
      {statsLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading stats…</div>
      ) : stats ? (
        <>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Paywall Clicks" value={`${stats.paywall_clicks ?? 0}`} />
          <StatCard label="Purchases" value={`${stats.purchases ?? 0}`} />
          <StatCard label="Revenue" value={`$${((stats.purchases ?? 0) * 4.99).toFixed(2)}`} />
          <StatCard label="Click → Purchase %" value={stats.paywall_clicks > 0 ? `${Math.round(((stats.purchases ?? 0) / stats.paywall_clicks) * 100)}%` : '0%'} />
        </div>

        {/* ━━━ Core Stats ━━━ */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <StatCard label="Total Submissions" value={stats.total_submissions} />
          <StatCard label="Last 30 Days" value={stats.submissions_30d} />
          <StatCard label="Today" value={stats.submissions_today} />
          <StatCard label="Unique Zips" value={stats.unique_zips} />
          <StatCard label="% Unfair/Excessive" value={stats.total_submissions > 0 ? `${Math.round((stats.unfair_excessive_count / stats.total_submissions) * 100)}%` : '0%'} />
          <StatCard label="Avg Overpayment" value={fmt(stats.avg_overpayment)} />
        </div>

        {/* ━━━ Secondary Stats ━━━ */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <StatCard label="% Shared" value={stats.total_submissions > 0 ? `${Math.round((stats.shared_count / stats.total_submissions) * 100)}%` : '0%'} />
          <StatCard label="Total Leads (email)" value={stats.total_leads} />
          <StatCard label="Emails / Submissions" value={`${stats.total_leads_all} / ${stats.total_submissions}`} />
        </div>
        </>
      ) : null}

      {/* ━━━ Captures by First-Touch Source ━━━ */}



      {/* ━━━ Conversion Funnel ━━━ */}
      {stats && (
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-3">Conversion Funnel</h2>
          <div className="flex flex-wrap items-center gap-2">
            <FunnelStep label="Tool Completed" count={stats.total_submissions} />
            <FunnelArrow from={stats.total_submissions} to={stats.above_market_count} />
            <FunnelStep label="Above Market" count={stats.above_market_count} />
            <FunnelArrow from={stats.above_market_count} to={stats.paywall_clicks ?? 0} />
            <FunnelStep label="Paywall Clicked" count={stats.paywall_clicks ?? 0} />
            <FunnelArrow from={stats.paywall_clicks ?? 0} to={stats.purchases ?? 0} />
            <FunnelStep label="Purchased" count={stats.purchases ?? 0} />
          </div>
          {/* Verdict breakdown */}
          <div className="mt-3 text-[12px] text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
            {(() => {
              const clicksByVerdict: Record<string, number> = {};
              const purchasesByVerdict: Record<string, number> = {};
              for (const v of (stats.paywall_clicks_by_verdict || [])) clicksByVerdict[v.verdict] = v.count;
              for (const v of (stats.purchases_by_verdict || [])) purchasesByVerdict[v.verdict] = v.count;
              const verdicts = ['above', 'at-market', 'below'];
              const labels: Record<string, string> = { above: 'Above market', 'at-market': 'Fair', below: 'Below' };
              return verdicts.map(v => (
                <span key={v}>{labels[v]}: {clicksByVerdict[v] ?? 0} clicks, {purchasesByVerdict[v] ?? 0} purchases</span>
              ));
            })()}
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
                  intent_stay: '🏠 Intent: Stay',
                  intent_move: '🚚 Intent: Move',
                  rent_reporter: '📊 RentReporter',
                  internal_click: '🔗 Internal Click',
                  agent_matching: '🏠 Agent Matching',
                  moving_quotes: '🚚 Moving Quotes',
                  mortgage_check: '🔑 Mortgage Check',
                  renters_insurance: '🛡️ Renters Insurance',
                  mortgage_banner: '🏦 Mortgage Banner',
                  listing_click: '🏘️ Listing Click',
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
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Event</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Link Type</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Placement</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Email</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Zip</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Analysis</th>
                     </tr>
                   </thead>
                   <tbody>
                     {referralClicks.slice(0, 50).map((c: any) => {
                       const labelMap: Record<string, string> = {
                         intent_stay: '🏠 Stay',
                         intent_move: '🚚 Move',
                         rent_reporter: '📊 RentReporter',
                         internal_click: '🔗 Internal',
                         agent_matching: '🏠 Agent',
                         moving_quotes: '🚚 Movers',
                         mortgage_check: '🔑 Mortgage',
                         renters_insurance: '🛡️ Insurance',
                         mortgage_banner: '🏦 Mortgage Banner',
                         listing_click: '🏘️ Listing',
                       };
                       return (
                         <tr key={c.id} className="border-b border-border/50 hover:bg-muted/30">
                           <td className="px-3 py-2 whitespace-nowrap text-xs">{new Date(c.created_at).toLocaleString()}</td>
                           <td className="px-3 py-2 whitespace-nowrap text-xs">{c.event_type || '—'}</td>
                           <td className="px-3 py-2 whitespace-nowrap text-xs">{labelMap[c.link_type] || c.link_type}</td>
                           <td className="px-3 py-2 whitespace-nowrap text-xs">{c.placement || '—'}</td>
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
                    { col: '', label: 'Flags' },
                    { col: '', label: '' },
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
                {(() => {
                  // Build session counts for repeat detection
                  const sessionCounts: Record<string, number> = {};
                  rows.forEach((r: any) => {
                    if (r.session_id) sessionCounts[r.session_id] = (sessionCounts[r.session_id] || 0) + 1;
                  });
                  return rows.map((r: any) => {
                  const lead = r.leads?.[0];
                  const tag = getLeadQualityTag(r);
                  const isRepeat = r.session_id && sessionCounts[r.session_id] > 1;
                  return (
                    <tr
                      key={r.id}
                      className={`border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors ${isRepeat ? 'opacity-60' : ''}`}
                      onClick={() => setSelectedRow(r)}
                    >
                      <td className="px-2 py-2 whitespace-nowrap text-xs">
                        {new Date(r.created_at).toLocaleDateString()}
                        {isRepeat && <span className="ml-1 text-[10px] text-amber-500" title={`Session: ${r.session_id?.slice(0, 8)}`}>♻️</span>}
                      </td>
                      <td className="px-2 py-2 max-w-[120px] truncate" title={r.address || ''}>{r.address || '—'}</td>
                      <td className="px-2 py-2 whitespace-nowrap">{r.zip || '—'}</td>
                      <td className="px-2 py-2 whitespace-nowrap">{r.city || '—'}</td>
                      <td className="px-2 py-2">{r.bedrooms ?? '—'}</td>
                      <td className="px-2 py-2 whitespace-nowrap">{fmt(r.current_rent)}</td>
                      <td className="px-2 py-2 whitespace-nowrap">{fmt(r.proposed_rent)}</td>
                      <td className="px-2 py-2">{r.increase_pct != null ? `${Number(r.increase_pct).toFixed(1)}%` : '—'}</td>
                      <td className="px-2 py-2">{r.fairness_score ?? '—'}</td>
                      <td className="px-2 py-2">
                        <span className="flex items-center gap-1">
                          {r.purchased && <span title="Purchased — $4.99">💰</span>}
                          {r.verdict_label ? (
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-medium border ${verdictColor(r.verdict_label)}`}>
                              {r.verdict_label}
                            </span>
                          ) : '—'}
                        </span>
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
                      <td className="px-2 py-2">
                        {Array.isArray(r.anomaly_flags) && r.anomaly_flags.length > 0 ? (
                          <div className="flex flex-wrap gap-0.5">
                            {r.anomaly_flags.map((flag: string) => (
                              <span key={flag} className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border bg-red-500/15 text-red-600 border-red-500/30">
                                {flag}
                              </span>
                            ))}
                          </div>
                        ) : '—'}
                      </td>
                      <td className="px-2 py-2">
                        <button
                          onClick={(e) => handleDelete(r.id, e)}
                          disabled={deletingId === r.id}
                          className={`p-1 rounded transition-colors ${confirmDeleteId === r.id ? 'bg-red-600 text-white hover:bg-red-700' : 'text-muted-foreground hover:text-red-600 hover:bg-red-500/10'}`}
                          title={confirmDeleteId === r.id ? 'Click again to confirm' : 'Delete'}
                        >
                          {deletingId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      </td>
                    </tr>
                  );
                });
                })()}
                {rows.length === 0 && (
                  <tr><td colSpan={20} className="px-4 py-8 text-center text-muted-foreground">No results found</td></tr>
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

        </TabsContent>

        {/* ━━━ EMAIL LISTS TAB ━━━ */}
        <TabsContent value="emails" className="space-y-6">
          {/* Source breakdown cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <StatCard label="Total Active Emails" value={emailLeads.filter(l => !l.unsubscribed).length} />
            <StatCard label="Unsubscribed" value={emailLeads.filter(l => l.unsubscribed).length} />
            <StatCard label="Partner Opt-In" value={emailLeads.filter(l => l.partner_opt_in && !l.unsubscribed).length} />
            <StatCard label="With Lease Date" value={emailLeads.filter(l => l.lease_expiration_month && !l.unsubscribed).length} />
            <StatCard label="🔄 Renewal Leads" value={emailLeads.filter(l => (l.tool_type || 'renewal') === 'renewal' && !l.unsubscribed).length} />
            <StatCard label="🏠 WSIP Leads" value={emailLeads.filter(l => l.tool_type === 'wsip' && !l.unsubscribed).length} />
            {emailSourceCounts.slice(0, 1).map(([src, count]) => (
              <StatCard key={src} label={src === 'early_capture' ? '📩 Early Capture' : src === 'letter_gate' ? '📝 Letter Gate' : src === 'lease_reminder' ? '📅 Lease Reminder' : `📧 ${src}`} value={count} />
            ))}
          </div>

          {/* Filters & Export */}
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="text-[11px] text-muted-foreground mb-0.5 block">Search</label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/50" />
                <input
                  type="text"
                  value={emailSearch}
                  onChange={(e) => setEmailSearch(e.target.value)}
                  className="w-48 pl-7 pr-2 py-1.5 text-sm border border-border rounded bg-background text-foreground outline-none focus:border-foreground transition-colors"
                  placeholder="Email, city, zip…"
                />
              </div>
            </div>
            <FilterSelect label="Source" value={emailFilterSource} onChange={setEmailFilterSource} options={[
              { label: 'All Sources', value: 'all' },
              ...emailSourceCounts.map(([src]) => ({ label: src === 'early_capture' ? 'Early Capture' : src === 'letter_gate' ? 'Letter Gate' : src === 'lease_reminder' ? 'Lease Reminder' : src, value: src })),
            ]} />
            <FilterSelect label="Verdict" value={emailFilterVerdict} onChange={setEmailFilterVerdict} options={[
              { label: 'All Verdicts', value: 'all' },
              { label: 'Above Market', value: 'above' },
              { label: 'At Market', value: 'at_market' },
              { label: 'At-Market', value: 'at-market' },
              { label: 'Below Market', value: 'below' },
            ]} />
            <FilterSelect label="Status" value={emailFilterUnsub} onChange={setEmailFilterUnsub} options={[
              { label: 'Active Only', value: 'active' },
              { label: 'Unsubscribed', value: 'unsub' },
              { label: 'All', value: 'all' },
            ]} />
            <FilterSelect label="Tool" value={emailFilterToolType} onChange={setEmailFilterToolType} options={[
              { label: 'All Tools', value: 'all' },
              { label: '🔄 Renewal', value: 'renewal' },
              { label: '🏠 WSIP', value: 'wsip' },
            ]} />
            <button onClick={handleEmailExport} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted transition-colors h-[34px]">
              <Download className="w-3.5 h-3.5" /> Export {filteredEmailLeads.length} emails
            </button>
          </div>

          {/* Email table */}
          {emailLeadsLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading email list…
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">Showing {filteredEmailLeads.length} of {emailLeads.length} leads</p>
              <div className="border border-border rounded-lg overflow-x-auto bg-card">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Email</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Source</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Date</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Location</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Rent</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Score</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Verdict</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Lease</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Partner</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Tool</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Emails Sent</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Status</th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmailLeads.slice(0, 200).map((l: any) => {
                      const emailsSent = [
                        l.reminder_sent_at && 'Reminder',
                        l.followup_sent_at && 'Follow-up',
                        l.sent_email_day45 && 'Day 45',
                      ].filter(Boolean);
                      return (
                        <tr key={l.id} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="px-3 py-2 text-xs font-medium max-w-[220px] truncate" title={l.email}>{l.email}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-xs">
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                              l.capture_source === 'early_capture' ? 'bg-primary/10 text-primary border-primary/30' :
                              l.capture_source === 'letter_gate' ? 'bg-accent/50 text-foreground border-border' :
                              'bg-muted text-muted-foreground border-border'
                            }`}>
                              {l.capture_source || '—'}
                            </span>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-xs">{new Date(l.created_at).toLocaleDateString()}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-xs">{l.city ? `${l.city}, ${l.state}` : l.zip || '—'}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-xs">{l.current_rent ? fmt(l.current_rent) : '—'}{l.proposed_rent ? ` → ${fmt(l.proposed_rent)}` : ''}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-xs">{l.fairness_score ?? '—'}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-xs">{l.verdict || '—'}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-xs">{l.lease_expiration_month && l.lease_expiration_year ? `${l.lease_expiration_month}/${l.lease_expiration_year}` : '—'}</td>
                          <td className="px-3 py-2 text-center">{l.partner_opt_in ? <Check className="w-3.5 h-3.5 text-emerald-600 inline" /> : <X className="w-3.5 h-3.5 text-muted-foreground/40 inline" />}</td>
                          <td className="px-3 py-2 text-xs">
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                              l.tool_type === 'wsip' ? 'bg-blue-500/10 text-blue-700 border-blue-500/30' : 'bg-muted text-muted-foreground border-border'
                            }`}>
                              {l.tool_type === 'wsip' ? 'WSIP' : 'Renewal'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs">{emailsSent.length > 0 ? emailsSent.join(', ') : '—'}</td>
                          <td className="px-3 py-2 text-xs">
                            {l.unsubscribed ? (
                              <span className="text-destructive font-medium">Unsub</span>
                            ) : (
                              <span className="text-emerald-600 font-medium">Active</span>
                            )}
                          </td>
                          <td className="px-2 py-2">
                            <button
                              onClick={(e) => handleDeleteLead(l.id, setEmailLeads, e)}
                              disabled={deletingLeadId === l.id}
                              className={`p-1 rounded transition-colors ${confirmDeleteLeadId === l.id ? 'bg-red-600 text-white hover:bg-red-700' : 'text-muted-foreground hover:text-red-600 hover:bg-red-500/10'}`}
                              title={confirmDeleteLeadId === l.id ? 'Click again to confirm' : 'Delete lead'}
                            >
                              {deletingLeadId === l.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredEmailLeads.length === 0 && (
                      <tr><td colSpan={12} className="px-4 py-8 text-center text-muted-foreground">No emails found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              {filteredEmailLeads.length > 200 && (
                <p className="text-xs text-muted-foreground">Showing first 200 of {filteredEmailLeads.length}. Export to see all.</p>
              )}
            </>
          )}
        </TabsContent>

        {/* ━━━ DIAGNOSTIC TAB ━━━ */}
        <TabsContent value="diagnostic" className="space-y-6">
          <div className="flex items-center gap-3">
            <button
              onClick={async () => {
                setDiagLoading(true);
                const data = await adminQuery('diagnostic');
                if (data) setDiagData(data);
                setDiagLoading(false);
              }}
              disabled={diagLoading}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {diagLoading ? <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Running…</span> : 'Run Diagnostic'}
            </button>
            {diagData && <span className="text-xs text-muted-foreground">Last run: {new Date().toLocaleTimeString()}</span>}
          </div>

          {/* Email Lookup */}
          <div className="border border-primary/20 rounded-lg p-4 bg-primary/5">
            <h3 className="text-sm font-semibold text-foreground mb-3">🔍 Email Lookup</h3>
            <form onSubmit={async (e) => { e.preventDefault(); if (!lookupEmail.trim()) return; setLookupLoading(true); const d = await adminQuery('lead_lookup', { email: lookupEmail.trim() }); if (d) setLookupData(d); setLookupLoading(false); }} className="flex gap-2 mb-3">
              <input type="text" placeholder="Search by email..." value={lookupEmail} onChange={(e) => setLookupEmail(e.target.value)} className="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground outline-none focus:border-foreground transition-colors" />
              <button type="submit" disabled={lookupLoading} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60">
                {lookupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Lookup'}
              </button>
            </form>
            {lookupData && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground mb-1">Leads table matches ({lookupData.leads?.length || 0})</h4>
                  {(!lookupData.leads || lookupData.leads.length === 0) ? (
                    <p className="text-xs text-muted-foreground">No leads found for this email</p>
                  ) : (
                    <div className="border border-border rounded-lg overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead><tr className="border-b border-border bg-muted/30">
                          <th className="text-left px-2 py-1.5 font-medium">Email</th>
                          <th className="text-left px-2 py-1.5 font-medium">Source</th>
                          <th className="text-left px-2 py-1.5 font-medium">Tool</th>
                          <th className="text-left px-2 py-1.5 font-medium">Analysis</th>
                          <th className="text-left px-2 py-1.5 font-medium">Verdict</th>
                          <th className="text-left px-2 py-1.5 font-medium">Score</th>
                          <th className="text-left px-2 py-1.5 font-medium">Rent</th>
                          <th className="text-left px-2 py-1.5 font-medium">Proposed</th>
                          <th className="text-left px-2 py-1.5 font-medium">Zip</th>
                          <th className="text-left px-2 py-1.5 font-medium">City</th>
                          <th className="text-left px-2 py-1.5 font-medium">UTM</th>
                          <th className="text-left px-2 py-1.5 font-medium">Lease</th>
                          <th className="text-left px-2 py-1.5 font-medium">Partner</th>
                          <th className="text-left px-2 py-1.5 font-medium">Unsub</th>
                          <th className="text-left px-2 py-1.5 font-medium">Created</th>
                        </tr></thead>
                        <tbody>
                          {lookupData.leads.map((l: any) => (
                            <tr key={l.id} className="border-b border-border last:border-0">
                              <td className="px-2 py-1.5" title={l.email}>{(l.email || '').slice(0, 20)}</td>
                              <td className="px-2 py-1.5">{l.capture_source || '—'}</td>
                              <td className="px-2 py-1.5">{l.tool_type || '—'}</td>
                              <td className="px-2 py-1.5 font-mono">{(l.analysis_id || '').slice(0, 8)}</td>
                              <td className="px-2 py-1.5">{l.verdict || '—'}</td>
                              <td className="px-2 py-1.5">{l.fairness_score ?? '—'}</td>
                              <td className="px-2 py-1.5">{l.current_rent ? fmt(l.current_rent) : '—'}</td>
                              <td className="px-2 py-1.5">{l.proposed_rent ? fmt(l.proposed_rent) : '—'}</td>
                              <td className="px-2 py-1.5">{l.zip || '—'}</td>
                              <td className="px-2 py-1.5">{l.city || '—'}</td>
                              <td className="px-2 py-1.5">{l.utm_source || '—'}</td>
                              <td className="px-2 py-1.5">{l.lease_expiration_month && l.lease_expiration_year ? `${l.lease_expiration_month}/${l.lease_expiration_year}` : '—'}</td>
                              <td className="px-2 py-1.5">{l.partner_opt_in ? '✓' : '—'}</td>
                              <td className="px-2 py-1.5">{l.unsubscribed ? '✗' : '—'}</td>
                              <td className="px-2 py-1.5">{new Date(l.created_at).toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground mb-1">Lead events matches ({lookupData.events?.length || 0})</h4>
                  {(!lookupData.events || lookupData.events.length === 0) ? (
                    <p className="text-xs text-muted-foreground">No events found</p>
                  ) : (
                    <div className="border border-border rounded-lg overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead><tr className="border-b border-border bg-muted/30">
                          <th className="text-left px-2 py-1.5 font-medium">Email</th>
                          <th className="text-left px-2 py-1.5 font-medium">Event</th>
                          <th className="text-left px-2 py-1.5 font-medium">Analysis</th>
                          <th className="text-left px-2 py-1.5 font-medium">Zip</th>
                          <th className="text-left px-2 py-1.5 font-medium">Verdict</th>
                          <th className="text-left px-2 py-1.5 font-medium">Score</th>
                          <th className="text-left px-2 py-1.5 font-medium">Rent</th>
                          <th className="text-left px-2 py-1.5 font-medium">Created</th>
                        </tr></thead>
                        <tbody>
                          {lookupData.events.map((e: any) => (
                            <tr key={e.id} className="border-b border-border last:border-0">
                              <td className="px-2 py-1.5" title={e.email}>{(e.email || '').slice(0, 20)}</td>
                              <td className="px-2 py-1.5">{e.event_type}</td>
                              <td className="px-2 py-1.5 font-mono">{(e.analysis_id || '').slice(0, 8)}</td>
                              <td className="px-2 py-1.5">{e.zip || '—'}</td>
                              <td className="px-2 py-1.5">{e.verdict || '—'}</td>
                              <td className="px-2 py-1.5">{e.fairness_score ?? '—'}</td>
                              <td className="px-2 py-1.5">{e.current_rent ? fmt(e.current_rent) : '—'}</td>
                              <td className="px-2 py-1.5">{new Date(e.created_at).toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground mb-1">Linked analyses ({lookupData.analyses?.length || 0})</h4>
                  {(!lookupData.analyses || lookupData.analyses.length === 0) ? (
                    <p className="text-xs text-muted-foreground">No linked analyses found</p>
                  ) : (
                    <div className="border border-border rounded-lg overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead><tr className="border-b border-border bg-muted/30">
                          <th className="text-left px-2 py-1.5 font-medium">ID</th>
                          <th className="text-left px-2 py-1.5 font-medium">Address</th>
                          <th className="text-left px-2 py-1.5 font-medium">Zip</th>
                          <th className="text-left px-2 py-1.5 font-medium">City</th>
                          <th className="text-left px-2 py-1.5 font-medium">BR</th>
                          <th className="text-left px-2 py-1.5 font-medium">Rent</th>
                          <th className="text-left px-2 py-1.5 font-medium">Proposed</th>
                          <th className="text-left px-2 py-1.5 font-medium">Score</th>
                          <th className="text-left px-2 py-1.5 font-medium">Verdict</th>
                          <th className="text-left px-2 py-1.5 font-medium">Tool</th>
                          <th className="text-left px-2 py-1.5 font-medium">Created</th>
                        </tr></thead>
                        <tbody>
                          {lookupData.analyses.map((a: any) => (
                            <tr key={a.id} className="border-b border-border last:border-0">
                              <td className="px-2 py-1.5 font-mono">{(a.id || '').slice(0, 8)}</td>
                              <td className="px-2 py-1.5">{a.address || '—'}</td>
                              <td className="px-2 py-1.5">{a.zip || '—'}</td>
                              <td className="px-2 py-1.5">{a.city || '—'}</td>
                              <td className="px-2 py-1.5">{a.bedrooms ?? '—'}</td>
                              <td className="px-2 py-1.5">{a.current_rent ? fmt(a.current_rent) : '—'}</td>
                              <td className="px-2 py-1.5">{a.proposed_rent ? fmt(a.proposed_rent) : '—'}</td>
                              <td className="px-2 py-1.5">{a.fairness_score ?? '—'}</td>
                              <td className="px-2 py-1.5">{a.verdict_label || '—'}</td>
                              <td className="px-2 py-1.5">{a.tool_type}</td>
                              <td className="px-2 py-1.5">{new Date(a.created_at).toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {diagData && (
            <div className="space-y-6">
              {/* March 14 Counts */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground mb-2">March 14</h3>
                <div className="grid grid-cols-3 gap-3">
                  <StatCard label="Analyses Mar 14" value={diagData.counts.analyses_mar14 ?? 0} />
                  <StatCard label="Leads Mar 14" value={diagData.counts.leads_mar14 ?? 0} />
                  <StatCard label="Events Mar 14" value={diagData.counts.events_mar14 ?? 0} />
                </div>
              </div>

              {/* Today / All Time Counts */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground mb-2">Today / All Time</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <StatCard label="Analyses Today" value={diagData.counts.analyses_today ?? 0} />
                  <StatCard label="Leads Today" value={diagData.counts.leads_today ?? 0} />
                  <StatCard label="Events Today" value={diagData.counts.events_today ?? 0} />
                  <StatCard label="Analyses Total" value={diagData.counts.analyses_total ?? 0} />
                  <StatCard label="Leads Total" value={diagData.counts.leads_total ?? 0} />
                </div>
              </div>

              {/* Orphaned Leads */}
              <div>
                <h2 className="text-sm font-semibold text-foreground mb-2">🔴 Orphaned Leads (lead points to deleted analysis)</h2>
                {(!diagData.orphaned_leads || diagData.orphaned_leads.length === 0) ? (
                  <p className="text-sm text-muted-foreground">✅ No orphaned leads found</p>
                ) : (
                  <div className="border border-border rounded-lg overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead><tr className="border-b border-border bg-muted/30">
                        <th className="text-left px-3 py-2 font-medium">Email</th>
                        <th className="text-left px-3 py-2 font-medium">Analysis ID</th>
                        <th className="text-left px-3 py-2 font-medium">Source</th>
                        <th className="text-left px-3 py-2 font-medium">Created</th>
                      </tr></thead>
                      <tbody>
                        {diagData.orphaned_leads.map((l: any) => (
                          <tr key={l.id} className="border-b border-border last:border-0">
                            <td className="px-3 py-2" title={l.email}>{(l.email || '').slice(0, 25)}</td>
                            <td className="px-3 py-2 font-mono">{(l.analysis_id || '').slice(0, 8)}</td>
                            <td className="px-3 py-2">{l.capture_source}</td>
                            <td className="px-3 py-2">{new Date(l.created_at).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Unlinked Analyses */}
              <div>
                <h2 className="text-sm font-semibold text-foreground mb-2">🟡 Recent Analyses (last 3 days) with No Lead ({diagData.unlinked_analyses_3d?.length || 0})</h2>
                {(!diagData.unlinked_analyses_3d || diagData.unlinked_analyses_3d.length === 0) ? (
                  <p className="text-sm text-muted-foreground">✅ All recent analyses have linked leads</p>
                ) : (
                  <div className="border border-border rounded-lg overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead><tr className="border-b border-border bg-muted/30">
                        <th className="text-left px-3 py-2 font-medium">ID</th>
                        <th className="text-left px-3 py-2 font-medium">Address/Zip</th>
                        <th className="text-left px-3 py-2 font-medium">City</th>
                        <th className="text-left px-3 py-2 font-medium">Verdict</th>
                        <th className="text-left px-3 py-2 font-medium">Score</th>
                        <th className="text-left px-3 py-2 font-medium">Tool</th>
                        <th className="text-left px-3 py-2 font-medium">Created</th>
                      </tr></thead>
                      <tbody>
                        {diagData.unlinked_analyses_3d.map((a: any) => (
                          <tr key={a.id} className="border-b border-border last:border-0">
                            <td className="px-3 py-2 font-mono">{(a.id || '').slice(0, 8)}</td>
                            <td className="px-3 py-2">{a.address || a.zip || '—'}</td>
                            <td className="px-3 py-2">{a.city || '—'}</td>
                            <td className="px-3 py-2">{a.verdict_label || '—'}</td>
                            <td className="px-3 py-2">{a.fairness_score ?? '—'}</td>
                            <td className="px-3 py-2">{a.tool_type}</td>
                            <td className="px-3 py-2">{new Date(a.created_at).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Recent Analyses */}
              <div>
                <h2 className="text-sm font-semibold text-foreground mb-2">Recent Analyses (last 15)</h2>
                <div className="border border-border rounded-lg overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="border-b border-border bg-muted/30">
                      <th className="text-left px-3 py-2 font-medium">ID</th>
                      <th className="text-left px-3 py-2 font-medium">Address/Zip</th>
                      <th className="text-left px-3 py-2 font-medium">City</th>
                      <th className="text-left px-3 py-2 font-medium">BR</th>
                      <th className="text-left px-3 py-2 font-medium">Rent</th>
                      <th className="text-left px-3 py-2 font-medium">Score</th>
                      <th className="text-left px-3 py-2 font-medium">Verdict</th>
                      <th className="text-left px-3 py-2 font-medium">Tool</th>
                      <th className="text-left px-3 py-2 font-medium">Created</th>
                      <th className="text-left px-3 py-2 font-medium">Session</th>
                    </tr></thead>
                    <tbody>
                      {(diagData.recent_analyses || []).map((a: any) => (
                        <tr key={a.id} className="border-b border-border last:border-0">
                          <td className="px-3 py-2 font-mono">{(a.id || '').slice(0, 8)}</td>
                          <td className="px-3 py-2">{a.address || a.zip || '—'}</td>
                          <td className="px-3 py-2">{a.city || '—'}</td>
                          <td className="px-3 py-2">{a.bedrooms ?? '—'}</td>
                          <td className="px-3 py-2">{a.current_rent ? fmt(a.current_rent) : '—'}</td>
                          <td className="px-3 py-2">{a.fairness_score ?? '—'}</td>
                          <td className="px-3 py-2">{a.verdict_label || '—'}</td>
                          <td className="px-3 py-2">{a.tool_type}</td>
                          <td className="px-3 py-2">{new Date(a.created_at).toLocaleString()}</td>
                          <td className="px-3 py-2 font-mono">{(a.session_id || '').slice(0, 8)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Recent Leads */}
              <div>
                <h2 className="text-sm font-semibold text-foreground mb-2">Recent Leads (last 15)</h2>
                <div className="border border-border rounded-lg overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="border-b border-border bg-muted/30">
                      <th className="text-left px-3 py-2 font-medium">Email</th>
                      <th className="text-left px-3 py-2 font-medium">Source</th>
                      <th className="text-left px-3 py-2 font-medium">Analysis</th>
                      <th className="text-left px-3 py-2 font-medium">Address/Zip</th>
                      <th className="text-left px-3 py-2 font-medium">City</th>
                      <th className="text-left px-3 py-2 font-medium">Verdict</th>
                      <th className="text-left px-3 py-2 font-medium">Tool</th>
                      <th className="text-left px-3 py-2 font-medium">Created</th>
                    </tr></thead>
                    <tbody>
                      {(diagData.recent_leads || []).map((l: any) => (
                        <tr key={l.id} className="border-b border-border last:border-0">
                          <td className="px-3 py-2" title={l.email}>{(l.email || '').slice(0, 25)}</td>
                          <td className="px-3 py-2">{l.capture_source || '—'}</td>
                          <td className="px-3 py-2 font-mono">{(l.analysis_id || '').slice(0, 8)}</td>
                          <td className="px-3 py-2">{l.address || l.zip || '—'}</td>
                          <td className="px-3 py-2">{l.city || '—'}</td>
                          <td className="px-3 py-2">{l.verdict || '—'}</td>
                          <td className="px-3 py-2">{l.tool_type}</td>
                          <td className="px-3 py-2">{new Date(l.created_at).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Recent Events */}
              <div>
                <h2 className="text-sm font-semibold text-foreground mb-2">Recent Lead Events (last 15)</h2>
                <div className="border border-border rounded-lg overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="border-b border-border bg-muted/30">
                      <th className="text-left px-3 py-2 font-medium">Email</th>
                      <th className="text-left px-3 py-2 font-medium">Event</th>
                      <th className="text-left px-3 py-2 font-medium">Analysis</th>
                      <th className="text-left px-3 py-2 font-medium">Zip</th>
                      <th className="text-left px-3 py-2 font-medium">Verdict</th>
                      <th className="text-left px-3 py-2 font-medium">Created</th>
                    </tr></thead>
                    <tbody>
                      {(diagData.recent_events || []).map((e: any) => (
                        <tr key={e.id} className="border-b border-border last:border-0">
                          <td className="px-3 py-2" title={e.email}>{(e.email || '').slice(0, 25)}</td>
                          <td className="px-3 py-2">{e.event_type}</td>
                          <td className="px-3 py-2 font-mono">{(e.analysis_id || '').slice(0, 8)}</td>
                          <td className="px-3 py-2">{e.zip || '—'}</td>
                          <td className="px-3 py-2">{e.verdict || '—'}</td>
                          <td className="px-3 py-2">{new Date(e.created_at).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ━━━ Outcomes Tab ━━━ */}
        <TabsContent value="outcomes" className="space-y-4">
          {outcomeLoading ? (
            <div className="text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin inline mr-1" /> Loading outcomes…</div>
          ) : outcomeRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No outcome responses yet.</p>
          ) : (() => {
            const filtered = outcomeFilter === 'all' ? outcomeRows : outcomeRows.filter((o: any) => o.outcome === outcomeFilter);
            const counts = {
              agreed: outcomeRows.filter((o: any) => o.outcome === 'agreed').length,
              no_response: outcomeRows.filter((o: any) => o.outcome === 'no_response').length,
              moving: outcomeRows.filter((o: any) => o.outcome === 'moving').length,
              unsubscribe: outcomeRows.filter((o: any) => o.outcome === 'unsubscribe').length,
            };
            return (
              <>
                {/* Summary cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <StatCard label="Total Responses" value={outcomeRows.length} />
                  <StatCard label="✅ Negotiated" value={counts.agreed} />
                  <StatCard label="⏳ Still Deciding" value={counts.no_response} />
                  <StatCard label="🚚 Moved" value={counts.moving} />
                  <StatCard label="🚫 Unsubscribed" value={counts.unsubscribe} />
                </div>

                {/* Filter */}
                <div className="flex gap-2 flex-wrap">
                  {[
                    { label: 'All', value: 'all' },
                    { label: '✅ Negotiated', value: 'agreed' },
                    { label: '⏳ Still Deciding', value: 'no_response' },
                    { label: '🚚 Moved', value: 'moving' },
                    { label: '🚫 Unsubscribed', value: 'unsubscribe' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setOutcomeFilter(opt.value)}
                      className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                        outcomeFilter === opt.value
                          ? 'bg-primary/15 text-primary border-primary/30'
                          : 'bg-background text-muted-foreground border-border hover:border-foreground'
                      }`}
                    >
                      {opt.label} {opt.value !== 'all' && <span className="ml-1 opacity-60">({counts[opt.value as keyof typeof counts]})</span>}
                    </button>
                  ))}
                </div>

                {/* Table */}
                <div className="overflow-x-auto border border-border rounded-lg">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Email</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Outcome</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Verdict</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Location</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Tool</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Testimonial</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Date</th>
                        <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((o: any) => (
                        <tr key={o.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                          <td className="px-3 py-2 font-mono text-xs">{o.email}</td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                              o.outcome === 'agreed' ? 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30' :
                              o.outcome === 'moving' ? 'bg-blue-500/15 text-blue-600 border-blue-500/30' :
                              o.outcome === 'no_response' ? 'bg-yellow-500/15 text-yellow-700 border-yellow-500/30' :
                              'bg-red-500/15 text-red-600 border-red-500/30'
                            }`}>
                              {o.outcome === 'agreed' ? 'Negotiated' : o.outcome === 'no_response' ? 'Still Deciding' : o.outcome === 'moving' ? 'Moved' : 'Unsubscribed'}
                            </span>
                          </td>
                          <td className="px-3 py-2">{o.verdict || '—'}</td>
                          <td className="px-3 py-2">{o.city && o.state ? `${o.city}, ${o.state}` : o.zip || '—'}</td>
                          <td className="px-3 py-2 text-xs">{o.tool_type === 'wsip' ? 'WSIP' : 'Renewal'}</td>
                          <td className="px-3 py-2 max-w-[200px] truncate text-xs" title={o.testimonial || ''}>{o.testimonial || '—'}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-xs">{new Date(o.created_at).toLocaleDateString()}</td>
                          <td className="px-2 py-2">
                            <button
                              onClick={(e) => handleDeleteLead(o.id, setOutcomeRows, e)}
                              disabled={deletingLeadId === o.id}
                              className={`p-1 rounded transition-colors ${confirmDeleteLeadId === o.id ? 'bg-red-600 text-white hover:bg-red-700' : 'text-muted-foreground hover:text-red-600 hover:bg-red-500/10'}`}
                              title={confirmDeleteLeadId === o.id ? 'Click again to confirm' : 'Delete lead'}
                            >
                              {deletingLeadId === o.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            );
          })()}
        </TabsContent>

        {/* ━━━ Feedback Tab ━━━ */}
        <TabsContent value="feedback" className="space-y-4">
          {feedbackLoading ? (
            <div className="text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin inline mr-1" /> Loading feedback…</div>
          ) : feedbackRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No feedback submitted yet.</p>
          ) : (
            <>
              {/* Summary cards */}
              {(() => {
                const pos = feedbackRows.filter((f: any) => f.rating === 'positive').length;
                const neg = feedbackRows.filter((f: any) => f.rating === 'negative').length;
                const withComment = feedbackRows.filter((f: any) => f.comment).length;
                const reasonCounts: Record<string, number> = {};
                feedbackRows.forEach((f: any) => { if (f.reason) reasonCounts[f.reason] = (reasonCounts[f.reason] || 0) + 1; });
                return (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="border border-border rounded-lg p-3 bg-card">
                        <div className="text-xs text-muted-foreground mb-1">Total</div>
                        <div className="text-lg font-semibold text-foreground">{feedbackRows.length}</div>
                      </div>
                      <div className="border border-border rounded-lg p-3 bg-card">
                        <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><ThumbsUp className="w-3 h-3" /> Positive</div>
                        <div className="text-lg font-semibold text-emerald-600">{pos}</div>
                      </div>
                      <div className="border border-border rounded-lg p-3 bg-card">
                        <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><ThumbsDown className="w-3 h-3" /> Negative</div>
                        <div className="text-lg font-semibold text-red-600">{neg}</div>
                      </div>
                      <div className="border border-border rounded-lg p-3 bg-card">
                        <div className="text-xs text-muted-foreground mb-1">With Comments</div>
                        <div className="text-lg font-semibold text-foreground">{withComment}</div>
                      </div>
                    </div>
                    {Object.keys(reasonCounts).length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-foreground mb-2">Reason Breakdown</h3>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(reasonCounts).sort((a, b) => b[1] - a[1]).map(([reason, count]) => (
                            <span key={reason} className="text-xs px-3 py-1.5 rounded-full border border-border bg-muted/30">
                              {reason} <span className="font-semibold ml-1">{count}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Table */}
              <div className="border border-border rounded-lg overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-3 py-2 font-medium">Rating</th>
                    <th className="text-left px-3 py-2 font-medium">Page</th>
                    <th className="text-left px-3 py-2 font-medium">Verdict</th>
                    <th className="text-left px-3 py-2 font-medium">Score</th>
                    <th className="text-left px-3 py-2 font-medium">Confidence</th>
                    <th className="text-left px-3 py-2 font-medium">Reason</th>
                    <th className="text-left px-3 py-2 font-medium">Comment</th>
                    <th className="text-left px-3 py-2 font-medium">Analysis</th>
                    <th className="text-left px-3 py-2 font-medium">Date</th>
                    <th className="text-left px-2 py-2 font-medium w-8"></th>
                  </tr></thead>
                  <tbody>
                    {feedbackRows.map((f: any) => (
                      <tr key={f.id} className="border-b border-border last:border-0">
                        <td className="px-3 py-2">
                          {f.rating === 'positive' ? <ThumbsUp className="w-3.5 h-3.5 text-emerald-600" /> : <ThumbsDown className="w-3.5 h-3.5 text-red-500" />}
                        </td>
                        <td className="px-3 py-2">{f.page === 'renewal_results' ? 'Renewal' : 'WSIP'}</td>
                        <td className="px-3 py-2">{f.verdict_snapshot || '—'}</td>
                        <td className="px-3 py-2">{f.score_snapshot ?? '—'}</td>
                        <td className="px-3 py-2">{f.confidence_snapshot || '—'}</td>
                        <td className="px-3 py-2">{f.reason || '—'}</td>
                        <td className="px-3 py-2 max-w-[200px] truncate" title={f.comment || ''}>{f.comment || '—'}</td>
                        <td className="px-3 py-2 font-mono">{(f.analysis_id || '').slice(0, 8)}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{new Date(f.created_at).toLocaleString()}</td>
                        <td className="px-2 py-2">
                          <button
                            onClick={(e) => handleDeleteFeedback(f.id, e)}
                            disabled={deletingFeedbackId === f.id}
                            className={`p-1 rounded transition-colors ${confirmDeleteFeedbackId === f.id ? 'bg-red-600 text-white hover:bg-red-700' : 'text-muted-foreground hover:text-red-600 hover:bg-red-500/10'}`}
                            title={confirmDeleteFeedbackId === f.id ? 'Click again to confirm' : 'Delete feedback'}
                          >
                            {deletingFeedbackId === f.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Detail Panel */}
      {selectedRow && <LeadDetailPanel analysis={selectedRow} onClose={() => setSelectedRow(null)} onDeleted={(id) => { setRows(prev => prev.filter(r => r.id !== id)); setTotalCount(prev => prev - 1); setSelectedRow(null); }} />}
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
