import { useParams, Link } from 'react-router-dom';
import { getRentControlByStateCity, getApplicableCap } from '@/data/rentControlData';
import { useEffect, useState, useMemo } from 'react';
import { usePrerenderReady } from '@/hooks/usePrerenderReady';
import { NoIndexMeta } from '@/components/NoIndexMeta';
import { getCityData, getNearbyCities, fmt, slugify, stateNameFromAbbr, type CityData } from '@/data/cityStateUtils';
import { getApartmentListData, getHud50Data, type ApartmentListZipRaw, type Hud50ZipRaw } from '@/data/dataLoader';
import { getDataFreshness, getFreshestDate, formatFreshnessDate, getHudFiscalYear, getDataYear, type DataFreshness } from '@/data/dataFreshness';
import SEO from '@/components/SEO';
import SEOFooter from '@/components/SEOFooter';
import ContactModal from '@/components/ContactModal';
import PageNav from '@/components/PageNav';
import RenterToolsCTA from '@/components/RenterToolsCTA';
import RentTrendSummary, { getDisplayTrend } from '@/components/RentTrendSummary';
import WhatShouldRentCost from '@/components/WhatShouldRentCost';
import ShareDataButton from '@/components/ShareDataButton';
import DataPageFreshness from '@/components/DataPageFreshness';

import OutlierFlag from '@/components/OutlierFlag';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

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

  const rentControlInfo = useMemo(() => {
    if (!data) return null;
    const rc = getRentControlByStateCity(data.state, data.city);
    return rc ? getApplicableCap(rc) : null;
  }, [data]);

  usePrerenderReady(!loading);

  if (loading) return <LoadingSkeleton stateSlug={stateSlug} citySlug={citySlug} />;
  if (notFound || !data) return <><NoIndexMeta /><NotFoundPage /></>;

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

  // ─── Best trend: AL > ZORI > HUD (waterfall) ───
  const hudYoY = yoyChange ?? null;
  const compositeTrendResult = getDisplayTrend(cityAlYoY, cityZoriYoY, hudYoY);
  const { yoy: trendYoY, source: trendSource, heroSource: trendHeroSource, sourceCount, primarySource } = compositeTrendResult;
  const trendAttribution = sourceCount >= 2 ? 'local market data' : primarySource || trendHeroSource;

  // ─── Freshness ───
  const freshest = freshness ? getFreshestDate(freshness, hasZillow, hasAL) : null;
  const freshestFormatted = freshest ? formatFreshnessDate(freshest.date) : '';
  const dataYear = freshness ? getDataYear(freshness) : '2026';
  const hudFY = freshness ? getHudFiscalYear(freshness) : '2026';

  // ─── Dynamic meta / OG ───
  const metaTitle = hasMarketData
    ? `Average Rent in ${city}, ${state} (${dataYear}) — ${fmt(avgFmr[1])}/mo for 1-BR`
    : `Fair Market Rent in ${city}, ${state} (FY${hudFY}) — ${fmt(avgFmr[1])}/mo for 1-BR`;

  const ogTitle = `Average Rent in ${city}, ${state} — ${fmt(avgFmr[1])}/mo for 1-BR (${dataYear})`;
  const metaDesc = `Average 1-BR rent in ${city} is ${fmt(avgFmr[1])}/mo${trendYoY !== null ? ` (${trendYoY > 0 ? '+' : ''}${trendYoY.toFixed(1)}% YoY)` : ''}. Compare ${zips.length} zip codes, see HUD fair market rents by bedroom, and check if your rent increase is fair. Updated ${dataYear}.`;

  // Metro name for context
  const metroName = zips[0]?.raw.m || '';

  const maxFmr1br = Math.max(...zips.map(z => z.raw.f[1]));
  const answerBlock = `The average 1-bedroom rent in ${city}, ${state} is ${fmt(avgFmr[1])}/month as of ${dataYear}, based on HUD data across ${zips.length} ZIP codes.${trendYoY !== null ? ` Rents have changed ${trendYoY > 0 ? '+' : ''}${trendYoY.toFixed(1)}% year over year.` : ''} Rents range from ${fmt(cheapestZip?.fmr1br ?? avgFmr[1])} to ${fmt(maxFmr1br)}.`;

  // Compute affordable income threshold
  const affordableIncome = Math.round(avgFmr[1] * 12 / 0.3);

  const faqItems = [
    {
      q: `What is the average 1-bedroom rent in ${city}, ${state}?`,
      a: `The average 1-bedroom fair market rent in ${city}, ${state} is ${fmt(avgFmr[1])}/month as of ${dataYear}, based on HUD rent data across ${zips.length} ZIP codes in the city.`,
    },
    {
      q: `What is a fair rent increase in ${city}?`,
      a: trendYoY !== null
        ? `A rent increase up to about ${Math.abs(trendYoY).toFixed(1)}% is broadly in line with the recent market trend in ${city}. Increases above that level are above trend and should be tested against neighborhood-level pricing and comparable rentals.`
        : `When local trend data is limited, a fair rent increase in ${city} is better judged against the current city rent benchmark and ZIP-level differences rather than a single trend percentage.`,
    },
    {
      q: `Are rents going up or down in ${city}?`,
      a: trendYoY !== null
        ? `Rents in ${city} have changed ${trendYoY > 0 ? '+' : ''}${trendYoY.toFixed(1)}% year over year based on the trend measure shown on this page.`
        : `This page has limited trend visibility for ${city}, so it emphasizes current rent benchmarks and cross-ZIP differences more than year-over-year movement.`,
    },
    {
      q: `How much do rents vary across ${city}?`,
      a: `1-bedroom rents across ${city} range from ${fmt(cheapestZip?.fmr1br ?? avgFmr[1])} to ${fmt(Math.max(...zips.map(z => z.raw.f[1])))} on this page, showing that rent can vary materially across ZIP codes within the same city.`,
    },
    {
      q: `Can my landlord raise my rent in ${city}?`,
      a: rentControlInfo
        ? `In ${city}, rent increases are regulated under ${rentControlInfo.jurisdiction} protections.${rentControlInfo.maxIncreaseFormula ? ` The maximum increase is generally ${rentControlInfo.maxIncreaseFormula}.` : ''} Landlords must also follow applicable state notice requirements.`
        : `We could not identify a city-specific rent cap for ${city}. Landlords must still follow applicable state and local notice rules before raising rent at lease renewal. Check your state's requirements for specifics.`,
    },
    {
      q: `How much should I spend on rent in ${city}?`,
      a: `The general guideline is to spend no more than 30% of your gross income on rent. With average 1-bedroom rent in ${city} at ${fmt(avgFmr[1])}/month, a household would need approximately ${fmt(affordableIncome)}/year to afford this comfortably.`,
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
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.renewalreply.com/' },
              { '@type': 'ListItem', position: 2, name: 'Rent Data', item: 'https://www.renewalreply.com/rent-data' },
              { '@type': 'ListItem', position: 3, name: stateName, item: `https://www.renewalreply.com/rent-data/${stateSlugVal}` },
              { '@type': 'ListItem', position: 4, name: `${city}, ${state}`, item: `https://www.renewalreply.com/rent-data/${stateSlugVal}/${slugify(city)}` },
            ],
          },
          {
            '@type': 'WebPage',
            name: ogTitle,
            description: metaDesc,
            dateModified: freshest?.date || `${dataYear}-01-01`,
            url: `https://www.renewalreply.com/rent-data/${stateSlugVal}/${slugify(city)}`,
            publisher: { '@type': 'Organization', name: 'RenewalReply', url: 'https://www.renewalreply.com' },
          },
          {
            '@type': 'Place',
            name: `${city}, ${state}`,
            address: { '@type': 'PostalAddress', addressLocality: city, addressRegion: state, addressCountry: 'US' },
          },
          {
            '@type': 'Dataset',
            name: `Rent Data for ${city}, ${state}`,
            description: `Fair market rent data and market trends for ${city}, ${state} across ${zips.length} zip codes.`,
            url: `https://www.renewalreply.com/rent-data/${stateSlugVal}/${slugify(city)}`,
            creator: { '@type': 'Organization', name: 'RenewalReply', url: 'https://www.renewalreply.com' },
            license: 'https://creativecommons.org/licenses/by/4.0/',
            temporalCoverage: dataYear,
            spatialCoverage: { '@type': 'Place', name: `${city}, ${state}` },
            variableMeasured: ['Fair Market Rent', 'Median Rent', 'Year-over-Year Rent Change', 'Rent by Bedroom Count', 'Apartment List Rent Estimate', 'Zillow Observed Rent Index'],
            measurementTechnique: 'Aggregated from HUD Fair Market Rent (SAFMR 50th percentile), Zillow Observed Rent Index (ZORI), and Apartment List rent estimates',
            isAccessibleForFree: true,
            keywords: ['rent data', 'fair market rent', 'rent trends', 'rental prices'],
          },
          {
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
          <p>{answerBlock}</p>
          {trendYoY !== null && <p>{trendYoY !== null && <p>{`Based on ${trendAttribution}, a fair rent increase in ${city}, ${state} is approximately ${Math.abs(trendYoY).toFixed(1)}% for ${dataYear}. An increase above ${Math.abs(trendYoY).toFixed(1)}% exceeds the local market trend and may be worth negotiating.`}</p>}</p>}
          {freshestFormatted && <p>{`Data through: ${freshestFormatted}`}</p>}
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

          {/* Quick summary — optimized for AI answer extraction */}
          <p className="mt-4 text-base text-foreground/80 leading-relaxed">
            {answerBlock}
          </p>

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
              Data through <time dateTime={freshest?.date || ''}>{freshestFormatted}</time>
            </p>
          )}

          {/* Summary */}
          <div className="mt-4 space-y-2 text-[1.08rem] text-foreground/90 leading-relaxed font-medium">
            <p>
              Average rent in {city}, {state} ranges from {fmt(cheapestZip?.fmr1br ?? avgFmr[1])} to {fmt(Math.max(...zips.map(z => z.raw.f[1])))} across {zips.length} ZIP codes.
            </p>
            <p>
              The average 1-bedroom rent in {city} is {fmt(avgFmr[1])}/month based on HUD Fair Market Rent data.
              {trendYoY !== null
                ? ` Year-over-year rent trends in ${city} show a ${trendYoY > 0 ? '+' : ''}${trendYoY.toFixed(1)}% change based on ${trendAttribution}. ${trendYoY < 0 ? 'Rents are declining in this area — any increase is above the local market trend.' : `A rent increase above ${trendYoY.toFixed(1)}% in this area is above the local market trend.`}`
                : ''}
            </p>
            {trendYoY !== null && (
              <p>
                Based on {trendAttribution}, a fair rent increase in {city}, {state} is approximately {Math.abs(trendYoY).toFixed(1)}% for {dataYear}. An increase above {Math.abs(trendYoY).toFixed(1)}% exceeds the local market trend and may be worth negotiating.
              </p>
            )}
          </div>

          {/* Visible source attribution */}
          <p className="mt-2 text-xs text-muted-foreground/70">
            Sources: {trendSource ? `${trendSource}, ` : ''}HUD SAFMR, Rentcast.{' '}
            {freshestFormatted && <>Updated {freshestFormatted}.</>}
          </p>

          {/* HUD-only note */}
          {!hasMarketData && (
            <p className="mt-3 text-sm text-muted-foreground bg-muted/40 border border-border rounded-lg px-4 py-3">
              📊 Market trend data is limited for this area. The analysis below uses federal rent benchmarks.
            </p>
          )}
        </section>

        {/* ═══ AEO: Query-matching answer sections ═══ */}
        <section className="mb-12 space-y-8">
          <div>
            <h2 className="font-display text-xl text-foreground mb-2 tracking-tight">
              How much is rent in {city}, {state}?
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              The average 1-bedroom rent in {city}, {state} is {fmt(avgFmr[1])}/month as of {dataYear}, based on HUD data across {zips.length} ZIP codes.
              {cheapestZip && maxFmr1br > (cheapestZip.fmr1br ?? avgFmr[1]) + 100
                ? ` Rents range from ${fmt(cheapestZip.fmr1br ?? avgFmr[1])} to ${fmt(maxFmr1br)} depending on neighborhood — a ${fmt(maxFmr1br - (cheapestZip.fmr1br ?? avgFmr[1]))}/month spread.`
                : ` Rents across ${city} are relatively uniform, clustering around ${fmt(avgFmr[1])}/month.`}
              {` To afford this at the 30% rule, a household would need approximately ${fmt(affordableIncome)}/year.`}
            </p>
          </div>

          {trendYoY !== null && (
            <div>
              <h2 className="font-display text-xl text-foreground mb-2 tracking-tight">
                Is rent going up in {city}?
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {trendYoY >= 0
                  ? `Rents in ${city} have increased ${trendYoY.toFixed(1)}% year over year based on ${trendAttribution}.`
                  : `Rents in ${city} have decreased ${Math.abs(trendYoY).toFixed(1)}% year over year based on ${trendAttribution}.`}
                {trendYoY > 5
                  ? ` This is a notably high rate of increase, indicating strong upward rent pressure in ${city}.`
                  : trendYoY > 0
                  ? ` This suggests a relatively stable rental market.`
                  : ` Declining rents may give renters leverage when negotiating renewals.`}
              </p>
            </div>
          )}

          <div>
            <h2 className="font-display text-xl text-foreground mb-2 tracking-tight">
              What is a fair rent increase in {city}?
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {trendYoY !== null
                ? `Based on ${trendAttribution}, a rent increase around ${Math.abs(trendYoY).toFixed(1)}% is in line with the ${city} market for ${dataYear}. An increase above that level exceeds the local trend and may be worth pushing back on.`
                : `Without strong local trend data for ${city}, a fair increase is best judged against the current 1-bedroom benchmark of ${fmt(avgFmr[1])}/month and comparable listings in your ZIP code.`}
              {rentControlInfo
                ? ` Note: ${rentControlInfo.jurisdiction} has rent increase protections${rentControlInfo.maxIncreaseFormula ? ` — the cap is generally ${rentControlInfo.maxIncreaseFormula}` : ''}.`
                : ''}
              {' '}Check your specific increase with RenewalReply's{' '}
              <Link to="/" className="text-primary hover:underline">free rent analysis tool</Link>.
            </p>
          </div>
        </section>

        {/* ═══ Section B: Rent Trends ═══ */}
        {hasMarketData && (
          <section className="mb-12">
            <h2 className="font-display text-2xl text-foreground mb-4 tracking-tight">Rent Trends in {city}</h2>
            <div className="rounded-lg border border-border p-6 bg-card">
              <RentTrendSummary location={city} trendYoY={trendYoY} alYoY={cityAlYoY} zoriYoY={cityZoriYoY} showHeadline precomputedResult={compositeTrendResult} />
            </div>
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
            HUD Fair Market Rents are federal rent benchmarks published annually by HUD. They provide a consistent baseline for comparing rents across areas.
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

        {/* RenterToolsCTA moved below FAQ */}

        {/* ═══ Section F: Rent Data by Zip Code ═══ */}
        <section id="section-zipcodes" className="mb-12">
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
          <h2 className="font-display text-2xl text-foreground mb-4 tracking-tight">Questions about rent in {city}</h2>
          <div className="space-y-6">
            {faqItems.map((f, i) => (
              <div key={i}>
                <h3 className="text-sm font-medium text-foreground">{f.q}</h3>
                <p className="text-sm text-muted-foreground mt-1">{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ═══ Rent Reporting CTA ═══ */}
        <div className="mt-6 mb-8">
          <RentReportingCTA zip={zips[0]?.zip} city={city} stateAbbr={state} pageType="city" />
        </div>

        {/* ═══ Renter Tools CTA ═══ */}
        <RenterToolsCTA zip={zips[0]?.zip} city={city} stateAbbr={state} pageType="city" />

        {/* ═══ Renter Guides ═══ */}
        <section className="mb-12">
          <h2 className="font-display text-2xl text-foreground mb-4 tracking-tight">Renter Guides</h2>
          <ul className="space-y-3">
            <li>
              <Link to="/guides/how-to-negotiate-rent-increase" className="text-sm text-primary hover:underline font-medium">How to Negotiate a Rent Increase →</Link>
              <p className="text-xs text-muted-foreground">A data-driven guide with free email templates for pushing back on your landlord.</p>
            </li>
            <li>
              <Link to="/guides/rent-increase-laws-by-state" className="text-sm text-primary hover:underline font-medium">Rent Increase Laws in {stateName} →</Link>
              <p className="text-xs text-muted-foreground">See notice rules, caps, and tenant protections in {stateName}.</p>
            </li>
            <li>
              <Link to="/guides/what-should-i-pay-for-rent" className="text-sm text-primary hover:underline font-medium">What Should I Pay for Rent? →</Link>
              <p className="text-xs text-muted-foreground">How to compare rent prices and know if you're getting a fair deal.</p>
            </li>
          </ul>
        </section>

        {/* Internal links */}
        <div className="mb-12 flex flex-col gap-2 text-sm">
          <Link to={`/rent-data/${stateSlugVal}`} className="text-primary underline hover:text-primary/80">← All cities in {stateName}</Link>
          <Link to="/rent-data" className="text-primary underline hover:text-primary/80">Browse all rent data →</Link>
        </div>

        {/* Disclaimer + freshness */}
        <p className="text-xs text-muted-foreground/60 italic mt-2">
          Market data updated monthly from public and third-party sources. Actual rents vary by unit, building, and lease terms. For informational purposes only — not legal or financial advice. <Link to="/methodology" className="underline hover:text-muted-foreground">See methodology →</Link>
        </p>
      </main>

      <SEOFooter onContactClick={() => setContactOpen(true)} />
      <ContactModal open={contactOpen} onOpenChange={setContactOpen} />
    </div>
  );
};

function unslugify(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function LoadingSkeleton({ stateSlug, citySlug }: { stateSlug?: string; citySlug?: string }) {
  const cityName = citySlug ? unslugify(citySlug) : '';
  const stateName = stateSlug ? unslugify(stateSlug) : '';
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {citySlug && stateSlug && (
        <SEO
          title={`Average Rent in ${cityName}, ${stateName} | RenewalReply`}
          description={`Rent data and fair market rent for ${cityName}, ${stateName}. See trends, zip codes, and federal benchmarks.`}
          canonical={`/rent-data/${stateSlug}/${citySlug}`}
        />
      )}
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
