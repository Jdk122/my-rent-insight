import { useParams, Link } from 'react-router-dom';
import { useEffect, useState, useMemo } from 'react';
import { getCityData, getNearbyCities, fmt, slugify, stateNameFromAbbr, type CityData } from '@/data/cityStateUtils';
import { getApartmentListData, type ApartmentListZipRaw } from '@/data/dataLoader';
import { getDataFreshness, getFreshestDate, formatFreshnessDate, type DataFreshness } from '@/data/dataFreshness';
import SEO from '@/components/SEO';
import SEOFooter from '@/components/SEOFooter';
import ContactModal from '@/components/ContactModal';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
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
  const [alData, setAlData] = useState<Record<string, ApartmentListZipRaw>>({});
  const [freshness, setFreshness] = useState<DataFreshness | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [zipSearch, setZipSearch] = useState('');

  useEffect(() => {
    if (!stateSlug || !citySlug) { setNotFound(true); setLoading(false); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [cityData, al, fresh] = await Promise.all([
        getCityData(stateSlug, citySlug),
        getApartmentListData(),
        getDataFreshness(),
      ]);
      if (cancelled) return;
      if (!cityData) { setNotFound(true); setLoading(false); return; }
      setData(cityData);
      setAlData(al);
      setFreshness(fresh);
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

  // ─── Compute city-level AL trend ───
  const cityAlYoYs = zips
    .map(z => alData[z.zip]?.aly)
    .filter((v): v is number => v !== undefined && v !== null);
  const cityAlYoY = cityAlYoYs.length > 0
    ? Math.round((cityAlYoYs.reduce((a, b) => a + b, 0) / cityAlYoYs.length) * 10) / 10
    : null;

  // ─── Has market data? ───
  const hasZillow = zips.some(z => z.raw.zy !== undefined && z.raw.zy !== null);
  const hasAL = cityAlYoY !== null;
  const hasMarketData = hasZillow || hasAL;

  // ─── Best trend: AL > ZORI > HUD ───
  const trendYoY = cityAlYoY ?? yoyChange;
  const trendSource = cityAlYoY !== null ? 'Apartment List' : hasZillow ? 'Zillow ZORI' : 'HUD FMR';

  // ─── Freshness ───
  const freshest = freshness ? getFreshestDate(freshness, hasZillow, hasAL) : null;
  const freshestFormatted = freshest ? formatFreshnessDate(freshest.date) : '';

  // ─── Dynamic meta title (capped ≤60 chars when possible) ───
  const metaTitle = hasMarketData
    ? `Average Rent in ${city}, ${state} — 2026 Data | RenewalReply`
    : `Fair Market Rent in ${city}, ${state} (FY2026) | RenewalReply`;

  // ─── Meta description (capped ≤155 chars) ───
  const metaDesc = `Average 1-BR rent in ${city}, ${state}: ${fmt(avgFmr[1])}/mo.${trendYoY !== null ? ` Rents ${trendYoY > 0 ? 'up' : 'down'} ${Math.abs(trendYoY).toFixed(1)}% YoY.` : ''} Free rent data across ${zips.length} zip codes.`;

  const faqItems = [
    {
      q: `What is the average rent in ${city}, ${state}?`,
      a: `Based on HUD data, the average rent for a 1-bedroom in ${city} is ${fmt(avgFmr[1])}/month. Studios average ${fmt(avgFmr[0])}, and 2-bedrooms average ${fmt(avgFmr[2])}.`,
    },
    {
      q: `How much has rent changed in ${city}?`,
      a: trendYoY !== null
        ? `Rents in ${city} changed ${trendYoY > 0 ? '+' : ''}${trendYoY.toFixed(1)}% year-over-year based on ${trendSource} data.`
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
        title={metaTitle}
        description={metaDesc}
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
            '@type': 'Dataset',
            name: `Rent Data for ${city}, ${state}`,
            description: `Fair market rent data and market trends for ${city}, ${state} across ${zips.length} zip codes.`,
            url: `https://www.renewalreply.com/rent-data/${stateSlugVal}/${slugify(city)}`,
            creator: { '@type': 'Organization', name: 'RenewalReply', url: 'https://www.renewalreply.com' },
            license: 'https://creativecommons.org/licenses/by/4.0/',
            temporalCoverage: '2026',
            spatialCoverage: {
              '@type': 'Place',
              address: {
                '@type': 'PostalAddress',
                addressLocality: city,
                addressRegion: state,
                addressCountry: 'US',
              },
            },
            distribution: {
              '@type': 'DataDownload',
              encodingFormat: 'text/html',
              contentUrl: `https://www.renewalreply.com/rent-data/${stateSlugVal}/${slugify(city)}`,
            },
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
          <h1>{`Average Rent in ${city}, ${state} (2026)`}</h1>
          <p>{`The average rent for a 1-bedroom apartment in ${city}, ${state} is ${fmt(avgFmr[1])}/month based on HUD data across ${zips.length} zip code${zips.length !== 1 ? 's' : ''}.`}</p>
          {trendYoY !== null && <p>{`Rents changed ${trendYoY > 0 ? '+' : ''}${trendYoY.toFixed(1)}% year-over-year (${trendSource}).`}</p>}
          {freshestFormatted && <p>{`Last updated: ${freshestFormatted}`}</p>}
          <p><a href="https://www.renewalreply.com/">{`Check if your rent increase is fair →`}</a></p>

          <h2>{`Rent by Bedroom Size in ${city}`}</h2>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: 8 }}>Bedroom Size</th>
                <th style={{ textAlign: 'right', borderBottom: '1px solid #ccc', padding: 8 }}>Avg Monthly Rent</th>
              </tr>
            </thead>
            <tbody>
              {BEDROOM_LABELS.map((label, i) => (
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

          <p><small>Sources: HUD SAFMR FY2026, Apartment List, Zillow ZORI</small></p>
          <p><a href={`https://www.renewalreply.com/rent-data/${stateSlugVal}`}>{`← Back to ${stateName}`}</a></p>
        </div>
      </noscript>

      {/* Nav */}
      <nav className="sticky top-0 z-[60] flex items-center justify-between px-6 py-4 bg-card" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <Link to="/">
          <img src="/renewalreply-wordmark.png" alt="RenewalReply" className="h-6 sm:h-7" />
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

        {/* ═══ 1. Hero — Lead with market rents ═══ */}
        <section className="mb-12">
          <h1 className="font-display text-3xl md:text-4xl text-foreground leading-tight tracking-tight" style={{ letterSpacing: '-0.02em' }}>
            Average Rent in {city}, {state} (2026)
          </h1>

          {/* Hero numbers */}
          <div className="mt-6 flex flex-wrap items-end gap-6">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Average Rent · 1-Bedroom</p>
              <p className="text-4xl font-bold tabular-nums text-foreground">{fmt(avgFmr[1])}<span className="text-lg font-normal text-muted-foreground">/mo</span></p>
              <p className="text-xs text-muted-foreground mt-1">Source: HUD FMR avg across {zips.length} ZIPs</p>
            </div>

            {trendYoY !== null && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Year-over-Year Trend</p>
                <p className={`text-2xl font-bold tabular-nums ${trendYoY > 0 ? 'text-destructive' : trendYoY < 0 ? 'text-green-600' : 'text-foreground'}`}>
                  {trendYoY > 0 ? '↑' : trendYoY < 0 ? '↓' : '→'} {trendYoY > 0 ? '+' : ''}{trendYoY.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">Source: {trendSource}</p>
              </div>
            )}
          </div>

          {/* Last updated badge */}
          {freshestFormatted && (
            <p className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500" />
              Last updated <time dateTime={freshest?.date || ''}>{freshestFormatted}</time>
            </p>
          )}

          {/* AI-extractable answer block */}
          <p className="mt-4 text-[1.08rem] text-foreground/90 leading-relaxed font-medium">
            In {city}, {state}, the average rent for a 1-bedroom apartment is {fmt(avgFmr[1])}/month.
            {trendYoY !== null
              ? ` Rents ${trendYoY > 0 ? 'increased' : trendYoY < 0 ? 'decreased' : 'remained flat'} ${Math.abs(trendYoY).toFixed(1)}% year-over-year (${trendSource}). A rent increase above ${Math.abs(trendYoY).toFixed(1)}% is above the local market trend.`
              : ''}
            {' '}Studio: {fmt(avgFmr[0])}, 2-BR: {fmt(avgFmr[2])}, 3-BR: {fmt(avgFmr[3])}, 4-BR: {fmt(avgFmr[4])}.
            {' '}Based on {zips.length} zip code{zips.length !== 1 ? 's' : ''} in {city}.
          </p>
        </section>

        {/* ═══ 2. Market Trends (when available) ═══ */}
        {hasMarketData && (
          <section className="mb-12">
            <h2 className="font-display text-2xl text-foreground mb-4 tracking-tight">Rent Trends in {city}</h2>
            <div className="rounded-lg border border-border p-6 bg-card">
              <div className="flex flex-wrap gap-6">
                {cityAlYoY !== null && (
                  <div>
                    <p className="text-sm text-muted-foreground">YoY (Apartment List)</p>
                    <p className="text-2xl font-bold tabular-nums">{cityAlYoY > 0 ? '+' : ''}{cityAlYoY.toFixed(1)}%</p>
                  </div>
                )}
                {hasZillow && yoyChange !== null && (
                  <div>
                    <p className="text-sm text-muted-foreground">YoY (Zillow ZORI)</p>
                    <p className="text-2xl font-bold tabular-nums">{yoyChange > 0 ? '+' : ''}{yoyChange.toFixed(1)}%</p>
                  </div>
                )}
              </div>
              <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
                {trendSource} data shows rents in {city} have {(trendYoY ?? 0) > 0 ? 'increased' : (trendYoY ?? 0) < 0 ? 'decreased' : 'remained flat'} by {Math.abs(trendYoY ?? 0).toFixed(1)}% over the past year.
              </p>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Sources: {hasAL ? 'Apartment List' : ''}{hasAL && hasZillow ? ', ' : ''}{hasZillow ? 'Zillow ZORI' : ''}
            </p>
          </section>
        )}

        {/* ═══ 3. Rent by Bedroom — HUD Reference ═══ */}
        <section className="mb-12">
          <h2 className="font-display text-2xl text-foreground mb-4 tracking-tight">HUD Fair Market Rent Reference</h2>
          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
            HUD Fair Market Rents represent the 40th percentile of area rents, used as a federal benchmark for housing programs. They're published annually and provide a consistent baseline for comparison.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {BEDROOM_LABELS.map((label, i) => (
              <div key={label} className="rounded-lg border border-border p-4 bg-card text-center">
                <p className="text-xs text-muted-foreground mb-1">{label}</p>
                <p className="text-lg font-bold tabular-nums text-foreground">{fmt(avgFmr[i])}</p>
                <p className="text-[11px] text-muted-foreground mt-1">HUD FMR avg</p>
              </div>
            ))}
          </div>
          {freshness && (
            <p className="mt-3 text-xs text-muted-foreground">
              Source: HUD SAFMR FY2026 · Updated <time dateTime={freshness.hud_safmr}>{formatFreshnessDate(freshness.hud_safmr)}</time>
            </p>
          )}
        </section>

        {/* ═══ 4. Rent by Zip Code Table ═══ */}
        <section className="mb-12">
          <h2 className="font-display text-2xl text-foreground mb-4 tracking-tight">Rent by Zip Code in {city}</h2>
          <p className="text-sm text-muted-foreground mb-3">
            Click any zip code for detailed rent data, nearby comparables, and a free rent increase check.
          </p>
          {zips.length > 10 && (
            <div className="mb-3">
              <Input
                type="text"
                inputMode="numeric"
                placeholder="Filter by zip code..."
                value={zipSearch}
                onChange={(e) => setZipSearch(e.target.value.replace(/\D/g, ''))}
                className="h-10 w-48"
              />
            </div>
          )}
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Zip Code</TableHead>
                  <TableHead className="text-right">1-BR FMR</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">2-BR FMR</TableHead>
                  <TableHead className="text-right">YoY</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {zips
                  .filter(({ zip }) => !zipSearch || zip.includes(zipSearch))
                  .map(({ zip, raw }) => {
                  const zipAl = alData[zip]?.aly;
                  const zipYoy = zipAl ?? raw.zy ?? (raw.p[1] > 0 ? Math.round(((raw.f[1] - raw.p[1]) / raw.p[1]) * 1000) / 10 : null);
                  return (
                    <TableRow key={zip}>
                      <TableCell>
                        <Link to={`/rent/${zip}`} className="text-primary hover:underline font-medium">{zip}</Link>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(raw.f[1])}</TableCell>
                      <TableCell className="text-right tabular-nums hidden sm:table-cell">{fmt(raw.f[2])}</TableCell>
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
          <p className="mt-2 text-xs text-muted-foreground">Sorted by 1-BR FMR (cheapest first). YoY trend: Apartment List → Zillow → HUD.</p>
        </section>

        {/* ═══ 5. Nearby City Comparison ═══ */}
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

        {/* ═══ 6. CTA ═══ */}
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

        {/* ═══ 7. FAQ ═══ */}
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

        {/* ═══ 8. Data Summary ═══ */}
        <p className="text-xs text-muted-foreground/70 italic mb-8">
          City: {city}, {state} | Zip codes: {zips.length} | Avg 1-BR FMR: {fmt(avgFmr[1])}/mo | Avg 2-BR FMR: {fmt(avgFmr[2])}/mo
          {trendYoY !== null && ` | YoY change: ${trendYoY > 0 ? '+' : ''}${trendYoY.toFixed(1)}% (${trendSource})`}
          {' '}| Sources: HUD SAFMR FY2026, Apartment List, Zillow ZORI, Rentcast
        </p>

        {/* Disclaimer */}
        <p className="text-xs text-muted-foreground/60 italic">
          Data reflects HUD FY2026 fair market rent benchmarks and market data from Apartment List and Zillow. Actual rents vary by unit condition, building type, and lease terms. This is general market information, not legal or financial advice.
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
        <Skeleton className="h-7 w-36" />
        <Skeleton className="h-9 w-32 rounded-lg" />
      </nav>
      <main className="max-w-3xl mx-auto px-6 py-12 flex-1 w-full">
        <Skeleton className="h-10 w-3/4 mb-4" />
        <Skeleton className="h-5 w-full mb-2" />
        <Skeleton className="h-5 w-2/3 mb-8" />
        <div className="grid grid-cols-5 gap-3 mb-12">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
        <Skeleton className="h-8 w-1/2 mb-4" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      </main>
    </div>
  );
}

function NotFoundPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEO title="City Not Found | RenewalReply" noindex />
      <nav className="sticky top-0 z-[60] flex items-center justify-between px-6 py-4 bg-card" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <Link to="/">
          <img src="/renewalreply-wordmark.png" alt="RenewalReply" className="h-6 sm:h-7" />
        </Link>
      </nav>
      <main className="max-w-xl mx-auto px-6 py-24 flex-1 text-center">
        <h1 className="font-display text-3xl text-foreground mb-4">City not found</h1>
        <p className="text-muted-foreground mb-8 leading-relaxed">
          We don't have data for this city. <Link to="/rent-data" className="text-primary underline">Browse all rent data</Link>.
        </p>
      </main>
      <SEOFooter />
    </div>
  );
}

export default RentByCity;