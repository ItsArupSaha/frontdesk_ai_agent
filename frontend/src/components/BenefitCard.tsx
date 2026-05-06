import { motion } from "framer-motion";
import type { Benefit } from "../data/landing";
import { staggerItem } from "../lib/motion";

type BenefitCardProps = {
  benefit: Benefit;
};

export function BenefitCard({ benefit }: BenefitCardProps) {
  const Icon = benefit.icon;

  return (
    <motion.div
      variants={staggerItem}
      whileHover={{ y: -3, backgroundColor: "rgba(18,18,24,0.98)" }}
      transition={{ duration: 0.2 }}
      className="rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[rgba(13,13,17,0.95)] p-6"
    >
      <div className="flex h-full flex-col">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-[rgba(139,92,246,0.26)] bg-[rgba(124,58,237,0.1)]">
          <Icon className="h-5 w-5 text-[var(--accent-bright)]" />
        </div>
        <h3 className="mt-5 text-xl font-medium tracking-[-0.03em] text-white">
          {benefit.title}
        </h3>
        <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
          {benefit.description}
        </p>
        <div className="mt-5 inline-flex w-fit items-center rounded-full border border-[rgba(139,92,246,0.18)] bg-[rgba(124,58,237,0.08)] px-3 py-1">
          <span className="text-[11px] font-medium tracking-wide text-[var(--accent-bright)]">
            {benefit.stat}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
