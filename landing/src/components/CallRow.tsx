import { useState } from "react";
import type { CallLog } from "../lib/api";
import { StatusBadge } from "./StatusBadge";

export function CallRow({ call }: { call: CallLog }) {
  const [expanded, setExpanded] = useState(false);

  function formatDuration(seconds: number | null) {
    if (seconds == null) return "-";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
  }

  return (
    <>
      <tr
        className="cursor-pointer border-b border-gray-100 transition-colors hover:bg-gray-50"
        onClick={() => setExpanded((value) => !value)}
      >
        <td className="px-4 py-3 text-sm text-gray-700">{call.caller_number}</td>
        <td className="px-4 py-3 text-sm text-gray-500">
          {new Date(call.started_at).toLocaleString()}
        </td>
        <td className="px-4 py-3 text-sm text-gray-500">{formatDuration(call.duration_seconds)}</td>
        <td className="px-4 py-3">
          {call.was_emergency ? (
            <StatusBadge status="emergency" label="Emergency" />
          ) : call.was_booked ? (
            <StatusBadge status="booked" label="Booked" />
          ) : (
            <StatusBadge status={call.status} />
          )}
        </td>
        <td className="max-w-xs truncate px-4 py-3 text-sm text-gray-500">{call.summary ?? "-"}</td>
        <td className="px-4 py-3 text-xs text-gray-400">{expanded ? "▲" : "▼"}</td>
      </tr>

      {expanded ? (
        <tr>
          <td colSpan={6} className="bg-gray-50 px-6 pb-4 pt-2">
            {call.summary ? (
              <div className="mb-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Summary</p>
                <p className="mt-1 text-sm text-gray-700">{call.summary}</p>
              </div>
            ) : null}

            {call.recording_url ? (
              <div className="mb-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Call Recording
                </p>
                <audio controls src={call.recording_url} className="mt-1 h-9 w-full" />
              </div>
            ) : null}

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Transcript</p>
              {call.transcript.length === 0 ? (
                <p className="mt-1 text-sm italic text-gray-400">No transcript available.</p>
              ) : (
                <div className="mt-2 max-h-64 space-y-1 overflow-y-auto">
                  {call.transcript.map((message, index) => (
                    <div
                      key={index}
                      className={`flex gap-2 text-sm ${
                        message.role === "assistant" ? "text-blue-700" : "text-gray-700"
                      }`}
                    >
                      <span className="w-16 shrink-0 font-medium capitalize opacity-70">
                        {message.role}:
                      </span>
                      <span>{message.content}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}
