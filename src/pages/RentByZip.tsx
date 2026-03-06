import { useParams, Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { getRentData, getApartmentListData, getHud50Data, type RentZipRaw, type ApartmentListZipRaw, type Hud50ZipRaw } from '@/data/dataLoader';
import { slugify, stateNameFromAbbr } from '@/data/cityStateUtils';
import { getRentControlForZip, getApplicableCap, isNycZip } from '@/data/rentControlData';
import { getDataFreshness, getFreshestDate, formatFreshnessDate, getHudFiscalYear, getDataYear, type DataFreshness } from '@/data/dataFreshness';
import RentcastMarketSection from '@/components/RentcastMarketSection';
import DhcrAlertSection from '@/components/DhcrAlertSection';
import RenterToolsCTA from '@/components/RenterToolsCTA';
import RentTrendSummary from '@/components/RentTrendSummary';
import WhatShouldRentCost from '@/components/WhatShouldRentCost';
import ShareDataButton from '@/components/ShareDataButton';
import DataPageFreshness from '@/components/DataPageFreshness';
import TrendDiscrepancyNote from '@/components/TrendDiscrepancyNote';
import OutlierFlag from '@/components/OutlierFlag';
import SEO from '@/components/SEO';
import SEOFooter from '@/components/SEOFooter';
import ContactModal from '@/components/ContactModal';
import PageNav from '@/components/PageNav';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

const BEDROOM_LABELS = ['Studio', '1-Bedroom', '2-Bedroom', '3-Bedroom', '4-Bedroom'];
const NATIONAL_AVG_YOY = 3.2;

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

interface ZipPageData {
  raw: RentZipRaw;
  al: ApartmentListZipRaw | null;
  hud50: Hud50ZipRaw | null;
  freshness: DataFreshness;
  nearby: { zip: string; raw: RentZipRaw }[];
  sameCity: { zip: string; raw: RentZipRaw }[];
  sameMetro: { zip: string; raw: RentZipRaw }[];
}

const RentByZip = () => {
  const { zip } = useParams<{ zip: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<ZipPageData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [contactOpen, setContactOpen] = useState(false);
  const [searchZip, setSearchZip] = useState('');

  useEffect(() => {
    if (!zip || zip.length !== 5) { setNotFound(true); setLoading(false); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setNotFound(false);
      const [allData, alData, hud50Data, freshness] = await Promise.all([
        getRentData(), getApartmentListData(), getHud50Data(), getDataFreshness()
      ]);
      if (cancelled) return;
      const raw = allData[zip];
      if (!raw) { setNotFound(true); setLoading(false); return; }

      const al = alData[zip] ?? null;
      const hud50 = hud50Data[zip] ?? null;

      const zipNum = parseInt(zip, 10);
      const nearby: { zip: string; raw: RentZipRaw }[] = [];
      for (let offset = 1; nearby.length < 5 && offset < 50; offset++) {
        for (const delta of [offset, -offset]) {
          const candidate = String(zipNum + delta).padStart(5, '0');
          if (allData[candidate] && candidate !== zip) {
            nearby.push({ zip: candidate, raw: allData[candidate] });
            if (nearby.length >= 5) break;
          }
        }
      }

      const sameCity: { zip: string; raw: RentZipRaw }[] = [];
      const sameMetro: { zip: string; raw: RentZipRaw }[] = [];
      const thisCity = raw.c?.toLowerCase();
      const thisState = raw.s?.toLowerCase();
      const thisMetro = raw.m?.toLowerCase();
      for (const [z, r] of Object.entries(allData)) {
        if (z === zip) continue;
        if (sameCity.length >= 5 && sameMetro.length >= 5) break;
        if (sameCity.length < 5 && r.c?.toLowerCase() === thisCity && r.s?.toLowerCase() === thisState) {
          sameCity.push({ zip: z, raw: r });
        } else if (sameMetro.length < 5 && r.m?.toLowerCase() === thisMetro && (r.c?.toLowerCase() !== thisCity || r.s?.toLowerCase() !== thisState)) {
          sameMetro.push({ zip: z, raw: r });
        }
      }

      setData({ raw, al, hud50, freshness, nearby, sameCity, sameMetro });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [zip]);

  if (loading) return <LoadingSkeleton />;
  if (notFound || !data || !zip) return <NotFoundPage zip={zip} />;

  const { raw, al, hud50, freshness, nearby, sameCity, sameMetro } = data;
  const city = raw.c || 'Unknown';
  const state = raw.s || '';
  const fmr1br = raw.f[1];
  const hasZillow = raw.zy !== undefined && raw.zy !== null;
  const hasAL = al !== null && al.aly !== undefined;
  const rentControl = getRentControlForZip(zip);
  const cap = getApplicableCap(rentControl);

  const stateSlug = slugify(stateNameFromAbbr(state));
  const citySlug = slugify(city);

  const heroRent = hud50?.f50?.[1] ?? fmr1br;
  const heroRentSource = hud50?.f50?.[1] ? 'HUD 50th Percentile' : 'HUD Fair Market Rent (40th Percentile)';
  const heroRentLabel = hud50?.f50?.[1] ? 'Estimated Rent' : 'Fair Market Rent';
  const heroRentLongLabel = hud50?.f50?.[1] ? 'HUD Estimated Rent (50th Percentile)' : 'Fair Market Rent (40th Percentile)';

  const trendYoY = al?.aly ?? raw.zy ?? (raw.p[1] > 0 ? Math.round(((raw.f[1] - raw.p[1]) / raw.p[1]) * 1000) / 10 : null);
  const trendSource = al?.aly !== undefined && al?.aly !== null
    ? 'Apartment List'
    : hasZillow ? 'Zillow ZORI' : 'HUD FMR';
  const hasMarketData = hasZillow || hasAL;
  const hasHud50 = hud50 !== null && hud50.f50 !== undefined && hud50.f50[1] > 0;
  const isThinPage = !hasMarketData && !hasHud50;

  const freshest = getFreshestDate(freshness, hasZillow, hasAL);
  const freshestFormatted = formatFreshnessDate(freshest.date);
  const dataYear = getDataYear(freshness);
  const hudFY = getHudFiscalYear(freshness);

  // Change 2: Compute YoY range when both AL and ZORI exist and differ by >1%
  const hasBothTrends = hasAL && al!.aly !== undefined && hasZillow;
  const alYoY = al?.aly ?? null;
  const zoriYoY = raw.zy ?? null;
  const trendsDiverge = hasBothTrends && alYoY !== null && zoriYoY !== null && Math.abs(alYoY - zoriYoY) > 1;
  const trendLow = trendsDiverge ? Math.min(alYoY!, zoriYoY!) : null;
  const trendHigh = trendsDiverge ? Math.max(alYoY!, zoriYoY!) : null;

  // Change 3: Verdict sentence — use range or single value
  const verdictTrendHigh = trendHigh ?? (trendYoY ?? NATIONAL_AVG_YOY);
  const verdictTrendLow = trendLow ?? verdictTrendHigh;

  // ─── OG-optimized meta ───
  const metaTitle = hasMarketData
    ? `Average Rent in ${zip} (${city}, ${state}) — ${dataYear} Data | RenewalReply`
    : `Fair Market Rent in ${zip} (${city}, ${state}) — FY${hudFY} | RenewalReply`;
  const ogTitle = `Average Rent in ${zip} — ${fmt(heroRent)}/mo (${dataYear})`;
  const metaDesc = `1-BR rents in ${zip} are ${fmt(heroRent)}/mo${trendYoY !== null ? `, ${trendYoY > 0 ? 'up' : 'down'} ${Math.abs(trendYoY).toFixed(1)}% year-over-year` : ''}. See federal benchmarks, trends, and nearby data for ${city}, ${state}.`;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEO
        title={metaTitle}
        description={metaDesc}
        canonical={`/rent/${zip}`}
        ogImage="/og-image.png"
        noindex={isThinPage}
        jsonLd={[
          {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.renewalreply.com/' },
              { '@type': 'ListItem', position: 2, name: 'Rent Data', item: 'https://www.renewalreply.com/rent-data' },
              { '@type': 'ListItem', position: 3, name: state, item: `https://www.renewalreply.com/rent-data/${stateSlug}` },
              { '@type': 'ListItem', position: 4, name: `${city}, ${state}`, item: `https://www.renewalreply.com/rent-data/${stateSlug}/${citySlug}` },
              { '@type': 'ListItem', position: 5, name: zip, item: `https://www.renewalreply.com/rent/${zip}` },
            ],
          },
          {
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: ogTitle,
            description: metaDesc,
            dateModified: freshest.date,
            url: `https://www.renewalreply.com/rent/${zip}`,
            publisher: { '@type': 'Organization', name: 'RenewalReply', url: 'https://www.renewalreply.com' },
          },
          {
            '@context': 'https://schema.org',
            '@type': 'Place',
            name: `${city}, ${state} (${zip})`,
            address: { '@type': 'PostalAddress', postalCode: zip, addressLocality: city, addressRegion: state, addressCountry: 'US' },
          },
          {
            '@context': 'https://schema.org',
            '@type': 'Dataset',
            name: hasMarketData ? `Rent Data for ${zip}` : `Fair Market Rent Data for ${zip}`,
            description: `Rent data and market trends for zip code ${zip} in ${city}, ${state}`,
            url: `https://www.renewalreply.com/rent/${zip}`,
            creator: { '@type': 'Organization', name: 'RenewalReply', url: 'https://www.renewalreply.com' },
            license: 'https://creativecommons.org/licenses/by/4.0/',
            temporalCoverage: '2026',
          },
          {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: [
              {
                '@type': 'Question',
                name: `What is the typical rent in ${zip}?`,
                acceptedAnswer: { '@type': 'Answer', text: `The typical rent for a 1-bedroom in zip code ${zip} is ${fmt(heroRent)}/month based on ${heroRentSource} data. Studio: ${fmt(hud50?.f50?.[0] ?? raw.f[0])}, 2-BR: ${fmt(hud50?.f50?.[2] ?? raw.f[2])}.` },
              },
              {
                '@type': 'Question',
                name: `How much has rent increased in ${city} (${zip})?`,
                acceptedAnswer: { '@type': 'Answer', text: trendYoY !== null ? `Rents in ${city} changed approximately ${trendYoY > 0 ? '+' : ''}${Math.abs(trendYoY).toFixed(1)}% year-over-year according to ${trendSource} data.` : `Year-over-year rent trend data is not currently available for ${zip}. The national average rent increase is approximately ${NATIONAL_AVG_YOY}%.` },
              },
              {
                '@type': 'Question',
                name: `What is the fair market rent for a 1-bedroom in ${zip}?`,
                acceptedAnswer: { '@type': 'Answer', text: `The HUD Small Area Fair Market Rent for a 1-bedroom in zip code ${zip} is ${fmt(fmr1br)} for FY2026. Studio: ${fmt(raw.f[0])}, 2-BR: ${fmt(raw.f[2])}, 3-BR: ${fmt(raw.f[3])}, 4-BR: ${fmt(raw.f[4])}.` },
              },
              {
                '@type': 'Question',
                name: `Is ${city} rent controlled?`,
                acceptedAnswer: { '@type': 'Answer', text: cap ? `Yes. ${cap.jurisdiction} has rent increase protections.${cap.maxIncreaseFormula ? ` The cap is generally ${cap.maxIncreaseFormula}.` : ''}${cap.applicability ? ` This applies to: ${cap.applicability}.` : ''}` : `No. There are no specific rent control laws covering ${city}, ${state} at this time. Landlords can raise rent by any amount with proper notice.` },
              },
            ],
          },
        ]}
      />

      {/* Noscript fallback */}
      <noscript>
        <div style={{ maxWidth: 800, margin: '0 auto', padding: 24, fontFamily: 'sans-serif' }}>
          <h1>{hasMarketData ? `Typical Rent in ${zip} — ${city}, ${state}` : `Fair Market Rent in ${zip} — ${city}, ${state}`}</h1>
          <p><strong>{`The typical 1-bedroom rent in ${zip} is ${fmt(heroRent)}/month based on ${heroRentSource} data.`}{trendYoY !== null ? ` Rents changed ${trendYoY > 0 ? '+' : ''}${trendYoY.toFixed(1)}% year-over-year (${trendSource}).` : ''}</strong></p>
          <p>{`Last updated: ${freshestFormatted}`}</p>
          <h2>{`HUD Fair Market Rent for ${zip}`}</h2>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead><tr><th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: 8 }}>Bedroom</th><th style={{ textAlign: 'right', borderBottom: '1px solid #ccc', padding: 8 }}>Fair Market Rent</th></tr></thead>
            <tbody>
              {BEDROOM_LABELS.map((label, i) => (
                <tr key={label}><td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{label}</td><td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{fmt(raw.f[i])}</td></tr>
              ))}
            </tbody>
          </table>
          <p><small>Source: HUD Small Area Fair Market Rents (SAFMR) FY2026</small></p>
          {nearby.length > 0 && (<><h2>Nearby Areas</h2><ul>{nearby.map(({ zip: nZip, raw: nRaw }) => (<li key={nZip}><a href={`https://www.renewalreply.com/rent/${nZip}`}>{nZip} — {nRaw.c || 'Unknown'}, {nRaw.s} — 1-BR: {fmt(nRaw.f[1])}</a></li>))}</ul></>)}
          <p><a href={`https://www.renewalreply.com/rent-data/${stateSlug}/${citySlug}`}>{`← ${city}, ${state} rent data`}</a></p>
          <p><a href="https://www.renewalreply.com/">Check if your rent increase is fair →</a></p>
        </div>
      </noscript>

      <PageNav ctaLink={`/?zip=${zip}`} />

      <main className="max-w-3xl mx-auto px-6 py-12 md:py-16 flex-1 w-full">
        {/* Breadcrumbs */}
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted-foreground">
          <ol className="flex flex-wrap items-center gap-1">
            <li><Link to="/" className="hover:text-foreground transition-colors">Home</Link></li>
            <li className="before:content-['›'] before:mx-1"><Link to="/rent-data" className="hover:text-foreground transition-colors">Rent Data</Link></li>
            <li className="before:content-['›'] before:mx-1"><Link to={`/rent-data/${stateSlug}`} className="hover:text-foreground transition-colors">{state}</Link></li>
            <li className="before:content-['›'] before:mx-1"><Link to={`/rent-data/${stateSlug}/${citySlug}`} className="hover:text-foreground transition-colors">{city}, {state}</Link></li>
            <li className="before:content-['›'] before:mx-1"><span aria-current="page">{zip}</span></li>
          </ol>
        </nav>

        {/* ═══ Section A: Hero — Verdict First ═══ */}
        <section className="mb-12">
          <div className="flex items-start justify-between gap-4">
            <h1 className="font-display text-3xl md:text-4xl text-foreground leading-tight tracking-tight" style={{ letterSpacing: '-0.02em' }}>
              {hasMarketData ? `Typical Rent in ${zip}` : `Fair Market Rent in ${zip}`} — {city}, {state}
            </h1>
            <ShareDataButton />
          </div>

          {/* Change 3: Verdict sentence first */}
          <p className="mt-6 text-[1.08rem] text-foreground/90 leading-relaxed font-medium">
            {trendsDiverge
              ? `Rents in ${city} have grown approximately ${trendLow! > 0 ? '+' : ''}${trendLow!.toFixed(1)}% – ${trendHigh! > 0 ? '+' : ''}${trendHigh!.toFixed(1)}% over the past year based on two independent sources. A rent increase above ${trendHigh!.toFixed(1)}% is above the local market trend.`
              : trendYoY !== null
                ? `Rents in ${city} have ${trendYoY >= 0 ? 'grown' : 'declined'} approximately ${trendYoY > 0 ? '+' : ''}${trendYoY.toFixed(1)}% over the past year. A rent increase above ${Math.abs(trendYoY).toFixed(1)}% is above the local market trend.`
                : `The national average rent increase is approximately ${NATIONAL_AVG_YOY}% year-over-year. A rent increase above ${NATIONAL_AVG_YOY}% is above the national market trend.`}
          </p>

          {/* Primary figure: Typical rent */}
          <div className="mt-5">
            <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">{heroRentLabel} · 1-Bedroom</p>
            <p className="text-5xl md:text-6xl font-bold tabular-nums text-foreground leading-none">{fmt(heroRent)}<span className="text-xl font-normal text-muted-foreground">/mo</span></p>
            <p className="text-xs text-muted-foreground/70 mt-2">Source: {heroRentSource}</p>
          </div>

          {/* Last updated */}
          <p className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent" />
            Last updated <time dateTime={freshest.date}>{freshestFormatted}</time>
          </p>

          {/* HUD-only note */}
          {!hasMarketData && (
            <p className="mt-3 text-sm text-muted-foreground bg-muted/40 border border-border rounded-lg px-4 py-3">
              📊 Market trend data is limited for this area. The analysis below uses federal rent benchmarks.
            </p>
          )}

          {/* Thin page note */}
          {isThinPage && (
            <p className="mt-2 text-sm text-muted-foreground bg-muted/40 border border-border rounded-lg px-4 py-3">
              This area has limited data coverage. For more detailed rent data, see the{' '}
              <Link to={`/rent-data/${stateSlug}/${citySlug}`} className="text-primary underline hover:no-underline">
                city-level analysis for {city}
              </Link>.
            </p>
          )}

          {/* CTA */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link to={`/?zip=${zip}`} className="inline-flex items-center bg-primary text-primary-foreground px-6 h-11 rounded-lg font-semibold hover:brightness-90 transition-all duration-150 shadow-sm shadow-primary/20">
              Check Your Rent Increase →
            </Link>
            <span className="text-muted-foreground text-sm hidden sm:inline">or</span>
            <form onSubmit={(e) => { e.preventDefault(); const t = searchZip.trim(); if (t.length === 5 && /^\d{5}$/.test(t)) { navigate(`/rent/${t}`); setSearchZip(''); } }} className="flex items-center gap-2">
              <Input type="text" inputMode="numeric" pattern="\d{5}" maxLength={5} placeholder="Other zip…" value={searchZip} onChange={(e) => setSearchZip(e.target.value.replace(/\D/g, '').slice(0, 5))} className="h-11 w-28" />
              <button type="submit" disabled={!/^\d{5}$/.test(searchZip)} className="bg-muted text-foreground px-4 h-11 rounded-lg text-sm font-semibold hover:bg-muted/80 transition-all duration-150 disabled:opacity-40">Go</button>
            </form>
          </div>
        </section>

        {/* ═══ What Should Rent Cost (stays visible) ═══ */}
        <WhatShouldRentCost
          location={`${zip} (${city})`}
          fmr={raw.f}
          hud50={hud50?.f50 ?? null}
          censusMedianRent={raw.r ?? null}
        />

        {/* ═══ Rentcast (stays visible — auto-loads if cached) ═══ */}
        <RentcastMarketSection zip={zip} city={city} state={state} />

        {/* ═══ DHCR ═══ */}
        <DhcrAlertSection zip={zip} city={city} />

        {/* ═══ Renter Tools CTA ═══ */}
        <RenterToolsCTA zip={zip} />

        {/* ═══ Change 3: Collapsible full market data — native <details> for SEO ═══ */}
        <section className="mb-12">
          <details className="group">
            <summary className="cursor-pointer font-display text-2xl text-foreground tracking-tight list-none flex items-center gap-2 select-none">
              <span className="transition-transform duration-200 group-open:rotate-90">▶</span>
              Full market data
            </summary>

            <div className="mt-6 space-y-10">
              {/* Rent Trends detail */}
              {(hasZillow || hasAL) && (
                <div>
                  <h3 className="font-display text-xl text-foreground mb-4 tracking-tight">Rent Trends in {city}, {state}</h3>
                  <div className="rounded-lg border border-border p-6 bg-card">
                    {/* Change 2: Range summary when both sources diverge */}
                    {trendsDiverge && (
                      <p className="text-sm font-medium text-foreground mb-4 bg-muted/40 border border-border rounded-lg px-4 py-3">
                        Local rents have grown approximately {trendLow! > 0 ? '+' : ''}{trendLow!.toFixed(1)}% – {trendHigh! > 0 ? '+' : ''}{trendHigh!.toFixed(1)}% over the past year based on two independent sources.
                      </p>
                    )}
                    <div className="flex flex-wrap gap-6">
                      {hasAL && al!.aly !== undefined && (
                        <div>
                          <p className="text-sm text-muted-foreground">Year-over-Year Trend (Apartment List)</p>
                          <p className={`text-2xl font-bold tabular-nums ${al!.aly! > 3 ? 'text-destructive' : al!.aly! < 0 ? 'text-accent' : 'text-foreground'}`}>{al!.aly! > 0 ? '+' : ''}{al!.aly!.toFixed(1)}%</p>
                          <OutlierFlag yoy={al!.aly!} />
                          {/* Change 5: AL metro disclosure */}
                          <p className="text-[11px] text-muted-foreground/60 mt-1">
                            Trend reflects county/metro-level data from Apartment List mapped to this ZIP.
                          </p>
                        </div>
                      )}
                      {hasZillow && (
                        <div>
                          <p className="text-sm text-muted-foreground">Year-over-Year Trend (Zillow ZORI)</p>
                          <p className={`text-2xl font-bold tabular-nums ${raw.zy! > 3 ? 'text-destructive' : raw.zy! < 0 ? 'text-accent' : 'text-foreground'}`}>{raw.zy! > 0 ? '+' : ''}{raw.zy!.toFixed(1)}%</p>
                          <OutlierFlag yoy={raw.zy!} />
                        </div>
                      )}
                      {hasZillow && raw.zm !== undefined && (
                        <div>
                          <p className="text-sm text-muted-foreground">Month-over-Month</p>
                          <p className="text-2xl font-bold tabular-nums">{raw.zm! > 0 ? '+' : ''}{raw.zm!.toFixed(1)}%</p>
                        </div>
                      )}
                      {hasAL && al!.alv !== undefined && al!.alv! > 0 && (
                        <div>
                          <p className="text-sm text-muted-foreground">Vacancy Rate</p>
                          <p className="text-2xl font-bold tabular-nums">{al!.alv!.toFixed(1)}%</p>
                        </div>
                      )}
                    </div>
                    <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
                      Rents in {zip} have {(trendYoY ?? 0) > 0 ? 'increased' : (trendYoY ?? 0) < 0 ? 'decreased' : 'remained flat'} by {Math.abs(trendYoY ?? 0).toFixed(1)}% over the past year, compared to the national average of {NATIONAL_AVG_YOY}%.
                    </p>
                    <RentTrendSummary location={`${zip} (${city})`} trendYoY={trendYoY} />
                    <TrendDiscrepancyNote alYoY={al?.aly ?? null} zoriYoY={raw.zy ?? null} />
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground/70">
                    Sources: {hasAL ? 'Apartment List transacted rent trends' : ''}{hasAL && hasZillow ? ', ' : ''}{hasZillow ? 'Zillow Observed Rent Index (ZORI)' : ''}
                  </p>
                </div>
              )}

              {/* HUD FMR Table */}
              <div>
                <h3 className="font-display text-xl text-foreground mb-4 tracking-tight">Federal Rent Benchmarks for {zip}</h3>
                <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                  HUD Fair Market Rents represent the 40th percentile of area rents, used as a federal benchmark for housing programs.
                  {raw.fs !== 'safmr' && raw.m && (
                    <span className="block mt-1 text-xs text-muted-foreground/80">
                      Note: These values represent the HUD metro-area benchmark for the {raw.m} area, not zip-specific rates.
                    </span>
                  )}
                </p>
                <div className="rounded-lg border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Bedroom Size</TableHead>
                        <TableHead className="text-right">Fair Market Rent (40th %ile)</TableHead>
                        {hud50 && <TableHead className="text-right">Typical Rent (50th %ile)</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {BEDROOM_LABELS.map((label, i) => {
                        if (raw.f[i] === 0) return null;
                        return (
                          <TableRow key={label}>
                            <TableCell className="font-medium">{label}</TableCell>
                            <TableCell className="text-right tabular-nums">{fmt(raw.f[i])}</TableCell>
                            {hud50 && <TableCell className="text-right tabular-nums">{hud50.f50?.[i] ? fmt(hud50.f50[i]) : '—'}</TableCell>}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                <p className="mt-3 text-xs text-muted-foreground/70">
                  Source: HUD {raw.fs === 'county' ? 'FMR' : 'SAFMR'} FY2026 · Updated <time dateTime={freshness.hud_safmr}>{formatFreshnessDate(freshness.hud_safmr)}</time>
                </p>
                {/* Change 4: Rural ZIP disclosure */}
                {(raw.fs === 'county' || (raw.fs !== 'safmr' && raw.fs !== undefined)) && (
                  <p className="mt-2 text-xs text-muted-foreground/70 bg-muted/30 border border-border rounded px-3 py-2">
                    Fair Market Rent shown is the county-level HUD benchmark. ZIP-specific data is not available for this area.
                  </p>
                )}
              </div>
            </div>
          </details>
        </section>

        {/* ═══ FAQ ═══ */}
        <section className="mb-12">
          <h2 className="font-display text-2xl text-foreground mb-4 tracking-tight">Frequently Asked Questions About Rent in {zip}</h2>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="avg">
              <AccordionTrigger>What is the typical rent in {zip}?</AccordionTrigger>
              <AccordionContent>
                <p className="text-muted-foreground leading-relaxed">
                  The {heroRentLabel.toLowerCase()} for a 1-bedroom in {zip} is {fmt(heroRent)}/month ({heroRentSource}).
                  {hud50?.f50 && ` The HUD 50th percentile (typical) rent is ${fmt(hud50.f50[1])}/mo, while the 40th percentile Fair Market Rent is ${fmt(fmr1br)}/mo.`}
                  {' '}For current asking rents from nearby listings, see the market data section above.
                </p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="cost">
              <AccordionTrigger>What should rent cost in {zip}?</AccordionTrigger>
              <AccordionContent>
                <p className="text-muted-foreground leading-relaxed">
                  A 1-bedroom in {zip} typically rents for {fmt(raw.f[1])} – {fmt(hud50?.f50?.[1] ?? Math.round(raw.f[1] * 1.15))} based on HUD data. See the "What Should Rent Cost" section above for all bedroom sizes.
                </p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="trend">
              <AccordionTrigger>How much has rent increased in {city} ({zip})?</AccordionTrigger>
              <AccordionContent>
                <p className="text-muted-foreground leading-relaxed">
                  {trendYoY !== null
                    ? `Rents in ${city} changed approximately ${trendYoY > 0 ? '+' : ''}${trendYoY.toFixed(1)}% year-over-year according to ${trendSource} data. The national average is approximately ${NATIONAL_AVG_YOY}%.`
                    : `Year-over-year rent trend data is not currently available for ${zip}. The national average rent increase is approximately ${NATIONAL_AVG_YOY}%.`}
                </p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="fmr">
              <AccordionTrigger>What is the HUD Fair Market Rent for a 1-bedroom in {zip}?</AccordionTrigger>
              <AccordionContent>
                <p className="text-muted-foreground leading-relaxed">
                  The HUD Small Area Fair Market Rent for a 1-bedroom in zip code {zip} is {fmt(fmr1br)} for FY2026. This represents the 40th percentile of area rents. Other bedroom sizes: Studio {fmt(raw.f[0])}, 2-BR {fmt(raw.f[2])}, 3-BR {fmt(raw.f[3])}, 4-BR {fmt(raw.f[4])}.
                </p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="control">
              <AccordionTrigger>Is {city} rent controlled?</AccordionTrigger>
              <AccordionContent>
                <p className="text-muted-foreground leading-relaxed">
                  {cap
                    ? `Yes. ${cap.jurisdiction} has rent increase protections.${cap.maxIncreaseFormula ? ` The cap is generally ${cap.maxIncreaseFormula}.` : ''}${cap.applicability ? ` This applies to: ${cap.applicability}.` : ''}`
                    : `No. There are no specific rent control laws covering ${city}, ${state} at this time. Landlords can raise rent by any amount with proper notice.`}
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </section>

        {/* ═══ Nearby Areas ═══ */}
        <section className="mb-12">
          {sameCity.length > 0 && (
            <>
              <h2 className="font-display text-2xl text-foreground mb-4 tracking-tight">Other Zip Codes in {city}, {state}</h2>
              <div className="rounded-lg border border-border overflow-hidden mb-8">
                <Table>
                  <TableHeader><TableRow><TableHead>Zip Code</TableHead><TableHead>Location</TableHead><TableHead className="text-right">1-BR Fair Market Rent</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {sameCity.map(({ zip: nZip, raw: nRaw }) => (
                      <TableRow key={nZip}>
                        <TableCell><Link to={`/rent/${nZip}`} className="text-primary underline hover:text-primary/80 font-medium">{nZip}</Link></TableCell>
                        <TableCell className="text-muted-foreground">{nRaw.c || 'Unknown'}, {nRaw.s}</TableCell>
                        <TableCell className="text-right tabular-nums">{nRaw.f[1] > 0 ? fmt(nRaw.f[1]) : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}

          {sameMetro.length > 0 && (
            <>
              <h2 className="font-display text-2xl text-foreground mb-4 tracking-tight">Nearby Areas</h2>
              <div className="rounded-lg border border-border overflow-hidden mb-8">
                <Table>
                  <TableHeader><TableRow><TableHead>Zip Code</TableHead><TableHead>Location</TableHead><TableHead className="text-right">1-BR Fair Market Rent</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {sameMetro.map(({ zip: nZip, raw: nRaw }) => (
                      <TableRow key={nZip}>
                        <TableCell><Link to={`/rent/${nZip}`} className="text-primary underline hover:text-primary/80 font-medium">{nZip}</Link></TableCell>
                        <TableCell className="text-muted-foreground">{nRaw.c || 'Unknown'}, {nRaw.s}</TableCell>
                        <TableCell className="text-right tabular-nums">{nRaw.f[1] > 0 ? fmt(nRaw.f[1]) : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}

          {sameCity.length === 0 && sameMetro.length === 0 && nearby.length > 0 && (
            <>
              <h2 className="font-display text-2xl text-foreground mb-4 tracking-tight">Nearby Areas</h2>
              <div className="rounded-lg border border-border overflow-hidden mb-8">
                <Table>
                  <TableHeader><TableRow><TableHead>Zip Code</TableHead><TableHead>Location</TableHead><TableHead className="text-right">1-BR Fair Market Rent</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {nearby.map(({ zip: nZip, raw: nRaw }) => (
                      <TableRow key={nZip}>
                        <TableCell><Link to={`/rent/${nZip}`} className="text-primary underline hover:text-primary/80 font-medium">{nZip}</Link></TableCell>
                        <TableCell className="text-muted-foreground">{nRaw.c || 'Unknown'}, {nRaw.s}</TableCell>
                        <TableCell className="text-right tabular-nums">{nRaw.f[1] > 0 ? fmt(nRaw.f[1]) : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}

          <div className="flex flex-col gap-2 text-sm">
            <Link to={`/rent-data/${stateSlug}/${citySlug}`} className="text-primary underline hover:text-primary/80">← More rent data in {city}</Link>
            <Link to={`/rent-data/${stateSlug}`} className="text-primary underline hover:text-primary/80">← More rent data in {stateNameFromAbbr(state)}</Link>
            <Link to="/rent-data" className="text-primary underline hover:text-primary/80">Browse all rent data →</Link>
          </div>
        </section>

        {/* Disclaimer + freshness */}
        <DataPageFreshness freshness={freshness} />
        <p className="mb-12 text-xs text-muted-foreground/60 italic leading-relaxed mt-2">
          Data reflects HUD FY2026 Fair Market Rent benchmarks and market data from Apartment List and Zillow. Actual rents vary by unit condition, building type, and lease terms. This is general market information, not legal or financial advice.
        </p>
      </main>

      {/* Data factsheet for AI extraction */}
      <div className="max-w-3xl mx-auto px-6 pb-4">
        <p className="text-sm text-muted-foreground/50">
          Zip code: {zip} | City: {city}, {state} | 1-BR {heroRentLabel}: {fmt(heroRent)}/mo | 2-BR: {fmt(hud50?.f50?.[2] ?? raw.f[2])}/mo | Sources: {trendSource}, HUD SAFMR FY2026
        </p>
      </div>

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
        <Skeleton className="h-6 w-48 mb-6" />
        <Skeleton className="h-10 w-3/4 mb-6" />
        <div className="flex gap-6 mb-8">
          <Skeleton className="h-20 w-40" />
          <Skeleton className="h-20 w-32" />
        </div>
        <Skeleton className="h-5 w-full mb-2" />
        <Skeleton className="h-5 w-2/3 mb-8" />
        <Skeleton className="h-48 w-full mb-8" />
        <div className="grid grid-cols-5 gap-3 mb-12">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
      </main>
    </div>
  );
}

function NotFoundPage({ zip }: { zip?: string }) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEO title={`Rent Data Not Found${zip ? ` for ${zip}` : ''} — RenewalReply`} noindex />
      <PageNav hideCta />
      <main className="flex-1 flex flex-col items-center justify-center text-center px-6">
        <h1 className="font-display text-3xl text-foreground mb-4">Zip Code Not Found</h1>
        <p className="text-muted-foreground mb-8">{zip ? `We don't have rent data for zip code ${zip} yet.` : 'Please enter a valid 5-digit zip code.'}</p>
        <Link to="/rent-data" className="text-primary hover:underline">← Browse all rent data</Link>
      </main>
      <SEOFooter />
    </div>
  );
}

export default RentByZip;
