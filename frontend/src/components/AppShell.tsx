import type { ReactNode } from "react";
import { DashboardSidebar } from "./DashboardSidebar";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="relative h-screen overflow-hidden bg-[#07050d] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-10%] top-[-14%] h-[36rem] w-[36rem] rounded-full bg-[radial-gradient(circle,rgba(124,58,237,0.24),transparent_62%)] blur-3xl" />
        <div className="absolute bottom-[-24%] right-[-10%] h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(circle,rgba(99,102,241,0.18),transparent_60%)] blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,8,18,0.84),rgba(6,5,12,0.96))]" />
      </div>

      <div className="relative z-10 flex h-full overflow-hidden">
        <DashboardSidebar />
        <main className="flex h-full flex-1 overflow-hidden px-4 py-4 md:px-5 md:py-5 xl:pl-0">
          <div className="h-full w-full overflow-y-auto rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(14,11,24,0.78),rgba(9,8,17,0.88))] shadow-[0_30px_90px_rgba(0,0,0,0.28)] backdrop-blur-xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
