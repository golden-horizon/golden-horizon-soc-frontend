import { Routes, Route, Navigate } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import CreateIncident from "./pages/CreateIncident";
import Investigation from "./pages/Investigation";

import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import SecurityEvents from "./pages/SecurityEvents";
import WorldMap from "./pages/WorldMap";
import IncidentDetails from "./pages/IncidentDetails";
import ThreatHunting from "./pages/ThreatHunting";
import ThreatIntelligence from "./pages/ThreatIntelligence";
import ExecutiveDashboard from "./pages/ExecutiveDashboard";
import Reports from "./pages/Reports";

function App() {
  return (
    <>
      {/* TOAST ALERT SYSTEM */}
      <ToastContainer
        position="top-right"
        autoClose={3000}
      />

      <Routes>

        {/* LOGIN */}
        <Route
          path="/login"
          element={<Login />}
        />

        {/* PROTECTED ROUTES */}
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route
            path="/dashboard"
            element={<Dashboard />}
          />

          <Route
            path="/create-incident"
            element={<CreateIncident />}
          />

          <Route
            path="/investigation"
            element={<Investigation />}
          />

          <Route
            path="/security-events"
            element={<SecurityEvents />}
          />
          //protected routes
          <Route path="/world-map" element={<WorldMap />} />
          <Route path="/incidents/:id" element={<IncidentDetails />} />
          <Route path="/threat-hunting" element={<ThreatHunting />} />
          <Route path="/threat-intelligence" element={<ThreatIntelligence />} />
          <Route path="/executive-dashboard" element={<ExecutiveDashboard />} />
          <Route path="/reports" element={<Reports />} />
        </Route>

        {/* DEFAULT */}
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </>
  );
}

export default App;