import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Lock, ExternalLink, ChevronDown, AlertTriangle, CheckCircle2, Clock, Search, Database, Activity, Upload, ShieldCheck, Loader2, Download } from 'lucide-react';
import { calculateFairnessScore, type FairnessScoreInput } from '@/lib/fairnessScore';
import { supabase } from '@/integrations/supabase/client';
import type { RentZipRaw, ZhviZipRaw, ApartmentListZipRaw, Hud50ZipRaw } from '@/data/dataLoader';
import AdminNav from '@/components/admin/AdminNav';

const ADMIN_PASSWORD = 'renewalreply2026';

// ─── Types ───

interface FreshnessEntry {
  source: string;
  key: string;
  date: string | null;
  isRealtime: boolean;
  thresholdDays: [number, number]; // [yellow, red]
}

interface CoverageStats {
  total: number;
  apartmentList: number;
  zori: number;
  zhvi: number;
  hud50: number;
  fullCoverage: number;
}

type AnomalyType =
  | 'Source Divergence (HUD vs AL)'
  | 'Source Divergence (ZORI vs AL)'
  | 'Negative FMR'
  | 'Extreme YoY'
  | 'ZHVI/ZORI direction conflict';

type AnomalySeverity = 'critical' | 'info';

interface Anomaly {
  zip: string;
  city: string;
  state: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  detail: string;
}

// ─── Helpers ───

function getStatusBadge(dateStr: string | null, isRealtime: boolean, thresholds: [number, number]) {
  if (isRealtime) return <Badge className="bg-primary text-primary-foreground">Live</Badge>;
  if (!dateStr) return <Badge variant="destructive">Unknown</Badge>;
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (days <= thresholds[0]) return <Badge className="bg-primary text-primary-foreground">Fresh ({days}d)</Badge>;
  if (days <= thresholds[1]) return <Badge className="bg-accent text-accent-foreground">Aging ({days}d)</Badge>;
  return <Badge variant="destructive">Stale ({days}d)</Badge>;
}

function pct(n: number, total: number) {
  return total > 0 ? `${((n / total) * 100).toFixed(1)}%` : '0%';
}

// ─── Password Gate ───

function PasswordGate({ onAuth }: { onAuth: () => void }) {
  const [pw, setPw] = useState('');
  const [error, setError] = useState(false);
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <Lock className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
          <CardTitle className="text-lg">Admin Access</CardTitle>
          <CardDescription>Enter password to continue</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            type="password"
            placeholder="Password"
            value={pw}
            onChange={e => { setPw(e.target.value); setError(false); }}
            onKeyDown={e => { if (e.key === 'Enter') { if (pw === ADMIN_PASSWORD) onAuth(); else setError(true); } }}
          />
          {error && <p className="text-destructive text-sm">Incorrect password</p>}
          <Button className="w-full" onClick={() => { if (pw === ADMIN_PASSWORD) onAuth(); else setError(true); }}>
            Enter
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Dashboard ───

export default function AdminDataQuality() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('rr_admin_authed') === 'true');
  const [freshness, setFreshness] = useState<Record<string, string> | null>(null);
  const [rentData, setRentData] = useState<Record<string, RentZipRaw> | null>(null);
  const [countyData, setCountyData] = useState<Record<string, RentZipRaw>>({});
  const [zhviData, setZhviData] = useState<Record<string, ZhviZipRaw> | null>(null);
  const [alData, setAlData] = useState<Record<string, ApartmentListZipRaw> | null>(null);
  const [hud50Data, setHud50Data] = useState<Record<string, Hud50ZipRaw> | null>(null);
  const [spotZip, setSpotZip] = useState('');
  const [anomalyFilter, setAnomalyFilter] = useState<string>('all');

  // Combined view: rentData (SAFMR) + countyData (county-level)
  const allRentData = useMemo(() => {
    if (!rentData) return null;
    // Tag existing rentData entries as safmr if no fs field
    const combined: Record<string, RentZipRaw> = {};
    for (const [z, entry] of Object.entries(rentData)) {
      combined[z] = { ...entry, fs: (entry as any).fs || 'safmr' } as RentZipRaw;
    }
    for (const [z, entry] of Object.entries(countyData)) {
      if (!(z in combined)) {
        combined[z] = entry;
      }
    }
    return combined;
  }, [rentData, countyData]);

  useEffect(() => {
    if (!authed) return;

    const loadCountyData = async () => {
      const urls = ['/data/county_fmr.json'];
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (projectId) {
        urls.push(`https://${projectId}.supabase.co/storage/v1/object/public/temp-data/county_fmr.json`);
      }
      if (supabaseUrl) {
        urls.push(`${supabaseUrl}/storage/v1/object/public/temp-data/county_fmr.json`);
      }

      for (const url of urls) {
        try {
          const response = await fetch(url);
          if (response.ok) return await response.json();
        } catch {
          // try next source
        }
      }
      return {};
    };

    Promise.all([
      fetch('/data/data_freshness.json').then(r => r.json()),
      fetch('/data/rentData.json').then(r => r.json()),
      fetch('/data/zhvi_processed.json').then(r => r.json()).catch(() => ({})),
      fetch('/data/apartmentlist_processed.json').then(r => r.json()).catch(() => ({})),
      fetch('/data/hud50_processed.json').then(r => r.json()).catch(() => ({})),
      loadCountyData(),
    ]).then(([f, rd, zhvi, al, h50, county]) => {
      setFreshness(f);
      setRentData(rd);
      setZhviData(zhvi);
      setAlData(al);
      setHud50Data(h50);
      setCountyData(county);
    });
  }, [authed]);

  if (!authed) return <PasswordGate onAuth={() => { sessionStorage.setItem('rr_admin_authed', 'true'); setAuthed(true); }} />;
  if (!allRentData || !freshness) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading data...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminNav />
      <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-8">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Data Quality Dashboard</h1>
          <Badge variant="outline" className="ml-auto">Internal Only</Badge>
        </div>

        <Tabs defaultValue="freshness">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="freshness" className="gap-1.5"><Clock className="h-3.5 w-3.5" />Freshness</TabsTrigger>
            <TabsTrigger value="coverage" className="gap-1.5"><Database className="h-3.5 w-3.5" />Coverage</TabsTrigger>
            <TabsTrigger value="spotcheck" className="gap-1.5"><Search className="h-3.5 w-3.5" />Spot-Check</TabsTrigger>
            <TabsTrigger value="anomalies" className="gap-1.5"><AlertTriangle className="h-3.5 w-3.5" />Anomalies</TabsTrigger>
            <TabsTrigger value="refresh" className="gap-1.5"><Upload className="h-3.5 w-3.5" />Refresh Guide</TabsTrigger>
            <TabsTrigger value="migrate" className="gap-1.5"><Download className="h-3.5 w-3.5" />Migration</TabsTrigger>
          </TabsList>

          <TabsContent value="freshness">
            <FreshnessSection freshness={freshness} />
          </TabsContent>

          <TabsContent value="coverage">
            <CoverageSection rentData={allRentData} zhviData={zhviData} alData={alData} hud50Data={hud50Data} />
          </TabsContent>

          <TabsContent value="spotcheck">
            <SpotCheckSection rentData={allRentData} zhviData={zhviData} alData={alData} hud50Data={hud50Data} spotZip={spotZip} setSpotZip={setSpotZip} />
          </TabsContent>

          <TabsContent value="anomalies">
            <AnomalySection rentData={allRentData} zhviData={zhviData} alData={alData} hud50Data={hud50Data} anomalyFilter={anomalyFilter} setAnomalyFilter={setAnomalyFilter} />
          </TabsContent>

          <TabsContent value="refresh">
            <RefreshGuideSection />
          </TabsContent>

          <TabsContent value="migrate">
            <MigrationSection />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// Section 1: Freshness
// ═══════════════════════════════════════

function FreshnessSection({ freshness }: { freshness: Record<string, string> }) {
  const sources: FreshnessEntry[] = [
    { source: 'HUD SAFMR FY2026', key: 'hud_safmr', date: freshness.hud_safmr || null, isRealtime: false, thresholdDays: [365, 450] },
    { source: 'HUD 50th Percentile', key: 'hud_50pct', date: freshness.hud_50pct || null, isRealtime: false, thresholdDays: [365, 450] },
    { source: 'Apartment List', key: 'apartment_list', date: freshness.apartment_list || null, isRealtime: false, thresholdDays: [45, 90] },
    { source: 'Zillow ZORI', key: 'zillow_zori', date: freshness.zillow_zori || null, isRealtime: false, thresholdDays: [45, 90] },
    { source: 'Zillow ZHVI', key: 'zillow_zhvi', date: freshness.zillow_zhvi || null, isRealtime: false, thresholdDays: [45, 90] },
    { source: 'Rentcast', key: 'rentcast', date: null, isRealtime: freshness.rentcast === 'realtime', thresholdDays: [30, 60] },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2"><Clock className="h-5 w-5" />Data Freshness Monitor</CardTitle>
        <CardDescription>Status of each active data source based on last refresh date.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Source</TableHead>
              <TableHead>Last Updated</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sources.map(s => (
              <TableRow key={s.key}>
                <TableCell className="font-medium">{s.source}</TableCell>
                <TableCell>{s.isRealtime ? 'Real-time (30d cache)' : s.date || 'Unknown'}</TableCell>
                <TableCell>{getStatusBadge(s.date, s.isRealtime, s.thresholdDays)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════
// Section 2: Coverage
// ═══════════════════════════════════════

function CoverageSection({ rentData, zhviData, alData, hud50Data }: {
  rentData: Record<string, RentZipRaw>;
  zhviData: Record<string, ZhviZipRaw> | null;
  alData: Record<string, ApartmentListZipRaw> | null;
  hud50Data: Record<string, Hud50ZipRaw> | null;
}) {
  const stats = useMemo(() => {
    const zips = Object.keys(rentData);
    const total = zips.length;
    let apartmentList = 0, zori = 0, zhvi = 0, hud50 = 0, full = 0, safmr = 0, county = 0;
    for (const z of zips) {
      const rd = rentData[z];
      const hasAL = !!(alData?.[z]?.aly !== undefined && alData[z].aly !== null);
      const hasZORI = rd.zy !== undefined && rd.zy !== null;
      const hasZHVI = !!(zhviData?.[z]);
      const hasH50 = !!(hud50Data?.[z]?.f50);
      if (hasAL) apartmentList++;
      if (hasZORI) zori++;
      if (hasZHVI) zhvi++;
      if (hasH50) hud50++;
      if (hasAL && hasZORI && hasZHVI && hasH50) full++;
      if ((rd as any).fs === 'safmr') safmr++;
      else if ((rd as any).fs === 'county') county++;
    }
    return { total, apartmentList, zori, zhvi, hud50, fullCoverage: full, safmr, county };
  }, [rentData, zhviData, alData, hud50Data]);

  const rows = [
    { label: 'Total ZIP codes in dataset', count: stats.total, pctStr: '' },
    { label: '  └─ SAFMR (ZIP-level granularity)', count: stats.safmr, pctStr: pct(stats.safmr, stats.total) },
    { label: '  └─ County-level FMR', count: stats.county, pctStr: pct(stats.county, stats.total) },
    { label: '  └─ Legacy (no source flag)', count: stats.total - stats.safmr - stats.county, pctStr: pct(stats.total - stats.safmr - stats.county, stats.total) },
    { label: 'ZIPs with Apartment List data', count: stats.apartmentList, pctStr: pct(stats.apartmentList, stats.total) },
    { label: 'ZIPs with Zillow ZORI data', count: stats.zori, pctStr: pct(stats.zori, stats.total) },
    { label: 'ZIPs with Zillow ZHVI data', count: stats.zhvi, pctStr: pct(stats.zhvi, stats.total) },
    { label: 'ZIPs with HUD 50th percentile', count: stats.hud50, pctStr: pct(stats.hud50, stats.total) },
    { label: 'ZIPs with full coverage (all 5 static sources)', count: stats.fullCoverage, pctStr: pct(stats.fullCoverage, stats.total) },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2"><Database className="h-5 w-5" />Coverage Report</CardTitle>
        <CardDescription>Coverage of 6 active data sources across all ZIP codes. Census fields are dormant and excluded.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Metric</TableHead>
              <TableHead className="text-right">Count</TableHead>
              <TableHead className="text-right">%</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(r => (
              <TableRow key={r.label}>
                <TableCell>{r.label}</TableCell>
                <TableCell className="text-right font-mono">{r.count.toLocaleString()}</TableCell>
                <TableCell className="text-right font-mono">{r.pctStr}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════
// Section 3: Spot-Check
// ═══════════════════════════════════════

const VERIFY_LINKS: Record<string, string> = {
  'HUD SAFMR': 'https://www.huduser.gov/portal/datasets/fmr/smallarea/index.html',
  'HUD 50th Pct': 'https://www.huduser.gov/portal/datasets/50per.html',
  'Apartment List': 'https://www.apartmentlist.com/research/category/data-rent-estimates',
  'Zillow': 'https://www.zillow.com/research/data/',
};

function SpotCheckSection({ rentData, zhviData, alData, hud50Data, spotZip, setSpotZip }: {
  rentData: Record<string, RentZipRaw>;
  zhviData: Record<string, ZhviZipRaw> | null;
  alData: Record<string, ApartmentListZipRaw> | null;
  hud50Data: Record<string, Hud50ZipRaw> | null;
  spotZip: string;
  setSpotZip: (z: string) => void;
}) {
  const zip = spotZip.padStart(5, '0');
  const rd = rentData[zip];
  const zhvi = zhviData?.[zip];
  const al = alData?.[zip];
  const h50 = hud50Data?.[zip];

  // Compute sample fairness score
  const sampleScore = useMemo(() => {
    if (!rd) return null;
    const fmr1br = rd.f?.[1] ?? 0;
    if (fmr1br <= 0) return null;
    const currentRent = fmr1br;
    const proposedRent = fmr1br * 1.05;
    const input: FairnessScoreInput = {
      increasePct: 5,
      marketYoY: rd.y ?? 0,
      proposedRent,
      currentRent,
      compMedian: null,
      compCount: 0,
      fmr: fmr1br,
      zillowMonthly: rd.zm ?? null,
      hvd: zhvi?.hvd ?? null,
      alYoY: al?.aly ?? null,
      alMoM: al?.alm ?? null,
      bedroomCount: 1,
      f50: h50?.f50 ?? null,
    };
    return calculateFairnessScore(input);
  }, [rd, zhvi, al, h50]);

  function VerifyLink({ source }: { source: string }) {
    const url = VERIFY_LINKS[source];
    if (!url) return null;
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline ml-2">
        Verify <ExternalLink className="h-3 w-3" />
      </a>
    );
  }

  function Val({ v, suffix }: { v: unknown; suffix?: string }) {
    if (v === null || v === undefined) return <span className="text-muted-foreground italic">—</span>;
    return <span className="font-mono">{String(v)}{suffix || ''}</span>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2"><Search className="h-5 w-5" />ZIP Code Spot-Check</CardTitle>
        <CardDescription>Enter a ZIP to inspect all data fields and run a sample scoring test.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex gap-2 max-w-xs">
          <Input placeholder="Enter ZIP" value={spotZip} onChange={e => setSpotZip(e.target.value)} maxLength={5} />
          <Button variant="secondary" onClick={() => setSpotZip(spotZip)}>Look up</Button>
        </div>

        {spotZip.length === 5 && !rd && (
          <p className="text-destructive text-sm">ZIP code {zip} not found in rentData.json.</p>
        )}

        {rd && (
          <>
            <div className="text-sm text-muted-foreground">
              {rd.c}, {rd.s} · Metro: {rd.m || '—'} ·{' '}
              FMR Source: <Badge variant="outline" className="text-xs ml-1">{(rd as any).fs === 'safmr' ? 'ZIP-level SAFMR' : (rd as any).fs === 'county' ? 'County-level FMR' : 'Legacy (no flag)'}</Badge>
            </div>

            {/* HUD SAFMR */}
            <div className="space-y-1">
              <h3 className="text-sm font-semibold">HUD FMR <VerifyLink source="HUD SAFMR" /></h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1 text-sm">
                <div>FMR (current): <Val v={rd.f?.join(', ')} /></div>
                <div>FMR (prior): <Val v={rd.p?.join(', ')} /></div>
                <div>YoY %: <Val v={rd.y} suffix="%" /></div>
                <div>Prior source: <Val v={rd.ps} /></div>
                <div>Source type (fs): <Val v={(rd as any).fs} /></div>
              </div>
            </div>

            {/* HUD 50th */}
            <div className="space-y-1">
              <h3 className="text-sm font-semibold">HUD 50th Percentile <VerifyLink source="HUD 50th Pct" /></h3>
              <div className="text-sm">
                f50: <Val v={h50?.f50?.join(', ')} />
              </div>
            </div>

            {/* Apartment List */}
            <div className="space-y-1">
              <h3 className="text-sm font-semibold">Apartment List <VerifyLink source="Apartment List" /></h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1 text-sm">
                <div>YoY: <Val v={al?.aly} suffix="%" /></div>
                <div>MoM: <Val v={al?.alm} suffix="%" /></div>
                <div>Vacancy: <Val v={al?.alv} suffix="%" /></div>
                <div>Time on Market: <Val v={al?.alt} suffix=" days" /></div>
                <div>Region: <Val v={al?.alr} /></div>
              </div>
            </div>

            {/* Zillow ZORI */}
            <div className="space-y-1">
              <h3 className="text-sm font-semibold">Zillow ZORI <VerifyLink source="Zillow" /></h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1 text-sm">
                <div>YoY: <Val v={rd.zy} suffix="%" /></div>
                <div>MoM: <Val v={rd.zm} suffix="%" /></div>
                <div>3mo trend: <Val v={rd.zt} suffix="%" /></div>
                <div>Direction: <Val v={rd.zd} /></div>
              </div>
            </div>

            {/* Zillow ZHVI */}
            <div className="space-y-1">
              <h3 className="text-sm font-semibold">Zillow ZHVI <VerifyLink source="Zillow" /></h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1 text-sm">
                <div>YoY: <Val v={zhvi?.hvy} suffix="%" /></div>
                <div>MoM: <Val v={zhvi?.hvm} suffix="%" /></div>
                <div>3mo trailing: <Val v={zhvi?.hvt} suffix="%" /></div>
                <div>Direction: <Val v={zhvi?.hvd} /></div>
              </div>
            </div>

            {/* Dormant Census */}
            <Collapsible>
              <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                <ChevronDown className="h-4 w-4" />
                Census ACS (not used in scoring)
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 pl-6 text-sm space-y-1 text-muted-foreground">
                <div>Median Rent (r): <Val v={rd.r} /></div>
                <div>Median Income (i): <Val v={rd.i} /></div>
              </CollapsibleContent>
            </Collapsible>

            {/* Sample Score */}
            {sampleScore && (
              <div className="border-t pt-4 mt-4 space-y-2">
                <h3 className="text-sm font-semibold">Sample Scoring: 1BR, current = ${rd.f?.[1]?.toLocaleString()}, +5% increase</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {sampleScore.components.map(c => (
                    <div key={c.id} className="border rounded-md p-3 text-center">
                      <div className="text-xs text-muted-foreground truncate">{c.label}</div>
                      <div className="text-lg font-bold">{c.score}<span className="text-sm text-muted-foreground">/{c.max}</span></div>
                      {c.estimated && <Badge variant="outline" className="text-xs mt-1">Estimated</Badge>}
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-sm font-medium">Total:</span>
                  <span className="text-2xl font-bold">{sampleScore.total}/100</span>
                  <Badge className={sampleScore.tierColor.replace('text-', 'bg-').replace('text-', '') + ' text-white'}>
                    {sampleScore.tierLabel}
                  </Badge>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════
// Section 4: Anomaly Scanner
// ═══════════════════════════════════════

function AnomalySection({ rentData, zhviData, alData, hud50Data, anomalyFilter, setAnomalyFilter }: {
  rentData: Record<string, RentZipRaw>;
  zhviData: Record<string, ZhviZipRaw> | null;
  alData: Record<string, ApartmentListZipRaw> | null;
  hud50Data: Record<string, Hud50ZipRaw> | null;
  anomalyFilter: string;
  setAnomalyFilter: (f: string) => void;
}) {
  const anomalies = useMemo<Anomaly[]>(() => {
    const results: Anomaly[] = [];
    for (const [zip, rd] of Object.entries(rentData)) {
      const al = alData?.[zip];
      const zhvi = zhviData?.[zip];
      const h50 = hud50Data?.[zip];
      const base = { zip, city: rd.c, state: rd.s };

      // Source Divergence: HUD vs AL (info — expected methodological difference)
      if (al?.aly !== undefined && al.aly !== null && rd.y !== undefined) {
        if (Math.abs(rd.y - al.aly) > 5) {
          results.push({ ...base, type: 'Source Divergence (HUD vs AL)', severity: 'info', detail: `HUD y=${rd.y}%, AL aly=${al.aly}%` });
        }
      }

      // Source Divergence: ZORI vs AL (info — expected methodological difference)
      if (al?.aly !== undefined && al.aly !== null && rd.zy !== undefined && rd.zy !== null) {
        if (Math.abs(rd.zy - al.aly) > 5) {
          results.push({ ...base, type: 'Source Divergence (ZORI vs AL)', severity: 'info', detail: `ZORI zy=${rd.zy}%, AL aly=${al.aly}%` });
        }
      }

      // Negative FMR (critical — data error)
      if (rd.f) {
        for (let br = 0; br < rd.f.length; br++) {
          if (rd.f[br] <= 0) { results.push({ ...base, type: 'Negative FMR', severity: 'critical', detail: `f[${br}]=${rd.f[br]}` }); break; }
        }
      }
      if (h50?.f50) {
        for (let br = 0; br < h50.f50.length; br++) {
          if (h50.f50[br] <= 0) { results.push({ ...base, type: 'Negative FMR', severity: 'critical', detail: `f50[${br}]=${h50.f50[br]}` }); break; }
        }
      }

      // Extreme YoY — only flag AL and ZORI, not HUD (HUD recalculations can be legitimately large)
      const yoyVals = [
        { src: 'ZORI', val: rd.zy },
        { src: 'AL', val: al?.aly },
      ];
      for (const { src, val } of yoyVals) {
        if (val !== undefined && val !== null && (val > 20 || val < -15)) {
          results.push({ ...base, type: 'Extreme YoY', severity: 'critical', detail: `${src}=${val}%` });
        }
      }

      // ZHVI/ZORI direction conflict (critical — signals stale or conflicting data)
      if (zhvi?.hvd && rd.zd) {
        const rising = (d: string) => d === 'rising';
        const falling = (d: string) => d === 'falling';
        if ((rising(rd.zd) && falling(zhvi.hvd)) || (falling(rd.zd) && rising(zhvi.hvd))) {
          results.push({ ...base, type: 'ZHVI/ZORI direction conflict', severity: 'critical', detail: `ZORI=${rd.zd}, ZHVI=${zhvi.hvd}` });
        }
      }
    }
    return results;
  }, [rentData, zhviData, alData, hud50Data]);

  const anomalyTypes = useMemo(() => [...new Set(anomalies.map(a => a.type))].sort(), [anomalies]);
  const filtered = anomalyFilter === 'all' ? anomalies : anomalyFilter === 'critical' ? anomalies.filter(a => a.severity === 'critical') : anomalyFilter === 'info' ? anomalies.filter(a => a.severity === 'info') : anomalies.filter(a => a.type === anomalyFilter);

  const criticalCount = anomalies.filter(a => a.severity === 'critical').length;
  const infoCount = anomalies.filter(a => a.severity === 'info').length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2"><AlertTriangle className="h-5 w-5" />Cross-Source Anomaly Scanner</CardTitle>
        <CardDescription className="flex items-center gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1.5">
            <Badge variant={criticalCount > 0 ? "destructive" : "outline"} className="text-xs">{criticalCount}</Badge>
            critical anomalies (data errors)
          </span>
          <span className="text-muted-foreground">|</span>
          <span className="inline-flex items-center gap-1.5">
            <Badge variant="secondary" className="text-xs">{infoCount}</Badge>
            info-level divergences (expected)
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Filter:</span>
          <Select value={anomalyFilter} onValueChange={setAnomalyFilter}>
            <SelectTrigger className="w-[300px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All ({anomalies.length})</SelectItem>
              <SelectItem value="critical">Critical only ({criticalCount})</SelectItem>
              <SelectItem value="info">Info only ({infoCount})</SelectItem>
              {anomalyTypes.map(t => (
                <SelectItem key={t} value={t}>{t} ({anomalies.filter(a => a.type === t).length})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="max-h-[500px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">ZIP</TableHead>
                <TableHead>City</TableHead>
                <TableHead>St</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Anomaly</TableHead>
                <TableHead>Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.slice(0, 500).map((a, i) => (
                <TableRow key={`${a.zip}-${a.type}-${i}`}>
                  <TableCell className="font-mono">{a.zip}</TableCell>
                  <TableCell>{a.city}</TableCell>
                  <TableCell>{a.state}</TableCell>
                  <TableCell>
                    <Badge variant={a.severity === 'critical' ? 'destructive' : 'secondary'} className="text-xs">
                      {a.severity}
                    </Badge>
                  </TableCell>
                  <TableCell><Badge variant="outline" className="text-xs whitespace-nowrap">{a.type}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">{a.detail}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filtered.length > 500 && <p className="text-sm text-muted-foreground mt-2">Showing first 500 of {filtered.length} results.</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════
// Section 5: Refresh Guide
// ═══════════════════════════════════════

function RefreshGuideSection() {
  const sources: { name: string; frequency: string; url: string; filename: string; destination: string; script: string; notes?: string }[] = [
    {
      name: 'HUD SAFMR + ERAP (two-pass)',
      frequency: 'Annual (October)',
      url: 'https://www.huduser.gov/portal/datasets/fmr.html',
      filename: 'fy2026_safmrs.xlsx + fy2026_erap_fmrs.xlsx',
      destination: 'scripts/',
      script: 'python scripts/refresh_safmr_fy2026.py',
      notes: 'SAFMR provides ZIP-level FMR (~38K metro ZIPs). ERAP fills remaining ZIPs with county-level FMR.',
    },
    {
      name: 'HUD 50th Percentile',
      frequency: 'Annual (October)',
      url: 'https://www.huduser.gov/portal/datasets/50per.html',
      filename: 'hud_50pct_fy2026.xlsx',
      destination: 'scripts/',
      script: 'python scripts/refresh_hud50.py',
      notes: 'Requires Census ZCTA-to-county crosswalk at public/data/tab20_zcta520_county20_natl.txt',
    },
    {
      name: 'Apartment List (rent summary + vacancy + time on market)',
      frequency: 'Monthly',
      url: 'https://www.apartmentlist.com/research/category/data-rent-estimates',
      filename: 'rent_estimates_summary.csv, vacancy_index.csv, time_on_market.csv',
      destination: 'public/data/apartmentlist/',
      script: 'python scripts/refresh_apartmentlist.py',
      notes: 'Requires Census ZCTA-to-county crosswalk at public/data/tab20_zcta520_county20_natl.txt',
    },
    {
      name: 'Zillow ZORI',
      frequency: 'Monthly',
      url: 'https://www.zillow.com/research/data/',
      filename: 'Zip_zori_uc_sfrcondomfr_sm_month.csv',
      destination: 'Auto-downloaded by script',
      script: 'python scripts/refresh_zori.py',
    },
    {
      name: 'Zillow ZHVI',
      frequency: 'Monthly',
      url: 'https://www.zillow.com/research/data/',
      filename: 'Zip_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',
      destination: 'Auto-downloaded by script',
      script: 'python scripts/refresh_zhvi.py',
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2"><Upload className="h-5 w-5" />Data Refresh Guide</CardTitle>
        <CardDescription>
          Reference checklist for periodic data updates. Rentcast is real-time via API and needs no manual refresh.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {sources.map(s => (
          <div key={s.name} className="border rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">{s.name}</h3>
              <Badge variant="outline">{s.frequency}</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-sm">
              <div>
                <span className="text-muted-foreground">Download URL: </span>
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                  Source <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <div><span className="text-muted-foreground">Expected file: </span><code className="text-xs bg-muted px-1 rounded">{s.filename}</code></div>
              <div><span className="text-muted-foreground">Destination: </span><code className="text-xs bg-muted px-1 rounded">{s.destination}</code></div>
              <div><span className="text-muted-foreground">Script: </span><code className="text-xs bg-muted px-1 rounded">{s.script}</code></div>
            </div>
            {(s as any).notes && (
              <div className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1">
                ℹ️ {(s as any).notes}
              </div>
            )}
            <div className="text-sm">
              <span className="text-muted-foreground">Last refresh performed: </span>
              <span className="italic text-muted-foreground">Update in data_freshness.json</span>
            </div>
          </div>
        ))}

        <div className="text-sm text-muted-foreground mt-4 border-t pt-4">
          <p><strong>After each refresh:</strong></p>
          <ol className="list-decimal list-inside space-y-1 mt-2">
            <li>Run the appropriate Python script</li>
            <li>Update <code className="bg-muted px-1 rounded">public/data/data_freshness.json</code> with the new date</li>
            <li>Check the Anomaly Scanner tab for any new data issues</li>
            <li>Spot-check 2-3 ZIP codes to verify data looks correct</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════
// Section 6: Migration (client-side XLSX processing)
// ═══════════════════════════════════════

function MigrationSection() {
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string>('');
  const [progress, setProgress] = useState('');

  const runMigration = async () => {
    setStatus('running');
    setError('');
    setResult(null);

    try {
      // Step 1: Fetch ERAP XLSX via edge function proxy (bypasses CORS)
      setProgress('Downloading ERAP file via proxy...');
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const erapUrl = `https://${projectId}.supabase.co/functions/v1/proxy-hud-xlsx`;
      const erapResp = await fetch(erapUrl);
      if (!erapResp.ok) throw new Error(`Failed to fetch ERAP file: ${erapResp.status}`);
      const erapBuffer = await erapResp.arrayBuffer();
      setProgress(`Downloaded ${(erapBuffer.byteLength / 1024 / 1024).toFixed(1)} MB. Parsing...`);

      // Step 2: Parse XLSX client-side
      const XLSX = await import('xlsx');
      const wb = XLSX.read(new Uint8Array(erapBuffer), { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
      setProgress(`Parsed ${rows.length} rows. Comparing with rentData...`);

      // Find column names
      const sampleRow = rows[0] || {};
      const keys = Object.keys(sampleRow);
      const findKey = (...candidates: string[]) => {
        for (const c of candidates) {
          const cl = c.toLowerCase();
          const found = keys.find((k) => k.toLowerCase().includes(cl));
          if (found) return found;
        }
        return null;
      };

      const kZip = findKey('zip', 'zcta');
      const kMetro = findKey('area name', 'metro', 'hud');
      const kBr0 = findKey('erap_fmr_br0', 'br0', '0br');
      const kBr1 = findKey('erap_fmr_br1', 'br1', '1br');
      const kBr2 = findKey('erap_fmr_br2', 'br2', '2br');
      const kBr3 = findKey('erap_fmr_br3', 'br3', '3br');
      const kBr4 = findKey('erap_fmr_br4', 'br4', '4br');

      if (!kZip || !kBr0) throw new Error(`Could not find required columns. Keys: ${keys.join(', ')}`);

      // Build ERAP lookup
      const erapData: Record<string, { m: string; f: number[] }> = {};
      for (const row of rows) {
        const z = String(row[kZip!] || '').trim().padStart(5, '0');
        if (z.length !== 5 || !/^\d{5}$/.test(z)) continue;
        const fmr = [
          parseInt(row[kBr0!]) || 0,
          parseInt(row[kBr1!]) || 0,
          parseInt(row[kBr2!]) || 0,
          parseInt(row[kBr3!]) || 0,
          parseInt(row[kBr4!]) || 0,
        ];
        if (fmr.every((v) => v === 0)) continue;
        const metro = String(row[kMetro!] || '').trim();
        erapData[z] = { m: metro, f: fmr };
      }

      // Step 3: Load current rentData.json
      setProgress('Loading current rentData.json...');
      const rdResp = await fetch('/data/rentData.json');
      const rentData: Record<string, any> = await rdResp.json();
      const existingZips = new Set(Object.keys(rentData));

      // Step 4: Build county_fmr.json
      setProgress('Building county-level supplement...');
      const countyFmr: Record<string, any> = {};
      let newCount = 0;

      for (const [z, data] of Object.entries(erapData)) {
        if (existingZips.has(z)) continue;

        let state = '';
        if (data.m.includes(', ')) {
          const parts = data.m.split(', ');
          const lastPart = parts[parts.length - 1];
          const stateCandidate = lastPart.split(/\s/)[0];
          if (stateCandidate.length === 2 && /^[A-Z]+$/.test(stateCandidate)) {
            state = stateCandidate;
          }
        }

        countyFmr[z] = {
          c: '',
          s: state,
          m: data.m,
          f: data.f,
          p: [0, 0, 0, 0, 0],
          y: 0,
          ps: 'f',
          fs: 'county',
        };
        newCount++;
      }

      // Step 5: Upload to Supabase storage
      setProgress('Uploading county_fmr.json to storage...');
      const jsonStr = JSON.stringify(countyFmr);
      const { error: uploadError } = await supabase.storage
        .from('temp-data')
        .upload('county_fmr.json', new Blob([jsonStr], { type: 'application/json' }), {
          upsert: true,
          contentType: 'application/json',
        });

      if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

      const { data: urlData } = supabase.storage
        .from('temp-data')
        .getPublicUrl('county_fmr.json');

      setResult({
        success: true,
        stats: {
          erap_total: Object.keys(erapData).length,
          existing_safmr: existingZips.size,
          new_county: newCount,
          total_coverage: existingZips.size + newCount,
        },
        download_url: urlData.publicUrl,
        message: `Created county_fmr.json with ${newCount} new ZIPs. Download and save to public/data/county_fmr.json.`,
      });
      setStatus('done');
    } catch (err: any) {
      setError(err.message);
      setStatus('error');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2"><Download className="h-5 w-5" />ERAP Migration — Expand to Full National Coverage</CardTitle>
        <CardDescription>
          Processes the FY2026 ERAP FMR file from HUD (~52K ZIPs) directly in your browser,
          identifies ZIPs not in your current SAFMR dataset, and creates a supplementary county_fmr.json file.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-2">
          <p><strong>What this does (all in-browser):</strong></p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Downloads FY2026 ERAP FMR xlsx from HUD (~6 MB)</li>
            <li>Parses all ~52K ZCTAs with their FMR values using SheetJS</li>
            <li>Compares against your current rentData.json (~38,601 SAFMR ZIPs)</li>
            <li>Creates county_fmr.json with only the ~13,300 new ZIPs (tagged as county-level)</li>
            <li>Uploads to storage for download</li>
          </ol>
          <p className="text-muted-foreground mt-2">
            After running, download the file and save it to <code className="bg-muted px-1 rounded">public/data/county_fmr.json</code>.
            The data loader will automatically merge it at runtime.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={runMigration}
            disabled={status === 'running'}
            className="gap-2"
          >
            {status === 'running' ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Processing...</>
            ) : (
              <><Download className="h-4 w-4" />Run ERAP Migration</>
            )}
          </Button>

          {status === 'done' && result?.download_url && (
            <a
              href={result.download_url}
              download="county_fmr.json"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <Download className="h-4 w-4" />
              Download county_fmr.json
            </a>
          )}
        </div>

        {status === 'running' && progress && (
          <div className="text-sm text-muted-foreground bg-muted/30 rounded-md p-3">
            {progress}
          </div>
        )}

        {status === 'error' && (
          <div className="text-destructive text-sm bg-destructive/10 rounded-md p-3">
            <strong>Error:</strong> {error}
          </div>
        )}

        {status === 'done' && result && (
          <div className="border rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Migration Complete
            </div>
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell>Total ZIPs in ERAP file</TableCell>
                  <TableCell className="text-right font-mono">{result.stats?.erap_total?.toLocaleString()}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Existing SAFMR ZIPs (unchanged)</TableCell>
                  <TableCell className="text-right font-mono">{result.stats?.existing_safmr?.toLocaleString()}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>New county-level ZIPs added</TableCell>
                  <TableCell className="text-right font-mono font-bold">{result.stats?.new_county?.toLocaleString()}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-semibold">Total national coverage</TableCell>
                  <TableCell className="text-right font-mono font-bold">{result.stats?.total_coverage?.toLocaleString()}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <p className="text-sm text-muted-foreground mt-2">
              {result.message}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
