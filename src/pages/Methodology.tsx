import { useState } from 'react';
import { Link } from 'react-router-dom';
import SEO from '@/components/SEO';
import SEOFooter from '@/components/SEOFooter';
import ContactModal from '@/components/ContactModal';
import PageNav from '@/components/PageNav';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const ScoreTier = ({ range, label, color }: { range: string; label: string; color: string }) => (
  <div className="flex items-center gap-3 py-1.5">
    <span className="text-[13px] font-mono tabular-nums text-muted-foreground w-[52px]">{range}</span>
    <span className={`text-[13px] font-semibold ${color}`}>{label}</span>
  </div>
);

const DataSource = ({ name, description, frequency }: { name: string; description: string; frequency: string }) => (
  <div className="py-3 border-b border-border/50 last:border-0">
    <h3 className="text-[14px] font-semibold text-foreground mb-1">{name}</h3>
    <p className="text-[13px] text-muted-foreground leading-relaxed">{description}</p>
    <p className="text-[11px] text-muted-foreground/60 mt-1">Update frequency: {frequency}</p>
  </div>
);

const Methodology = () => {
  const [contactOpen, setContactOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <SEO
        title="How RenewalReply Works — Methodology & Data Sources"
        description="Learn how RenewalReply's Fairness Score analyzes rent increases using HUD rents, Apartment List trends, Zillow ZORI, live market comps, and Census data."
        canonical="/methodology"
      />

      <noscript>
        <div style={{ maxWidth: 640, margin: '0 auto', padding: 24, fontFamily: 'sans-serif' }}>
          <h1>How RenewalReply Works</h1>
          <p>We believe renters deserve the same data landlords use. Here's exactly how we analyze your rent increase.</p>

          <h2>How the Fairness Score Works</h2>
          <p>The RenewalReply Fairness Score is a 0–100 composite score from multiple independently weighted components:</p>
          <ul>
            <li>Rent Increase vs. Market Trend — Compares your increase to year-over-year rent trends using multiple independent market data sources.</li>
            <li>Comparable Rents — Measures your proposed rent against the median asking rent for similar units nearby using real-time listing data.</li>
            <li>Increase Reasonableness — Evaluates against multiple federal and market data benchmarks.</li>
            <li>Market Momentum — Captures month-over-month direction from market data sources.</li>
          </ul>

          <h2>Score Tiers</h2>
          <ul>
            <li>80–100: Excellent</li>
            <li>60–79: Fair</li>
            <li>40–59: Moderate</li>
            <li>20–39: Unfair</li>
            <li>0–19: Excessive</li>
          </ul>

          <h2>Data Sources</h2>
          <ul>
            <li>HUD Small Area Fair Market Rents (SAFMR) — Annual, FY2026</li>
            <li>HUD 50th Percentile Rents — Annual, FY2026</li>
            <li>Apartment List — Monthly lease transaction trends</li>
            <li>Zillow Observed Rent Index (ZORI) — Monthly</li>
            <li>Zillow Home Value Index (ZHVI) — Monthly</li>
            <li>Real-time comparable listings — Live market data</li>
          </ul>

          <h2>Limitations</h2>
          <p>Score accuracy depends on data availability. Urban areas have richer coverage. Components marked "estimated" use proxy data. Counter-offer ranges are suggestions, not guarantees. Not legal or financial advice.</p>

          <p><a href="https://www.renewalreply.com/">Check if your rent increase is fair →</a></p>
        </div>
      </noscript>

      <PageNav />

      <main className="max-w-[640px] mx-auto px-6 py-16 w-full">
        <h1 className="font-display text-[28px] font-semibold tracking-tight mb-3" style={{ letterSpacing: '-0.02em' }}>
          How RenewalReply Works
        </h1>
        <p className="text-[15px] text-muted-foreground leading-relaxed mb-10">
          We believe renters deserve the same data landlords use. Here's exactly how we analyze your rent increase.
        </p>

        <Accordion type="multiple" defaultValue={['score']} className="space-y-1">
          {/* Section 1: Fairness Score */}
          <AccordionItem value="score" className="border border-border/60 rounded-lg px-5 data-[state=open]:bg-card/50">
            <AccordionTrigger className="text-[16px] font-semibold text-foreground py-4 hover:no-underline">
              How the Fairness Score Works
            </AccordionTrigger>
            <AccordionContent className="pb-5">
              <div className="space-y-5 text-[13px] leading-relaxed text-muted-foreground">
                <p>
                  The RenewalReply Fairness Score™ is a 0–100 composite score calculated from multiple independently weighted components. Each measures a different dimension of whether your rent increase is reasonable.
                </p>

                <div className="space-y-3">
                  <div className="p-3 rounded-md bg-secondary/40">
                    <span className="text-[13px] font-semibold text-foreground block mb-1">Rent Increase vs. Market Trend</span>
                    <p>Compares your rent increase percentage to the year-over-year rent trend in your area using multiple independent market data sources.</p>
                  </div>

                  <div className="p-3 rounded-md bg-secondary/40">
                    <span className="text-[13px] font-semibold text-foreground block mb-1">Comparable Rents</span>
                    <p>Measures whether your proposed rent is above or below the median asking rent for similar units nearby, using real-time listing data filtered by distance and similarity to your unit.</p>
                  </div>

                  <div className="p-3 rounded-md bg-secondary/40">
                    <span className="text-[13px] font-semibold text-foreground block mb-1">Increase Reasonableness</span>
                    <p>Evaluates whether your proposed rent is reasonable relative to area benchmarks from multiple federal and market data sources.</p>
                  </div>

                  <div className="p-3 rounded-md bg-secondary/40">
                    <span className="text-[13px] font-semibold text-foreground block mb-1">Market Momentum</span>
                    <p>Captures the direction rents are heading month-over-month in your area to account for whether the market is rising, steady, or cooling.</p>
                  </div>
                </div>

                <div className="p-3 rounded-md bg-muted/30 border border-border/40">
                  <p className="text-[12px] text-muted-foreground leading-relaxed">
                    <strong className="text-foreground">Dynamic weights:</strong> Component weights are dynamically adjusted based on data availability and reliability for your specific location to ensure the most accurate result possible.
                  </p>
                </div>

                <div className="pt-3 border-t border-border/40">
                  <p className="text-[13px] font-semibold text-foreground mb-2">Score Tiers</p>
                  <ScoreTier range="80–100" label="Excellent" color="text-verdict-good" />
                  <ScoreTier range="60–79" label="Fair" color="text-verdict-fair" />
                  <ScoreTier range="40–59" label="Moderate" color="text-accent-amber" />
                  <ScoreTier range="20–39" label="Unfair" color="text-destructive" />
                  <ScoreTier range="0–19" label="Excessive" color="text-destructive" />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Section 2: Data Sources */}
          <AccordionItem value="sources" className="border border-border/60 rounded-lg px-5 data-[state=open]:bg-card/50">
            <AccordionTrigger className="text-[16px] font-semibold text-foreground py-4 hover:no-underline">
              Data Sources
            </AccordionTrigger>
            <AccordionContent className="pb-5">
              <div className="text-[13px] text-muted-foreground leading-relaxed">
                <p className="mb-4">RenewalReply combines multiple independent data sources to build a complete picture of your local rental market.</p>
                <DataSource
                  name="HUD Small Area Fair Market Rents (SAFMR)"
                  description="ZIP-level rent benchmarks representing the 40th percentile of standard quality rental housing, specific to bedroom count. Published by the U.S. Department of Housing and Urban Development."
                  frequency="Annual (October) — Currently FY2026"
                />
                <DataSource
                  name="HUD 50th Percentile Rents"
                  description="County-level median rent reference mapped to ZIP codes. Represents the actual median (50th percentile) rent by bedroom count — a more central benchmark than the 40th percentile SAFMR."
                  frequency="Annual (October) — Currently FY2026"
                />
                <DataSource
                  name="Apartment List"
                  description="Rent growth trends derived from actual lease transactions (not just listings). Provides year-over-year and month-over-month rent growth, vacancy index, and time on market at the county level."
                  frequency="Monthly"
                />
                <DataSource
                  name="Zillow Observed Rent Index (ZORI)"
                  description="Observed rent index tracking year-over-year and month-over-month changes in asking rents. Available for approximately 15% of ZIP codes, covering roughly 80% of the U.S. renter population."
                  frequency="Monthly"
                />
                <DataSource
                  name="Zillow Home Value Index (ZHVI)"
                  description="Home value trends used as a directional momentum proxy when rent-specific trend data is unavailable. Indicates whether the local housing market is rising, falling, or flat."
                  frequency="Monthly"
                />
                <DataSource
                  name="Real-Time Comparable Listings"
                  description="Live comparable rental listings and aggregate market statistics (median rent by bedroom count, active listings, days on market). Sourced from MLS data, public records, and proprietary databases."
                  frequency="Live (real-time, cached 24 hours per ZIP)"
                />
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Section 3: How We Use the Data */}
          <AccordionItem value="cascade" className="border border-border/60 rounded-lg px-5 data-[state=open]:bg-card/50">
            <AccordionTrigger className="text-[16px] font-semibold text-foreground py-4 hover:no-underline">
              How We Use the Data
            </AccordionTrigger>
            <AccordionContent className="pb-5">
              <div className="space-y-4 text-[13px] leading-relaxed text-muted-foreground">
                <p>
                  For each scoring component, RenewalReply uses the most accurate source available for your ZIP code and automatically falls back to alternatives when primary data is missing.
                </p>
                <p>
                  The score details on your results page show which source was used for each component. Components marked <span className="font-mono text-[12px] bg-secondary px-1.5 py-0.5 rounded">(est.)</span> indicate a proxy or default was used instead of direct measurement.
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Section 4: Confidence & Limitations */}
          <AccordionItem value="limitations" className="border border-border/60 rounded-lg px-5 data-[state=open]:bg-card/50">
            <AccordionTrigger className="text-[16px] font-semibold text-foreground py-4 hover:no-underline">
              Confidence & Limitations
            </AccordionTrigger>
            <AccordionContent className="pb-5">
              <div className="space-y-3 text-[13px] leading-relaxed text-muted-foreground">
                <ul className="space-y-2.5 list-none">
                  <li className="flex gap-2">
                    <span className="text-muted-foreground/40 shrink-0">•</span>
                    <span>Score accuracy depends on data availability for your specific ZIP code. Urban areas with more rental activity typically have richer data coverage.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-muted-foreground/40 shrink-0">•</span>
                    <span>Components marked "estimated" use proxy data or neutral defaults when primary sources aren't available for your area.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-muted-foreground/40 shrink-0">•</span>
                    <span>Comparable listings represent current asking rents, which may differ from actual transaction prices.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-muted-foreground/40 shrink-0">•</span>
                    <span>Comp availability varies by geography. Component weights adjust automatically when comp data is limited.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-muted-foreground/40 shrink-0">•</span>
                    <span>Counter-offer ranges are data-driven suggestions — not guaranteed outcomes. Your specific situation (unit condition, amenities, lease terms) may justify different numbers.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-muted-foreground/40 shrink-0">•</span>
                    <span>RenewalReply provides market analysis for informational purposes only. It is not legal or financial advice.</span>
                  </li>
                </ul>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Section 5: Data Freshness */}
          <AccordionItem value="freshness" className="border border-border/60 rounded-lg px-5 data-[state=open]:bg-card/50">
            <AccordionTrigger className="text-[16px] font-semibold text-foreground py-4 hover:no-underline">
              Data Freshness
            </AccordionTrigger>
            <AccordionContent className="pb-5">
              <div className="text-[13px] leading-relaxed text-muted-foreground">
                <div className="space-y-2">
                  {[
                    { source: 'HUD FMR & 50th Percentile', updated: 'FY2026 (effective October 2025)', dateTime: '2025-10' },
                    { source: 'Apartment List', updated: 'February 2026', dateTime: '2026-02' },
                    { source: 'Zillow ZORI', updated: 'January 2026', dateTime: '2026-01' },
                    { source: 'Zillow ZHVI', updated: 'January 2026', dateTime: '2026-01' },
                    { source: 'Live market comps', updated: 'Real-time (cached 24 hours)', dateTime: undefined },
                    { source: 'Census ACS', updated: '2022 (5-year estimates)', dateTime: '2022' },
                  ].map(({ source, updated, dateTime }) => (
                    <div key={source} className="flex justify-between items-center py-1.5 border-b border-border/30 last:border-0">
                      <span className="text-foreground font-medium">{source}</span>
                      <span className="text-muted-foreground text-[12px]">
                        {dateTime ? <time dateTime={dateTime}>{updated}</time> : updated}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="mt-12 pt-8 border-t border-border">
          <Link to="/" className="text-sm text-primary hover:underline">← Back to RenewalReply</Link>
        </div>
      </main>

      <SEOFooter onContactClick={() => setContactOpen(true)} />
      <ContactModal open={contactOpen} onOpenChange={setContactOpen} />
    </div>
  );
};

export default Methodology;
