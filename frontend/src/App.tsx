import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import { AppShell } from "./components/AppShell";
import { AppSuspenseFallback } from "./components/AppSuspenseFallback";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminRoute } from "./routes/AdminRoute";
import { LandingPage } from "./pages/LandingPage";

const LoginPage = lazy(() =>
  import("./pages/Login").then((module) => ({ default: module.LoginPage })),
);
const DashboardPage = lazy(() =>
  import("./pages/Dashboard").then((module) => ({ default: module.DashboardPage })),
);
const CallLogsPage = lazy(() => import("./pages/CallLogs"));
const BookingsPage = lazy(() => import("./pages/Bookings"));
const AnalyticsPage = lazy(() => import("./pages/Analytics"));
const SettingsPage = lazy(() => import("./pages/Settings"));
const AdminPanelPage = lazy(() =>
  import("./pages/AdminPanel").then((module) => ({ default: module.AdminPanelPage })),
);
const ClientOnboardingPage = lazy(() => import("./pages/ClientOnboarding"));

function RootEntry() {
  const { user, role, loading } = useAuth();

  if (loading) return <AppSuspenseFallback />;
  if (!user) return <LandingPage />;
  return <Navigate to={role === "admin" ? "/admin" : "/dashboard"} replace />;
}

export default function App() {
  return (
    <Suspense fallback={<AppSuspenseFallback />}>
      <Routes>
        <Route path="/" element={<RootEntry />} />
        <Route path="/landing" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <AppShell>
                <DashboardPage />
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/calls"
          element={
            <ProtectedRoute>
              <AppShell>
                <CallLogsPage />
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/bookings"
          element={
            <ProtectedRoute>
              <AppShell>
                <BookingsPage />
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/analytics"
          element={
            <ProtectedRoute>
              <AppShell>
                <AnalyticsPage />
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <AppShell>
                <SettingsPage />
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminPanelPage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/onboarding"
          element={
            <AdminRoute>
              <ClientOnboardingPage />
            </AdminRoute>
          }
        />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
}
