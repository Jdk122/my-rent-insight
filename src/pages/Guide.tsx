import { useParams, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import { getGuideBySlug, guides } from '@/data/guides';
import { usePrerenderReady } from '@/hooks/usePrerenderReady';
import { NoIndexMeta } from '@/components/NoIndexMeta';
import SEO from '@/components/SEO';
import SEOFooter from '@/components/SEOFooter';
import PageNav from '@/components/PageNav';
import { Badge } from '@/components/ui/badge';

const slugify = (text: string) =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const markdownComponents: Components = {
  h2: ({ children, ...props }) => {
    const id = slugify(String(children));
    return <h2 id={id} {...props}>{children}</h2>;
  },
  h3: ({ children, ...props }) => {
    const id = slugify(String(children));
    return <h3 id={id} {...props}>{children}</h3>;
  },
  table: ({ children, ...props }) => (
    <div className="overflow-x-auto -mx-5 px-5 sm:mx-0 sm:px-0">
      <table {...props}>{children}</table>
    </div>
  ),
};

const Guide = () => {
  const { slug } = useParams<{ slug: string }>();
  const article = slug ? getGuideBySlug(slug) : undefined;
  usePrerenderReady(true);

  if (!article) {
    return (
      <>
      <NoIndexMeta />
      <div className="min-h-screen bg-background flex flex-col">
        <SEO title="Guide Not Found | RenewalReply" noindex />
        <PageNav />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <h1 className="text-2xl font-bold text-foreground">Guide not found</h1>
            <p className="text-muted-foreground">This guide doesn't exist or has been moved.</p>
            <Link to="/guides" className="text-primary hover:underline text-sm font-medium">← Back to all guides</Link>
          </div>
        </main>
        <SEOFooter />
      </div>
      </>
    );
  }

  const relatedArticles = article.relatedSlugs
    .map((s) => guides.find((g) => g.slug === s))
    .filter(Boolean);

  const articleJsonLd = {
    '@type': 'Article',
    headline: article.title,
    description: article.metaDescription,
    datePublished: article.publishedDate,
    dateModified: article.updatedDate || article.publishedDate,
    author: { '@type': 'Organization', name: 'RenewalReply', url: 'https://www.renewalreply.com' },
    publisher: { '@type': 'Organization', name: 'RenewalReply', url: 'https://www.renewalreply.com' },
    mainEntityOfPage: `https://www.renewalreply.com/guides/${article.slug}`,
  };

  const faqJsonLd = article.faqItems?.length
    ? {
        '@type': 'FAQPage',
        mainEntity: article.faqItems.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      }
    : null;

  const howToJsonLd = article.slug === 'how-to-negotiate-rent-increase'
    ? {
        '@context': 'https://schema.org',
        '@type': 'HowTo',
        name: 'How to Negotiate a Rent Increase',
        description: 'A step-by-step guide to negotiating your rent increase using market data, comparable listings, and a professional counter-offer email.',
        totalTime: 'PT30M',
        step: [
          {
            '@type': 'HowToStep',
            name: 'Check the market trend',
            text: 'Look up the year-over-year rent trend for your area. If rents grew 3% and your landlord wants 8%, that 5-point gap is your strongest argument.',
            url: 'https://www.renewalreply.com/guides/how-to-negotiate-rent-increase',
          },
          {
            '@type': 'HowToStep',
            name: 'Pull comparable listings',
            text: 'Find what similar units near you are renting for right now. If your post-increase rent is above the median for comparable units, you have a data-backed case.',
            url: 'https://www.renewalreply.com/guides/how-to-negotiate-rent-increase',
          },
          {
            '@type': 'HowToStep',
            name: 'Calculate your counter-offer',
            text: 'Anchor your counter to the local rent trend. If the trend is 4% and your landlord wants 10%, a counter in the 4-6% range is data-backed and reasonable.',
            url: 'https://www.renewalreply.com/guides/how-to-negotiate-rent-increase',
          },
          {
            '@type': 'HowToStep',
            name: 'Send a professional counter-offer email',
            text: 'Lead with your intent to stay, present specific market evidence, propose a clear counter-number with reasoning, and close by reinforcing your value as a tenant.',
            url: 'https://www.renewalreply.com/guides/how-to-negotiate-rent-increase',
          },
          {
            '@type': 'HowToStep',
            name: 'Handle the response',
            text: 'If accepted, confirm in writing. If countered, evaluate whether the gap is worth continued negotiation. If rejected, consider non-monetary concessions or alternatives.',
            url: 'https://www.renewalreply.com/guides/how-to-negotiate-rent-increase',
          },
        ],
        tool: [
          { '@type': 'HowToTool', name: 'RenewalReply Fairness Score tool (free)' },
          { '@type': 'HowToTool', name: 'Local comparable rental listings' },
          { '@type': 'HowToTool', name: 'HUD Fair Market Rent data' },
        ],
      }
    : null;

  const itemListJsonLd = article.slug === 'how-to-check-rent-fair'
    ? {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: 'How to Check If Your Rent Is Fair: 5 Methods Compared',
        description: 'A comparison of five methods renters can use to check whether their rent or rent increase is fair, including free tools, paid services, and manual research.',
        numberOfItems: 5,
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'RenewalReply Rent Fairness Checker',
            url: 'https://www.renewalreply.com',
            description: 'Free renter-focused tool that combines HUD benchmarks, Zillow trends, Apartment List data, and local comps to score your rent increase.'
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Rentometer',
            url: 'https://www.rentometer.com',
            description: 'Paid rental comp service starting at $16/month, primarily designed for landlords, investors, and property managers.'
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: 'Zillow Rent Zestimate',
            url: 'https://www.zillow.com/rent/what-is-a-rent-zestimate/',
            description: 'Free algorithmic rent estimate based on property data and comparable listings. Property-focused, not increase-focused.'
          },
          {
            '@type': 'ListItem',
            position: 4,
            name: 'Manual Comp Research',
            description: 'Searching Zillow, Apartments.com, and Craigslist yourself to find comparable listings and estimate fair market rent.'
          },
          {
            '@type': 'ListItem',
            position: 5,
            name: 'Ask Your Landlord or Management Company',
            description: 'Requesting justification for a rent increase directly from your landlord, including what market data they used.'
          }
        ]
      }
    : null;

  const jsonLd = [articleJsonLd, faqJsonLd, howToJsonLd, itemListJsonLd].filter(Boolean);

  const pubDate = new Date(article.publishedDate).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEO
        title={article.metaTitle}
        description={article.metaDescription}
        canonical={`/guides/${article.slug}`}
        jsonLd={jsonLd}
      />
      <PageNav />

      <main id="main-content" className="flex-1">
        <article className="max-w-[680px] mx-auto px-5 sm:px-6 py-10 sm:py-14">
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="mb-6">
            <ol className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <li><Link to="/" className="hover:text-foreground transition-colors">Home</Link></li>
              <li>/</li>
              <li><Link to="/guides" className="hover:text-foreground transition-colors">Guides</Link></li>
              <li>/</li>
              <li className="text-foreground truncate max-w-[200px]">{article.title}</li>
            </ol>
          </nav>

          {/* Header */}
          <header className="mb-10">
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground leading-tight tracking-tight">
              {article.title}
            </h1>
            <div className="flex flex-wrap items-center gap-3 mt-4 text-sm text-muted-foreground">
              <Badge variant="secondary" className="text-xs font-medium">{article.category}</Badge>
              <span>{pubDate}</span>
              <span>·</span>
              <span>{article.readingTime}</span>
            </div>
          </header>

          {/* Content */}
          <div className="prose-rr">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={markdownComponents}
            >
              {article.content}
            </ReactMarkdown>
          </div>

          {/* FAQ section */}
          {article.faqItems && article.faqItems.length > 0 && (
            <section className="mt-12 pt-8 border-t border-border">
              <h2 className="text-xl font-semibold text-foreground mb-4">Frequently Asked Questions</h2>
              <div className="space-y-4">
                {article.faqItems.map((faq, i) => (
                  <details key={i} className="group">
                    <summary className="cursor-pointer text-sm font-medium text-foreground hover:text-primary transition-colors list-none flex items-center gap-2">
                      <span className="text-muted-foreground group-open:rotate-90 transition-transform">▸</span>
                      {faq.q}
                    </summary>
                    <div className="mt-2 ml-5 text-sm text-muted-foreground leading-relaxed prose-rr">
                      <ReactMarkdown components={{ p: ({ children }) => <span>{children}</span> }}>{faq.a}</ReactMarkdown>
                    </div>
                  </details>
                ))}
              </div>
            </section>
          )}

          {/* Related guides */}
          {relatedArticles.length > 0 && (
            <section className="mt-12 pt-8 border-t border-border">
              <h2 className="text-lg font-semibold text-foreground mb-4">Related Guides</h2>
              <div className="space-y-3">
                {relatedArticles.map((r) => r && (
                  <Link
                    key={r.slug}
                    to={`/guides/${r.slug}`}
                    className="block p-4 rounded-lg border border-border hover:border-primary/30 hover:bg-accent/30 transition-colors"
                  >
                    <p className="font-medium text-foreground text-sm">{r.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{r.readingTime} · {r.category}</p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* CTA */}
          <section className="mt-12 p-6 rounded-xl bg-accent/40 border border-border text-center">
            <p className="text-base font-semibold text-foreground mb-2">
              Check if your rent increase is fair
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Free, instant results backed by HUD, Zillow, and real-time listing data.
            </p>
            <Link
              to="/"
              className="inline-block bg-primary text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-semibold hover:brightness-90 transition-all shadow-sm"
            >
              Analyze My Rent →
            </Link>
          </section>
        </article>
      </main>

      <SEOFooter />
    </div>
  );
};

export default Guide;
