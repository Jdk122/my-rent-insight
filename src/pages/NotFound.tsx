import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { usePrerenderReady } from '@/hooks/usePrerenderReady';
import { NoIndexMeta } from '@/components/NoIndexMeta';
import SEO from "@/components/SEO";
import SEOFooter from "@/components/SEOFooter";
import PageNav from "@/components/PageNav";
import { trackEvent } from "@/lib/analytics";

const NotFound = () => {
  const location = useLocation();
  usePrerenderReady(true);

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
    trackEvent('page_not_found', {
      path: location.pathname,
      referrer: document.referrer || 'direct',
    });
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <NoIndexMeta />
      <SEO title="Page Not Found — RenewalReply" noindex />
      <PageNav hideCta />
      <main className="flex-1 flex flex-col items-center justify-center">
        <h1 className="mb-4 text-4xl font-bold text-foreground">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">Oops! Page not found</p>
        <a href="/" className="text-primary underline hover:text-primary/90">
          Return to Home
        </a>
      </main>
      <SEOFooter />
    </div>
  );
};

export default NotFound;
