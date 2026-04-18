import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Filter } from "lucide-react";
import { CallRow } from "../components/CallRow";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { useAuth } from "../contexts/AuthContext";
import { getCalls, type CallLog } from "../lib/api";

function csvEscape(value: string | boolean | number | null | undefined) {
  const text = String(value ?? "");
  return text.includes(",") || text.includes("\"") || text.includes("\n")
    ? `"${text.replace(/"/g, "\"\"")}"`
    : text;
}

function downloadCsv(calls: CallLog[]) {
  const headers = [
    "Caller",
    "Started At",
    "Duration (s)",
    "Emergency",
    "Booked",
    "Status",
    "Summary",
  ];
  const rows = calls.map((call) => [
    csvEscape(call.caller_number),
    csvEscape(call.started_at),
    csvEscape(call.duration_seconds),
    csvEscape(call.was_emergency),
    csvEscape(call.was_booked),
    csvEscape(call.status),
    csvEscape(call.summary),
  ]);
  const csv = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "call-logs.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export default function CallLogsPage() {
  const { token, clientId } = useAuth();
  const [emergencyOnly, setEmergencyOnly] = useState(false);
  const [bookedOnly, setBookedOnly] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [search, setSearch] = useState("");

  const query = useQuery({
    queryKey: ["calls", clientId, emergencyOnly, bookedOnly, startDate, endDate],
    queryFn: () =>
      getCalls(token!, clientId!, {
        limit: 200,
        emergency_only: emergencyOnly,
        booked_only: bookedOnly,
        start: startDate || undefined,
        end: endDate || undefined,
      }),
    enabled: !!token && !!clientId,
  });

  const filteredCalls = useMemo(() => {
    const calls = query.data?.calls ?? [];
    if (!search.trim()) return calls;
    const needle = search.toLowerCase();
    return calls.filter(
      (call) =>
        call.caller_number.toLowerCase().includes(needle) ||
        (call.summary ?? "").toLowerCase().includes(needle),
    );
  }, [query.data?.calls, search]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 md:p-8">
      <section className="flex flex-col gap-4 rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(70,56,190,0.2),rgba(16,12,28,0.92)_48%,rgba(24,19,39,0.95))] p-7 shadow-[0_28px_80px_rgba(0,0,0,0.22)] md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-white/40">Conversation Archive</p>
          <h2 className="mt-3 text-[clamp(2rem,4vw,3.25rem)] font-semibold tracking-[-0.06em] text-white">
            Review every customer call.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-white/60">
            Search conversations, isolate bookings or emergencies, and export the call history when you need it.
          </p>
        </div>

        <button
          onClick={() => downloadCsv(filteredCalls)}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-5 py-3 text-sm text-white/80 transition-colors hover:bg-white/[0.09] hover:text-white"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </section>

      <section className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(22,17,37,0.74),rgba(11,9,20,0.84))] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.22)]">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-500/12 text-violet-100">
              <Filter className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-white/40">Filters</p>
              <h3 className="mt-1 text-lg font-medium text-white">Refine results</h3>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.2fr_repeat(4,minmax(0,0.7fr))]">
            <input
              type="text"
              placeholder="Search caller or summary"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full rounded-[20px] border border-white/10 bg-[#0d0a16] px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-violet-500/60"
            />
            <input
              type="datetime-local"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="w-full rounded-[20px] border border-white/10 bg-[#0d0a16] px-4 py-3 text-sm text-white [color-scheme:dark]"
              aria-label="Start date"
            />
            <input
              type="datetime-local"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="w-full rounded-[20px] border border-white/10 bg-[#0d0a16] px-4 py-3 text-sm text-white [color-scheme:dark]"
              aria-label="End date"
            />
            <label className="flex items-center justify-center gap-3 rounded-[20px] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/70">
              <input
                type="checkbox"
                checked={emergencyOnly}
                onChange={(event) => setEmergencyOnly(event.target.checked)}
                className="h-4 w-4 accent-violet-500"
              />
              Emergencies
            </label>
            <label className="flex items-center justify-center gap-3 rounded-[20px] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/70">
              <input
                type="checkbox"
                checked={bookedOnly}
                onChange={(event) => setBookedOnly(event.target.checked)}
                className="h-4 w-4 accent-violet-500"
              />
              Booked
            </label>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(22,17,37,0.74),rgba(11,9,20,0.84))] shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/40">Results</p>
            <h3 className="mt-2 text-lg font-medium text-white">Full call list</h3>
          </div>
          <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/70">
            {filteredCalls.length} shown
          </div>
        </div>

        {query.isLoading ? (
          <div className="flex justify-center py-14">
            <LoadingSpinner />
          </div>
        ) : query.isError ? (
          <p className="p-6 text-center text-sm text-rose-300">Failed to load calls. Please refresh.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px]">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs uppercase tracking-[0.28em] text-white/38">
                  <th className="px-4 py-3">Caller</th>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Duration</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Summary</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filteredCalls.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-sm text-white/38">
                      No calls match your filters.
                    </td>
                  </tr>
                ) : (
                  filteredCalls.map((call) => <CallRow key={call.id} call={call} />)
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
