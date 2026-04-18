import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "../contexts/AuthContext";
import { getAnalytics, getCalls, getOverview } from "../lib/api";
import { subscribeToCallLogs, supabase } from "../lib/supabase";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { MetricCard } from "../components/MetricCard";
import { StatusBadge } from "../components/StatusBadge";

export function DashboardPage({ overrideClientId }: { overrideClientId?: string } = {}) {
  const { token, clientId: authClientId } = useAuth();
  const clientId = overrideClientId ?? authClientId;
  const [liveCallCount, setLiveCallCount] = useState<number | null>(null);

  const overviewQuery = useQuery({
    queryKey: ["overview", clientId],
    queryFn: () => getOverview(token!, clientId!),
    enabled: !!token && !!clientId,
    refetchInterval: 30000,
  });

  const callsQuery = useQuery({
    queryKey: ["calls", clientId],
    queryFn: () => getCalls(token!, clientId!, { limit: 8 }),
    enabled: !!token && !!clientId,
  });

  const analyticsQuery = useQuery({
    queryKey: ["analytics", clientId, "30d"],
    queryFn: () => getAnalytics(token!, clientId!, "30d"),
    enabled: !!token && !!clientId,
  });

  useEffect(() => {
    if (!token || !clientId) return;
    const channel = subscribeToCallLogs(clientId, () => {
      setLiveCallCount((previous) => (previous ?? overviewQuery.data?.calls_today ?? 0) + 1);
    });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [token, clientId, overviewQuery.data?.calls_today]);

  if (!token || !clientId || overviewQuery.isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (overviewQuery.isError) {
    return <div className="p-8 text-rose-300">Failed to load dashboard. Please refresh.</div>;
  }

  const metrics = overviewQuery.data!;
  const callsToday = liveCallCount ?? metrics.calls_today;
  const recentCalls = callsQuery.data?.calls ?? [];

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 md:p-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold tracking-[-0.04em] text-white">Dashboard</h2>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/60">
          Last 30 days
        </span>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Calls Today" value={callsToday} color="blue" />
        <MetricCard label="Bookings This Week" value={metrics.bookings_this_week} color="green" />
        <MetricCard
          label="Booking Rate"
          value={`${(metrics.booking_rate * 100).toFixed(1)}%`}
          color="yellow"
        />
        <MetricCard label="Emergencies This Week" value={metrics.emergencies_this_week} color="red" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
        <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(22,17,37,0.74),rgba(11,9,20,0.84))] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.22)]">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-lg font-medium text-white">Calls</h3>
            <span className="text-xs text-white/45">Daily volume</span>
          </div>

          {analyticsQuery.data ? (
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analyticsQuery.data.calls_per_day}>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: "rgba(255,255,255,0.45)" }}
                    tickFormatter={(value: string) => value.slice(5)}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: "rgba(255,255,255,0.45)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#0d0b13",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 16,
                    }}
                  />
                  <Line type="monotone" dataKey="count" stroke="#a78bfa" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-[320px] items-center justify-center">
              <LoadingSpinner />
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(22,17,37,0.74),rgba(11,9,20,0.84))] shadow-[0_24px_60px_rgba(0,0,0,0.22)]">
          <div className="border-b border-white/8 px-6 py-5">
            <h3 className="text-lg font-medium text-white">Recent Calls</h3>
          </div>

          {callsQuery.isLoading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : (
            <div className="divide-y divide-white/8">
              {recentCalls.map((call) => (
                <div key={call.id} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-white">{call.caller_number}</p>
                      <p className="mt-1 text-xs text-white/45">
                        {new Date(call.started_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="shrink-0">
                      {call.was_emergency ? (
                        <StatusBadge status="emergency" label="Emergency" />
                      ) : call.was_booked ? (
                        <StatusBadge status="booked" label="Booked" />
                      ) : (
                        <StatusBadge status={call.status} />
                      )}
                    </div>
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm text-white/58">
                    {call.summary ?? "No summary available."}
                  </p>
                </div>
              ))}

              {recentCalls.length === 0 ? (
                <div className="px-6 py-10 text-center text-sm text-white/35">No calls yet.</div>
              ) : null}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
