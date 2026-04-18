type Status =
  | "emergency"
  | "booked"
  | "completed"
  | "confirmed"
  | "cancelled"
  | "in_progress"
  | "failed"
  | string;

function resolveStyle(status: Status) {
  switch (status) {
    case "emergency":
      return "bg-rose-500/15 text-rose-200";
    case "booked":
    case "confirmed":
      return "bg-emerald-500/15 text-emerald-200";
    case "completed":
      return "bg-sky-500/15 text-sky-200";
    case "cancelled":
      return "bg-white/10 text-white/65";
    case "in_progress":
      return "bg-amber-500/15 text-amber-200";
    case "failed":
      return "bg-rose-500/15 text-rose-200";
    default:
      return "bg-white/10 text-white/75";
  }
}

export function StatusBadge({ status, label }: { status: Status; label?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${resolveStyle(status)}`}
    >
      {label ?? status.replace(/_/g, " ")}
    </span>
  );
}
