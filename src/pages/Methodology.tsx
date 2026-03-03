import { useState } from 'react';
import { Link } from 'react-router-dom';
import SEO from '@/components/SEO';
import SEOFooter from '@/components/SEOFooter';
import ContactModal from '@/components/ContactModal';

const Methodology = () => {
  const [contactOpen, setContactOpen] = useState(false);
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <SEO
        title="How RenewalReply Works — Methodology & Data Sources"
        description="Learn how RenewalReply analyzes rent increases using HUD SAFMR, local listings, Zillow ZORI, and Census data. Transparent methodology explained."
        canonical="/methodology"
      />
      <nav className="flex items-center justify-between px-6 py-5 border-b border-border">
        <Link to="/" className="font-display text-xl font-bold text-primary tracking-tight hover:scale-105 transition-transform duration-200" style={{ letterSpacing: '-0.02em' }}>
          Renewal<span className="font-normal text-accent">Reply</span>
        </Link>
      </nav>

      <main className="max-w-[620px] mx-auto px-6 py-16">
        <h1 className="font-display text-[28px] font-semibold tracking-tight mb-8" style={{ letterSpacing: '-0.02em' }}>
          How RenewalReply Works
        </h1>

        <div className="space-y-10 text-[15px] leading-relaxed text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">Our Data Sources</h2>
            <p className="mb-4">RenewalReply combines four independent data sources to analyze your rent increase:</p>
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">HUD Small Area Fair Market Rents (SAFMR) FY2026</h3>
                <p>Federal rent benchmarks published by the U.S. Department of Housing and Urban Development, calculated at the zip code level. These represent the 40th percentile of standard quality rental housing in each area.</p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Local Rental Listings</h3>
                <p>Real, current comparable listings near your address sourced from MLS data, public records, and proprietary rental databases. These show what similar units are actually renting for right now.</p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Zillow Observed Rent Index (ZORI)</h3>
                <p>Monthly rent trend data tracking year-over-year and month-over-month changes in asking rents by metro area.</p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">U.S. Census American Community Survey (ACS) 2023</h3>
                <p>Demographic and housing data including median renter income, median gross rent, and rent-to-income ratios at the zip code level.</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">How We Determine Your Verdict</h2>
            <p className="mb-4">We compare your proposed rent increase against three benchmarks:</p>
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Rate of increase</h3>
                <p>Is your landlord's proposed increase percentage higher, lower, or in line with the year-over-year rent trend in your area?</p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Comparable listings</h3>
                <p>Is your proposed new rent above or below the median asking rent for similar units near you?</p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Federal benchmarks</h3>
                <p>Does your proposed new rent fall within the HUD Fair Market Rent range for your zip code and unit size?</p>
              </div>
            </div>
            <p className="mt-4">
              When all three benchmarks agree, the verdict is clear. When they tell different stories — for example, your increase rate is above trend but your absolute rent is below the local median — we provide nuanced analysis that explains both sides.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">How We Calculate the Counter-Offer</h2>
            <p>
              When your increase exceeds the local market trend, we suggest a counter-offer range based on applying the area's actual year-over-year rent trend to your current rent. For example, if you pay $2,000 and the local trend is +3.5%, a market-rate increase would bring your rent to approximately $2,070. This gives you a data-backed starting point for negotiation.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">Limitations</h2>
            <p>
              RenewalReply provides market analysis based on available data. It is not legal or financial advice. Data coverage varies by location — some zip codes have more comprehensive data than others, which is reflected in the confidence indicator on your results. Comparable listings represent current asking rents, which may differ from actual transaction prices. Federal data is updated annually and may lag fast-moving markets. We recommend using RenewalReply as one input in your decision-making, alongside your own knowledge of your building and neighborhood.
            </p>
          </section>
        </div>

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
