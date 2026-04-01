import { useState, useRef, useMemo, lazy, Suspense } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { usePrerenderReady } from '@/hooks/usePrerenderReady';
import RentForm, { RentFormData } from '@/components/RentForm';
import { lookupRentData, loadFredTrend, RentLookupResult } from '@/data/rentData';
import { usePropertyLookup } from '@/hooks/usePropertyLookup';
import { toast } from 'sonner';
import { trackEvent } from '@/lib/analytics';
import SEO from '@/components/SEO';
import LoadingAnalysis from '@/components/LoadingAnalysis';
import { getRememberedEmail, rememberEmail } from '@/lib/emailMemory';
import PageNav from '@/components/PageNav';
import RentReportingCTA from '@/components/RentReportingCTA';

const RentResults = lazy(() => import('@/components/RentResults'));
const SEOFooter = lazy(() => import('@/components/SEOFooter'));
const ContactModal = lazy(() => import('@/components/ContactModal'));

const RentIncreaseCalculator = () => {
  const [searchParams] = useSearchParams();
  const [results, setResults] = useState<{ formData: RentFormData; rentData: RentLookupResult } | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [capturedEmail, setCapturedEmailRaw] = useState(() => getRememberedEmail());
  const setCapturedEmail = (email: string) => {
    setCapturedEmailRaw(email);
    if (email) rememberEmail(email);
  };
  const [formKey, setFormKey] = useState(0);
  const propertyLookup = usePropertyLookup();
  const resultsRef = useRef<HTMLDivElement>(null);

  const prefill = useMemo(() => {
    const zip = searchParams.get('zip');
    const bedrooms = searchParams.get('bedrooms');
    const rent = searchParams.get('rent');
    const address = searchParams.get('address');
    if (!zip && !bedrooms && !rent && !address) return undefined;
    return {
      zip: zip || undefined,
      bedrooms: bedrooms !== null ? parseInt(bedrooms, 10) : undefined,
      rent: rent !== null ? parseInt(rent, 10) : undefined,
      address: address || undefined,
    };
  }, [searchParams]);

  usePrerenderReady(!isLoading);

  const handleSubmit = async (data: RentFormData) => {
    setIsLoading(true);
    setCapturedEmailRaw(getRememberedEmail());

    try {
      if (data.fullAddress) {
        const propResult = await propertyLookup.lookup(data.fullAddress).catch(() => null);
        const zip = propResult?.zipCode || data.zip;
        const rentData = await lookupRentData(zip, data.bedrooms);
        if (!rentData) {
          toast.error(`We don't have rent data for that area yet. Try entering your 5-digit zip code instead.`);
          setIsLoading(false);
          return;
        }
        setResults({ formData: { ...data, zip }, rentData });
        trackEvent('analysis_started', { tool: 'renewal', zip, bedrooms: data.bedrooms, has_address: true, source: 'calculator_page' });
        setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        loadFredTrend(rentData.metro).then((fredTrend) => {
          if (fredTrend) {
            setResults((prev) => prev ? { ...prev, rentData: { ...prev.rentData, fredTrend } } : prev);
          }
        });
      } else {
        const rentData = await lookupRentData(data.zip, data.bedrooms);
        if (!rentData) {
          toast.error(`We don't have data for ${data.zip} yet. Try a nearby zip code.`);
          setIsLoading(false);
          return;
        }
        setResults({ formData: data, rentData });
        trackEvent('analysis_started', { tool: 'renewal', zip: data.zip, bedrooms: data.bedrooms, has_address: false, source: 'calculator_page' });
        setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        loadFredTrend(rentData.metro).then((fredTrend) => {
          if (fredTrend) {
            setResults((prev) => prev ? { ...prev, rentData: { ...prev.rentData, fredTrend } } : prev);
          }
        });
      }
    } catch (err) {
      toast.error('Something went wrong loading rent data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO
        title="Rent Increase Calculator — Is Your Rent Increase Fair? | RenewalReply"
        description="Free rent increase calculator. Enter your current rent and proposed increase to see your increase percentage, compare it to your local market trend, and get a Fairness Score. Covers 38,600+ US ZIP codes."
        canonical="https://www.renewalreply.com/rent-increase-calculator"
        jsonLd={[
          {
            '@type': 'WebApplication',
            name: 'Rent Increase Calculator',
            url: 'https://www.renewalreply.com/rent-increase-calculator',
            description: "Free rent increase calculator that compares your landlord's proposed increase to local market data including federal rent benchmarks, market trends, and real comparable listings for 38,600+ US ZIP codes.",
            applicationCategory: 'FinanceApplication',
            operatingSystem: 'Web',
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
            author: { '@type': 'Organization', name: 'RenewalReply' },
          },
          {
            '@type': 'FAQPage',
            mainEntity: [
              {
                '@type': 'Question',
                name: 'How do I calculate my rent increase percentage?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Subtract your current rent from the proposed rent, divide by your current rent, and multiply by 100. For example, if your rent goes from $2,000 to $2,100, the increase is 5%. This calculator does it automatically and compares your increase to the local market trend.',
                },
              },
              {
                '@type': 'Question',
                name: 'What is a normal rent increase?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'It depends on your local market. RenewalReply compares your specific increase to year-over-year rent trends in your ZIP code using federal benchmarks and commercial market data. Enter your details to see how your increase compares.',
                },
              },
              {
                '@type': 'Question',
                name: 'Can I negotiate my rent increase?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Yes. If your increase exceeds the local market trend, you have data-backed leverage to negotiate. RenewalReply generates a free negotiation letter with your local market data, comparable rents, and a suggested counter-offer range.',
                },
              },
            ],
          },
        ]}
      />

      <PageNav hideCta />

      {isLoading ? (
        <LoadingAnalysis />
      ) : !results ? (
        <main id="main-content" className="flex-1 max-w-2xl mx-auto w-full px-4 sm:px-6 py-10 sm:py-14">
          {/* Hero */}
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-foreground tracking-tight mb-3">
            Rent Increase Calculator
          </h1>
          <p className="text-base text-muted-foreground leading-relaxed mb-8 max-w-xl">
            Enter your current rent, proposed increase, and ZIP code. We'll calculate your increase percentage, compare it to the local market trend, and tell you if your landlord's asking above market.
          </p>

          {/* Form */}
          <div className="mb-12">
            <RentForm key={formKey} onSubmit={handleSubmit} isLoading={isLoading} prefill={prefill} />
          </div>

          {/* How it works */}
          <section className="mb-12">
            <h2 className="font-display text-xl font-semibold text-foreground mb-3">How this calculator works</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
              Every other rent increase calculator on the internet does one thing: basic math. You type in two numbers, it tells you the percentage. You could do that on your phone.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
              This one actually tells you whether the number is reasonable. After calculating your increase, it pulls rent data for your specific ZIP code and compares your landlord's ask to what's actually happening in your market:
            </p>
            <div className="text-sm text-muted-foreground leading-relaxed space-y-1 mb-3">
              <p>· Year-over-year rent trends from multiple market sources</p>
              <p>· Federal rent benchmarks for your bedroom count</p>
              <p>· Comparable listings near your address</p>
              <p>· A Fairness Score (0–100) that weighs all of the above</p>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              If your increase is above the local trend, you get a counter-offer range and a negotiation letter you can actually send — not a generic template, but one built from the data in your area.
            </p>
          </section>

          {/* FAQ — visible on page */}
          <section className="mb-12">
            <h2 className="font-display text-xl font-semibold text-foreground mb-4">Common questions</h2>

            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-1">How do I calculate my rent increase percentage?</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Take the new rent, subtract your current rent, divide by your current rent, multiply by 100. So $2,000 to $2,100 is a 5% increase. The form above does this for you and then tells you whether 5% is high or low for your area.
                </p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-foreground mb-1">What is a normal rent increase?</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  There's no single answer — it depends entirely on where you live. In some cities rents are falling right now. In others they're climbing 5-8% a year. Anyone who tells you "3-5% is normal" without checking your ZIP code is guessing. That's the whole point of this tool.
                </p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-foreground mb-1">Can I negotiate my rent increase?</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Almost always. Landlords expect some pushback, and replacing you costs them more than you'd think — vacancy, cleaning, listing fees, the risk of a worse tenant. If your increase is above the market trend, you have real leverage. The tool generates a letter with your local numbers built in.
                </p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-foreground mb-1">Is this free?</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Yes. The full analysis — comps, Fairness Score, negotiation letter — costs nothing. You can save your report by entering your email, but it's not required to see your results.
                </p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-foreground mb-1">Where does the data come from?</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  We combine federal rent benchmarks from HUD, market rent trends from multiple commercial data providers, and real comparable rental listings near your address. Coverage spans 38,600+ US ZIP codes.
                </p>
              </div>
            </div>
          </section>

          {/* Rent Reporting CTA */}
          <div className="mb-12">
            <RentReportingCTA pageType="calculator" />
          </div>

          {/* Cross-links */}
          <section className="mb-8">
            <h2 className="font-display text-xl font-semibold text-foreground mb-3">More renter tools</h2>
            <div className="space-y-2 text-sm">
              <p><Link to="/what-should-i-pay" className="text-primary hover:underline">Check what rent should cost for a new apartment →</Link></p>
              <p><Link to="/rent-data" className="text-primary hover:underline">Browse rent data by city and ZIP code →</Link></p>
              <p><Link to="/deals" className="text-primary hover:underline">Browse apartment deals near you →</Link></p>
              <p><Link to="/guides/how-to-negotiate-rent-increase" className="text-primary hover:underline">How to negotiate a rent increase →</Link></p>
              <p><Link to="/guides/rent-increase-laws-by-state" className="text-primary hover:underline">Rent increase laws by state →</Link></p>
            </div>
          </section>
        </main>
      ) : (
        <div ref={resultsRef}>
          <Suspense fallback={<LoadingAnalysis />}>
            <RentResults
              formData={results.formData}
              rentData={results.rentData}
              propertyData={propertyLookup.data}
              propertyLoading={propertyLookup.loading}
              propertyError={propertyLookup.error}
              onReset={() => { setResults(null); setFormKey(k => k + 1); setCapturedEmailRaw(getRememberedEmail()); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              onScrollToTop={() => { setResults(null); setFormKey(k => k + 1); setCapturedEmailRaw(getRememberedEmail()); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              capturedEmail={capturedEmail}
              onEmailCaptured={setCapturedEmail}
            />
          </Suspense>
        </div>
      )}

      {!results && (
        <div className="max-w-2xl mx-auto mt-8 px-5">
          <RentReportingCTA pageType="calculator" />
        </div>
      )}

      <Suspense fallback={null}>
        <SEOFooter onContactClick={() => setContactOpen(true)} />
      </Suspense>

      {contactOpen && (
        <Suspense fallback={null}>
          <ContactModal open={contactOpen} onOpenChange={setContactOpen} />
        </Suspense>
      )}
    </div>
  );
};

export default RentIncreaseCalculator;
