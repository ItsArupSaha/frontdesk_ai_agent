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
    queryFn: () => getCalls(token!, clientId!, { limit: 10 }),
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
    return <div className="p-6 text-rose-300">Failed to load dashboard. Please refresh.</div>;
  }

  const metrics = overviewQuery.data!;
  const callsToday = liveCallCount ?? metrics.calls_today;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold tracking-[-0.04em] text-white">Dashboard</h2>
        <span className="flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-200">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
          Live
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Calls Today" value={callsToday} color="blue" />
        <MetricCard label="Bookings This Week" value={metrics.bookings_this_week} color="green" />
        <MetricCard
          label="Booking Rate"
          value={`${(metrics.booking_rate * 100).toFixed(1)}%`}
          color="yellow"
        />
        <MetricCard
          label="Missed Calls Recovered"
          value={metrics.missed_calls_recovered}
          color={metrics.missed_calls_recovered > 0 ? "green" : "gray"}
          subtext="This week"
        />
      </div>

      {analyticsQuery.data ? (
        <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
          <h3 className="mb-4 text-sm font-semibold text-white/70">Calls per day - last 30 days</h3>
          <ResponsiveContainer width="100%" height={240}>
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
              <Line type="monotone" dataKey="count" stroke="#8b5cf6" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.03]">
        <div className="border-b border-white/8 px-5 py-4">
          <h3 className="text-sm font-semibold text-white/70">Recent Calls</h3>
        </div>
        {callsQuery.isLoading ? (
          <div className="flex justify-center py-10">
            <LoadingSpinner />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr className="text-left text-xs uppercase tracking-[0.2em] text-white/35">
                  <th className="px-4 py-3">Caller</th>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Summary</th>
                </tr>
              </thead>
              <tbody>
                {(callsQuery.data?.calls ?? []).map((call) => (
                  <tr key={call.id} className="border-t border-white/6 text-sm text-white/72">
                    <td className="px-4 py-3">{call.caller_number}</td>
                    <td className="px-4 py-3 text-white/45">
                      {new Date(call.started_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      {call.was_emergency ? (
                        <StatusBadge status="emergency" label="Emergency" />
                      ) : call.was_booked ? (
                        <StatusBadge status="booked" label="Booked" />
                      ) : (
                        <StatusBadge status={call.status} />
                      )}
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 text-white/45">
                      {call.summary ?? "-"}
                    </td>
                  </tr>
                ))}
                {(callsQuery.data?.calls ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-sm text-white/35">
                      No calls yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
