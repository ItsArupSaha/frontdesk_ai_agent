import { motion } from "framer-motion";
import type { Benefit } from "../data/landing";
import { cardHover, staggerItem } from "../lib/motion";

type BenefitCardProps = {
  benefit: Benefit;
};

export function BenefitCard({ benefit }: BenefitCardProps) {
  const Icon = benefit.icon;

  return (
    <motion.div
      variants={staggerItem}
      initial="rest"
      whileHover="hover"
      animate="rest"
      className="rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[rgba(13,13,17,0.95)] p-6"
    >
      <motion.div variants={cardHover}>
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-[rgba(139,92,246,0.26)] bg-[rgba(124,58,237,0.1)]">
          <Icon className="h-5 w-5 text-[var(--accent-bright)]" />
        </div>
        <h3 className="mt-6 text-xl font-medium tracking-[-0.03em] text-white">{benefit.title}</h3>
        <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">{benefit.description}</p>
      </motion.div>
    </motion.div>
  );
}
