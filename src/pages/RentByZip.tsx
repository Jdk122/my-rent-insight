import { useParams, Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { getRentData, type RentZipRaw } from '@/data/dataLoader';
import { slugify, stateNameFromAbbr } from '@/data/cityStateUtils';
import { getRentControlForZip, getApplicableCap, isNycZip } from '@/data/rentControlData';
import RentcastMarketSection from '@/components/RentcastMarketSection';
import DhcrAlertSection from '@/components/DhcrAlertSection';
import SEO from '@/components/SEO';
import SEOFooter from '@/components/SEOFooter';
import ContactModal from '@/components/ContactModal';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const BEDROOM_LABELS = ['Studio', '1-Bedroom', '2-Bedroom', '3-Bedroom', '4-Bedroom'];
const NATIONAL_AVG_YOY = 3.2; // approximate national average

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}


interface ZipPageData {
  raw: RentZipRaw;
  nearby: { zip: string; raw: RentZipRaw }[];
  sameCity: { zip: string; raw: RentZipRaw }[];
  sameMetro: { zip: string; raw: RentZipRaw }[];
}

// slugify moved to cityStateUtils

const RentByZip = () => {
  const { zip } = useParams<{ zip: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<ZipPageData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [contactOpen, setContactOpen] = useState(false);
  const [searchZip, setSearchZip] = useState('');

  useEffect(() => {
    if (!zip || zip.length !== 5) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setNotFound(false);
      const allData = await getRentData();
      if (cancelled) return;

      const raw = allData[zip];
      if (!raw) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      // Find nearby zips (numerically adjacent that exist)
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

      // Find same-city zips
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

      setData({ raw, nearby, sameCity, sameMetro });
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [zip]);

  // Meta tags are now handled by the <SEO> component below (imperative DOM manipulation)

  if (loading) return <LoadingSkeleton />;
  if (notFound || !data || !zip) return <NotFoundPage zip={zip} />;

  const { raw, nearby, sameCity, sameMetro } = data;
  const city = raw.c || 'Unknown';
  const state = raw.s || '';
  const fmr1br = raw.f[1];
  const hasZillow = raw.zy !== undefined && raw.zy !== null;
  const rentControl = getRentControlForZip(zip);
  const cap = getApplicableCap(rentControl);

  const stateSlug = slugify(stateNameFromAbbr(state));
  const citySlug = slugify(city);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEO
        title={`Fair Market Rent in ${zip} (${city}, ${state}) — FY2026 HUD Data | RenewalReply`}
        description={`${city} rent data for ${zip}: See how your rent increase compares to local trends, nearby listings, and HUD benchmarks across 6 data sources. | RenewalReply`}
        canonical={`/rent/${zip}`}
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
            '@type': 'Dataset',
            name: `Fair Market Rent Data for ${zip}`,
            description: `HUD Fair Market Rent (SAFMR FY2026) and local rent market data for zip code ${zip} in ${city}, ${state}`,
            url: `https://www.renewalreply.com/rent/${zip}`,
            creator: { '@type': 'Organization', name: 'RenewalReply', url: 'https://www.renewalreply.com' },
            license: 'https://creativecommons.org/licenses/by/4.0/',
            temporalCoverage: '2026',
            spatialCoverage: {
              '@type': 'Place',
              address: {
                '@type': 'PostalAddress',
                postalCode: zip,
                addressLocality: city,
                addressRegion: state,
                addressCountry: 'US',
              },
            },
            distribution: {
              '@type': 'DataDownload',
              encodingFormat: 'text/html',
              contentUrl: `https://www.renewalreply.com/rent/${zip}`,
            },
          },
          {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: [
              {
                '@type': 'Question',
                name: `What is the fair market rent for a 1-bedroom in ${zip}?`,
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: `The HUD Small Area Fair Market Rent for a 1-bedroom in zip code ${zip} is ${fmt(fmr1br)} for FY2026. Studio: ${fmt(raw.f[0])}, 2-BR: ${fmt(raw.f[2])}, 3-BR: ${fmt(raw.f[3])}, 4-BR: ${fmt(raw.f[4])}.`,
                },
              },
              {
                '@type': 'Question',
                name: `How much has rent increased in ${city} (${zip})?`,
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: hasZillow
                    ? `Rents in ${city} increased approximately ${Math.abs(raw.zy!).toFixed(1)}% year-over-year according to Zillow ZORI data.`
                    : `Year-over-year rent trend data is not currently available for ${zip}. The national average rent increase is approximately ${NATIONAL_AVG_YOY}%.`,
                },
              },
              {
                '@type': 'Question',
                name: `What is the average rent in ${zip}?`,
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: `The average rent for a 1-bedroom in ${zip} is ${fmt(fmr1br)} based on HUD Fair Market Rent benchmarks for FY2026.`,
                },
              },
              {
                '@type': 'Question',
                name: `Is ${city} rent controlled?`,
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: cap
                    ? `Yes. ${cap.jurisdiction} has rent increase protections. ${cap.maxIncreaseFormula ? `The cap is generally ${cap.maxIncreaseFormula}.` : ''} ${cap.applicability ? `This applies to: ${cap.applicability}.` : ''}`
                    : `No. There are no specific rent control laws covering ${city}, ${state} at this time. Landlords can raise rent by any amount with proper notice.`,
                },
              },
              {
                '@type': 'Question',
                name: `Is my rent increase fair in ${zip}?`,
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: `Use the free RenewalReply rent check tool to compare your proposed increase to HUD fair market rent and local market trends for ${zip}.`,
                },
              },
            ],
          },
        ]}
      />

      {/* Noscript fallback for crawlers */}
      <noscript>
        <div style={{ maxWidth: 800, margin: '0 auto', padding: 24, fontFamily: 'sans-serif' }}>
          <h1>{`Fair Market Rent in ${zip} — ${city}, ${state}`}</h1>
          <p><strong>{`In zip code ${zip}, the HUD fair market rent for a 1-bedroom is ${fmt(fmr1br)}/month (FY2026).`}{hasZillow ? ` Rents in this area ${raw.zy! > 0 ? 'increased' : raw.zy! < 0 ? 'decreased' : 'remained flat'} ${Math.abs(raw.zy!).toFixed(1)}% year-over-year. A rent increase above ${Math.abs(raw.zy!).toFixed(1)}% is above the local market trend.` : ''}{` Studio: ${fmt(raw.f[0])}, 2-BR: ${fmt(raw.f[2])}, 3-BR: ${fmt(raw.f[3])}, 4-BR: ${fmt(raw.f[4])}.`}</strong></p>
          <p>{`Data sourced from HUD Fair Market Rents and 50th Percentile Rents, Apartment List, Zillow ZORI and ZHVI, and Rentcast.`}</p>

          <h2>{`HUD Fair Market Rent for ${zip}`}</h2>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr><th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: 8 }}>Bedroom Size</th><th style={{ textAlign: 'right', borderBottom: '1px solid #ccc', padding: 8 }}>FMR Monthly Rent</th></tr>
            </thead>
            <tbody>
              {BEDROOM_LABELS.map((label, i) => (
                <tr key={label}><td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{label}</td><td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{fmt(raw.f[i])}</td></tr>
              ))}
            </tbody>
          </table>
          <p><small>Source: HUD Small Area Fair Market Rents (SAFMR) FY2026</small></p>

          {hasZillow && (
            <>
              <h2>{`Rent Trends in ${city}, ${state}`}</h2>
              <p>{`Year-over-Year change: ${raw.zy! > 0 ? '+' : ''}${raw.zy!.toFixed(1)}%. Rents in ${zip} have ${raw.zy! > 0 ? 'increased' : raw.zy! < 0 ? 'decreased' : 'remained flat'} by ${Math.abs(raw.zy!).toFixed(1)}% over the past year.`}</p>
            </>
          )}


          <h2>{`Frequently Asked Questions About Rent in ${zip}`}</h2>
          <h3>{`What is the fair market rent for a 1-bedroom in ${zip}?`}</h3>
          <p>{`The HUD Small Area Fair Market Rent for a 1-bedroom in zip code ${zip} is ${fmt(fmr1br)} for FY2026. Studio: ${fmt(raw.f[0])}, 2-BR: ${fmt(raw.f[2])}, 3-BR: ${fmt(raw.f[3])}, 4-BR: ${fmt(raw.f[4])}.`}</p>
          <h3>{`How much has rent increased in ${city} (${zip})?`}</h3>
          <p>{hasZillow ? `Rents in ${city} increased approximately ${Math.abs(raw.zy!).toFixed(1)}% year-over-year according to Zillow ZORI data.` : `Year-over-year rent trend data is not currently available for ${zip}. The national average rent increase is approximately ${NATIONAL_AVG_YOY}%.`}</p>
          <h3>{`What is the average rent in ${zip}?`}</h3>
          <p>{`The average rent for a 1-bedroom in ${zip} is ${fmt(fmr1br)} based on HUD Fair Market Rent benchmarks for FY2026.`}</p>
          <h3>{`Is ${city} rent controlled?`}</h3>
          <p>{cap ? `Yes. ${cap.jurisdiction} has rent increase protections. ${cap.maxIncreaseFormula ? `The cap is generally ${cap.maxIncreaseFormula}.` : ''}` : `No. There are no specific rent control laws covering ${city}, ${state} at this time.`}</p>
          <h3>{`Is my rent increase fair in ${zip}?`}</h3>
          <p>{`Use our free rent check tool to compare your proposed increase to HUD fair market rent for ${zip}.`} <a href={`https://www.renewalreply.com/?zip=${zip}`}>Check now</a></p>

          {nearby.length > 0 && (
            <>
              <h2>Nearby Zip Codes</h2>
              <ul>
                {nearby.map(({ zip: nZip, raw: nRaw }) => (
                  <li key={nZip}><a href={`https://www.renewalreply.com/rent/${nZip}`}>{nZip} — {nRaw.c || 'Unknown'}, {nRaw.s} — 1-BR FMR: {fmt(nRaw.f[1])}</a></li>
                ))}
              </ul>
            </>
          )}

          <p><a href="https://www.renewalreply.com/">← Back to RenewalReply Homepage</a></p>
        </div>
      </noscript>

      {/* Nav */}
      <nav className="sticky top-0 z-[60] flex items-center justify-between px-6 py-4 bg-card" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <Link to="/" className="font-display text-xl font-bold text-primary tracking-tight" style={{ letterSpacing: '-0.02em' }}>
          Renewal<span className="font-normal text-accent">Reply</span>
        </Link>
        <Link
          to={`/?zip=${zip}`}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-[13px] font-semibold hover:brightness-90 transition-all duration-150 shadow-sm shadow-primary/20"
        >
          Check your rent →
        </Link>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-12 md:py-16 flex-1 w-full">
        {/* Visible breadcrumbs */}
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted-foreground">
          <ol className="flex flex-wrap items-center gap-1">
            <li><Link to="/" className="hover:text-foreground transition-colors">Home</Link></li>
            <li className="before:content-['›'] before:mx-1"><Link to="/rent-data" className="hover:text-foreground transition-colors">Rent Data</Link></li>
            <li className="before:content-['›'] before:mx-1"><Link to={`/rent-data/${stateSlug}`} className="hover:text-foreground transition-colors">{state}</Link></li>
            <li className="before:content-['›'] before:mx-1"><Link to={`/rent-data/${stateSlug}/${citySlug}`} className="hover:text-foreground transition-colors">{city}, {state}</Link></li>
            <li className="before:content-['›'] before:mx-1"><span aria-current="page">{zip}</span></li>
          </ol>
        </nav>

        {/* SECTION 1 — Hero */}
        <section className="mb-12">
          <h1 className="font-display text-3xl md:text-4xl text-foreground leading-tight tracking-tight" style={{ letterSpacing: '-0.02em' }}>
            Fair Market Rent in {zip} — {city}, {state}
          </h1>

          {/* AI-extractable answer block */}
          <p className="mt-4 text-[1.08rem] text-foreground/90 leading-relaxed font-medium" data-nosnippet="false">
            In zip code {zip}, the HUD fair market rent for a 1-bedroom is {fmt(raw.f[1])}/month (FY2026).
            {hasZillow
              ? ` Rents in this area ${raw.zy! > 0 ? 'increased' : raw.zy! < 0 ? 'decreased' : 'remained flat'} ${Math.abs(raw.zy!).toFixed(1)}% year-over-year. A rent increase above ${Math.abs(raw.zy!).toFixed(1)}% is above the local market trend.`
              : ` The national average rent increase is approximately ${NATIONAL_AVG_YOY}% year-over-year.`}
            {' '}Studio: {fmt(raw.f[0])}, 2-BR: {fmt(raw.f[2])}, 3-BR: {fmt(raw.f[3])}, 4-BR: {fmt(raw.f[4])}.
          </p>

          <p className="mt-2 text-muted-foreground leading-relaxed" style={{ fontSize: '1.05rem' }}>
            See how rents in {zip} compare to HUD fair market rent benchmarks across six data sources: HUD Fair Market Rents and 50th Percentile Rents, Apartment List transacted rent trends, Zillow ZORI and ZHVI for market momentum, and Rentcast real-time comparable listings.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              to={`/?zip=${zip}`}
              className="inline-flex items-center bg-primary text-primary-foreground px-6 h-11 rounded-lg font-semibold hover:brightness-90 transition-all duration-150 shadow-sm shadow-primary/20"
            >
              Check your rent in {zip} →
            </Link>
            <span className="text-muted-foreground text-sm hidden sm:inline">or</span>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const trimmed = searchZip.trim();
                if (trimmed.length === 5 && /^\d{5}$/.test(trimmed)) {
                  navigate(`/rent/${trimmed}`);
                  setSearchZip('');
                }
              }}
              className="flex items-center gap-2"
            >
              <Input
                type="text"
                inputMode="numeric"
                pattern="\d{5}"
                maxLength={5}
                placeholder="Other zip…"
                value={searchZip}
                onChange={(e) => setSearchZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
                className="h-11 w-28"
              />
              <button
                type="submit"
                disabled={!/^\d{5}$/.test(searchZip)}
                className="bg-muted text-foreground px-4 h-11 rounded-lg text-sm font-semibold hover:bg-muted/80 transition-all duration-150 disabled:opacity-40"
              >
                Go
              </button>
            </form>
          </div>
          <Link to={`/rent-data/${stateSlug}/${citySlug}`} className="inline-block mt-4 text-sm text-primary hover:underline">
            See all rent data for {city} →
          </Link>
        </section>

        {/* SECTION 2 — HUD FMR Table */}
        <section className="mb-12">
          <h2 className="font-display text-2xl text-foreground mb-4 tracking-tight">HUD Fair Market Rent for {zip}</h2>
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bedroom Size</TableHead>
                  <TableHead className="text-right">FMR Monthly Rent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {BEDROOM_LABELS.map((label, i) => (
                  <TableRow key={label}>
                    <TableCell className="font-medium">{label}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(raw.f[i])}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Source: HUD Small Area Fair Market Rents (SAFMR) FY2026
          </p>
        </section>

        {/* SECTION 2.5 — DHCR Rent Stabilization Alert (NYC only) */}
        <DhcrAlertSection zip={zip} city={city} />

        {/* SECTION 3 — Market Context (Zillow) */}
        {hasZillow && (
          <section className="mb-12">
            <h2 className="font-display text-2xl text-foreground mb-4 tracking-tight">Rent Trends in {city}, {state}</h2>
            <div className="rounded-lg border border-border p-6 bg-card">
              <div className="flex flex-wrap gap-6">
                {raw.zm !== undefined && (
                  <div>
                    <p className="text-sm text-muted-foreground">Month-over-Month</p>
                    <p className="text-2xl font-bold tabular-nums">{raw.zm! > 0 ? '+' : ''}{raw.zm!.toFixed(1)}%</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Year-over-Year</p>
                  <p className="text-2xl font-bold tabular-nums">
                    {raw.zy! > 0 ? '↑' : raw.zy! < 0 ? '↓' : '→'} {raw.zy! > 0 ? '+' : ''}{raw.zy!.toFixed(1)}%
                  </p>
                </div>
              </div>
              <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
                Rents in {zip} have {raw.zy! > 0 ? 'increased' : raw.zy! < 0 ? 'decreased' : 'remained flat'} by {Math.abs(raw.zy!).toFixed(1)}% over the past year, compared to the national average of {NATIONAL_AVG_YOY}%.
              </p>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Source: Zillow Observed Rent Index (ZORI)</p>
          </section>
        )}

        {/* SECTION 3.5 — Rentcast Market Rents */}
        <RentcastMarketSection zip={zip} city={city} state={state} />

        {/* SECTION 4 — How RenewalReply Works */}
        <section className="mb-12">
          <h2 className="font-display text-2xl text-foreground mb-4 tracking-tight">How RenewalReply Works</h2>
          <p className="text-muted-foreground leading-relaxed text-sm">
            RenewalReply cross-references six independent data sources — HUD Fair Market Rents and 50th Percentile Rents, Apartment List transacted rent trends, Zillow ZORI and ZHVI market data, and Rentcast real-time listings — to score your rent increase across four components: trend comparison, comparable rents, increase reasonableness, and market momentum.
          </p>
        </section>

        {/* Data summary for AI extraction */}
        <p className="mb-12 text-sm text-muted-foreground">
          Zip code: {zip} | City: {city}, {state} | 1-BR FMR: {fmt(raw.f[1])}/mo | Sources: HUD SAFMR FY2026, Apartment List, Zillow, Rentcast
        </p>

        {/* SECTION 5 — FAQ */}
        <section className="mb-12">
          <h2 className="font-display text-2xl text-foreground mb-4 tracking-tight">Frequently Asked Questions About Rent in {zip}</h2>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="fmr">
              <AccordionTrigger>What is the fair market rent for a 1-bedroom in {zip}?</AccordionTrigger>
              <AccordionContent>
                <p className="text-muted-foreground leading-relaxed">
                  The HUD Small Area Fair Market Rent for a 1-bedroom in zip code {zip} is {fmt(fmr1br)} for FY2026.
                  This represents what HUD considers a moderately-priced rental in this area.
                  Other bedroom sizes: Studio {fmt(raw.f[0])}, 2-BR {fmt(raw.f[2])}, 3-BR {fmt(raw.f[3])}, 4-BR {fmt(raw.f[4])}.
                </p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="trend">
              <AccordionTrigger>How much has rent increased in {city} ({zip})?</AccordionTrigger>
              <AccordionContent>
                <p className="text-muted-foreground leading-relaxed">
                  {hasZillow
                    ? `Rents in ${city} increased approximately ${Math.abs(raw.zy!).toFixed(1)}% year-over-year according to Zillow ZORI data. ${raw.zy! > 0 ? 'This means rents are rising.' : raw.zy! < 0 ? 'This means rents are declining.' : 'Rents have remained flat.'} The national average is approximately ${NATIONAL_AVG_YOY}%.`
                    : `Year-over-year rent trend data is not currently available for ${zip}. The national average rent increase is approximately ${NATIONAL_AVG_YOY}%.`
                  }
                </p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="avg">
              <AccordionTrigger>What is the average rent in {zip}?</AccordionTrigger>
              <AccordionContent>
                <p className="text-muted-foreground leading-relaxed">
                  The average rent for a 1-bedroom in {zip} is {fmt(fmr1br)} based on HUD Fair Market Rent benchmarks for FY2026.
                  {' '}For current asking rents from nearby listings, see the market data section above.
                </p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="control">
              <AccordionTrigger>Is {city} rent controlled?</AccordionTrigger>
              <AccordionContent>
                <p className="text-muted-foreground leading-relaxed">
                  {cap
                    ? `Yes. ${cap.jurisdiction} has rent increase protections. ${cap.maxIncreaseFormula ? `The cap is generally ${cap.maxIncreaseFormula}.` : ''} ${cap.applicability ? ` This applies to: ${cap.applicability}.` : ''}`
                    : `No. There are no specific rent control laws covering ${city}, ${state} at this time. Landlords can raise rent by any amount with proper notice.`
                  }
                </p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="check">
              <AccordionTrigger>Is my rent increase fair in {zip}?</AccordionTrigger>
              <AccordionContent>
                <p className="text-muted-foreground leading-relaxed">
                  Enter your address, current rent, and proposed increase. We compare your increase against local rent trends from Apartment List lease transaction data, real nearby rental listings with actual prices from Rentcast, HUD reference rent benchmarks including the 50th percentile median, and market momentum signals from Zillow. Your Fairness Score is a weighted composite of four components: how your increase compares to local rent trends (35 points), how your proposed rent compares to nearby units (30 points), whether your rent is reasonable relative to area benchmarks (25 points), and market momentum (10 points). <Link to={`/?zip=${zip}`} className="underline text-primary hover:text-primary/80">Try it free</Link>.
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </section>

        {/* SECTION 6 — Related Zip Codes */}
        <section className="mb-12">
          {sameCity.length > 0 && (
            <>
              <h2 className="font-display text-2xl text-foreground mb-4 tracking-tight">Other zip codes in {city}, {state}</h2>
              <div className="rounded-lg border border-border overflow-hidden mb-8">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Zip Code</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead className="text-right">1-BR FMR</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sameCity.map(({ zip: nZip, raw: nRaw }) => (
                      <TableRow key={nZip}>
                        <TableCell>
                          <Link to={`/rent/${nZip}`} className="text-primary underline hover:text-primary/80 font-medium">{nZip}</Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{nRaw.c || 'Unknown'}, {nRaw.s}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmt(nRaw.f[1])}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}

          {sameMetro.length > 0 && (
            <>
              <h2 className="font-display text-2xl text-foreground mb-4 tracking-tight">Nearby metro area</h2>
              <div className="rounded-lg border border-border overflow-hidden mb-8">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Zip Code</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead className="text-right">1-BR FMR</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sameMetro.map(({ zip: nZip, raw: nRaw }) => (
                      <TableRow key={nZip}>
                        <TableCell>
                          <Link to={`/rent/${nZip}`} className="text-primary underline hover:text-primary/80 font-medium">{nZip}</Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{nRaw.c || 'Unknown'}, {nRaw.s}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmt(nRaw.f[1])}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}

          {/* Fallback: numerically adjacent if no city/metro matches */}
          {sameCity.length === 0 && sameMetro.length === 0 && nearby.length > 0 && (
            <>
              <h2 className="font-display text-2xl text-foreground mb-4 tracking-tight">Nearby Zip Codes</h2>
              <div className="rounded-lg border border-border overflow-hidden mb-8">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Zip Code</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead className="text-right">1-BR FMR</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {nearby.map(({ zip: nZip, raw: nRaw }) => (
                      <TableRow key={nZip}>
                        <TableCell>
                          <Link to={`/rent/${nZip}`} className="text-primary underline hover:text-primary/80 font-medium">{nZip}</Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{nRaw.c || 'Unknown'}, {nRaw.s}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmt(nRaw.f[1])}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}

          {/* Hub links */}
          <div className="flex flex-col gap-2 text-sm">
            <Link to="/rent-data" className="text-primary underline hover:text-primary/80">Browse all rent data →</Link>
          </div>
        </section>

        {/* Inline disclaimer */}
        <p className="mb-12 text-xs text-muted-foreground/70 italic leading-relaxed">
          Data reflects HUD FY2026 fair market rent benchmarks. Actual rents vary by unit condition, building type, and lease terms. This is general market information, not legal or financial advice.
        </p>

        {/* SECTION 7 — Bottom CTA */}
        <section className="text-center py-10">
          <h2 className="font-display text-2xl text-foreground mb-3 tracking-tight">
            Is your rent increase fair in {zip}?
          </h2>
          <p className="text-muted-foreground mb-6">Check now — it's free.</p>
          <Link
            to={`/?zip=${zip}`}
            className="inline-block bg-primary text-primary-foreground px-8 py-3 rounded-lg font-semibold hover:brightness-90 transition-all duration-150 shadow-sm shadow-primary/20"
          >
            Check my rent →
          </Link>
        </section>
      </main>

      {/* Data factsheet for AI extraction */}
      <div className="max-w-3xl mx-auto px-6 pb-4">
        <p className="text-sm text-muted-foreground/50">
          {[
            `Zip code: ${zip}`,
            `City: ${city}, ${state}`,
            `1-BR FMR: ${fmt(raw.f[1])}/mo`,
            `2-BR FMR: ${fmt(raw.f[2])}/mo`,
          ].join(' | ')}
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
        <Skeleton className="h-10 w-3/4 mb-4" />
        <Skeleton className="h-5 w-full mb-2" />
        <Skeleton className="h-5 w-2/3 mb-8" />
        <Skeleton className="h-12 w-64 rounded-lg mb-12" />
        <Skeleton className="h-8 w-1/2 mb-4" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </main>
    </div>
  );
}

function NotFoundPage({ zip }: { zip?: string }) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEO title="Zip Code Not Found | RenewalReply" noindex />
      <nav className="sticky top-0 z-[60] flex items-center justify-between px-6 py-4 bg-card" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <Link to="/" className="font-display text-xl font-bold text-primary tracking-tight" style={{ letterSpacing: '-0.02em' }}>
          Renewal<span className="font-normal text-accent">Reply</span>
        </Link>
      </nav>
      <main className="max-w-xl mx-auto px-6 py-24 flex-1 text-center">
        <h1 className="font-display text-3xl text-foreground mb-4">Zip code not found</h1>
        <p className="text-muted-foreground mb-8 leading-relaxed">
          We don't have data for {zip ? `zip code ${zip}` : 'this zip code'} yet. Try checking your rent increase on our homepage.
        </p>
        <Link
          to="/"
          className="inline-block bg-primary text-primary-foreground px-6 py-3 rounded-lg font-semibold hover:brightness-90 transition-all duration-150"
        >
          Go to homepage →
        </Link>
      </main>
      <SEOFooter />
    </div>
  );
}

export default RentByZip;
