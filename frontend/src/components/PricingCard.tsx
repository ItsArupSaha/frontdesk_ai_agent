import { motion } from "framer-motion";
import { Check } from "lucide-react";
import type { Plan } from "../data/landing";
import { buttonHover, cardHover, staggerItem } from "../lib/motion";

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
      initial="rest"
      whileHover="hover"
      animate="rest"
      className={[
        "relative flex h-full flex-col rounded-[var(--radius-card)] border p-7",
        isFeatured
          ? "border-[rgba(139,92,246,0.4)] bg-[linear-gradient(180deg,rgba(25,16,42,0.95),rgba(13,13,17,0.98))]"
          : "border-[var(--border-default)] bg-[rgba(13,13,17,0.96)]",
      ].join(" ")}
    >
      <motion.div variants={cardHover} className="flex h-full flex-col">
        {isFeatured ? (
          <span className="mb-5 inline-flex w-fit rounded-full border border-[rgba(139,92,246,0.28)] bg-[rgba(124,58,237,0.12)] px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-[var(--accent-bright)]">
            Most Popular
          </span>
        ) : null}
        <h3 className="text-xl font-medium text-white">{plan.name}</h3>
        <motion.div
          key={price}
          initial={{ opacity: 0.7, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          className="mt-5 flex items-end gap-2"
        >
          <span className="text-5xl font-semibold tracking-[-0.05em] text-white">{price}</span>
          {price !== "Custom" ? (
            <span className="pb-1 text-sm text-[var(--text-muted)]">/ month</span>
          ) : null}
        </motion.div>
        <p className="mt-5 min-h-12 text-sm leading-7 text-[var(--text-secondary)]">
          {plan.description}
        </p>
        <ul className="mt-7 space-y-4">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-start gap-3 text-sm text-[var(--text-secondary)]">
              <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border border-[rgba(139,92,246,0.25)] bg-[rgba(124,58,237,0.1)]">
                <Check className="h-3.5 w-3.5 text-[var(--accent-bright)]" />
              </span>
              <span>{feature}</span>
            </li>
          ))}
        </ul>
        <div className="mt-auto pt-8">
          <motion.a
            href="#cta"
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
            {plan.name === "Enterprise" ? "Request Proposal" : "Choose Plan"}
          </motion.a>
        </div>
      </motion.div>
    </motion.div>
  );
}
