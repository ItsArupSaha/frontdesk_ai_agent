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
    queueLabel: "Every inbound call captured",
    rows: [
      {
        title: "After-hours answered",
        meta: "New lead captured",
        icon: PhoneCall,
        statusIcon: Check,
        statusTone: "text-emerald-200",
      },
      {
        title: "Details collected",
        meta: "Name, phone, address, issue",
        icon: MessageSquareText,
        statusIcon: Check,
        statusTone: "text-emerald-200",
      },
      {
        title: "Job qualified",
        meta: "Ready for booking",
        icon: ShieldCheck,
        statusIcon: Sparkles,
        statusTone: "text-violet-200",
      },
      {
        title: "Recovery SMS sent",
        meta: "Unanswered lead recovered",
        icon: Clock3,
        statusIcon: Clock3,
        statusTone: "text-violet-200",
      },
      {
        title: "Booking handoff",
        meta: "Sent to scheduling",
        icon: CircleDollarSign,
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

function EmergencyDispatchVisual() {
  return (
    <div className="relative min-h-[356px] overflow-hidden rounded-[20px] border border-[rgba(248,113,113,0.12)] bg-[radial-gradient(circle_at_top,rgba(127,29,29,0.28),rgba(10,10,14,0.98)_58%)] p-5 sm:p-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(248,113,113,0.08),transparent_44%)]" />
      <div className="absolute inset-x-12 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(248,113,113,0.55),transparent)]" />

      <div className="relative z-10 flex items-center justify-between">
        <div>
          <p className="text-[0.68rem] uppercase tracking-[0.28em] text-white/40">Emergency Routing</p>
          <p className="mt-2 text-base font-medium tracking-[-0.03em] text-white/92">AI detects, verifies, and forwards</p>
        </div>
        <span className="rounded-full border border-[rgba(248,113,113,0.24)] bg-[rgba(248,113,113,0.12)] px-3 py-1 text-[0.72rem] text-rose-100">
          live transfer
        </span>
      </div>

      <div className="relative z-10 mt-7 grid min-h-[260px] items-center gap-6 lg:grid-cols-[1fr_auto_1fr]">
        <motion.div
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          className="relative rounded-[22px] border border-[rgba(255,255,255,0.08)] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-5 shadow-[0_22px_60px_rgba(0,0,0,0.28)]"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-[14px] border border-[rgba(248,113,113,0.22)] bg-[rgba(248,113,113,0.12)]">
              <PhoneCall className="h-5 w-5 text-rose-200" />
            </div>
            <div>
              <p className="text-sm font-medium text-white/92">Caller</p>
              <p className="text-[0.74rem] text-white/40">Emergency reported</p>
            </div>
          </div>
          <div className="mt-5 rounded-[16px] border border-[rgba(248,113,113,0.16)] bg-[rgba(248,113,113,0.08)] px-4 py-3">
            <p className="text-[0.7rem] uppercase tracking-[0.22em] text-rose-100/70">Issue detected</p>
            <p className="mt-2 text-sm leading-6 text-white/86">Burst pipe. Immediate technician required.</p>
          </div>
        </motion.div>

        <div className="relative flex h-[220px] w-[140px] items-center justify-center">
          <motion.div
            className="absolute h-[170px] w-[170px] rounded-full border border-[rgba(248,113,113,0.12)]"
            animate={{ scale: [0.92, 1.08, 0.92], opacity: [0.2, 0.55, 0.2] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute h-[120px] w-[120px] rounded-full border border-[rgba(251,191,36,0.2)]"
            animate={{ scale: [1.08, 0.92, 1.08], opacity: [0.45, 0.2, 0.45] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          />
          <div className="absolute left-1/2 top-[28%] h-[2px] w-[160px] -translate-x-1/2 bg-[linear-gradient(90deg,rgba(248,113,113,0),rgba(248,113,113,0.45),rgba(251,191,36,0.75),rgba(34,197,94,0.45),rgba(34,197,94,0))]" />
          <div className="absolute left-1/2 top-[72%] h-[2px] w-[160px] -translate-x-1/2 bg-[linear-gradient(90deg,rgba(248,113,113,0),rgba(248,113,113,0.45),rgba(251,191,36,0.75),rgba(34,197,94,0.45),rgba(34,197,94,0))]" />
          <motion.div
            className="absolute top-[28%] h-3 w-3 rounded-full bg-rose-200 shadow-[0_0_18px_rgba(254,205,211,0.95)]"
            animate={{ left: ["8%", "82%"] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute top-[72%] h-3 w-3 rounded-full bg-amber-200 shadow-[0_0_18px_rgba(253,230,138,0.95)]"
            animate={{ left: ["82%", "8%"] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
          />
          <div className="relative flex h-24 w-24 items-center justify-center rounded-full border border-[rgba(251,191,36,0.24)] bg-[radial-gradient(circle,rgba(251,191,36,0.14),rgba(251,191,36,0.02)_64%)]">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[rgba(251,191,36,0.3)] bg-[rgba(251,191,36,0.12)]">
              <Sparkles className="h-6 w-6 text-amber-200" />
            </div>
          </div>
          <div className="absolute bottom-0 rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-3 py-1.5 text-[0.7rem] uppercase tracking-[0.22em] text-white/45">
            AI relay
          </div>
        </div>

        <motion.div
          animate={{ y: [0, 4, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          className="relative rounded-[22px] border border-[rgba(255,255,255,0.08)] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-5 shadow-[0_22px_60px_rgba(0,0,0,0.28)]"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-[14px] border border-[rgba(34,197,94,0.22)] bg-[rgba(34,197,94,0.1)]">
              <ShieldCheck className="h-5 w-5 text-emerald-200" />
            </div>
            <div>
              <p className="text-sm font-medium text-white/92">Technician</p>
              <p className="text-[0.74rem] text-white/40">Connected instantly</p>
            </div>
          </div>
          <div className="mt-5 rounded-[16px] border border-[rgba(34,197,94,0.16)] bg-[rgba(34,197,94,0.08)] px-4 py-3">
            <p className="text-[0.7rem] uppercase tracking-[0.22em] text-emerald-100/70">Forward complete</p>
            <p className="mt-2 text-sm leading-6 text-white/86">Caller transferred to the on-call emergency line.</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function LiveBookingVisual() {
  return (
    <div className="relative h-full min-h-[356px] overflow-hidden rounded-[20px] border border-[rgba(96,165,250,0.14)] bg-[radial-gradient(circle_at_top,rgba(30,64,175,0.18),rgba(10,10,14,0.98)_62%)] p-5 sm:p-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_15%,rgba(96,165,250,0.08),transparent_34%)]" />
      <div className="absolute inset-x-12 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(96,165,250,0.55),transparent)]" />

      <div className="relative z-10 flex h-full flex-col">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[0.68rem] uppercase tracking-[0.26em] text-white/40">Schedule</p>
            <p className="mt-2 text-base font-medium tracking-[-0.03em] text-white/92">Find the day. Lock the slot.</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(34,197,94,0.18)] bg-[rgba(34,197,94,0.08)]">
            <Check className="h-4.5 w-4.5 text-emerald-200" />
          </div>
        </div>

        <div className="mt-6 rounded-[22px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.26)]">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-[14px] border border-[rgba(96,165,250,0.2)] bg-[rgba(96,165,250,0.08)]">
              <CalendarDays className="h-5 w-5 text-sky-200" />
            </div>
            <div>
              <p className="text-sm font-medium text-white/92">Live booking window</p>
              <p className="text-[0.74rem] text-white/40">Searching availability while the caller waits</p>
            </div>
          </div>

          <div className="relative mt-5 rounded-[18px] border border-[rgba(255,255,255,0.08)] bg-[rgba(10,10,14,0.5)] px-3 py-3">
            <div className="grid grid-cols-7 gap-2 text-center text-[0.74rem] font-medium">
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
                <div key={day} className="relative rounded-[10px] px-1 py-2 text-white/46">
                  {day}
                </div>
              ))}
            </div>
            <motion.div
              className="absolute top-3 h-[34px] w-[calc((100%-1.5rem)/7)] rounded-[10px] border border-[rgba(96,165,250,0.22)] bg-[rgba(96,165,250,0.16)] shadow-[0_0_24px_rgba(56,189,248,0.14)]"
              animate={{ left: ["0.75rem", "calc(0.75rem + 14.285% )", "calc(0.75rem + 28.57% )", "calc(0.75rem + 42.855% )"] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>

          <div className="mt-5 space-y-3">
            <div className="rounded-[16px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/86">10:00 AM</span>
                <span className="rounded-full border border-[rgba(255,255,255,0.08)] px-2 py-0.5 text-[0.66rem] uppercase tracking-[0.18em] text-white/42">
                  open
                </span>
              </div>
            </div>

            <motion.div
              className="rounded-[16px] border border-[rgba(96,165,250,0.22)] bg-[rgba(96,165,250,0.12)] px-4 py-3 shadow-[0_0_28px_rgba(56,189,248,0.12)]"
              animate={{ scale: [1, 1.02, 1], borderColor: ["rgba(96,165,250,0.22)", "rgba(34,197,94,0.22)", "rgba(96,165,250,0.22)"] }}
              transition={{ duration: 2.1, repeat: Infinity, ease: "easeInOut" }}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white">4:00 PM</span>
                <motion.span
                  className="rounded-full border border-[rgba(34,197,94,0.18)] bg-[rgba(34,197,94,0.1)] px-2 py-0.5 text-[0.66rem] uppercase tracking-[0.18em] text-emerald-100"
                  animate={{ opacity: [0.55, 1, 0.55] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                >
                  booked
                </motion.span>
              </div>
            </motion.div>

            <div className="rounded-[16px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/86">6:30 PM</span>
                <span className="rounded-full border border-[rgba(255,255,255,0.08)] px-2 py-0.5 text-[0.66rem] uppercase tracking-[0.18em] text-white/42">
                  open
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between rounded-[18px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[12px] border border-[rgba(34,197,94,0.18)] bg-[rgba(34,197,94,0.08)]">
              <ShieldCheck className="h-4.5 w-4.5 text-emerald-200" />
            </div>
            <div>
              <p className="text-sm font-medium text-white/90">Confirmed on call</p>
              <p className="text-[0.72rem] text-white/40">Guarded against double-booking</p>
            </div>
          </div>
          <motion.div
            className="h-2 w-16 rounded-full bg-[linear-gradient(90deg,#38BDF8_0%,#22C55E_100%)]"
            animate={{ opacity: [0.45, 1, 0.45], scaleX: [0.92, 1, 0.92] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
      </div>
    </div>
  );
}

function TaskFeedVisual({ featureId }: { featureId: string }) {
  if (featureId === "delegate") {
    return <EmergencyDispatchVisual />;
  }

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
                    className="flex items-center gap-3 rounded-[14px] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.015)] px-3 py-2.5"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)]">
                      <ItemIcon className="h-5 w-5 text-white/72" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[0.9rem] font-medium tracking-[-0.03em] text-white/88">
                        {item.title}
                      </p>
                      <p className="truncate text-[0.78rem] text-white/38">{item.meta}</p>
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
  const usesCustomEmergencyVisual = feature.id === "delegate";
  const usesCustomBookingVisual = feature.id === "sales";

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
          {usesCustomEmergencyVisual ? (
            <EmergencyDispatchVisual />
          ) : usesCustomBookingVisual ? (
            <LiveBookingVisual />
          ) : (
            <>
              <div className="absolute inset-x-10 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(139,92,246,0.55),transparent)]" />
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-[var(--text-low)]">
                    Call Capture
                  </p>
                  <h3 className="mt-2 text-lg font-medium text-[var(--text-primary)]">
                    {feature.eyebrow}
                  </h3>
                </div>
                <div className="rounded-full border border-[rgba(139,92,246,0.26)] bg-[rgba(124,58,237,0.12)] px-3 py-1 text-xs text-[var(--accent-bright)]">
                  Live
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[0.76fr_1.24fr]">
                <TaskFeedVisual featureId={feature.id} />

                <div>
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
                </div>
              </div>
            </>
          )}
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
