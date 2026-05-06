import { motion } from "framer-motion";
import { Check, PhoneIncoming } from "lucide-react";
import type { ProcessStep } from "../data/landing";
import { staggerItem } from "../lib/motion";

type ProcessCardProps = {
  step: ProcessStep;
};

function StepVisual({ id }: { id: string }) {
  if (id === "setup") {
    return (
      <div className="space-y-2.5">
        {["Services & pricing configured", "Working hours set", "Emergency line added"].map(
          (item, i) => (
            <motion.div
              key={item}
              initial={{ opacity: 0, x: -6 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 + i * 0.1, duration: 0.4 }}
              viewport={{ once: true }}
              className="flex items-center gap-2.5"
            >
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-violet-500/20">
                <Check className="h-2.5 w-2.5 text-violet-400" />
              </span>
              <span className="text-xs text-[var(--text-muted)]">{item}</span>
            </motion.div>
          ),
        )}
      </div>
    );
  }

  if (id === "configure") {
    return (
      <div className="flex items-end gap-[3px] h-10">
        {[4, 7, 5, 9, 6, 8, 5, 7, 9, 6, 8, 4, 7, 5, 6].map((h, i) => (
          <motion.div
            key={i}
            className="flex-1 rounded-sm bg-violet-500/50"
            animate={{ scaleY: [1, 1.5, 0.7, 1.3, 1] }}
            transition={{
              duration: 1.8,
              delay: i * 0.07,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            style={{ height: `${h * 4}px`, transformOrigin: "bottom" }}
          />
        ))}
      </div>
    );
  }

  if (id === "golive") {
    return (
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-violet-500/30 bg-violet-500/10">
          <PhoneIncoming className="h-4 w-4 text-violet-400" />
        </div>
        <div className="flex flex-1 flex-col gap-2">
          {[
            { label: "Call received", active: true },
            { label: "Lead qualified", active: true },
            { label: "Appointment booked", active: true },
          ].map(({ label, active }) => (
            <div key={label} className="flex items-center gap-2">
              <div
                className={`h-1.5 rounded-full transition-all ${active ? "w-14 bg-violet-500" : "w-8 bg-white/10"}`}
              />
              <span className="text-[10px] text-[var(--text-muted)]">{label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (id === "monitor") {
    return (
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Calls", value: "48", color: "text-violet-400" },
          { label: "Booked", value: "31", color: "text-emerald-400" },
          { label: "Recovered", value: "12", color: "text-amber-400" },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="rounded-xl border border-[var(--border-muted)] bg-white/[0.02] p-2 text-center"
          >
            <div className={`text-lg font-semibold ${color}`}>{value}</div>
            <div className="text-[9px] uppercase tracking-wider text-[var(--text-low)]">
              {label}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return null;
}

export function ProcessCard({ step }: ProcessCardProps) {
  const Icon = step.icon;

  return (
    <motion.div
      variants={staggerItem}
      whileHover={{ y: -2, borderColor: "rgba(139,92,246,0.28)" }}
      className="relative overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[linear-gradient(160deg,rgba(13,13,17,0.98),rgba(8,8,10,0.98))] p-6 transition-colors duration-200"
    >
      {/* Faded step number watermark */}
      <span className="pointer-events-none absolute right-3 top-1 select-none text-[6rem] font-bold leading-none text-white/[0.03]">
        {step.label}
      </span>

      <div className="relative z-10 flex h-full flex-col gap-5">
        {/* Icon + tone badge */}
        <div className="flex items-start justify-between">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border-default)] bg-violet-500/10">
            <Icon className="h-[18px] w-[18px] text-violet-400" />
          </div>
          <span className="rounded-full border border-[rgba(139,92,246,0.22)] px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-[var(--accent-bright)]">
            {step.tone}
          </span>
        </div>

        {/* Step number + title + description */}
        <div>
          <span className="text-[11px] font-medium uppercase tracking-[0.3em] text-[var(--text-low)]">
            Step {step.label}
          </span>
          <h3 className="mt-2 text-xl font-medium tracking-[-0.03em] text-[var(--text-primary)]">
            {step.title}
          </h3>
          <p className="mt-3 text-sm leading-[1.75] text-[var(--text-secondary)]">
            {step.description}
          </p>
        </div>

        {/* Mini visual */}
        <div className="mt-auto rounded-[14px] border border-[var(--border-muted)] bg-[rgba(255,255,255,0.018)] p-4">
          <StepVisual id={step.id} />
        </div>
      </div>
    </motion.div>
  );
}
