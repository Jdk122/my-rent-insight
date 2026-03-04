import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import { captureUtmParams } from "@/lib/utm";
import Index from "./pages/Index";
import Privacy from "./pages/Privacy";
import Outcome from "./pages/Outcome";
import Contact from "./pages/Contact";
import NotFound from "./pages/NotFound";
import PageSkeleton from "./components/PageSkeleton";
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
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/about" element={<Suspense fallback={<PageSkeleton />}><About /></Suspense>} />
          <Route path="/methodology" element={<Suspense fallback={<PageSkeleton />}><Methodology /></Suspense>} />
          <Route path="/outcome" element={<Outcome />} />
          <Route path="/rent-data" element={<Suspense fallback={<PageSkeleton />}><RentData /></Suspense>} />
          <Route path="/rent/:zip" element={<Suspense fallback={<PageSkeleton />}><RentByZip /></Suspense>} />
          <Route path="/rent-data/:stateSlug/:citySlug" element={<Suspense fallback={<PageSkeleton />}><RentByCity /></Suspense>} />
          <Route path="/rent-data/:stateSlug" element={<Suspense fallback={<PageSkeleton />}><RentByState /></Suspense>} />
          <Route path="/report/:shortId" element={<Suspense fallback={<PageSkeleton />}><SharedReport /></Suspense>} />
          <Route path="/admin/data-quality" element={<Suspense fallback={<PageSkeleton />}><AdminDataQuality /></Suspense>} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
