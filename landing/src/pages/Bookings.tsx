import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { StatusBadge } from "../components/StatusBadge";
import { useAuth } from "../contexts/AuthContext";
import { getBookings, type Booking, updateBookingStatus } from "../lib/api";

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatDayLabel(value: string) {
  return new Date(value).toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function isUpcoming(value: string) {
  const target = new Date(value);
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return target >= startOfToday;
}

function groupByDate(bookings: Booking[]) {
  const grouped = new Map<string, Booking[]>();
  const sorted = [...bookings].sort(
    (left, right) =>
      new Date(left.appointment_start).getTime() - new Date(right.appointment_start).getTime(),
  );

  for (const booking of sorted) {
    const label = formatDayLabel(booking.appointment_start);
    if (!grouped.has(label)) grouped.set(label, []);
    grouped.get(label)!.push(booking);
  }

  return Array.from(grouped.entries()).map(([label, items]) => ({ label, items }));
}

function Detail({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "col-span-2" : ""}>
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</dt>
      <dd className="mt-0.5 text-gray-700">{value}</dd>
    </div>
  );
}

function DetailPanel({
  booking,
  token,
  clientId,
  onClose,
}: {
  booking: Booking;
  token: string;
  clientId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => updateBookingStatus(token, clientId, booking.id, "completed"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings", clientId] });
      onClose();
    },
  });

  return (
    <div className="mt-4 rounded-lg border border-gray-200 bg-blue-50 p-5">
      <div className="flex items-start justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Booking Details</h3>
        <button onClick={onClose} className="text-lg leading-none text-gray-400 hover:text-gray-600">
          ×
        </button>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <Detail label="Caller" value={booking.caller_name} />
        <Detail label="Phone" value={booking.caller_phone} />
        <Detail label="Address" value={booking.caller_address} />
        <Detail label="Time" value={formatTime(booking.appointment_start)} />
        <Detail label="Problem" value={booking.problem_description} wide />
        <Detail label="Status" value={<StatusBadge status={booking.status} />} />
        <Detail label="SMS sent" value={booking.confirmation_sms_sent ? "Yes" : "No"} />
        <Detail label="FSM synced" value={booking.fsm_synced ? "Yes" : "No"} />
      </dl>

      {booking.status === "confirmed" ? (
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="mt-4 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          {mutation.isPending ? "Saving..." : "Mark as Completed"}
        </button>
      ) : null}
    </div>
  );
}

export default function BookingsPage() {
  const { token, clientId } = useAuth();
  const [selected, setSelected] = useState<Booking | null>(null);

  const query = useQuery({
    queryKey: ["bookings", clientId],
    queryFn: () => getBookings(token!, clientId!),
    enabled: !!token && !!clientId,
  });

  if (!token || !clientId || query.isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const upcoming = (query.data?.bookings ?? []).filter((booking) => isUpcoming(booking.appointment_start));
  const groups = groupByDate(upcoming);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800">Upcoming Bookings</h2>
        <span className="text-sm text-gray-400">
          {upcoming.length} appointment{upcoming.length !== 1 ? "s" : ""}
        </span>
      </div>

      {query.isError ? (
        <p className="text-sm text-red-500">Failed to load bookings. Please refresh.</p>
      ) : null}

      {groups.length === 0 && !query.isError ? (
        <div className="rounded-lg border border-gray-200 bg-white py-12 text-center text-sm text-gray-400">
          No upcoming bookings.
        </div>
      ) : null}

      {groups.map(({ label, items }) => (
        <div key={label}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</h3>
          <div className="space-y-2">
            {items.map((booking) => (
              <div key={booking.id}>
                <button
                  className="w-full rounded-lg border border-gray-200 bg-white px-5 py-4 text-left transition-colors hover:border-violet-300 hover:bg-violet-50"
                  onClick={() => setSelected(selected?.id === booking.id ? null : booking)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span className="w-16 shrink-0 text-sm font-medium text-violet-600">
                        {formatTime(booking.appointment_start)}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{booking.caller_name}</p>
                        <p className="text-xs text-gray-500">{booking.caller_address}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="max-w-48 truncate text-xs text-gray-500">
                        {booking.problem_description}
                      </p>
                      <StatusBadge status={booking.status} />
                    </div>
                  </div>
                </button>

                {selected?.id === booking.id ? (
                  <DetailPanel
                    booking={booking}
                    token={token}
                    clientId={clientId}
                    onClose={() => setSelected(null)}
                  />
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
