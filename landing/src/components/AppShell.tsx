import type { ReactNode } from "react";
import { DashboardSidebar } from "./DashboardSidebar";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <DashboardSidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
