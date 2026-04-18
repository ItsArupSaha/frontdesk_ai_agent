import { motion } from "framer-motion";
import { CheckCircle2, CircleDollarSign, Sparkles } from "lucide-react";
import { fadeUp, staggerContainer, viewportOnce } from "../../lib/motion";
import { showcaseBullets } from "../../data/landing";
import { SectionHeading } from "../SectionHeading";
import { SectionParticleLayer } from "../SectionParticleLayer";

const showcaseNodeLabels = ["Lead intake", "Intent score", "Exec handoff"];

const showcaseSignalItems = [
  "Response lag reduced across all channels",
  "Unified records across CRM, support, and reporting",
  "Escalations routed using business-specific logic",
];

export function ShowcaseSection() {
  return (
    <section
      id="showcase"
      className="relative isolate overflow-hidden px-4 py-[clamp(5rem,8vw,8rem)] sm:px-6 lg:px-8"
    >
      <SectionParticleLayer glowClassName="bg-[radial-gradient(circle_at_20%_20%,rgba(124,58,237,0.12),transparent_34%)]" />
      <div className="relative z-10 mx-auto max-w-[1240px]">
        <SectionHeading
          eyebrow="Showcase"
          title="A controlled automation layer for teams that need speed without chaos."
          description="The system below represents how we combine workflow visibility, event triggers, and operational intelligence into one measured surface."
        />
        <div className="grid items-center gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:gap-14">
          <ShowcasePanel />
          <ShowcaseBulletList />
        </div>
      </div>
    </section>
  );
}

function ShowcasePanel() {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={viewportOnce}
      variants={fadeUp}
      className="relative overflow-hidden rounded-[var(--radius-panel)] border border-[var(--border-default)] bg-[linear-gradient(180deg,rgba(13,13,17,0.98),rgba(8,8,10,0.96))] p-5 sm:p-6"
    >
      <div className="absolute inset-x-10 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(139,92,246,0.55),transparent)]" />
      <div className="grid gap-5 lg:grid-cols-[0.88fr_1.12fr]">
        <div className="rounded-[18px] border border-[var(--border-muted)] bg-[radial-gradient(circle_at_top,rgba(139,92,246,0.24),rgba(13,13,17,0.92)_56%)] p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-[var(--text-low)]">
                Revenue engine
              </p>
              <p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-white">92%</p>
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[rgba(139,92,246,0.24)] bg-[rgba(124,58,237,0.14)]">
              <CircleDollarSign className="h-6 w-6 text-[var(--accent-bright)]" />
            </div>
          </div>
          <div className="mt-8 space-y-3">
            <div className="h-2 rounded-full bg-[rgba(255,255,255,0.06)]">
              <div className="h-full w-[86%] rounded-full bg-[linear-gradient(135deg,#7C3AED_0%,#8B5CF6_100%)]" />
            </div>
            <div className="flex justify-between text-sm text-[var(--text-muted)]">
              <span>Qualification accuracy</span>
              <span>86%</span>
            </div>
          </div>
        </div>

        <div className="grid gap-5">
          <div className="rounded-[18px] border border-[var(--border-muted)] bg-[rgba(255,255,255,0.02)] p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-[var(--text-low)]">
                  Intelligent routing
                </p>
                <p className="mt-2 text-xl font-medium text-white">Event-driven decisions</p>
              </div>
              <Sparkles className="h-5 w-5 text-[var(--accent-bright)]" />
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {showcaseNodeLabels.map((item, index) => (
                <div
                  key={item}
                  className="rounded-[14px] border border-[var(--border-muted)] bg-[rgba(255,255,255,0.02)] px-4 py-3 text-sm text-[var(--text-secondary)]"
                >
                  <span className="mb-2 block text-[10px] uppercase tracking-[0.24em] text-[var(--text-low)]">
                    0{index + 1}
                  </span>
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-[18px] border border-[var(--border-muted)] bg-[rgba(255,255,255,0.02)] p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-[var(--text-low)]">
                  Operational signal
                </p>
                <p className="mt-2 text-xl font-medium text-white">Centralized visibility</p>
              </div>
              <CheckCircle2 className="h-5 w-5 text-[var(--accent-bright)]" />
            </div>
            <div className="mt-5 grid gap-4">
              {showcaseSignalItems.map((item) => (
                <div key={item} className="flex items-start gap-3 text-sm text-[var(--text-secondary)]">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-[var(--accent-bright)]" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ShowcaseBulletList() {
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      whileInView="visible"
      viewport={viewportOnce}
      className="space-y-5"
    >
      {showcaseBullets.map((bullet) => (
        <motion.div
          key={bullet}
          variants={fadeUp}
          className="flex items-start gap-4 rounded-[18px] border border-[var(--border-default)] bg-[rgba(13,13,17,0.9)] px-5 py-4"
        >
          <span className="mt-1 inline-flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(139,92,246,0.24)] bg-[rgba(124,58,237,0.12)]">
            <CheckCircle2 className="h-4 w-4 text-[var(--accent-bright)]" />
          </span>
          <p className="text-sm leading-7 text-[var(--text-secondary)]">{bullet}</p>
        </motion.div>
      ))}
    </motion.div>
  );
}
