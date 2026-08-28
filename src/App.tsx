import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import {
  CarrierLanding,
  CarrierWorkspace,
  CreateRequest,
  CustomerWorkspace,
  HowItWorks,
  Home,
  LegalPage,
  Registration,
  Tracking,
} from "./pages/VanScout";

const App = () => (
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
      <Route path="/politika-privatnosti" element={<LegalPage document="privacy" />} />
      <Route path="/politika-o-kolacicima" element={<LegalPage document="cookies" />} />
      <Route path="/uvjeti-koristenja" element={<LegalPage document="terms" />} />
      <Route path="/impressum" element={<LegalPage document="impressum" />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </BrowserRouter>
);

export default App;
