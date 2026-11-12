import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Layout } from "./components/Layout";
import Overview from "./pages/Overview";
import Graphs from "./pages/Graphs";
import Simulator from "./pages/Simulator";
import Events from "./pages/Events";
import Entitlements from "./pages/Entitlements";
import Ledger from "./pages/Ledger";
import Integrations from "./pages/Integrations";
import ApiKeys from "./pages/ApiKeys";
import Agreements from "./pages/Agreements";
import Sources from "./pages/Sources";
import Statements from "./pages/Statements";
import Settlement from "./pages/Settlement";
import Workflow from "./pages/Workflow";

/* ------------------------------------------------------------------
   Shell — routes wrapped in the app Layout. The topbar status pill and
   key indicator follow the AuthContext connection state.
------------------------------------------------------------------- */

function Shell() {
  const { apiKey, isConnected, principal } = useAuth();
  const keyLabel = apiKey
    ? apiKey.length > 12
      ? `${apiKey.slice(0, 6)}…${apiKey.slice(-4)}`
      : apiKey
    : principal
      ? (principal.email ?? principal.org_id)
      : null;

  return (
    <Routes>
      <Route
        element={
          <Layout
            status={isConnected ? "connected" : "nokey"}
            keyLabel={keyLabel}
          />
        }
      >
        <Route index element={<Overview />} />
        <Route path="workflow" element={<Workflow />} />
        <Route path="graphs" element={<Graphs />} />
        <Route path="agreements" element={<Agreements />} />
        <Route path="sources" element={<Sources />} />
        <Route path="simulator" element={<Simulator />} />
        <Route path="events" element={<Events />} />
        <Route path="entitlements" element={<Entitlements />} />
        <Route path="statements" element={<Statements />} />
        <Route path="settlement" element={<Settlement />} />
        <Route path="ledger" element={<Ledger />} />
        <Route path="integrations" element={<Integrations />} />
        <Route path="api-keys" element={<ApiKeys />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter basename="/revrule-console">
      <AuthProvider>
        <Shell />
      </AuthProvider>
    </BrowserRouter>
  );
}
