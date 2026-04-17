import { motion } from "framer-motion";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Feature } from "../data/landing";
import { cardHover, splitReveal, staggerContainer, staggerItem, viewportOnce } from "../lib/motion";

type FeatureRowProps = {
  feature: Feature;
  reverse?: boolean;
};

const chartData = [
  { name: "Mon", value: 18 },
  { name: "Tue", value: 28 },
  { name: "Wed", value: 22 },
  { name: "Thu", value: 34 },
  { name: "Fri", value: 47 },
  { name: "Sat", value: 41 },
];

export function FeatureRow({ feature, reverse = false }: FeatureRowProps) {
  return (
    <motion.article
      className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14"
      variants={staggerContainer}
      initial="hidden"
      whileInView="visible"
      viewport={viewportOnce}
    >
      <motion.div
        variants={splitReveal(reverse ? "right" : "left")}
        className={reverse ? "lg:order-2" : ""}
      >
        <motion.div
          variants={cardHover}
          initial="rest"
          whileHover="hover"
          animate="rest"
          className="relative overflow-hidden rounded-[var(--radius-panel)] border border-[var(--border-default)] bg-[linear-gradient(180deg,rgba(13,13,17,0.96),rgba(8,8,10,0.96))] p-6 sm:p-7"
        >
          <div className="absolute inset-x-10 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(139,92,246,0.55),transparent)]" />
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-[var(--text-low)]">
                Control Surface
              </p>
              <h3 className="mt-2 text-lg font-medium text-[var(--text-primary)]">
                {feature.eyebrow}
              </h3>
            </div>
            <div className="rounded-full border border-[rgba(139,92,246,0.26)] bg-[rgba(124,58,237,0.12)] px-3 py-1 text-xs text-[var(--accent-bright)]">
              Live
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-[16px] border border-[var(--border-muted)] bg-[rgba(255,255,255,0.02)] p-4">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-[var(--text-low)]">Workflow throughput</p>
                  <p className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-white">
                    {feature.stats[0]?.value}
                  </p>
                </div>
                <div className="rounded-full border border-[var(--border-default)] px-2 py-1 text-[10px] uppercase tracking-[0.24em] text-[var(--text-muted)]">
                  Weekly
                </div>
              </div>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id={`feature-${feature.id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.46} />
                        <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.28)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Tooltip
                      contentStyle={{
                        background: "#0D0D11",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 12,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#8B5CF6"
                      strokeWidth={2}
                      fill={`url(#feature-${feature.id})`}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-[16px] border border-[var(--border-muted)] bg-[rgba(255,255,255,0.02)] p-4">
                <p className="text-xs uppercase tracking-[0.26em] text-[var(--text-low)]">
                  Active nodes
                </p>
                <div className="mt-4 space-y-3">
                  {feature.chips.slice(0, 3).map((chip, index) => (
                    <div
                      key={chip}
                      className="flex items-center justify-between rounded-[12px] border border-[var(--border-muted)] bg-[rgba(255,255,255,0.02)] px-3 py-2"
                    >
                      <span className="text-sm text-[var(--text-secondary)]">{chip}</span>
                      <span className="text-xs text-[var(--accent-bright)]">0{index + 1}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-[16px] border border-[var(--border-muted)] bg-[rgba(255,255,255,0.02)] p-4">
                <p className="text-xs uppercase tracking-[0.26em] text-[var(--text-low)]">Signals</p>
                <div className="mt-4 grid gap-3">
                  {feature.stats.slice(1).map((stat) => (
                    <div key={stat.label} className="flex items-end justify-between">
                      <span className="text-sm text-[var(--text-muted)]">{stat.label}</span>
                      <span className="text-lg font-medium tracking-[-0.03em] text-white">
                        {stat.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>

      <motion.div variants={staggerContainer} className={reverse ? "lg:order-1" : ""}>
        <motion.p
          variants={staggerItem}
          className="mb-4 text-[11px] uppercase tracking-[0.3em] text-[var(--text-muted)]"
        >
          {feature.eyebrow}
        </motion.p>
        <motion.h3
          variants={staggerItem}
          className="max-w-xl text-[clamp(2rem,4vw,2.85rem)] font-semibold leading-[1.02] tracking-[-0.04em] text-[var(--text-primary)]"
        >
          {feature.title}
        </motion.h3>
        <motion.p
          variants={staggerItem}
          className="mt-5 max-w-xl text-sm leading-7 text-[var(--text-secondary)] sm:text-base"
        >
          {feature.description}
        </motion.p>
        <motion.div variants={staggerItem} className="mt-7 flex flex-wrap gap-3">
          {feature.chips.map((chip) => (
            <span
              key={chip}
              className="rounded-full border border-[var(--border-default)] bg-[rgba(13,13,17,0.88)] px-3 py-1.5 text-xs text-[var(--text-secondary)]"
            >
              {chip}
            </span>
          ))}
        </motion.div>
      </motion.div>
    </motion.article>
  );
}
