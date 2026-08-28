import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
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
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </BrowserRouter>
);

export default App;
