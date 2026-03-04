import { useState } from 'react';
import { Link } from 'react-router-dom';
import SEO from '@/components/SEO';
import SEOFooter from '@/components/SEOFooter';
import ContactModal from '@/components/ContactModal';
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
        description="Learn how RenewalReply's Fairness Score analyzes rent increases using HUD rents, Apartment List trends, Zillow ZORI, Rentcast comps, and Census data. Transparent methodology explained."
        canonical="/methodology"
      />

      <nav className="sticky top-0 z-[60] flex items-center justify-between px-6 py-4 bg-card" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <Link to="/">
          <img src="/renewalreply-wordmark.png" alt="RenewalReply" className="h-7" />
        </Link>
        <Link to="/" className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-[13px] font-semibold hover:brightness-90 transition-all duration-150 shadow-sm shadow-primary/20">
          Check your rent →
        </Link>
      </nav>

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
                  The RenewalReply Fairness Score™ is a 0–100 composite score calculated from five independently weighted components. Each measures a different dimension of whether your rent increase is reasonable.
                </p>

                <div className="space-y-3">
                  <div className="p-3 rounded-md bg-secondary/40">
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="text-[13px] font-semibold text-foreground">Rent Increase vs. Market Trend</span>
                      <span className="text-[12px] font-mono text-muted-foreground">30 pts</span>
                    </div>
                    <p>Compares your increase percentage to the year-over-year rent trend in your area. Uses Apartment List transacted rent data when available, otherwise Zillow ZORI or HUD FMR trends.</p>
                  </div>

                  <div className="p-3 rounded-md bg-secondary/40">
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="text-[13px] font-semibold text-foreground">Comparable Rents</span>
                      <span className="text-[12px] font-mono text-muted-foreground">25 pts</span>
                    </div>
                    <p>Measures whether your proposed rent is above or below the median asking rent for similar units nearby, using real-time listings from Rentcast.</p>
                  </div>

                  <div className="p-3 rounded-md bg-secondary/40">
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="text-[13px] font-semibold text-foreground">Increase Reasonableness</span>
                      <span className="text-[12px] font-mono text-muted-foreground">20 pts</span>
                    </div>
                    <p>Evaluates whether your proposed rent is reasonable relative to HUD reference rents for your area. Uses the 50th percentile (median) when available, otherwise the 40th percentile SAFMR. In areas where rents naturally exceed HUD levels, scores the rate of increase instead.</p>
                  </div>

                  <div className="p-3 rounded-md bg-secondary/40">
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="text-[13px] font-semibold text-foreground">Rent-to-Income Ratio</span>
                      <span className="text-[12px] font-mono text-muted-foreground">15 pts</span>
                    </div>
                    <p>Checks whether your proposed rent would exceed 30% of the area's median renter income — the standard affordability threshold used by HUD.</p>
                  </div>

                  <div className="p-3 rounded-md bg-secondary/40">
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="text-[13px] font-semibold text-foreground">Market Momentum</span>
                      <span className="text-[12px] font-mono text-muted-foreground">10 pts</span>
                    </div>
                    <p>Captures the direction rents are heading month-over-month. Uses Zillow ZORI when available, then Apartment List MoM trends, then Zillow Home Value Index as a directional proxy.</p>
                  </div>
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
                <p className="mb-4">RenewalReply combines seven independent data sources to build a complete picture of your local rental market.</p>
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
                  description="Rent growth trends derived from actual lease transactions (not just listings). Provides year-over-year and month-over-month rent growth at the county level, mapped to ZIP codes via Census crosswalk."
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
                  name="Rentcast"
                  description="Real-time comparable rental listings near your address, sourced from MLS data, public records, and proprietary rental databases. Shows what similar units are actually listed for right now."
                  frequency="Live (real-time)"
                />
                <DataSource
                  name="U.S. Census American Community Survey (ACS)"
                  description="Demographic and housing data including median renter household income and median gross rent at the ZIP code level."
                  frequency="Annual — Currently 2023 5-year estimates"
                />
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Section 3: Priority Cascade */}
          <AccordionItem value="cascade" className="border border-border/60 rounded-lg px-5 data-[state=open]:bg-card/50">
            <AccordionTrigger className="text-[16px] font-semibold text-foreground py-4 hover:no-underline">
              How We Pick the Best Data
            </AccordionTrigger>
            <AccordionContent className="pb-5">
              <div className="space-y-4 text-[13px] leading-relaxed text-muted-foreground">
                <p>
                  Not every data source is available for every ZIP code. Rather than showing incomplete results, we use a <strong className="text-foreground">priority cascade</strong> — for each scoring component, we select the most accurate available source and automatically fall back to alternatives when primary data is missing.
                </p>
                <p>
                  For example, when scoring market trends, we first look for Apartment List transacted rent data (actual leases signed), then Zillow ZORI (listing-based trends), and finally HUD year-over-year changes. Each fallback is still meaningful — just slightly less precise.
                </p>
                <p>
                  Components in your score breakdown marked <span className="font-mono text-[12px] bg-secondary px-1.5 py-0.5 rounded">(est.)</span> indicate that a proxy or default was used instead of direct measurement. Components without this marker are based on primary data specific to your ZIP code.
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
                    <span>Counter-offer ranges are data-backed suggestions — not guaranteed outcomes. Your specific situation (unit condition, amenities, lease terms) may justify different numbers.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-muted-foreground/40 shrink-0">•</span>
                    <span>RenewalReply provides market analysis for informational purposes. It is not legal or financial advice.</span>
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
                    { source: 'HUD SAFMR (40th pct)', updated: 'October 2025 (FY2026)' },
                    { source: 'HUD 50th Percentile', updated: 'October 2025 (FY2026)' },
                    { source: 'Apartment List', updated: 'February 2026' },
                    { source: 'Zillow ZORI', updated: 'January 2026' },
                    { source: 'Zillow ZHVI', updated: 'January 2026' },
                    { source: 'Rentcast Listings', updated: 'Live (real-time)' },
                    { source: 'Census ACS', updated: '2023 (5-year estimates)' },
                  ].map(({ source, updated }) => (
                    <div key={source} className="flex justify-between items-center py-1.5 border-b border-border/30 last:border-0">
                      <span className="text-foreground font-medium">{source}</span>
                      <span className="text-muted-foreground text-[12px]">{updated}</span>
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
