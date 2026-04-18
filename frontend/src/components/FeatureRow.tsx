import { motion } from "framer-motion";
import {
  CalendarDays,
  Check,
  CircleDollarSign,
  Clock3,
  List,
  MessageSquareText,
  PhoneCall,
  ShieldCheck,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import type { Feature } from "../data/landing";
import {
  cardHover,
  splitReveal,
  staggerContainer,
  staggerItem,
  viewportOnce,
} from "../lib/motion";
import { SectionParticleLayer } from "./SectionParticleLayer";

type FeatureRowProps = {
  feature: Feature;
  reverse?: boolean;
};

type FeedItem = {
  title: string;
  meta: string;
  icon: LucideIcon;
  statusIcon: LucideIcon;
  statusTone: string;
};

const taskFeedByFeature: Record<string, { queueLabel: string; rows: FeedItem[] }> = {
  automate: {
    queueLabel: "Waiting for approval",
    rows: [
      {
        title: "After-hours call intake",
        meta: "Ready to capture new inbound jobs",
        icon: PhoneCall,
        statusIcon: Clock3,
        statusTone: "text-violet-200",
      },
      {
        title: "Customer message routing",
        meta: "Escalation path configured",
        icon: MessageSquareText,
        statusIcon: Check,
        statusTone: "text-emerald-200",
      },
      {
        title: "Lead list sync",
        meta: "CRM handoff queued",
        icon: List,
        statusIcon: Sparkles,
        statusTone: "text-violet-200",
      },
      {
        title: "Callback request",
        meta: "Pending manager confirmation",
        icon: CircleDollarSign,
        statusIcon: Clock3,
        statusTone: "text-violet-200",
      },
      {
        title: "Job summary update",
        meta: "Delivery layer refreshed",
        icon: ShieldCheck,
        statusIcon: Check,
        statusTone: "text-emerald-200",
      },
    ],
  },
  delegate: {
    queueLabel: "Active delegation",
    rows: [
      {
        title: "Inbox triage",
        meta: "Urgent requests ranked first",
        icon: MessageSquareText,
        statusIcon: Sparkles,
        statusTone: "text-violet-200",
      },
      {
        title: "Qualification workflow",
        meta: "Caller intent captured",
        icon: PhoneCall,
        statusIcon: Check,
        statusTone: "text-emerald-200",
      },
      {
        title: "Follow-up reminder",
        meta: "Scheduled for next response window",
        icon: CalendarDays,
        statusIcon: Clock3,
        statusTone: "text-violet-200",
      },
      {
        title: "Lead ownership",
        meta: "Assigned to the right queue",
        icon: List,
        statusIcon: Check,
        statusTone: "text-emerald-200",
      },
      {
        title: "Escalation branch",
        meta: "Awaiting handoff approval",
        icon: ShieldCheck,
        statusIcon: Clock3,
        statusTone: "text-violet-200",
      },
    ],
  },
  sales: {
    queueLabel: "Revenue actions",
    rows: [
      {
        title: "New caller scored",
        meta: "High-intent lead detected",
        icon: CircleDollarSign,
        statusIcon: Sparkles,
        statusTone: "text-violet-200",
      },
      {
        title: "Appointment follow-up",
        meta: "Booked into the right slot",
        icon: CalendarDays,
        statusIcon: Check,
        statusTone: "text-emerald-200",
      },
      {
        title: "Missed call recovery",
        meta: "SMS confirmation sent",
        icon: PhoneCall,
        statusIcon: Check,
        statusTone: "text-emerald-200",
      },
      {
        title: "Proposal request",
        meta: "Waiting on customer reply",
        icon: MessageSquareText,
        statusIcon: Clock3,
        statusTone: "text-violet-200",
      },
      {
        title: "Pipeline update",
        meta: "Next action surfaced automatically",
        icon: List,
        statusIcon: Sparkles,
        statusTone: "text-violet-200",
      },
    ],
  },
  systems: {
    queueLabel: "System activity",
    rows: [
      {
        title: "Calendar sync check",
        meta: "Availability cache refreshed",
        icon: CalendarDays,
        statusIcon: Check,
        statusTone: "text-emerald-200",
      },
      {
        title: "Cross-tool data sync",
        meta: "Unified records verified",
        icon: ShieldCheck,
        statusIcon: Sparkles,
        statusTone: "text-violet-200",
      },
      {
        title: "Reporting package",
        meta: "Prepared for leadership view",
        icon: CircleDollarSign,
        statusIcon: Clock3,
        statusTone: "text-violet-200",
      },
      {
        title: "Ops checklist",
        meta: "Manual QA removed from queue",
        icon: List,
        statusIcon: Check,
        statusTone: "text-emerald-200",
      },
      {
        title: "Support transcript",
        meta: "Latest call summary attached",
        icon: MessageSquareText,
        statusIcon: X,
        statusTone: "text-violet-200",
      },
    ],
  },
};

function TaskFeedVisual({ featureId }: { featureId: string }) {
  const feed = taskFeedByFeature[featureId] ?? taskFeedByFeature.automate;

  return (
      <div className="mx-auto w-full max-w-[320px] rounded-[16px] border border-[var(--border-muted)] bg-[linear-gradient(180deg,rgba(8,8,10,0.98),rgba(12,12,16,0.98))] p-3">
      <div className="rounded-[12px] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] px-3 py-2.5">
        <div className="flex items-center gap-3">
          <span className="rounded-[8px] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] px-2.5 py-1 text-xs font-semibold text-white">
            All Tasks
          </span>
          <span className="text-sm font-medium text-white/88">{feed.queueLabel}</span>
        </div>
      </div>

      <div className="task-feed-mask mt-3 h-[204px] overflow-hidden rounded-[14px]">
        <div className="task-feed-track flex flex-col">
          {[0, 1].map((copyIndex) => (
            <div key={copyIndex} className="space-y-3">
              {feed.rows.map((item, index) => {
                const ItemIcon = item.icon;
                const StatusIcon = item.statusIcon;

                return (
                  <div
                    key={`${copyIndex}-${item.title}-${index}`}
                    className="flex items-center gap-3 rounded-[14px] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.015)] px-3 py-3"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)]">
                      <ItemIcon className="h-5 w-5 text-white/72" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[0.96rem] font-medium tracking-[-0.03em] text-white/88">
                        {item.title}
                      </p>
                      <p className="truncate text-sm text-white/38">{item.meta}</p>
                    </div>
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] border border-[rgba(139,92,246,0.18)] bg-[rgba(124,58,237,0.08)]">
                      <StatusIcon className={`h-4.5 w-4.5 ${item.statusTone}`} />
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function FeatureRow({ feature, reverse = false }: FeatureRowProps) {
  return (
    <motion.article
      className="relative isolate grid items-center gap-8 overflow-hidden rounded-[32px] lg:grid-cols-2 lg:gap-14"
      variants={staggerContainer}
      initial="hidden"
      whileInView="visible"
      viewport={viewportOnce}
    >
      <SectionParticleLayer
        count={110}
        glowClassName="bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.09),transparent_52%)]"
      />
      <motion.div
        variants={splitReveal(reverse ? "right" : "left")}
        className={reverse ? "relative z-10 lg:order-2" : "relative z-10"}
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

          <div className="grid gap-4 lg:grid-cols-[0.88fr_1.12fr]">
            <TaskFeedVisual featureId={feature.id} />

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
                <p className="text-xs uppercase tracking-[0.26em] text-[var(--text-low)]">
                  Signals
                </p>
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

      <motion.div
        variants={staggerContainer}
        className={reverse ? "relative z-10 lg:order-1" : "relative z-10"}
      >
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
