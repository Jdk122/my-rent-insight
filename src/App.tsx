import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import { captureUtmParams } from "@/lib/utm";
import ErrorBoundary from "./components/ErrorBoundary";
import Index from "./pages/Index";
import PageSkeleton from "./components/PageSkeleton";
const Privacy = lazy(() => import("./pages/Privacy"));
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

const queryClient = new QueryClient();

// Capture UTM params on first load
captureUtmParams();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/privacy" element={<Suspense fallback={<PageSkeleton />}><Privacy /></Suspense>} />
          <Route path="/contact" element={<Suspense fallback={<PageSkeleton />}><Contact /></Suspense>} />
          <Route path="/about" element={<Suspense fallback={<PageSkeleton />}><About /></Suspense>} />
          <Route path="/methodology" element={<Suspense fallback={<PageSkeleton />}><Methodology /></Suspense>} />
          <Route path="/outcome" element={<Suspense fallback={<PageSkeleton />}><Outcome /></Suspense>} />
          <Route path="/rent-data" element={<Suspense fallback={<PageSkeleton />}><RentData /></Suspense>} />
          <Route path="/rent/:zip" element={<Suspense fallback={<PageSkeleton />}><RentByZip /></Suspense>} />
          <Route path="/rent-data/:stateSlug/:citySlug" element={<Suspense fallback={<PageSkeleton />}><RentByCity /></Suspense>} />
          <Route path="/rent-data/:stateSlug" element={<Suspense fallback={<PageSkeleton />}><RentByState /></Suspense>} />
          <Route path="/report/:shortId" element={<Suspense fallback={<PageSkeleton />}><SharedReport /></Suspense>} />
          <Route path="/admin/data-quality" element={<Suspense fallback={<PageSkeleton />}><AdminDataQuality /></Suspense>} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<Suspense fallback={<PageSkeleton />}><NotFound /></Suspense>} />
        </Routes>
        </ErrorBoundary>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
