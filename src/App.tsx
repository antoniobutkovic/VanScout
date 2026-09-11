import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import {
  CarrierWorkspace,
  CheckEmail,
  CreateRequest,
  CustomerWorkspace,
  Home,
  LegalPage,
  ForgotPassword,
  Registration,
  ResetPassword,
  Tracking,
  VerifyEmail,
} from "./screens/VanScout";

const App = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/create-request" element={<CreateRequest />} />
      <Route path="/auth" element={<Registration />} />
      <Route path="/auth/check-email" element={<CheckEmail />} />
      <Route path="/auth/verify-email" element={<VerifyEmail />} />
      <Route path="/auth/forgot-password" element={<ForgotPassword />} />
      <Route path="/auth/reset-password" element={<ResetPassword />} />
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
