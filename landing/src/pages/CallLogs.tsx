import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800">Call Logs</h2>
        <button
          onClick={() => downloadCsv(filteredCalls)}
          className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
        >
          Export CSV
        </button>
      </div>

      <div className="flex flex-wrap gap-3 rounded-lg border border-gray-200 bg-white p-4">
        <input
          type="text"
          placeholder="Search caller or summary..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="min-w-48 flex-1 rounded-md border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
        <input
          type="datetime-local"
          value={startDate}
          onChange={(event) => setStartDate(event.target.value)}
          className="rounded-md border border-gray-200 px-3 py-1.5 text-sm"
          aria-label="Start date"
        />
        <input
          type="datetime-local"
          value={endDate}
          onChange={(event) => setEndDate(event.target.value)}
          className="rounded-md border border-gray-200 px-3 py-1.5 text-sm"
          aria-label="End date"
        />
        <label className="flex items-center gap-1.5 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={emergencyOnly}
            onChange={(event) => setEmergencyOnly(event.target.checked)}
          />
          Emergencies only
        </label>
        <label className="flex items-center gap-1.5 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={bookedOnly}
            onChange={(event) => setBookedOnly(event.target.checked)}
          />
          Booked only
        </label>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        {query.isLoading ? (
          <div className="flex justify-center py-10">
            <LoadingSpinner />
          </div>
        ) : query.isError ? (
          <p className="p-6 text-center text-sm text-red-500">Failed to load calls. Please refresh.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
                <th className="px-4 py-2">Caller</th>
                <th className="px-4 py-2">Time</th>
                <th className="px-4 py-2">Duration</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Summary</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {filteredCalls.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-sm text-gray-400">
                    No calls match your filters.
                  </td>
                </tr>
              ) : (
                filteredCalls.map((call) => <CallRow key={call.id} call={call} />)
              )}
            </tbody>
          </table>
        )}
      </div>

      {!query.isLoading ? (
        <p className="text-right text-xs text-gray-400">
          {filteredCalls.length} call{filteredCalls.length !== 1 ? "s" : ""} shown
        </p>
      ) : null}
    </div>
  );
}
