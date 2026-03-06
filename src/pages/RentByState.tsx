import { useParams, Link } from 'react-router-dom';
import { useEffect, useState, useMemo } from 'react';
import { getStateData, fmt, slugify, type StateData } from '@/data/cityStateUtils';
import { getApartmentListData, type ApartmentListZipRaw } from '@/data/dataLoader';
import { getDataFreshness, getFreshestDate, formatFreshnessDate, getHudFiscalYear, getDataYear, type DataFreshness } from '@/data/dataFreshness';
import { Input } from '@/components/ui/input';
import SEO from '@/components/SEO';
import SEOFooter from '@/components/SEOFooter';
import ContactModal from '@/components/ContactModal';
import PageNav from '@/components/PageNav';
import RenterToolsCTA from '@/components/RenterToolsCTA';
import ShareDataButton from '@/components/ShareDataButton';
import DataPageFreshness from '@/components/DataPageFreshness';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';

const RentByState = () => {
  const { stateSlug } = useParams<{ stateSlug: string }>();
  const [data, setData] = useState<StateData | null>(null);
  const [alData, setAlData] = useState<Record<string, ApartmentListZipRaw>>({});
  const [freshness, setFreshness] = useState<DataFreshness | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!stateSlug) { setNotFound(true); setLoading(false); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [stateData, al, fresh] = await Promise.all([
        getStateData(stateSlug),
        getApartmentListData(),
        getDataFreshness(),
      ]);
      if (cancelled) return;
      if (!stateData) { setNotFound(true); setLoading(false); return; }
      setData(stateData);
      setAlData(al);
      setFreshness(fresh);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [stateSlug]);

  // Compute state-level YoY from AL data
  const stateYoY = useMemo(() => {
    if (!data) return null;
    const yoys: number[] = [];
    for (const city of data.cities) {
      for (const z of city.zips) {
        const aly = alData[z.zip]?.aly;
        if (aly !== undefined && aly !== null) yoys.push(aly);
      }
    }
    if (yoys.length === 0) return null;
    return Math.round((yoys.reduce((a, b) => a + b, 0) / yoys.length) * 10) / 10;
  }, [data, alData]);

  const filteredCities = useMemo(() => {
    if (!data) return [];
    // Sort by zip count (proxy for population)
    const sorted = [...data.cities].sort((a, b) => b.zips.length - a.zips.length);
    if (!search.trim()) return sorted;
    const q = search.toLowerCase();
    return sorted.filter(c => c.city.toLowerCase().includes(q));
  }, [data, search]);

  // Freshness
  const freshest = useMemo(() => {
    if (!freshness) return null;
    return getFreshestDate(freshness, false, Object.keys(alData).length > 0);
  }, [freshness, alData]);
  const dataYear = freshness ? getDataYear(freshness) : '2026';
  const hudFY = freshness ? getHudFiscalYear(freshness) : '2026';

  if (loading) return <LoadingSkeleton />;
  if (notFound || !data) return <NotFoundPage />;

  const { stateName, stateAbbr, cities, avgFmr1br, totalZips } = data;

  // ─── OG-optimized meta ───
  const ogTitle = `Average Rent in ${stateName} — ${fmt(avgFmr1br)}/mo (${dataYear})`;
  const metaTitle = `Average Rent in ${stateName} (${dataYear}) | Rent Data by City`;
  const metaDesc = `1-BR rents in ${stateName} are ${fmt(avgFmr1br)}/mo${stateYoY !== null ? `, ${stateYoY > 0 ? 'up' : 'down'} ${Math.abs(stateYoY).toFixed(1)}% YoY` : ''}. See rent data for ${cities.length} cities across ${totalZips.toLocaleString()} zip codes.`;

  const faqItems = [
    {
      q: `What is the average rent in ${stateName}?`,
      a: `The average HUD Fair Market Rent for a 1-bedroom in ${stateName} is ${fmt(avgFmr1br)}/month according to HUD FY${hudFY} data, based on ${totalZips.toLocaleString()} zip codes across ${cities.length} cities.${stateYoY !== null ? ` Rents have changed ${stateYoY > 0 ? '+' : ''}${stateYoY.toFixed(1)}% year-over-year.` : ''}`,
    },
    {
      q: `Which city in ${stateName} has the cheapest rent?`,
      a: (() => {
        const cheapest = [...cities].sort((a, b) => a.avgFmr[1] - b.avgFmr[1])[0];
        return cheapest
          ? `${cheapest.city} has the lowest average 1-bedroom HUD Fair Market Rent in ${stateName} at ${fmt(cheapest.avgFmr[1])}/month.`
          : `City-level rent comparison data is not currently available for ${stateName}.`;
      })(),
    },
    {
      q: `Which city in ${stateName} has the most expensive rent?`,
      a: (() => {
        const expensive = [...cities].sort((a, b) => b.avgFmr[1] - a.avgFmr[1])[0];
        return expensive
          ? `${expensive.city} has the highest average 1-bedroom HUD Fair Market Rent in ${stateName} at ${fmt(expensive.avgFmr[1])}/month.`
          : `City-level rent comparison data is not currently available for ${stateName}.`;
      })(),
    },
    {
      q: `How many zip codes have rent data in ${stateName}?`,
      a: `RenewalReply covers ${totalZips.toLocaleString()} zip codes across ${cities.length} cities in ${stateName}, using HUD Fair Market Rent benchmarks updated for FY${hudFY}.`,
    },
  ];

  // Show top 20 by default
  const displayedCities = search.trim() ? filteredCities : filteredCities.slice(0, 20);
  const hasMoreCities = !search.trim() && filteredCities.length > 20;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEO
        title={metaTitle}
        description={metaDesc}
        canonical={`/rent-data/${stateSlug}`}
        ogImage="/og-image.png"
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
          {
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: ogTitle,
            description: metaDesc,
            dateModified: freshest?.date || `${dataYear}-01-01`,
            url: `https://www.renewalreply.com/rent-data/${stateSlug}`,
            publisher: { '@type': 'Organization', name: 'RenewalReply', url: 'https://www.renewalreply.com' },
          },
          {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: faqItems.map(f => ({
              '@type': 'Question',
              name: f.q,
              acceptedAnswer: { '@type': 'Answer', text: f.a },
            })),
          },
        ]}
      />

      {/* Noscript fallback */}
      <noscript>
        <div style={{ maxWidth: 800, margin: '0 auto', padding: 24, fontFamily: 'sans-serif' }}>
          <h1>{`Rent Data for ${stateName} — Average Rent by City (${dataYear})`}</h1>
          <p>{`The average 1-BR HUD Fair Market Rent in ${stateName} is ${fmt(avgFmr1br)}/month. Browse rent data for ${cities.length} cities across ${totalZips.toLocaleString()} zip codes.`}</p>
          <p><a href="https://www.renewalreply.com/">{`Check if your rent increase is fair →`}</a></p>
          <h2>{`Cities in ${stateName}`}</h2>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead><tr><th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: 8 }}>City</th><th style={{ textAlign: 'right', borderBottom: '1px solid #ccc', padding: 8 }}>1-BR Fair Market Rent</th><th style={{ textAlign: 'right', borderBottom: '1px solid #ccc', padding: 8 }}>Zip Codes</th></tr></thead>
            <tbody>
              {cities.map(c => (
                <tr key={c.citySlug}><td style={{ padding: 8, borderBottom: '1px solid #eee' }}><a href={`https://www.renewalreply.com/rent-data/${stateSlug}/${c.citySlug}`}>{c.city}</a></td><td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{fmt(c.avgFmr[1])}</td><td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{c.zips.length}</td></tr>
              ))}
            </tbody>
          </table>
          {faqItems.map((f, i) => (<div key={i}><h3>{f.q}</h3><p>{f.a}</p></div>))}
          <p><small>Source: HUD Small Area Fair Market Rents (SAFMR) FY{hudFY}</small></p>
          <p><a href="https://www.renewalreply.com/rent-data">← Browse all rent data</a></p>
        </div>
      </noscript>

      <PageNav />

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
          <div className="flex items-start justify-between gap-4">
            <h1 className="font-display text-3xl md:text-4xl text-foreground leading-tight tracking-tight" style={{ letterSpacing: '-0.02em' }}>
              Average Rent in {stateName} ({dataYear})
            </h1>
            <ShareDataButton />
          </div>

          <div className="mt-6 flex flex-wrap items-end gap-6">
            <div>
              <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Average 1-Bedroom Fair Market Rent</p>
              <p className="text-5xl md:text-6xl font-bold tabular-nums text-foreground leading-none">{fmt(avgFmr1br)}<span className="text-xl font-normal text-muted-foreground">/mo</span></p>
              <p className="text-xs text-muted-foreground/70 mt-2">Source: HUD Fair Market Rent FY{hudFY} · {totalZips.toLocaleString()} zip codes</p>
            </div>

            {stateYoY !== null && (
              <div>
                <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Year-over-Year</p>
                <p className={`text-3xl md:text-4xl font-bold tabular-nums leading-none ${stateYoY > 3 ? 'text-destructive' : stateYoY < 0 ? 'text-accent' : 'text-foreground'}`}>
                  {stateYoY > 0 ? '↑' : stateYoY < 0 ? '↓' : '→'} {stateYoY > 0 ? '+' : ''}{stateYoY.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground/70 mt-2">Source: Apartment List</p>
              </div>
            )}
          </div>

          {/* Largest city callout */}
          {filteredCities.length > 0 && filteredCities[0].avgFmr[1] > 0 && (
            <p className="mt-4 text-sm text-muted-foreground">
              Includes all regions.{' '}
              <Link to={`/rent-data/${stateSlug}/${filteredCities[0].citySlug}`} className="text-primary hover:underline font-medium">
                {filteredCities[0].city} average: {fmt(filteredCities[0].avgFmr[1])}/mo →
              </Link>
            </p>
          )}

          {/* Last updated */}
          {freshest && (
            <p className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent" />
              Last updated <time dateTime={freshest.date}>{formatFreshnessDate(freshest.date)}</time>
            </p>
          )}

          <p className="mt-4 text-[1.08rem] text-foreground/90 leading-relaxed font-medium">
            The average 1-bedroom rent in {stateName} is {fmt(avgFmr1br)}/month according to HUD FY{hudFY} Fair Market Rent data.
            {stateYoY !== null ? ` Rents have changed ${stateYoY > 0 ? '+' : ''}${stateYoY.toFixed(1)}% year-over-year.` : ''}
            {' '}{stateName} has {cities.length} cities with rent data covering {totalZips.toLocaleString()} zip codes.
          </p>
        </section>

        {/* Renter Tools CTA */}
        <RenterToolsCTA />

        {/* Search */}
        <div className="mb-6">
          <Input type="text" placeholder={`Search cities in ${stateName}…`} value={search} onChange={(e) => setSearch(e.target.value)} className="h-11 w-full max-w-sm" />
        </div>

        {/* Cities Table */}
        <section className="mb-12">
          <h2 className="font-display text-2xl text-foreground mb-4 tracking-tight">Rent by City in {stateName}</h2>
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>City</TableHead>
                  <TableHead className="text-right">1-BR Fair Market Rent</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">Zip Codes</TableHead>
                  <TableHead className="text-right hidden md:table-cell">YoY</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedCities.map(c => (
                  <TableRow key={c.citySlug}>
                    <TableCell>
                      <Link to={`/rent-data/${stateSlug}/${c.citySlug}`} className="text-primary hover:underline font-medium">
                        {c.city}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{c.avgFmr[1] > 0 ? fmt(c.avgFmr[1]) : '—'}</TableCell>
                    <TableCell className="text-right tabular-nums hidden sm:table-cell">{c.zips.length}</TableCell>
                    <TableCell className="text-right tabular-nums hidden md:table-cell">
                      {c.yoyChange !== null ? (
                        <span className={`${c.yoyChange > 3 ? 'text-destructive' : c.yoyChange < 0 ? 'text-accent' : ''} ${Math.abs(c.yoyChange) > 20 ? 'opacity-60' : ''}`}>
                          {c.yoyChange > 0 ? '+' : ''}{c.yoyChange.toFixed(1)}%{Math.abs(c.yoyChange) > 20 ? ' ⚠' : ''}
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
          {hasMoreCities && (
            <p className="mt-3 text-sm text-muted-foreground">
              Showing top 20 of {filteredCities.length} cities.{' '}
              <button onClick={() => setSearch(' ')} className="text-primary underline hover:text-primary/80">
                View all {filteredCities.length} cities in {stateName} →
              </button>
            </p>
          )}
          <p className="mt-2 text-xs text-muted-foreground/70">Sorted by number of zip codes. Source: HUD SAFMR FY{hudFY}.</p>
        </section>

        {/* FAQ */}
        <section className="mb-12">
          <h2 className="font-display text-2xl text-foreground mb-4 tracking-tight">Frequently Asked Questions</h2>
          <Accordion type="multiple" className="space-y-2">
            {faqItems.map((f, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="border border-border rounded-lg px-4">
                <AccordionTrigger className="text-left text-sm font-medium">{f.q}</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        {/* Internal links */}
        <div className="mb-12 flex flex-col gap-2 text-sm">
          <Link to="/rent-data" className="text-primary underline hover:text-primary/80">← Browse all rent data</Link>
        </div>

        {/* Disclaimer + freshness */}
        <DataPageFreshness freshness={freshness} />
        <p className="text-xs text-muted-foreground/60 italic mt-2">
          Data reflects HUD FY2026 Fair Market Rent benchmarks. Actual rents vary by unit condition, building type, and lease terms. This is general market information, not legal or financial advice.
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
        <Link to="/" className="h-7 w-36"><Skeleton className="h-7 w-36" /></Link>
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
      <PageNav hideCta />
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
