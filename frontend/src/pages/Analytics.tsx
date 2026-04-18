import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, ChartColumn, Radar } from "lucide-react";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { useAuth } from "../contexts/AuthContext";
import { getAnalytics } from "../lib/api";

const periods = ["7d", "30d", "90d"] as const;
type Period = (typeof periods)[number];

export default function AnalyticsPage() {
  const { token, clientId } = useAuth();
  const [period, setPeriod] = useState<Period>("30d");

  const query = useQuery({
    queryKey: ["analytics", clientId, period],
    queryFn: () => getAnalytics(token!, clientId!, period),
    enabled: !!token && !!clientId,
  });

  function emergencyColor(rate: number) {
    if (rate > 0.2) return "text-rose-300";
    if (rate > 0.1) return "text-amber-300";
    return "text-emerald-300";
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 md:p-8">
      <section className="flex flex-col gap-6 rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(70,56,190,0.2),rgba(16,12,28,0.92)_48%,rgba(24,19,39,0.95))] p-7 shadow-[0_28px_80px_rgba(0,0,0,0.22)] lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-white/40">Performance View</p>
          <h2 className="mt-3 text-[clamp(2rem,4vw,3.1rem)] font-semibold tracking-[-0.06em] text-white">
            Trends across calls, bookings, and urgency.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-white/60">
            See how demand shifts across the week and where your receptionist is generating conversions.
          </p>
        </div>

        <div className="flex gap-2 rounded-full border border-white/10 bg-white/[0.05] p-1">
          {periods.map((value) => (
            <button
              key={value}
              onClick={() => setPeriod(value)}
              className={`rounded-full px-4 py-2 text-sm transition-colors ${
                period === value
                  ? "bg-violet-500/80 text-white"
                  : "text-white/58 hover:bg-white/[0.06] hover:text-white"
              }`}
            >
              {value}
            </button>
          ))}
        </div>
      </section>

      {query.isLoading ? (
        <div className="flex justify-center py-20">
          <LoadingSpinner size="lg" />
        </div>
      ) : query.isError ? (
        <p className="text-center text-sm text-rose-300">Failed to load analytics.</p>
      ) : query.data ? (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(64,43,120,0.34),rgba(14,11,26,0.88))] p-5 shadow-[0_20px_64px_rgba(0,0,0,0.2)]">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-500/12 text-violet-100">
                <Radar className="h-4.5 w-4.5" />
              </div>
              <p className="mt-5 text-[11px] uppercase tracking-[0.24em] text-white/40">Emergency Rate</p>
              <p className={`mt-3 text-4xl font-semibold tracking-[-0.05em] ${emergencyColor(query.data.emergency_rate)}`}>
                {(query.data.emergency_rate * 100).toFixed(1)}%
              </p>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(22,17,37,0.74),rgba(11,9,20,0.84))] p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/12 text-emerald-100">
                <Activity className="h-4.5 w-4.5" />
              </div>
              <p className="mt-5 text-[11px] uppercase tracking-[0.24em] text-white/40">Period</p>
              <p className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-white">
                {query.data.period_days}
              </p>
              <p className="mt-2 text-xs text-white/45">days analyzed</p>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(22,17,37,0.74),rgba(11,9,20,0.84))] p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/12 text-amber-100">
                <ChartColumn className="h-4.5 w-4.5" />
              </div>
              <p className="mt-5 text-[11px] uppercase tracking-[0.24em] text-white/40">Peak Hours</p>
              <p className="mt-3 text-2xl font-semibold tracking-[-0.05em] text-white">
                {query.data.calls_by_hour.reduce((best, item) => (item.count > best.count ? item : best), query.data.calls_by_hour[0])?.hour ?? "--"}:00
              </p>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(22,17,37,0.74),rgba(11,9,20,0.84))] p-6">
              <p className="text-[11px] uppercase tracking-[0.24em] text-white/40">Demand Curve</p>
              <h3 className="mt-2 text-lg font-medium text-white">Calls per day</h3>
              <div className="mt-6 h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={query.data.calls_per_day}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: "rgba(255,255,255,0.45)" }}
                      tickFormatter={(value: string) => value.slice(5)}
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "rgba(255,255,255,0.45)" }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="count" name="Calls" stroke="#a78bfa" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(22,17,37,0.74),rgba(11,9,20,0.84))] p-6">
              <p className="text-[11px] uppercase tracking-[0.24em] text-white/40">Hourly Pressure</p>
              <h3 className="mt-2 text-lg font-medium text-white">Calls by hour</h3>
              <div className="mt-6 h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={query.data.calls_by_hour}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="hour" tick={{ fontSize: 11, fill: "rgba(255,255,255,0.45)" }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "rgba(255,255,255,0.45)" }} />
                    <Tooltip />
                    <Bar dataKey="count" name="Calls" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          <section className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(22,17,37,0.74),rgba(11,9,20,0.84))] p-6">
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/40">Conversion Curve</p>
            <h3 className="mt-2 text-lg font-medium text-white">Bookings per day</h3>
            <div className="mt-6 h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={query.data.bookings_per_day}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: "rgba(255,255,255,0.45)" }}
                    tickFormatter={(value: string) => value.slice(5)}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "rgba(255,255,255,0.45)" }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" name="Bookings" stroke="#34d399" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
