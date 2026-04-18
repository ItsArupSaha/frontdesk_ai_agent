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
        className="cursor-pointer border-b border-white/10 transition-colors hover:bg-white/[0.03]"
        onClick={() => setExpanded((value) => !value)}
      >
        <td className="px-4 py-3 text-sm text-white">{call.caller_number}</td>
        <td className="px-4 py-3 text-sm text-white/58">
          {new Date(call.started_at).toLocaleString()}
        </td>
        <td className="px-4 py-3 text-sm text-white/58">{formatDuration(call.duration_seconds)}</td>
        <td className="px-4 py-3">
          {call.was_emergency ? (
            <StatusBadge status="emergency" label="Emergency" />
          ) : call.was_booked ? (
            <StatusBadge status="booked" label="Booked" />
          ) : (
            <StatusBadge status={call.status} />
          )}
        </td>
        <td className="max-w-xs truncate px-4 py-3 text-sm text-white/58">{call.summary ?? "-"}</td>
        <td className="px-4 py-3 text-xs text-white/35">{expanded ? "▲" : "▼"}</td>
      </tr>

      {expanded ? (
        <tr>
          <td colSpan={6} className="bg-white/[0.03] px-6 pb-4 pt-3">
            {call.summary ? (
              <div className="mb-3">
                <p className="text-xs font-semibold uppercase tracking-[0.26em] text-white/40">Summary</p>
                <p className="mt-2 text-sm leading-6 text-white/72">{call.summary}</p>
              </div>
            ) : null}

            {call.recording_url ? (
              <div className="mb-3">
                <p className="text-xs font-semibold uppercase tracking-[0.26em] text-white/40">
                  Call Recording
                </p>
                <audio controls src={call.recording_url} className="mt-1 h-9 w-full" />
              </div>
            ) : null}

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.26em] text-white/40">Transcript</p>
              {call.transcript.length === 0 ? (
                <p className="mt-2 text-sm italic text-white/38">No transcript available.</p>
              ) : (
                <div className="mt-2 max-h-64 space-y-1 overflow-y-auto">
                  {call.transcript.map((message, index) => (
                    <div
                      key={index}
                      className={`flex gap-2 text-sm ${
                        message.role === "assistant" ? "text-violet-300" : "text-white/72"
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
