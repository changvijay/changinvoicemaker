import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import InvoiceEditor from "./pages/InvoiceEditor";
import InvoiceHistory from "./pages/InvoiceHistory";
import Clients from "./pages/Clients";
import Settings from "./pages/Settings";
import Renewals from "./pages/Renewals";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 15_000 } },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner position="top-right" richColors />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/invoice/new" element={<InvoiceEditor key="new-invoice" newType="invoice" />} />
          <Route path="/proforma/new" element={<InvoiceEditor key="new-proforma" newType="proforma" />} />
          <Route path="/documents" element={<InvoiceHistory />} />
          <Route path="/documents/:id" element={<InvoiceEditor />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/renewals" element={<Renewals />} />
          <Route path="/settings" element={<Settings />} />
          {/* old links */}
          <Route path="/invoice" element={<Navigate to="/invoice/new" replace />} />
          <Route path="/proforma" element={<Navigate to="/proforma/new" replace />} />
          <Route path="/history" element={<Navigate to="/documents" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
