import { motion } from "framer-motion";
import { Check } from "lucide-react";
import type { Plan } from "../data/landing";
import { buttonHover, staggerItem } from "../lib/motion";

type PricingCardProps = {
  plan: Plan;
  yearly: boolean;
};

export function PricingCard({ plan, yearly }: PricingCardProps) {
  const isFeatured = Boolean(plan.featured);
  const price = yearly ? plan.yearlyPrice : plan.price;

  return (
    <motion.div
      variants={staggerItem}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.2 }}
      className={[
        "relative flex h-full flex-col rounded-[var(--radius-card)] border p-7",
        isFeatured
          ? "border-[rgba(139,92,246,0.4)] bg-[linear-gradient(180deg,rgba(25,16,42,0.97),rgba(13,13,17,0.98))]"
          : "border-[var(--border-default)] bg-[rgba(13,13,17,0.96)]",
      ].join(" ")}
    >
      {isFeatured && (
        <span className="mb-5 inline-flex w-fit rounded-full border border-[rgba(139,92,246,0.28)] bg-[rgba(124,58,237,0.12)] px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-[var(--accent-bright)]">
          Most Popular
        </span>
      )}

      <h3 className="text-xl font-medium text-white">{plan.name}</h3>

      {/* Price */}
      <motion.div
        key={price}
        initial={{ opacity: 0.6, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="mt-4 flex items-end gap-1.5"
      >
        <span className="text-5xl font-semibold tracking-[-0.05em] text-white">{price}</span>
        <span className="mb-1 text-sm text-[var(--text-muted)]">/ month</span>
      </motion.div>

      {/* Setup fee */}
      <div className="mt-2">
        <span className="text-xs text-[var(--text-low)]">+ {plan.setupFee}</span>
      </div>

      <p className="mt-4 text-sm leading-7 text-[var(--text-secondary)]">{plan.description}</p>

      {/* Divider */}
      <div className="my-6 h-px bg-[var(--border-muted)]" />

      {/* Features */}
      <ul className="space-y-3.5">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-3 text-sm text-[var(--text-secondary)]">
            <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[rgba(139,92,246,0.25)] bg-[rgba(124,58,237,0.1)]">
              <Check className="h-3 w-3 text-[var(--accent-bright)]" />
            </span>
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <div className="mt-auto pt-8">
        <motion.a
          href="/onboarding"
          variants={buttonHover}
          initial="rest"
          whileHover="hover"
          animate="rest"
          className={[
            "inline-flex w-full items-center justify-center rounded-[var(--radius-button)] border px-4 py-3 text-sm font-medium transition-colors duration-200",
            isFeatured
              ? "border-[rgba(139,92,246,0.35)] bg-[linear-gradient(135deg,#7C3AED_0%,#8B5CF6_100%)] text-white shadow-[var(--shadow-button)]"
              : "border-[var(--border-default)] bg-[rgba(255,255,255,0.02)] text-[var(--text-primary)] hover:border-[rgba(139,92,246,0.28)] hover:bg-[rgba(255,255,255,0.04)]",
          ].join(" ")}
        >
          {plan.ctaLabel}
        </motion.a>
      </div>
    </motion.div>
  );
}
