interface MetricCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  color?: "blue" | "green" | "red" | "yellow" | "gray";
}

const shellMap: Record<NonNullable<MetricCardProps["color"]>, string> = {
  blue: "border-violet-300/20 bg-[linear-gradient(180deg,rgba(93,63,211,0.22),rgba(23,18,38,0.82))]",
  green: "border-emerald-400/20 bg-[linear-gradient(180deg,rgba(16,185,129,0.18),rgba(17,22,24,0.82))]",
  red: "border-rose-400/20 bg-[linear-gradient(180deg,rgba(244,63,94,0.16),rgba(25,18,23,0.82))]",
  yellow: "border-amber-400/20 bg-[linear-gradient(180deg,rgba(245,158,11,0.16),rgba(25,20,16,0.82))]",
  gray: "border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(14,11,24,0.78))]",
};

export function MetricCard({ label, value, subtext, color = "blue" }: MetricCardProps) {
  return (
    <div className={`rounded-[28px] border p-5 shadow-[0_18px_48px_rgba(0,0,0,0.18)] ${shellMap[color]}`}>
      <p className="text-[11px] uppercase tracking-[0.26em] text-white/48">{label}</p>
      <p className="mt-3 text-[2.1rem] font-semibold tracking-[-0.05em] text-white">{value}</p>
      {subtext ? <p className="mt-2 text-xs text-white/48">{subtext}</p> : null}
    </div>
  );
}
