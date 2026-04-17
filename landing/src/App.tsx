import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
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
const AdminPanelPage = lazy(() =>
  import("./pages/AdminPanel").then((module) => ({ default: module.AdminPanelPage })),
);

export default function App() {
  return (
    <Suspense fallback={<AppSuspenseFallback />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
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
          path="/admin"
          element={
            <AdminRoute>
              <AppShell>
                <AdminPanelPage />
              </AppShell>
            </AdminRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
