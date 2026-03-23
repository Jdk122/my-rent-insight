import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { lazy, Suspense, useEffect } from "react";
import { captureUtmParams } from "@/lib/utm";
import ErrorBoundary from "./components/ErrorBoundary";
import Index from "./pages/Index";
import PageSkeleton from "./components/PageSkeleton";

const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const Outcome = lazy(() => import("./pages/Outcome"));
const Contact = lazy(() => import("./pages/Contact"));
const NotFound = lazy(() => import("./pages/NotFound"));
const RentByZip = lazy(() => import("./pages/RentByZip"));
const RentData = lazy(() => import("./pages/RentData"));
const RentByState = lazy(() => import("./pages/RentByState"));
const RentByCity = lazy(() => import("./pages/RentByCity"));
const SharedReport = lazy(() => import("./pages/SharedReport"));
const About = lazy(() => import("./pages/About"));
const Methodology = lazy(() => import("./pages/Methodology"));
const AdminDataQuality = lazy(() => import("./pages/AdminDataQuality"));
const AdminLeadDashboard = lazy(() => import("./pages/AdminLeadDashboard"));
const AdminMarketIntelligence = lazy(() => import("./pages/AdminMarketIntelligence"));
const WhatShouldIPay = lazy(() => import("./pages/WhatShouldIPay"));
const Guides = lazy(() => import("./pages/Guides"));
const Guide = lazy(() => import("./pages/Guide"));
const DemoIndex = lazy(() => import("./pages/DemoIndex"));
const Deals = lazy(() => import("./pages/Deals"));

const queryClient = new QueryClient();

// Capture UTM params on first load
captureUtmParams();

/** SPA page_view tracking — fires on every route change */
function AnalyticsPageView() {
  const location = useLocation();

  useEffect(() => {
    window.gtag?.('event', 'page_view', {
      page_path: location.pathname + location.search,
      page_title: document.title,
    });
  }, [location.pathname, location.search]);

  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ErrorBoundary>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:rounded-lg focus:text-sm focus:font-semibold"
        >
          Skip to main content
        </a>
        <AnalyticsPageView />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/privacy" element={<Suspense fallback={<PageSkeleton />}><Privacy /></Suspense>} />
          <Route path="/terms" element={<Suspense fallback={<PageSkeleton />}><Terms /></Suspense>} />
          <Route path="/contact" element={<Suspense fallback={<PageSkeleton />}><Contact /></Suspense>} />
          <Route path="/about" element={<Suspense fallback={<PageSkeleton />}><About /></Suspense>} />
          <Route path="/methodology" element={<Suspense fallback={<PageSkeleton />}><Methodology /></Suspense>} />
          <Route path="/outcome" element={<Suspense fallback={<PageSkeleton />}><Outcome /></Suspense>} />
          <Route path="/rent-data" element={<Suspense fallback={<PageSkeleton />}><RentData /></Suspense>} />
          <Route path="/what-should-i-pay" element={<Suspense fallback={<PageSkeleton />}><WhatShouldIPay /></Suspense>} />
          <Route path="/rent/:zip" element={<Suspense fallback={<PageSkeleton />}><RentByZip /></Suspense>} />
          <Route path="/rent-data/:stateSlug/:citySlug" element={<Suspense fallback={<PageSkeleton />}><RentByCity /></Suspense>} />
          <Route path="/rent-data/:stateSlug" element={<Suspense fallback={<PageSkeleton />}><RentByState /></Suspense>} />
          <Route path="/report/:shortId" element={<Suspense fallback={<PageSkeleton />}><SharedReport /></Suspense>} />
          <Route path="/admin/data-quality" element={<Suspense fallback={<PageSkeleton />}><AdminDataQuality /></Suspense>} />
          <Route path="/admin/leads" element={<Suspense fallback={<PageSkeleton />}><AdminLeadDashboard /></Suspense>} />
          <Route path="/admin/markets" element={<Suspense fallback={<PageSkeleton />}><AdminMarketIntelligence /></Suspense>} />
          <Route path="/guides" element={<Suspense fallback={<PageSkeleton />}><Guides /></Suspense>} />
          <Route path="/guides/:slug" element={<Suspense fallback={<PageSkeleton />}><Guide /></Suspense>} />
          <Route path="/demos" element={<Suspense fallback={<PageSkeleton />}><DemoIndex /></Suspense>} />
          <Route path="/deals/:citySlug" element={<Suspense fallback={<PageSkeleton />}><Deals /></Suspense>} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<Suspense fallback={<PageSkeleton />}><NotFound /></Suspense>} />
        </Routes>
        
        </ErrorBoundary>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
