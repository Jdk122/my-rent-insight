import { useParams, Link } from 'react-router-dom';
import { useEffect, useState, useMemo } from 'react';
import { getCityData, getNearbyCities, fmt, slugify, stateNameFromAbbr, type CityData } from '@/data/cityStateUtils';
import { getApartmentListData, getHud50Data, type ApartmentListZipRaw, type Hud50ZipRaw } from '@/data/dataLoader';
import { getDataFreshness, getFreshestDate, formatFreshnessDate, getHudFiscalYear, getDataYear, type DataFreshness } from '@/data/dataFreshness';
import SEO from '@/components/SEO';
import SEOFooter from '@/components/SEOFooter';
import ContactModal from '@/components/ContactModal';
import PageNav from '@/components/PageNav';
import RenterToolsCTA from '@/components/RenterToolsCTA';
import RentTrendSummary from '@/components/RentTrendSummary';
import WhatShouldRentCost from '@/components/WhatShouldRentCost';
import ShareDataButton from '@/components/ShareDataButton';
import DataPageFreshness from '@/components/DataPageFreshness';
import TrendDiscrepancyNote from '@/components/TrendDiscrepancyNote';
import OutlierFlag from '@/components/OutlierFlag';
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
  const [hud50Data, setHud50Data] = useState<Record<string, Hud50ZipRaw>>({});
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
      const [cityData, al, h50, fresh] = await Promise.all([
        getCityData(stateSlug, citySlug),
        getApartmentListData(),
        getHud50Data(),
        getDataFreshness(),
      ]);
      if (cancelled) return;
      if (!cityData) { setNotFound(true); setLoading(false); return; }
      setData(cityData);
      setAlData(al);
      setHud50Data(h50);
      setFreshness(fresh);
      setLoading(false);

      const metro = cityData.zips[0]?.raw.m;
      if (metro) {
        const nearbyCities = await getNearbyCities(cityData.city, cityData.state, metro);
        if (!cancelled) setNearby(nearbyCities);
      }
    })();
    return () => { cancelled = true; };
  }, [stateSlug, citySlug]);

  // Compute city-level HUD 50th pct averages
  const cityHud50 = useMemo(() => {
    if (!data) return null;
    const vals = data.zips.map(z => hud50Data[z.zip]?.f50).filter(Boolean) as number[][];
    if (vals.length === 0) return null;
    return [0, 1, 2, 3, 4].map(i => {
      const nums = vals.map(v => v[i]).filter(n => n > 0);
      return nums.length > 0 ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : 0;
    });
  }, [data, hud50Data]);

  // ─── Zip table intelligence: detect whether FMR/YoY actually vary among DISPLAYED zips ───
  // We check the displayed zips (top 20 or filtered), not all zips, to avoid showing
  // a table full of identical rows when only a handful of outlier zips differ.
  const { fmrVaries, hasZipLevelYoY, displayedZips, hasMoreZips } = useMemo(() => {
    if (!data) return { fmrVaries: false, hasZipLevelYoY: false, displayedZips: [], hasMoreZips: false };

    const sorted = [...data.zips].sort((a, b) => {
      const aHasMarket = (alData[a.zip]?.aly !== undefined) || (a.raw.zy !== undefined);
      const bHasMarket = (alData[b.zip]?.aly !== undefined) || (b.raw.zy !== undefined);
      if (aHasMarket !== bHasMarket) return aHasMarket ? -1 : 1;
      return b.raw.f[1] - a.raw.f[1];
    });

    const displayed = zipSearch
      ? sorted.filter(({ zip }) => zip.includes(zipSearch))
      : sorted.slice(0, 20);

    const more = !zipSearch && data.zips.length > 20;

    // Check variation among displayed zips only
    const fmr1brCounts: Record<number, number> = {};
    const fmr2brCounts: Record<number, number> = {};
    let fmrVar = false;
    if (displayed.length > 1) {
      for (const z of displayed) {
        const v1 = Math.round(z.raw.f[1]);
        const v2 = Math.round(z.raw.f[2]);
        if (v1 > 0) fmr1brCounts[v1] = (fmr1brCounts[v1] || 0) + 1;
        if (v2 > 0) fmr2brCounts[v2] = (fmr2brCounts[v2] || 0) + 1;
      }
      fmrVar = Object.keys(fmr1brCounts).length > 1 || Object.keys(fmr2brCounts).length > 1;
    }

    // Check if displayed zips have actual zip-level YoY (not identical county-level)
    let hasYoY = false;
    const yoyVals = new Set<number>();
    for (const z of displayed) {
      const zipAl = alData[z.zip]?.aly;
      const zipZori = z.raw.zy;
      const val = zipAl ?? zipZori ?? null;
      if (val !== null) {
        yoyVals.add(Math.round(val * 10));
        hasYoY = true;
      }
    }
    if (hasYoY && yoyVals.size <= 1) hasYoY = false;


    return { fmrVaries: fmrVar, hasZipLevelYoY: hasYoY, displayedZips: displayed, hasMoreZips: more };
  }, [data, alData, zipSearch]);

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

  // ─── Zillow city-level YoY ───
  const zillowYoYs = zips
    .map(z => z.raw.zy)
    .filter((v): v is number => v !== undefined && v !== null);
  const cityZoriYoY = zillowYoYs.length > 0
    ? Math.round((zillowYoYs.reduce((a, b) => a + b, 0) / zillowYoYs.length) * 10) / 10
    : null;

  // ─── Best trend: AL > ZORI > HUD ───
  const trendYoY = cityAlYoY ?? yoyChange;
  const trendSource = cityAlYoY !== null ? 'Apartment List' : hasZillow ? 'Zillow ZORI' : 'HUD FMR';

  // ─── Freshness ───
  const freshest = freshness ? getFreshestDate(freshness, hasZillow, hasAL) : null;
  const freshestFormatted = freshest ? formatFreshnessDate(freshest.date) : '';
  const dataYear = freshness ? getDataYear(freshness) : '2026';
  const hudFY = freshness ? getHudFiscalYear(freshness) : '2026';

  // ─── Dynamic meta / OG ───
  const metaTitle = hasMarketData
    ? `Average Rent in ${city}, ${state} (${dataYear}) | Rent Data by Zip Code`
    : `Fair Market Rent in ${city}, ${state} (FY${hudFY}) | Rent Data by Zip Code`;

  const ogTitle = `Average Rent in ${city}, ${state} — ${fmt(avgFmr[1])}/mo (${dataYear})`;
  const metaDesc = `1-BR rents in ${city} are ${fmt(avgFmr[1])}/mo${trendYoY !== null ? `, ${trendYoY > 0 ? 'up' : 'down'} ${Math.abs(trendYoY).toFixed(1)}% year-over-year` : ''}. See federal benchmarks, trends, and data for ${zips.length} zip codes.`;

  // Metro name for context
  const metroName = zips[0]?.raw.m || '';

  // Compute affordable income threshold
  const affordableIncome = Math.round(avgFmr[1] * 12 / 0.3);

  const faqItems = [
    {
      q: `What is the average rent in ${city}, ${state}?`,
      a: `Based on HUD Fair Market Rent data, the average rent for a 1-bedroom in ${city} is ${fmt(avgFmr[1])}/month. Studios average ${fmt(avgFmr[0])}, and 2-bedrooms average ${fmt(avgFmr[2])}.${cityHud50?.[1] ? ` The HUD 50th percentile (median) rent for a 1-bedroom is ${fmt(cityHud50[1])}/mo.` : ''}`,
    },
    {
      q: `Can I afford to rent in ${city}?`,
      a: `Using the 30% affordability rule, a household needs to earn at least ${fmt(affordableIncome)}/year to afford the average 1-bedroom rent of ${fmt(avgFmr[1])}/month without being cost-burdened.${censusMedianRent ? ` The Census median gross rent in ${city} is ${fmt(censusMedianRent)}/mo.` : ''}`,
    },
    {
      q: `How much has rent changed in ${city}?`,
      a: trendYoY !== null
        ? `Rents in ${city} changed ${trendYoY > 0 ? '+' : ''}${trendYoY.toFixed(1)}% year-over-year based on ${trendSource} data. ${Math.abs(trendYoY - 3.2) > 1 ? `This is ${trendYoY > 3.2 ? 'above' : 'below'} the national average of approximately 3.2%.` : 'This is roughly in line with the national average of approximately 3.2%.'}`
        : `Year-over-year rent change data is not currently available for ${city}.`,
    },
    {
      q: `What is the cheapest zip code in ${city}?`,
      a: cheapestZip
        ? `The most affordable zip code in ${city} is ${cheapestZip.zip} with a 1-bedroom HUD Fair Market Rent of ${fmt(cheapestZip.fmr1br)}/month.${avgFmr[1] > cheapestZip.fmr1br ? ` That's ${Math.round(((avgFmr[1] - cheapestZip.fmr1br) / avgFmr[1]) * 100)}% below the city average.` : ''}`
        : `Zip-level affordability data is not available for ${city}.`,
    },
    {
      q: `How does ${city} compare to the metro area?`,
      a: metroName
        ? `${city} is part of the ${metroName} metropolitan area. The city's average 1-bedroom FMR is ${fmt(avgFmr[1])}/month. ${nearby.length > 0 ? `Nearby cities like ${nearby.slice(0, 2).map(n => `${n.city} (${fmt(n.avgFmr[1])})`).join(' and ')} offer points of comparison.` : ''}`
        : `Metro-level comparison data is not available for ${city}.`,
    },
    {
      q: `What should rent cost in ${city}?`,
      a: `A 1-bedroom in ${city} typically rents for ${fmt(avgFmr[1])} – ${fmt(cityHud50?.[1] ?? Math.round(avgFmr[1] * 1.15))}, based on HUD FMR and median rent data.`,
    },
  ];


  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEO
        title={metaTitle}
        description={metaDesc}
        canonical={`/rent-data/${stateSlugVal}/${slugify(city)}`}
        ogImage="/og-image.png"
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
            '@type': 'WebPage',
            name: ogTitle,
            description: metaDesc,
            dateModified: freshest?.date || `${dataYear}-01-01`,
            url: `https://www.renewalreply.com/rent-data/${stateSlugVal}/${slugify(city)}`,
            publisher: { '@type': 'Organization', name: 'RenewalReply', url: 'https://www.renewalreply.com' },
          },
          {
            '@context': 'https://schema.org',
            '@type': 'Place',
            name: `${city}, ${state}`,
            address: { '@type': 'PostalAddress', addressLocality: city, addressRegion: state, addressCountry: 'US' },
          },
          {
            '@context': 'https://schema.org',
            '@type': 'Dataset',
            name: `Rent Data for ${city}, ${state}`,
            description: `Fair market rent data and market trends for ${city}, ${state} across ${zips.length} zip codes.`,
            url: `https://www.renewalreply.com/rent-data/${stateSlugVal}/${slugify(city)}`,
            creator: { '@type': 'Organization', name: 'RenewalReply', url: 'https://www.renewalreply.com' },
            license: 'https://creativecommons.org/licenses/by/4.0/',
            temporalCoverage: dataYear,
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
          <h1>{`Average Rent in ${city}, ${state} (${dataYear})`}</h1>
          <p>{`The average 1-bedroom rent in ${city} is ${fmt(avgFmr[1])}/month based on HUD Fair Market Rent data across ${zips.length} zip codes.`}{trendYoY !== null ? ` Rents changed ${trendYoY > 0 ? '+' : ''}${trendYoY.toFixed(1)}% year-over-year (${trendSource}).` : ''}</p>
          {freshestFormatted && <p>{`Last updated: ${freshestFormatted}`}</p>}
          <p><a href="https://www.renewalreply.com/">{`Check if your rent increase is fair →`}</a></p>
          <h2>{`Rent by Zip Code in ${city}`}</h2>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead><tr><th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: 8 }}>Zip Code</th><th style={{ textAlign: 'right', borderBottom: '1px solid #ccc', padding: 8 }}>1-BR FMR</th><th style={{ textAlign: 'right', borderBottom: '1px solid #ccc', padding: 8 }}>2-BR FMR</th></tr></thead>
            <tbody>
              {zips.map(({ zip, raw }) => (
                <tr key={zip}><td style={{ padding: 8, borderBottom: '1px solid #eee' }}><a href={`https://www.renewalreply.com/rent/${zip}`}>{zip}</a></td><td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{fmt(raw.f[1])}</td><td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{fmt(raw.f[2])}</td></tr>
              ))}
            </tbody>
          </table>
          {faqItems.map((f, i) => (<div key={i}><h3>{f.q}</h3><p>{f.a}</p></div>))}
          <p><small>Sources: HUD SAFMR FY{hudFY}, Apartment List, Zillow ZORI</small></p>
          <p><a href={`https://www.renewalreply.com/rent-data/${stateSlugVal}`}>{`← Back to ${stateName}`}</a></p>
        </div>
      </noscript>

      <PageNav />

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

        {/* ═══ Section A: Hero / Summary ═══ */}
        <section className="mb-12">
          <div className="flex items-start justify-between gap-4">
            <h1 className="font-display text-3xl md:text-4xl text-foreground leading-tight tracking-tight" style={{ letterSpacing: '-0.02em' }}>
              Average Rent in {city}, {state} ({dataYear})
            </h1>
            <ShareDataButton />
          </div>

          <div className="mt-6 flex flex-wrap items-end gap-6">
            <div>
              <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Average Rent · 1-Bedroom</p>
              <p className="text-5xl md:text-6xl font-bold tabular-nums text-foreground leading-none">{fmt(avgFmr[1])}<span className="text-xl font-normal text-muted-foreground">/mo</span></p>
              <p className="text-xs text-muted-foreground/70 mt-2">Source: HUD Fair Market Rent · {zips.length} zip codes</p>
            </div>

            {trendYoY !== null && (
              <div>
                <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Year-over-Year</p>
                <p className={`text-3xl md:text-4xl font-bold tabular-nums leading-none ${trendYoY > 3 ? 'text-destructive' : trendYoY > 0 ? 'text-foreground' : trendYoY < 0 ? 'text-accent' : 'text-foreground'}`}>
                  {trendYoY > 0 ? '↑' : trendYoY < 0 ? '↓' : '→'} {trendYoY > 0 ? '+' : ''}{trendYoY.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground/70 mt-2">Source: {trendSource}</p>
                <OutlierFlag yoy={trendYoY} />
              </div>
            )}
          </div>

          {/* Last updated */}
          {freshestFormatted && (
            <p className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent" />
              Last updated <time dateTime={freshest?.date || ''}>{freshestFormatted}</time>
            </p>
          )}

          {/* Summary */}
          <p className="mt-4 text-[1.08rem] text-foreground/90 leading-relaxed font-medium">
            The average 1-bedroom rent in {city} is {fmt(avgFmr[1])}/month based on HUD Fair Market Rent data.
            {trendYoY !== null
              ? ` Rents have changed ${trendYoY > 0 ? '+' : ''}${trendYoY.toFixed(1)}% year-over-year according to ${trendSource}. A rent increase above ${Math.abs(trendYoY).toFixed(1)}% in this area is above the local market trend.`
              : ''}
          </p>

          {/* HUD-only note */}
          {!hasMarketData && (
            <p className="mt-3 text-sm text-muted-foreground bg-muted/40 border border-border rounded-lg px-4 py-3">
              📊 Market trend data is limited for this area. The analysis below uses federal rent benchmarks.
            </p>
          )}
        </section>

        {/* ═══ Section B: Rent Trends ═══ */}
        {hasMarketData && (
          <section className="mb-12">
            <h2 className="font-display text-2xl text-foreground mb-4 tracking-tight">Rent Trends in {city}</h2>
            <div className="rounded-lg border border-border p-6 bg-card">
              <div className="flex flex-wrap gap-6">
                {cityAlYoY !== null && (
                  <div>
                    <p className="text-sm text-muted-foreground">Year-over-Year Trend (Apartment List)</p>
                    <p className={`text-2xl font-bold tabular-nums ${cityAlYoY > 3 ? 'text-destructive' : cityAlYoY < 0 ? 'text-accent' : 'text-foreground'}`}>
                      {cityAlYoY > 0 ? '+' : ''}{cityAlYoY.toFixed(1)}%
                    </p>
                    <OutlierFlag yoy={cityAlYoY} />
                  </div>
                )}
                {hasZillow && yoyChange !== null && (
                  <div>
                    <p className="text-sm text-muted-foreground">Year-over-Year Trend (Zillow ZORI)</p>
                    <p className={`text-2xl font-bold tabular-nums ${yoyChange > 3 ? 'text-destructive' : yoyChange < 0 ? 'text-accent' : 'text-foreground'}`}>
                      {yoyChange > 0 ? '+' : ''}{yoyChange.toFixed(1)}%
                    </p>
                    <OutlierFlag yoy={yoyChange} />
                  </div>
                )}
              </div>
              <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
                {trendSource} data shows rents in {city} have {(trendYoY ?? 0) > 0 ? 'increased' : (trendYoY ?? 0) < 0 ? 'decreased' : 'remained flat'} by {Math.abs(trendYoY ?? 0).toFixed(1)}% over the past year.
              </p>
              <RentTrendSummary location={city} trendYoY={trendYoY} />
              <TrendDiscrepancyNote alYoY={cityAlYoY} zoriYoY={cityZoriYoY} />
            </div>
            <p className="mt-3 text-xs text-muted-foreground/70">
              Sources: {hasAL ? 'Apartment List' : ''}{hasAL && hasZillow ? ', ' : ''}{hasZillow ? 'Zillow ZORI' : ''}
            </p>
          </section>
        )}

        {/* ═══ Section C: What Should Rent Cost? ═══ */}
        <WhatShouldRentCost
          location={city}
          fmr={avgFmr}
          hud50={cityHud50}
          censusMedianRent={censusMedianRent}
        />

        {/* ═══ Section D: Federal Rent Benchmarks ═══ */}
        <section className="mb-12">
          <h2 className="font-display text-2xl text-foreground mb-4 tracking-tight">Federal Rent Benchmarks for {city}</h2>
          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
            HUD Fair Market Rents represent the 40th percentile of area rents, used as a federal benchmark for housing programs. They're published annually and provide a consistent baseline for comparison.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {BEDROOM_LABELS.map((label, i) => {
              if (avgFmr[i] === 0) return null;
              return (
                <div key={label} className="rounded-lg border border-border p-4 bg-card text-center hover:border-primary/30 transition-colors">
                  <p className="text-xs font-semibold text-primary mb-1">{label}</p>
                  <p className="text-lg font-bold tabular-nums text-foreground">{fmt(avgFmr[i])}</p>
                  <p className="text-[11px] text-muted-foreground/70 mt-1">HUD Fair Market Rent</p>
                </div>
              );
            })}
          </div>
          {freshness && (
            <p className="mt-3 text-xs text-muted-foreground/70">
              Source: HUD SAFMR FY{hudFY} · Updated <time dateTime={freshness.hud_safmr}>{formatFreshnessDate(freshness.hud_safmr)}</time>
            </p>
          )}
        </section>

        {/* ═══ Section E: Renter Tools CTA ═══ */}
        <RenterToolsCTA />

        {/* ═══ Section F: Rent Data by Zip Code ═══ */}
        <section className="mb-12">
          <h2 className="font-display text-2xl text-foreground mb-4 tracking-tight">Zip Codes in {city}</h2>
          <p className="text-sm text-muted-foreground mb-3">
            Click any zip code for detailed rent data including zip-specific SAFMR rates, nearby comparables, and a free rent increase check.
          </p>
          {zips.length > 10 && (
            <div className="mb-3">
              <Input type="text" inputMode="numeric" placeholder="Filter by zip code..." value={zipSearch} onChange={(e) => setZipSearch(e.target.value.replace(/\D/g, ''))} className="h-10 w-48" />
            </div>
          )}

          {fmrVaries || hasZipLevelYoY ? (
            /* ── Table mode: show columns only for data that actually varies ── */
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Zip Code</TableHead>
                    {fmrVaries && <TableHead className="text-right">1-BR SAFMR</TableHead>}
                    {fmrVaries && <TableHead className="text-right hidden sm:table-cell">2-BR SAFMR</TableHead>}
                    {hasZipLevelYoY && <TableHead className="text-right">YoY</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedZips.map(({ zip, raw }) => {
                    const zipAl = alData[zip]?.aly;
                    const zipZori = raw.zy;
                    // Only show zip-level trend data (AL or Zillow), NOT HUD fallback
                    const zipYoy = zipAl ?? zipZori ?? null;
                    const isOutlier = zipYoy !== null && Math.abs(zipYoy) > 20;
                    return (
                      <TableRow key={zip}>
                        <TableCell>
                          <Link to={`/rent/${zip}`} className="text-primary hover:underline font-medium">{zip}</Link>
                        </TableCell>
                        {fmrVaries && <TableCell className="text-right tabular-nums">{raw.f[1] > 0 ? fmt(raw.f[1]) : '—'}</TableCell>}
                        {fmrVaries && <TableCell className="text-right tabular-nums hidden sm:table-cell">{raw.f[2] > 0 ? fmt(raw.f[2]) : '—'}</TableCell>}
                        {hasZipLevelYoY && (
                          <TableCell className="text-right tabular-nums">
                            {zipYoy !== null ? (
                              <span className={`${zipYoy > 3 ? 'text-destructive' : zipYoy < 0 ? 'text-accent' : ''} ${isOutlier ? 'opacity-60' : ''}`}>
                                {zipYoy > 0 ? '+' : ''}{zipYoy.toFixed(1)}%{isOutlier ? ' ⚠' : ''}
                              </span>
                            ) : '—'}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            /* ── Simple list mode: all zips share same FMR, no zip-level trends ── */
            <div className="rounded-lg border border-border p-4 bg-card">
              {/* Note about uniform SAFMR */}
              <div className="mb-3 px-3 py-2.5 rounded-md bg-muted/50 border border-border/60">
                <p className="text-[12px] text-muted-foreground leading-relaxed">
                  HUD publishes a single Fair Market Rent for the entire {data.zips[0]?.raw.m || city} metro area. For zip-level variation, the tool uses additional data sources including real-time comparable listings and local market indices.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {displayedZips.map(({ zip }) => (
                  <Link
                    key={zip}
                    to={`/rent/${zip}`}
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline font-medium bg-muted/50 px-3 py-1.5 rounded-md hover:bg-muted transition-colors"
                  >
                    {zip}
                  </Link>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground/70">
                All zip codes in {city} share the same county-level HUD Fair Market Rent ({fmt(avgFmr[1])} for 1-BR). Click any zip for SAFMR-specific rates.
              </p>
            </div>
          )}

          {hasMoreZips && (
            <p className="mt-3 text-sm text-muted-foreground">
              Showing top 20 of {zips.length} zip codes.{' '}
              <button onClick={() => setZipSearch(' ')} className="text-primary underline hover:text-primary/80">
                View all {zips.length} zip codes in {city} →
              </button>
            </p>
          )}
          <p className="mt-2 text-xs text-muted-foreground/70">
            {fmrVaries ? 'SAFMR rates are zip-specific.' : 'County-level FMR shown in city summary above.'} {hasZipLevelYoY ? 'YoY from Apartment List or Zillow ZORI where available.' : ''}
          </p>
          {!fmrVaries && zips.length > 1 && (
            <p className="mt-1 text-[11px] text-muted-foreground/60">
              Many zip codes in this metro area share the same SAFMR rate because HUD sets Fair Market Rents at the metropolitan statistical area level.
            </p>
          )}
        </section>

        {/* ═══ Nearby City Comparison ═══ */}
        {nearby.length > 0 && (
          <section className="mb-12">
            <h2 className="font-display text-2xl text-foreground mb-4 tracking-tight">How Does {city} Compare?</h2>
            <div className="space-y-2">
              {nearby.map(nc => {
                const diff = nc.avgFmr[1] - avgFmr[1];
                const pctDiff = Math.round((diff / avgFmr[1]) * 100);
                return (
                  <Link key={`${nc.city}-${nc.state}`} to={`/rent-data/${nc.stateSlug}/${nc.citySlug}`} className="flex items-center justify-between rounded-lg border border-border p-4 bg-card hover:bg-muted/50 transition-colors">
                    <span className="font-medium text-foreground">{nc.city.replace(/^Zcta\s+/i, '')}, {nc.state}</span>
                    <div className="text-right">
                      <span className="tabular-nums text-sm text-muted-foreground">{fmt(nc.avgFmr[1])}/mo</span>
                      <span className={`ml-2 text-xs font-medium ${diff > 0 ? 'text-destructive' : diff < 0 ? 'text-accent' : 'text-muted-foreground'}`}>
                        {diff > 0 ? '+' : ''}{pctDiff}%
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* ═══ FAQ ═══ */}
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
          <Link to={`/rent-data/${stateSlugVal}`} className="text-primary underline hover:text-primary/80">← All cities in {stateName}</Link>
          <Link to="/rent-data" className="text-primary underline hover:text-primary/80">Browse all rent data →</Link>
        </div>

        {/* Disclaimer + freshness */}
        <DataPageFreshness freshness={freshness} />
        <p className="text-xs text-muted-foreground/60 italic mt-2">
          Data reflects HUD FY{hudFY} fair market rent benchmarks and market data from Apartment List and Zillow. Actual rents vary by unit condition, building type, and lease terms. This is general market information, not legal or financial advice.
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
      <PageNav hideCta />
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
