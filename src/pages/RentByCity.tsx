import { useParams, Link } from 'react-router-dom';
import { useEffect, useState, useMemo } from 'react';
import { getCityData, getNearbyCities, fmt, slugify, stateNameFromAbbr, type CityData } from '@/data/cityStateUtils';
import SEO from '@/components/SEO';
import SEOFooter from '@/components/SEOFooter';
import ContactModal from '@/components/ContactModal';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';

const BEDROOM_LABELS = ['Studio', '1-Bedroom', '2-Bedroom', '3-Bedroom', '4-Bedroom'];

const RentByCity = () => {
  const { stateSlug, citySlug } = useParams<{ stateSlug: string; citySlug: string }>();
  const [data, setData] = useState<CityData | null>(null);
  const [nearby, setNearby] = useState<CityData[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);

  useEffect(() => {
    if (!stateSlug || !citySlug) { setNotFound(true); setLoading(false); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const cityData = await getCityData(stateSlug, citySlug);
      if (cancelled) return;
      if (!cityData) { setNotFound(true); setLoading(false); return; }
      setData(cityData);
      setLoading(false);

      // Load nearby cities (non-blocking)
      const metro = cityData.zips[0]?.raw.m;
      if (metro) {
        const nearbyCities = await getNearbyCities(cityData.city, cityData.state, metro);
        if (!cancelled) setNearby(nearbyCities);
      }
    })();
    return () => { cancelled = true; };
  }, [stateSlug, citySlug]);

  if (loading) return <LoadingSkeleton />;
  if (notFound || !data) return <NotFoundPage />;

  const { city, state, zips, avgFmr, censusMedianRent, yoyChange, cheapestZip } = data;
  const stateName = stateNameFromAbbr(state);
  const stateSlugVal = slugify(stateName);

  const faqItems = [
    {
      q: `What is the average rent in ${city}, ${state}?`,
      a: `Based on HUD fair market rent data, the average rent for a 1-bedroom in ${city} is ${fmt(avgFmr[1])}/month. Studios average ${fmt(avgFmr[0])}, and 2-bedrooms average ${fmt(avgFmr[2])}.`,
    },
    {
      q: `How much has rent changed in ${city}?`,
      a: yoyChange !== null
        ? `Rents in ${city} changed ${yoyChange > 0 ? '+' : ''}${yoyChange.toFixed(1)}% year-over-year based on available market data.`
        : `Year-over-year rent change data is not currently available for ${city}.`,
    },
    {
      q: `What is the cheapest zip code in ${city}?`,
      a: cheapestZip
        ? `The most affordable zip code in ${city} is ${cheapestZip.zip} with a 1-bedroom FMR of ${fmt(cheapestZip.fmr1br)}/month.`
        : `Zip-level affordability data is not available for ${city}.`,
    },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEO
        title={`Average Rent in ${city}, ${state} (2025) — Fair Market Rent Data`}
        description={`See average rent prices in ${city}, ${state} by bedroom count. Compare HUD fair market rent, median rents, and year-over-year trends for all ${city} zip codes.`}
        canonical={`/rent-data/${stateSlugVal}/${slugify(city)}`}
        jsonLd={[
          {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.renewalreply.com/' },
              { '@type': 'ListItem', position: 2, name: 'Rent Data', item: 'https://www.renewalreply.com/rent-data' },
              { '@type': 'ListItem', position: 3, name: stateName, item: `https://www.renewalreply.com/rent-data/${stateSlugVal}` },
              { '@type': 'ListItem', position: 4, name: `${city}, ${state}`, item: `https://www.renewalreply.com/rent-data/${stateSlugVal}/${slugify(city)}` },
            ],
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

      {/* Noscript fallback for crawlers */}
      <noscript>
        <div style={{ maxWidth: 800, margin: '0 auto', padding: 24, fontFamily: 'sans-serif' }}>
          <h1>{`Average Rent in ${city}, ${state} (2025)`}</h1>
          <p>{`The average fair market rent for a 1-bedroom apartment in ${city}, ${state} is ${fmt(avgFmr[1])}/month based on HUD data across ${zips.length} zip code${zips.length !== 1 ? 's' : ''}.`}</p>
          <p><a href="https://www.renewalreply.com/">{`Check if your rent increase is fair →`}</a></p>

          <h2>{`Rent by Bedroom Size in ${city}`}</h2>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: 8 }}>Bedroom Size</th>
                <th style={{ textAlign: 'right', borderBottom: '1px solid #ccc', padding: 8 }}>FMR Monthly Rent</th>
              </tr>
            </thead>
            <tbody>
              {['Studio', '1-Bedroom', '2-Bedroom', '3-Bedroom', '4-Bedroom'].map((label, i) => (
                <tr key={label}>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{label}</td>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{fmt(avgFmr[i])}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2>{`Rent by Zip Code in ${city}`}</h2>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: 8 }}>Zip Code</th>
                <th style={{ textAlign: 'right', borderBottom: '1px solid #ccc', padding: 8 }}>1-BR FMR</th>
                <th style={{ textAlign: 'right', borderBottom: '1px solid #ccc', padding: 8 }}>2-BR FMR</th>
              </tr>
            </thead>
            <tbody>
              {zips.map(({ zip, raw }) => (
                <tr key={zip}>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                    <a href={`https://www.renewalreply.com/rent/${zip}`}>{zip}</a>
                  </td>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{fmt(raw.f[1])}</td>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{fmt(raw.f[2])}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {faqItems.map((f, i) => (
            <div key={i}>
              <h3>{f.q}</h3>
              <p>{f.a}</p>
            </div>
          ))}

          <p><small>Source: HUD Small Area Fair Market Rents (SAFMR) FY2025</small></p>
          <p><a href={`https://www.renewalreply.com/rent-data/${stateSlugVal}`}>{`← Back to ${stateName}`}</a></p>
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
            <li className="before:content-['›'] before:mx-1"><Link to={`/rent-data/${stateSlugVal}`} className="hover:text-foreground transition-colors">{stateName}</Link></li>
            <li className="before:content-['›'] before:mx-1"><span aria-current="page">{city}, {state}</span></li>
          </ol>
        </nav>

        {/* 1. Hero + Answer Summary */}
        <section className="mb-12">
          <h1 className="font-display text-3xl md:text-4xl text-foreground leading-tight tracking-tight" style={{ letterSpacing: '-0.02em' }}>
            Average Rent in {city}, {state} (2025)
          </h1>
          <p className="mt-3 text-muted-foreground leading-relaxed" style={{ fontSize: '1.05rem' }}>
            The average fair market rent for a 1-bedroom apartment in {city}, {state} is {fmt(avgFmr[1])}/month based on HUD data across {zips.length} zip code{zips.length !== 1 ? 's' : ''}.
            {' '}Studio: {fmt(avgFmr[0])}, 2-BR: {fmt(avgFmr[2])}, 3-BR: {fmt(avgFmr[3])}, 4-BR: {fmt(avgFmr[4])}.
            {yoyChange !== null && ` Rents in ${city} changed ${yoyChange > 0 ? '+' : ''}${yoyChange.toFixed(1)}% year-over-year.`}
          </p>
        </section>

        {/* 2. Rent Overview Cards */}
        <section className="mb-12">
          <h2 className="font-display text-2xl text-foreground mb-4 tracking-tight">Rent by Bedroom Size</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {BEDROOM_LABELS.map((label, i) => (
              <div key={label} className="rounded-lg border border-border p-4 bg-card text-center">
                <p className="text-xs text-muted-foreground mb-1">{label}</p>
                <p className="text-lg font-bold tabular-nums text-foreground">{fmt(avgFmr[i])}</p>
                <p className="text-[11px] text-muted-foreground mt-1">HUD FMR avg</p>
              </div>
            ))}
          </div>
          {censusMedianRent && (
            <p className="mt-3 text-sm text-muted-foreground">
              Census median gross rent: <span className="font-semibold text-foreground">{fmt(censusMedianRent)}/mo</span>
              {yoyChange !== null && (
                <> · Year-over-year: <span className={`font-semibold ${yoyChange > 0 ? 'text-destructive' : yoyChange < 0 ? 'text-green-600' : 'text-foreground'}`}>{yoyChange > 0 ? '+' : ''}{yoyChange.toFixed(1)}%</span></>
              )}
            </p>
          )}
        </section>

        {/* 3. Rent by Zip Code Table */}
        <section className="mb-12">
          <h2 className="font-display text-2xl text-foreground mb-4 tracking-tight">Rent by Zip Code in {city}</h2>
          <p className="text-sm text-muted-foreground mb-3">
            Click any zip code for detailed rent data, nearby comparables, and a free rent increase check.
          </p>
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Zip Code</TableHead>
                  <TableHead className="text-right">1-BR FMR</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">2-BR FMR</TableHead>
                  <TableHead className="text-right hidden md:table-cell">Census Median</TableHead>
                  <TableHead className="text-right">YoY</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {zips.map(({ zip, raw }) => {
                  const zipYoy = raw.zy ?? (raw.p[1] > 0 ? Math.round(((raw.f[1] - raw.p[1]) / raw.p[1]) * 1000) / 10 : null);
                  return (
                    <TableRow key={zip}>
                      <TableCell>
                        <Link to={`/rent/${zip}`} className="text-primary hover:underline font-medium">{zip}</Link>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(raw.f[1])}</TableCell>
                      <TableCell className="text-right tabular-nums hidden sm:table-cell">{fmt(raw.f[2])}</TableCell>
                      <TableCell className="text-right tabular-nums hidden md:table-cell">{raw.r ? fmt(raw.r) : '—'}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {zipYoy !== null ? (
                          <span className={zipYoy > 0 ? 'text-destructive' : zipYoy < 0 ? 'text-green-600' : ''}>
                            {zipYoy > 0 ? '+' : ''}{zipYoy.toFixed(1)}%
                          </span>
                        ) : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Sorted by 1-BR FMR (cheapest first). Source: HUD SAFMR FY2025.</p>
        </section>

        {/* 4. Nearby City Comparison */}
        {nearby.length > 0 && (
          <section className="mb-12">
            <h2 className="font-display text-2xl text-foreground mb-4 tracking-tight">How Does {city} Compare?</h2>
            <div className="space-y-2">
              {nearby.map(nc => {
                const diff = nc.avgFmr[1] - avgFmr[1];
                const pctDiff = Math.round((diff / avgFmr[1]) * 100);
                return (
                  <Link
                    key={`${nc.city}-${nc.state}`}
                    to={`/rent-data/${nc.stateSlug}/${nc.citySlug}`}
                    className="flex items-center justify-between rounded-lg border border-border p-4 bg-card hover:bg-muted/50 transition-colors"
                  >
                    <span className="font-medium text-foreground">{nc.city}, {nc.state}</span>
                    <div className="text-right">
                      <span className="tabular-nums text-sm text-muted-foreground">{fmt(nc.avgFmr[1])}/mo</span>
                      <span className={`ml-2 text-xs font-medium ${diff > 0 ? 'text-destructive' : diff < 0 ? 'text-green-600' : 'text-muted-foreground'}`}>
                        {diff > 0 ? '+' : ''}{pctDiff}%
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* 5. CTA */}
        <section className="mb-12 rounded-xl border border-border bg-card p-8 text-center">
          <h2 className="font-display text-2xl text-foreground mb-2 tracking-tight">
            Live in {city}? Check if your rent is fair.
          </h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Enter your address and current rent to see how you compare to local market data — and get a free negotiation letter if you're overpaying.
          </p>
          <Link
            to="/"
            className="inline-block bg-primary text-primary-foreground px-8 py-3 rounded-lg font-semibold hover:brightness-90 transition-all duration-150 shadow-sm shadow-primary/20"
          >
            Check my rent →
          </Link>
        </section>

        {/* 6. FAQ */}
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

        {/* 7. Data Summary */}
        <p className="text-xs text-muted-foreground/70 italic mb-8">
          City: {city}, {state} | Zip codes: {zips.length} | Avg 1-BR FMR: {fmt(avgFmr[1])}/mo | Avg 2-BR FMR: {fmt(avgFmr[2])}/mo
          {yoyChange !== null && ` | YoY change: ${yoyChange > 0 ? '+' : ''}${yoyChange.toFixed(1)}%`}
          {censusMedianRent && ` | Census median rent: ${fmt(censusMedianRent)}`}
          {' '}| Sources: HUD, U.S. Census Bureau, FRED
        </p>

        {/* Disclaimer */}
        <p className="text-xs text-muted-foreground/60 italic">
          Data reflects HUD FY2025 fair market rent benchmarks and U.S. Census estimates. Actual rents vary by unit condition, building type, and lease terms. This is general market information, not legal or financial advice.
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
        <Skeleton className="h-10 w-96 mb-4" />
        <Skeleton className="h-20 w-full mb-8" />
        <div className="grid grid-cols-5 gap-3 mb-8">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
        <Skeleton className="h-64 w-full" />
      </main>
    </div>
  );
}

function NotFoundPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEO title="City Not Found — RenewalReply" noindex />
      <nav className="sticky top-0 z-[60] flex items-center justify-between px-6 py-4 bg-card" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <Link to="/" className="font-display text-xl font-bold text-primary tracking-tight" style={{ letterSpacing: '-0.02em' }}>
          Renewal<span className="font-normal text-accent">Reply</span>
        </Link>
      </nav>
      <main className="flex-1 flex flex-col items-center justify-center">
        <h1 className="font-display text-3xl text-foreground mb-4">City Not Found</h1>
        <p className="text-muted-foreground mb-6">We don't have rent data for this city yet.</p>
        <Link to="/rent-data" className="text-primary hover:underline">← Browse all rent data</Link>
      </main>
      <SEOFooter />
    </div>
  );
}

export default RentByCity;
