import { motion } from "framer-motion";
import { ResponsiveContainer, Line, LineChart } from "recharts";
import type { ProcessStep } from "../data/landing";
import { cardHover, staggerItem } from "../lib/motion";

type ProcessCardProps = {
  step: ProcessStep;
};

const miniData = [
  { value: 14 },
  { value: 22 },
  { value: 18 },
  { value: 29 },
  { value: 25 },
  { value: 34 },
];

export function ProcessCard({ step }: ProcessCardProps) {
  return (
    <motion.div
      variants={staggerItem}
      initial="rest"
      whileHover="hover"
      animate="rest"
      className="rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[linear-gradient(180deg,rgba(13,13,17,0.96),rgba(8,8,10,0.96))] p-6"
    >
      <motion.div variants={cardHover} className="h-full">
        <div className="flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-[0.3em] text-[var(--text-low)]">
            {step.label}
          </span>
          <span className="rounded-full border border-[rgba(139,92,246,0.22)] px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-[var(--accent-bright)]">
            {step.tone}
          </span>
        </div>
        <h3 className="mt-6 text-2xl font-medium tracking-[-0.03em] text-[var(--text-primary)]">
          {step.title}
        </h3>
        <p className="mt-4 max-w-sm text-sm leading-7 text-[var(--text-secondary)]">
          {step.description}
        </p>
        <div className="mt-8 rounded-[14px] border border-[var(--border-muted)] bg-[rgba(255,255,255,0.02)] p-4">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-xs text-[var(--text-muted)]">System quality</span>
            <span className="text-xs text-[var(--accent-bright)]">stable</span>
          </div>
          <div className="h-24">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={miniData}>
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#8B5CF6"
                  dot={false}
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
