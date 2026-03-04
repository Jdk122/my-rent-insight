import { useParams, Link, useNavigate } from 'react-router-dom';
import { useEffect, useState, useMemo } from 'react';
import { getStateData, fmt, slugify, type StateData } from '@/data/cityStateUtils';
import { Input } from '@/components/ui/input';
import SEO from '@/components/SEO';
import SEOFooter from '@/components/SEOFooter';
import ContactModal from '@/components/ContactModal';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

const RentByState = () => {
  const { stateSlug } = useParams<{ stateSlug: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<StateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!stateSlug) { setNotFound(true); setLoading(false); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const stateData = await getStateData(stateSlug);
      if (cancelled) return;
      if (!stateData) { setNotFound(true); setLoading(false); return; }
      setData(stateData);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [stateSlug]);

  const filteredCities = useMemo(() => {
    if (!data) return [];
    const sorted = [...data.cities].sort((a, b) => b.zips.length - a.zips.length);
    if (!search.trim()) return sorted;
    const q = search.toLowerCase();
    return sorted.filter(c => c.city.toLowerCase().includes(q));
  }, [data, search]);

  if (loading) return <LoadingSkeleton />;
  if (notFound || !data) return <NotFoundPage />;

  const { stateName, stateAbbr, cities, avgFmr1br, totalZips } = data;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEO
        title={`Rent Data for ${stateName} — Average Rent by City (2026)`}
        description={`Average fair market rent for a 1-bedroom in ${stateName} is ${fmt(avgFmr1br)}/month. Browse rent data for ${cities.length} cities across ${totalZips} zip codes.`}
        canonical={`/rent-data/${stateSlug}`}
        jsonLd={[
          {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.renewalreply.com/' },
              { '@type': 'ListItem', position: 2, name: 'Rent Data', item: 'https://www.renewalreply.com/rent-data' },
              { '@type': 'ListItem', position: 3, name: stateName, item: `https://www.renewalreply.com/rent-data/${stateSlug}` },
            ],
          },
        ]}
      />

      {/* Noscript fallback for crawlers */}
      <noscript>
        <div style={{ maxWidth: 800, margin: '0 auto', padding: 24, fontFamily: 'sans-serif' }}>
          <h1>{`Rent Data for ${stateName} — Average Rent by City (2026)`}</h1>
          <p>{`The average fair market rent for a 1-bedroom in ${stateName} is ${fmt(avgFmr1br)}/month. Browse rent data for ${cities.length} cities across ${totalZips.toLocaleString()} zip codes.`}</p>
          <p><a href="https://www.renewalreply.com/">{`Check if your rent increase is fair →`}</a></p>

          <h2>{`Cities in ${stateName}`}</h2>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: 8 }}>City</th>
                <th style={{ textAlign: 'right', borderBottom: '1px solid #ccc', padding: 8 }}>1-BR FMR</th>
                <th style={{ textAlign: 'right', borderBottom: '1px solid #ccc', padding: 8 }}>Zip Codes</th>
              </tr>
            </thead>
            <tbody>
              {cities.map(c => (
                <tr key={c.citySlug}>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                    <a href={`https://www.renewalreply.com/rent-data/${stateSlug}/${c.citySlug}`}>{c.city}</a>
                  </td>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{fmt(c.avgFmr[1])}</td>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{c.zips.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p><small>Source: HUD Small Area Fair Market Rents (SAFMR) FY2026</small></p>
          <p><a href="https://www.renewalreply.com/rent-data">← Browse all rent data</a></p>
        </div>
      </noscript>

      {/* Nav */}
      <nav className="sticky top-0 z-[60] flex items-center justify-between px-6 py-4 bg-card" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <Link to="/" className="font-display text-xl font-bold text-primary tracking-tight" style={{ letterSpacing: '-0.02em' }}>
          Renewal<span className="font-normal text-accent">Reply</span>
        </Link>
        <Link to="/" className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-[13px] font-semibold hover:brightness-90 transition-all duration-150 shadow-sm shadow-primary/20">
          Check your rent →
        </Link>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-12 md:py-16 flex-1 w-full">
        {/* Breadcrumbs */}
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted-foreground">
          <ol className="flex flex-wrap items-center gap-1">
            <li><Link to="/" className="hover:text-foreground transition-colors">Home</Link></li>
            <li className="before:content-['›'] before:mx-1"><Link to="/rent-data" className="hover:text-foreground transition-colors">Rent Data</Link></li>
            <li className="before:content-['›'] before:mx-1"><span aria-current="page">{stateName}</span></li>
          </ol>
        </nav>

        {/* Hero */}
        <section className="mb-12">
          <h1 className="font-display text-3xl md:text-4xl text-foreground leading-tight tracking-tight" style={{ letterSpacing: '-0.02em' }}>
            Rent Data for {stateName}
          </h1>

          {/* AI-extractable answer block */}
          <p className="mt-4 text-[1.08rem] text-foreground/90 leading-relaxed font-medium" data-nosnippet="false">
            In {stateName}, the average fair market rent for a 1-bedroom apartment is {fmt(avgFmr1br)}/month according to HUD FY2026 data. {stateName} has {cities.length} cities with rent data covering {totalZips.toLocaleString()} zip codes. Use the table below to find average rent by city.
          </p>
        </section>

        {/* Search */}
        <div className="mb-6">
          <Input
            type="text"
            placeholder={`Search cities in ${stateName}…`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 w-full max-w-sm"
          />
        </div>

        {/* Cities Table */}
        <section className="mb-12">
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>City</TableHead>
                  <TableHead className="text-right">1-BR FMR</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">Zip Codes</TableHead>
                  <TableHead className="text-right hidden md:table-cell">YoY</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCities.map(c => (
                  <TableRow key={c.citySlug}>
                    <TableCell>
                      <Link to={`/rent-data/${stateSlug}/${c.citySlug}`} className="text-primary hover:underline font-medium">
                        {c.city}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(c.avgFmr[1])}</TableCell>
                    <TableCell className="text-right tabular-nums hidden sm:table-cell">{c.zips.length}</TableCell>
                    <TableCell className="text-right tabular-nums hidden md:table-cell">
                      {c.yoyChange !== null ? (
                        <span className={c.yoyChange > 0 ? 'text-destructive' : c.yoyChange < 0 ? 'text-green-600' : ''}>
                          {c.yoyChange > 0 ? '+' : ''}{c.yoyChange.toFixed(1)}%
                        </span>
                      ) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {filteredCities.length === 0 && (
            <p className="text-sm text-muted-foreground mt-4 text-center">No cities match "{search}"</p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">Sorted by number of zip codes (most first). Source: HUD SAFMR FY2026.</p>
        </section>

        {/* CTA */}
        <section className="mb-12 text-center py-10">
          <h2 className="font-display text-2xl text-foreground mb-3 tracking-tight">
            Got a rent increase?
          </h2>
          <p className="text-muted-foreground mb-6">Check if it's fair — it's free.</p>
          <Link
            to="/"
            className="inline-block bg-primary text-primary-foreground px-8 py-3 rounded-lg font-semibold hover:brightness-90 transition-all duration-150 shadow-sm shadow-primary/20"
          >
            Check my rent →
          </Link>
        </section>

        {/* Disclaimer */}
        <p className="text-xs text-muted-foreground/60 italic">
          Data reflects HUD FY2026 fair market rent benchmarks. Actual rents vary by unit condition, building type, and lease terms. This is general market information, not legal or financial advice.
        </p>
      </main>

      <SEOFooter onContactClick={() => setContactOpen(true)} />
      <ContactModal open={contactOpen} onOpenChange={setContactOpen} />
    </div>
  );
};

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <nav className="sticky top-0 z-[60] flex items-center justify-between px-6 py-4 bg-card" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <Link to="/" className="font-display text-xl font-bold text-primary tracking-tight" style={{ letterSpacing: '-0.02em' }}>
          Renewal<span className="font-normal text-accent">Reply</span>
        </Link>
      </nav>
      <main className="max-w-3xl mx-auto px-6 py-12 flex-1 w-full">
        <Skeleton className="h-6 w-48 mb-6" />
        <Skeleton className="h-10 w-72 mb-4" />
        <Skeleton className="h-16 w-full mb-8" />
        <Skeleton className="h-96 w-full" />
      </main>
    </div>
  );
}

function NotFoundPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEO title="State Not Found — RenewalReply" noindex />
      <nav className="sticky top-0 z-[60] flex items-center justify-between px-6 py-4 bg-card" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <Link to="/" className="font-display text-xl font-bold text-primary tracking-tight" style={{ letterSpacing: '-0.02em' }}>
          Renewal<span className="font-normal text-accent">Reply</span>
        </Link>
      </nav>
      <main className="flex-1 flex flex-col items-center justify-center">
        <h1 className="font-display text-3xl text-foreground mb-4">State Not Found</h1>
        <p className="text-muted-foreground mb-6">We don't have rent data for this state.</p>
        <Link to="/rent-data" className="text-primary hover:underline">← Browse all rent data</Link>
      </main>
      <SEOFooter />
    </div>
  );
}

export default RentByState;
