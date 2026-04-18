import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, MapPin, Phone } from "lucide-react";
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
      <dt className="text-xs font-medium uppercase tracking-[0.22em] text-white/38">{label}</dt>
      <dd className="mt-1 text-white/72">{value}</dd>
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
    <div className="mt-4 rounded-[28px] border border-violet-400/15 bg-[linear-gradient(180deg,rgba(34,25,58,0.82),rgba(14,10,25,0.9))] p-5 shadow-[0_18px_48px_rgba(76,29,149,0.16)]">
      <div className="flex items-start justify-between">
        <h3 className="text-sm font-semibold text-white/78">Booking Details</h3>
        <button onClick={onClose} className="text-lg leading-none text-white/35 hover:text-white/70">
          ×
        </button>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
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
          className="mt-5 rounded-2xl bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-400 disabled:opacity-50"
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
    <div className="mx-auto max-w-7xl space-y-6 p-6 md:p-8">
      <section className="rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(70,56,190,0.2),rgba(16,12,28,0.92)_48%,rgba(24,19,39,0.95))] p-7 shadow-[0_28px_80px_rgba(0,0,0,0.22)]">
        <p className="text-[11px] uppercase tracking-[0.28em] text-white/40">Schedule Board</p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-[clamp(2rem,4vw,3.1rem)] font-semibold tracking-[-0.06em] text-white">
              Upcoming bookings, organized by day.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-white/60">
              Track every appointment the receptionist confirmed and inspect the exact caller details before the job begins.
            </p>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-white/[0.05] px-5 py-4">
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/38">Upcoming</p>
            <p className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-white">{upcoming.length}</p>
          </div>
        </div>
      </section>

      {query.isError ? (
        <p className="text-sm text-rose-300">Failed to load bookings. Please refresh.</p>
      ) : null}

      {groups.length === 0 && !query.isError ? (
        <div className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(22,17,37,0.74),rgba(11,9,20,0.84))] py-16 text-center text-sm text-white/38">
          No upcoming bookings.
        </div>
      ) : null}

      <section className="space-y-6">
        {groups.map(({ label, items }) => (
          <div
            key={label}
            className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(22,17,37,0.74),rgba(11,9,20,0.84))] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.22)]"
          >
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-500/12 text-violet-100">
                <CalendarDays className="h-4.5 w-4.5" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-white/38">Scheduled Day</p>
                <h3 className="mt-1 text-lg font-medium text-white">{label}</h3>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              {items.map((booking) => (
                <div key={booking.id}>
                  <button
                    className="w-full rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(17,14,28,0.76),rgba(11,9,20,0.9))] px-5 py-5 text-left transition-colors hover:border-violet-400/30 hover:bg-[linear-gradient(180deg,rgba(34,25,58,0.82),rgba(14,10,25,0.9))]"
                    onClick={() => setSelected(selected?.id === booking.id ? null : booking)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-white">{booking.caller_name}</p>
                        <div className="mt-3 flex flex-wrap gap-3 text-xs text-white/48">
                          <span className="inline-flex items-center gap-1.5">
                            <Phone className="h-3.5 w-3.5" />
                            {booking.caller_phone}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5" />
                            {booking.caller_address}
                          </span>
                        </div>
                      </div>
                      <StatusBadge status={booking.status} />
                    </div>

                    <div className="mt-5 flex items-end justify-between gap-4">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.22em] text-white/34">Time</p>
                        <p className="mt-1 text-xl font-semibold tracking-[-0.04em] text-violet-200">
                          {formatTime(booking.appointment_start)}
                        </p>
                      </div>
                      <p className="max-w-[14rem] text-right text-sm text-white/52">
                        {booking.problem_description}
                      </p>
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
      </section>
    </div>
  );
}
