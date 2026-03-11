import { Link } from 'react-router-dom';
import { guides } from '@/data/guides';
import SEO from '@/components/SEO';
import SEOFooter from '@/components/SEOFooter';
import PageNav from '@/components/PageNav';
import { Badge } from '@/components/ui/badge';

const Guides = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEO
        title="Renter's Guides | RenewalReply"
        description="Data-driven guides to help you navigate rent increases, negotiate with your landlord, and understand your tenant rights. Updated for 2026."
        canonical="/guides"
      />
      <PageNav />

      <main id="main-content" className="flex-1">
        <div className="max-w-[680px] mx-auto px-5 sm:px-6 py-10 sm:py-14">
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
            Renter's Guides
          </h1>
          <p className="mt-3 text-muted-foreground leading-relaxed">
            Data-driven guides to help you navigate rent increases, negotiate with your landlord, and understand your rights.
          </p>

          <div className="mt-10 space-y-4">
            {guides.map((article) => {
              const preview = article.content
                .replace(/[#*\[\]()_`>-]/g, '')
                .replace(/\n+/g, ' ')
                .trim()
                .slice(0, 150);

              return (
                <Link
                  key={article.slug}
                  to={`/guides/${article.slug}`}
                  className="block p-5 rounded-xl border border-border hover:border-primary/30 hover:bg-accent/20 transition-colors group"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary" className="text-xs font-medium">{article.category}</Badge>
                    <span className="text-xs text-muted-foreground">{article.readingTime}</span>
                  </div>
                  <h2 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                    {article.title}
                  </h2>
                  <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                    {preview}…
                  </p>
                  <span className="inline-block mt-3 text-sm text-primary font-medium">
                    Read guide →
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </main>

      <SEOFooter />
    </div>
  );
};

export default Guides;
