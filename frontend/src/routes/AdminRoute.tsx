import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { AppSuspenseFallback } from "../components/AppSuspenseFallback";
import { useAuth } from "../contexts/AuthContext";

type AdminRouteProps = {
  children: ReactNode;
};

export function AdminRoute({ children }: AdminRouteProps) {
  const { loading, role, user } = useAuth();

  if (loading) {
    return <AppSuspenseFallback />;
  }

  if (!user) return <Navigate to="/login" replace />;
  if (role !== "admin") return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
