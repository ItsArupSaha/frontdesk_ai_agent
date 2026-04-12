import { useState } from 'react'
import type { CallLog } from '../lib/api'
import StatusBadge from './StatusBadge'

interface Props {
  call: CallLog
}

function formatDuration(seconds: number | null): string {
  if (seconds == null) return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString()
}

export default function CallRow({ call }: Props) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <tr
        className="cursor-pointer border-b border-gray-100 hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded((v) => !v)}
        data-testid="call-row"
      >
        <td className="px-4 py-3 text-sm text-gray-700">{call.caller_number}</td>
        <td className="px-4 py-3 text-sm text-gray-500">{formatDate(call.started_at)}</td>
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
        <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">
          {call.summary ?? '—'}
        </td>
        <td className="px-4 py-3 text-xs text-gray-400">{expanded ? '▲' : '▼'}</td>
      </tr>

      {expanded && (
        <tr data-testid="call-row-expanded">
          <td colSpan={6} className="bg-gray-50 px-6 pb-4 pt-2">
            {call.summary && (
              <div className="mb-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Summary
                </p>
                <p className="mt-1 text-sm text-gray-700">{call.summary}</p>
              </div>
            )}
            {call.recording_url && (
              <div className="mb-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Call Recording
                </p>
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <audio
                  controls
                  src={call.recording_url}
                  className="mt-1 h-9 w-full"
                  data-testid="call-audio-player"
                />
              </div>
            )}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Transcript
              </p>
              {call.transcript.length === 0 ? (
                <p className="mt-1 text-sm text-gray-400 italic">No transcript available.</p>
              ) : (
                <div className="mt-2 max-h-64 space-y-1 overflow-y-auto">
                  {call.transcript.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex gap-2 text-sm ${
                        msg.role === 'assistant'
                          ? 'text-blue-700'
                          : 'text-gray-700'
                      }`}
                    >
                      <span className="w-16 shrink-0 font-medium capitalize opacity-70">
                        {msg.role}:
                      </span>
                      <span>{msg.content}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
