import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardSidebar } from "./DashboardSidebar";
import { useAuth } from "../contexts/AuthContext";
import { getSettings } from "../lib/api";

type AppShellProps = {
  children: ReactNode;
};

function SuspendedScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#07050d] p-6 text-center text-white">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-[22px] border border-rose-500/30 bg-rose-500/10">
        <span className="text-2xl">⛔</span>
      </div>
      <h1 className="text-2xl font-semibold tracking-[-0.04em]">Account Suspended</h1>
      <p className="mt-3 max-w-sm text-sm text-white/55">
        Your AI front-desk agent has been temporarily suspended and is not answering calls or booking
        appointments.
      </p>
      <div className="mt-6 rounded-[18px] border border-amber-500/20 bg-amber-500/8 px-6 py-4 text-left text-sm text-amber-200/80 max-w-sm">
        <p className="font-medium text-amber-200 mb-1">To reactivate your account:</p>
        <ul className="space-y-1 text-amber-200/70 text-xs">
          <li>• Check your payment status and ensure your subscription is current</li>
          <li>• Contact support if you believe this is an error</li>
          <li>• Your data is safe and will be restored immediately on reactivation</li>
        </ul>
      </div>
      <a
        href="mailto:growwitharup@gmail.com?subject=Account%20Suspended%20–%20Reactivation%20Request"
        className="mt-6 rounded-full bg-violet-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-violet-400"
      >
        Contact Support
      </a>
    </div>
  );
}

export function AppShell({ children }: AppShellProps) {
  const { token, clientId } = useAuth();

  const { data: settings } = useQuery({
    queryKey: ["settings", clientId],
    queryFn: () => getSettings(token!, clientId!),
    enabled: !!token && !!clientId,
    staleTime: 30_000,
  });

  if (settings && !settings.is_active) {
    return <SuspendedScreen />;
  }

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
