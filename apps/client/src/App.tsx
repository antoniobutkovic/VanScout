import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  CarrierLanding,
  CarrierWorkspace,
  CreateRequest,
  CustomerWorkspace,
  HowItWorks,
  Home,
  Registration,
  Tracking,
} from "./pages/Movago";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/for-carriers" element={<CarrierLanding />} />
          <Route path="/create-request" element={<CreateRequest />} />
          <Route path="/auth" element={<Registration />} />
          <Route path="/customer/*" element={<CustomerWorkspace />} />
          <Route path="/carrier/*" element={<CarrierWorkspace />} />
          <Route path="/tracking" element={<Tracking />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
