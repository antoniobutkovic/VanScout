import { useEffect, useState, type ReactNode } from "react";
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
import { dashboardPath, fetchSessionUser, type SessionRole } from "./lib/client-auth";

function RequireSession({ role, children }: { role: SessionRole; children: ReactNode }) {
  const [sessionRole, setSessionRole] = useState<SessionRole | null>();

  useEffect(() => {
    const controller = new AbortController();
    void fetchSessionUser(controller.signal)
      .then(user => setSessionRole(user?.role ?? null))
      .catch(error => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setSessionRole(null);
      });
    return () => controller.abort();
  }, []);

  if (sessionRole === undefined) return <div className="session-loading" aria-busy="true" />;
  if (sessionRole === null) return <Navigate to="/auth" replace />;
  if (sessionRole !== role) return <Navigate to={dashboardPath(sessionRole)} replace />;
  return children;
}

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
      <Route path="/customer/*" element={<RequireSession role="requester"><CustomerWorkspace /></RequireSession>} />
      <Route path="/carrier/*" element={<RequireSession role="transporter"><CarrierWorkspace /></RequireSession>} />
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
