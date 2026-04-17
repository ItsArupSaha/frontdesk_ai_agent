interface MetricCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  color?: "blue" | "green" | "red" | "yellow" | "gray";
}

const shellMap: Record<NonNullable<MetricCardProps["color"]>, string> = {
  blue: "border-blue-500/20 bg-blue-500/10 text-blue-100",
  green: "border-emerald-500/20 bg-emerald-500/10 text-emerald-100",
  red: "border-rose-500/20 bg-rose-500/10 text-rose-100",
  yellow: "border-amber-500/20 bg-amber-500/10 text-amber-100",
  gray: "border-white/10 bg-white/[0.03] text-white",
};

export function MetricCard({ label, value, subtext, color = "blue" }: MetricCardProps) {
  return (
    <div className={`rounded-2xl border p-5 ${shellMap[color]}`}>
      <p className="text-xs uppercase tracking-[0.24em] opacity-70">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-[-0.04em]">{value}</p>
      {subtext ? <p className="mt-2 text-xs opacity-60">{subtext}</p> : null}
    </div>
  );
}
