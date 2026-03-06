import { useState, useEffect, useMemo } from 'react';
import { Loader2, ChevronDown, ChevronUp, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import AdminPasswordGate, { getAdminPassword, clearAdminSession } from '@/components/admin/AdminPasswordGate';
import AdminNav from '@/components/admin/AdminNav';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart } from 'recharts';

const fmt = (n: number | null | undefined) =>
  n != null ? `$${Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—';

export default function AdminMarketIntelligence() {
  return (
    <div className="min-h-screen bg-background">
      <AdminNav />
      <AdminPasswordGate>
        <MarketContent />
      </AdminPasswordGate>
    </div>
  );
}

function MarketContent() {
  const [zipData, setZipData] = useState<any[]>([]);
  const [trafficData, setTrafficData] = useState<any[]>([]);
  const [dailyData, setDailyData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [zipSort, setZipSort] = useState<{ col: string; asc: boolean }>({ col: 'submissions', asc: false });
  const [expandedZip, setExpandedZip] = useState<string | null>(null);

  useEffect(() => {
    const password = getAdminPassword();
    const query = async (q: string, params?: any) => {
      const { data, error } = await supabase.functions.invoke('admin-query', {
        body: { password, query: q, params },
      });
      if (error || data?.error) {
        clearAdminSession();
        window.location.reload();
        return null;
      }
      return data;
    };

    Promise.all([
      query('zip_leaderboard'),
      query('traffic_stats'),
      query('daily_submissions', { days: 90 }),
    ]).then(([zipRes, trafficRes, dailyRes]) => {
      setZipData((zipRes as any[]) || []);
      setTrafficData((trafficRes as any[]) || []);
      setDailyData((dailyRes as any[]) || []);
      setLoading(false);
    });
  }, []);

  // Sort zip data
  const sortedZips = useMemo(() => {
    const sorted = [...zipData].sort((a, b) => {
      const aVal = a[zipSort.col] ?? 0;
      const bVal = b[zipSort.col] ?? 0;
      return zipSort.asc ? aVal - bVal : bVal - aVal;
    });
    return sorted;
  }, [zipData, zipSort]);

  // Daily chart data with 7-day moving average
  const chartData = useMemo(() => {
    return dailyData.map((d: any, i: number) => {
      const slice = dailyData.slice(Math.max(0, i - 6), i + 1);
      const avg = slice.reduce((sum: number, s: any) => sum + Number(s.submissions), 0) / slice.length;
      return {
        day: new Date(d.day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        submissions: Number(d.submissions),
        avg7: Math.round(avg * 10) / 10,
      };
    });
  }, [dailyData]);

  const handleZipSort = (col: string) => {
    if (zipSort.col === col) setZipSort({ col, asc: !zipSort.asc });
    else setZipSort({ col, asc: false });
  };

  const ZipSortIcon = ({ col }: { col: string }) => {
    if (zipSort.col !== col) return null;
    return zipSort.asc ? <ChevronUp className="w-3 h-3 inline ml-0.5" /> : <ChevronDown className="w-3 h-3 inline ml-0.5" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading market data…
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-8">
      <h1 className="text-2xl font-display font-bold text-foreground">Market Intelligence</h1>

      {/* ━━━ Trend Chart ━━━ */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
          <TrendingUp className="w-5 h-5" /> Daily Submissions (90 days)
        </h2>
        <div className="border border-border rounded-lg p-4 bg-card">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" interval={6} />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="submissions" fill="hsl(var(--primary) / 0.3)" radius={[2, 2, 0, 0]} name="Daily" />
                <Line dataKey="avg7" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="7-day avg" />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No submission data yet</p>
          )}
        </div>
      </div>

      {/* ━━━ Zip Code Leaderboard ━━━ */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">Zip Code Leaderboard</h2>
        <p className="text-sm text-muted-foreground mb-3">Zips with 3+ submissions. Click a row to see agent opportunity estimate.</p>
        <div className="border border-border rounded-lg overflow-x-auto bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {[
                  { col: 'zip', label: 'Zip' },
                  { col: 'city', label: 'City' },
                  { col: 'submissions', label: 'Submissions' },
                  { col: 'avg_fairness_score', label: 'Avg Score' },
                  { col: 'avg_overpayment', label: 'Avg Overpay' },
                  { col: 'unfair_count', label: '% Unfair' },
                  { col: 'leads_with_email', label: 'Leads w/ Email' },
                  { col: '', label: 'Email Rate' },
                  { col: 'letter_count', label: 'Letters' },
                  { col: '', label: 'Letter Rate' },
                ].map((h, i) => (
                  <th
                    key={i}
                    className={`px-3 py-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap ${h.col ? 'cursor-pointer hover:text-foreground' : ''}`}
                    onClick={() => h.col && handleZipSort(h.col)}
                  >
                    {h.label}<ZipSortIcon col={h.col} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedZips.map((z: any) => {
                const unfairPct = z.submissions > 0 ? Math.round((z.unfair_count / z.submissions) * 100) : 0;
                const emailRate = z.submissions > 0 ? Math.round((z.leads_with_email / z.submissions) * 100) : 0;
                const letterRate = z.submissions > 0 ? Math.round((z.letter_count / z.submissions) * 100) : 0;
                const isExpanded = expandedZip === z.zip;

                return (
                  <Fragment key={z.zip}>
                    <tr
                      className="border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => setExpandedZip(isExpanded ? null : z.zip)}
                    >
                      <td className="px-3 py-2 font-mono">{z.zip}</td>
                      <td className="px-3 py-2">{z.city || '—'}</td>
                      <td className="px-3 py-2 font-semibold">{z.submissions}</td>
                      <td className="px-3 py-2">{z.avg_fairness_score ?? '—'}</td>
                      <td className="px-3 py-2">{fmt(z.avg_overpayment)}</td>
                      <td className="px-3 py-2">{unfairPct}%</td>
                      <td className="px-3 py-2">{z.leads_with_email}</td>
                      <td className="px-3 py-2">{emailRate}%</td>
                      <td className="px-3 py-2">{z.letter_count}</td>
                      <td className="px-3 py-2">{letterRate}%</td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={10} className="px-3 py-4 bg-muted/20">
                          <AgentOpportunity zip={z} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {sortedZips.length === 0 && (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">No zip codes with 3+ submissions yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ━━━ Traffic Source Analysis ━━━ */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">Traffic Source Analysis</h2>
        <div className="border border-border rounded-lg overflow-x-auto bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Source</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Submissions</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Avg Score</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">% Unfair</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Avg Overpay</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Leads w/ Email</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Email Rate</th>
              </tr>
            </thead>
            <tbody>
              {trafficData.map((t: any) => {
                const unfairPct = t.submissions > 0 ? Math.round((t.unfair_count / t.submissions) * 100) : 0;
                const emailRate = t.submissions > 0 ? Math.round((t.leads_with_email / t.submissions) * 100) : 0;
                return (
                  <tr key={t.source} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-2 font-medium">{t.source}</td>
                    <td className="px-3 py-2 font-semibold">{t.submissions}</td>
                    <td className="px-3 py-2">{t.avg_fairness_score ?? '—'}</td>
                    <td className="px-3 py-2">{unfairPct}%</td>
                    <td className="px-3 py-2">{fmt(t.avg_overpayment)}</td>
                    <td className="px-3 py-2">{t.leads_with_email}</td>
                    <td className="px-3 py-2">{emailRate}%</td>
                  </tr>
                );
              })}
              {trafficData.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No traffic data yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Agent Opportunity Calculator ──
function AgentOpportunity({ zip }: { zip: any }) {
  const monthlyUnfair = zip.unfair_30d || 0;
  const monthlyLeads = Math.round((zip.leads_with_email / Math.max(zip.submissions, 1)) * monthlyUnfair);
  const avgOverpay = zip.avg_overpayment || 0;
  // Estimated: 20% close rate × $3,000 avg broker fee × 25% referral
  const estRevenue = Math.round(monthlyLeads * 0.20 * 3000 * 0.25);

  return (
    <div className="max-w-xl space-y-2">
      <h4 className="font-semibold text-foreground text-sm">Agent Opportunity — {zip.zip} ({zip.city})</h4>
      <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
        <div className="text-muted-foreground">Monthly unfair/excessive leads</div>
        <div className="font-medium">{monthlyUnfair}</div>
        <div className="text-muted-foreground">Estimated leads with email/mo</div>
        <div className="font-medium">{monthlyLeads}</div>
        <div className="text-muted-foreground">Avg overpayment</div>
        <div className="font-medium">{fmt(avgOverpay)}/mo</div>
        <div className="text-muted-foreground">Est. agent referral revenue</div>
        <div className="font-semibold text-primary">{fmt(estRevenue)}/mo</div>
      </div>
      {estRevenue > 0 && (
        <p className="text-xs text-muted-foreground mt-2 bg-muted/50 rounded p-2">
          An agent subscribing to {zip.zip} at $199/month could generate an estimated {fmt(estRevenue)}/month in referral income based on current lead volume.
        </p>
      )}
    </div>
  );
}

// Need Fragment import
import { Fragment } from 'react';
