import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import SEO from "@/components/SEO";
import SEOFooter from "@/components/SEOFooter";
import PageNav from "@/components/PageNav";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
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
