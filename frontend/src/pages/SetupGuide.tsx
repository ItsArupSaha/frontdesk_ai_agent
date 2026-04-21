import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Circle, ExternalLink, Phone, Calendar, BookOpen, Star, Bot } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { getSettings } from "../lib/api";

interface Step {
  id: string;
  title: string;
  description: string;
  done: boolean;
  icon: React.ComponentType<{ className?: string }>;
  action?: { label: string; to?: string };
  detail: React.ReactNode;
}

function StepCard({ step, index }: { step: Step; index: number }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={`rounded-[22px] border transition-colors ${
        step.done ? "border-emerald-500/20 bg-emerald-500/5" : "border-white/10 bg-white/[0.03]"
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-4 px-5 py-4 text-left"
      >
        <span className={`shrink-0 ${step.done ? "text-emerald-400" : "text-white/25"}`}>
          {step.done ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
        </span>
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] border ${
            step.done
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
              : "border-white/10 bg-white/[0.04] text-white/50"
          }`}
        >
          <step.icon className="h-4 w-4" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-white/30 font-medium">Step {index}</span>
            {step.done && (
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-medium text-emerald-300">
                Done
              </span>
            )}
          </div>
          <p className={`text-sm font-medium mt-0.5 ${step.done ? "text-white/60" : "text-white"}`}>
            {step.title}
          </p>
          <p className="text-xs text-white/38 mt-0.5">{step.description}</p>
        </div>
        <span className="shrink-0 text-white/30 text-xs">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="border-t border-white/8 px-5 pb-5 pt-4">
          {step.detail}
          {step.action && !step.done && (
            <div className="mt-4">
              <Link
                to={step.action.to ?? "/settings"}
                className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/15 px-4 py-2 text-xs font-medium text-violet-300 hover:bg-violet-500/25"
              >
                {step.action.label}
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SetupGuidePage() {
  const { token, clientId } = useAuth();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["settings", clientId],
    queryFn: () => getSettings(token!, clientId!),
    enabled: !!token && !!clientId,
  });

  const vapiPhone = settings?.vapi_phone_number ?? null;
  const calendarConnected = settings?.calendar_connected ?? false;
  const kbIngested = !!settings?.kb_last_ingested_at;
  const reviewLink = !!settings?.google_review_link;
  const hasEmergencyPhone = !!settings?.emergency_phone_number;

  const steps: Step[] = [
    {
      id: "forwarding",
      title: "Forward Your Business Number",
      description: "Route inbound calls to your AI agent so it can answer 24/7.",
      done: !!vapiPhone,
      icon: Phone,
      detail: (
        <div className="space-y-3 text-sm text-white/65">
          {vapiPhone ? (
            <div className="rounded-[14px] border border-emerald-500/20 bg-emerald-500/8 px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-emerald-300 mb-1">Your AI Calling Number</p>
              <p className="font-mono text-lg text-emerald-200">{vapiPhone}</p>
              <p className="mt-1 text-xs text-emerald-200/60">Forward your business number to this.</p>
            </div>
          ) : (
            <p className="text-amber-300/80">Your AI number is being provisioned — check back shortly.</p>
          )}
          <p>How to forward (most carriers):</p>
          <ul className="space-y-1.5 pl-4 text-white/55 text-xs">
            <li><span className="text-white/80 font-medium">iPhone:</span> Settings → Phone → Call Forwarding → enter number above</li>
            <li><span className="text-white/80 font-medium">Android:</span> Phone app → Settings → Supplementary services → Call forwarding</li>
            <li><span className="text-white/80 font-medium">Landline / VoIP:</span> Contact carrier, request unconditional call forwarding</li>
          </ul>
          <p className="text-white/40 text-xs">Callers will not notice any difference — the AI answers as your business.</p>
        </div>
      ),
    },
    {
      id: "calendar",
      title: "Connect Google Calendar",
      description: "Let the AI check your real availability and book appointments directly onto your calendar.",
      done: calendarConnected,
      icon: Calendar,
      action: { label: "Connect in Settings →", to: "/settings" },
      detail: (
        <div className="space-y-2 text-sm text-white/65">
          {calendarConnected ? (
            <p className="text-emerald-300">Google Calendar is connected. The AI checks your availability before booking.</p>
          ) : (
            <>
              <p>
                Go to{" "}
                <Link to="/settings" className="text-violet-400 underline underline-offset-2">
                  Settings → Integrations
                </Link>{" "}
                and click <span className="text-white/80">Connect Google Calendar</span>.
              </p>
              <ul className="space-y-1 pl-4 text-white/55 text-xs">
                <li>AI checks calendar before offering time slots</li>
                <li>Booked appointments appear directly in Google Calendar</li>
                <li>No double-bookings, no manual entry</li>
              </ul>
            </>
          )}
        </div>
      ),
    },
    {
      id: "emergency",
      title: "Verify Emergency Contact Number",
      description: "Ensure emergencies (burst pipes, gas leaks, no heat) are transferred to you immediately.",
      done: hasEmergencyPhone,
      icon: Bot,
      action: { label: "Set in Settings →", to: "/settings" },
      detail: (
        <div className="space-y-2 text-sm text-white/65">
          {hasEmergencyPhone ? (
            <p className="text-emerald-300">Emergency number is set. The AI transfers emergency calls instantly.</p>
          ) : (
            <>
              <p>
                Go to{" "}
                <Link to="/settings" className="text-violet-400 underline underline-offset-2">
                  Settings
                </Link>{" "}
                and confirm your emergency contact number.
              </p>
              <p className="text-white/40 text-xs">
                This is the number the AI live-transfers to when a caller reports a burst pipe, gas leak, sparking
                wires, or no heat in winter.
              </p>
            </>
          )}
        </div>
      ),
    },
    {
      id: "kb",
      title: "Upload Your Knowledge Base",
      description: "Give the AI your pricing, service area, and FAQs so it answers caller questions accurately.",
      done: kbIngested,
      icon: BookOpen,
      action: { label: "Upload in Settings →", to: "/settings" },
      detail: (
        <div className="space-y-2 text-sm text-white/65">
          {kbIngested ? (
            <p className="text-emerald-300">Knowledge base ingested. AI can answer business-specific questions.</p>
          ) : (
            <>
              <p>
                Go to{" "}
                <Link to="/settings" className="text-violet-400 underline underline-offset-2">
                  Settings → Knowledge Base
                </Link>{" "}
                and upload a PDF, TXT, or Markdown file.
              </p>
              <p className="text-white/55 text-xs">Good things to include:</p>
              <ul className="space-y-1 pl-4 text-white/45 text-xs">
                <li>Service area (zip codes or cities you cover)</li>
                <li>Pricing ranges (e.g. "drain clearing starts at $150")</li>
                <li>Common FAQs callers ask</li>
                <li>What makes your business different</li>
              </ul>
            </>
          )}
        </div>
      ),
    },
    {
      id: "review",
      title: "Add Your Google Review Link",
      description: "After a job, the AI can send customers a direct link to leave a Google review.",
      done: reviewLink,
      icon: Star,
      action: { label: "Add in Settings →", to: "/settings" },
      detail: (
        <div className="space-y-2 text-sm text-white/65">
          {reviewLink ? (
            <p className="text-emerald-300">Google review link is set. AI can prompt happy customers to leave reviews.</p>
          ) : (
            <>
              <p>How to find your Google review link:</p>
              <ol className="space-y-1 pl-4 text-white/55 text-xs list-decimal">
                <li>Search your business on Google Maps</li>
                <li>Click "Write a review"</li>
                <li>Copy the URL from your browser</li>
                <li>
                  Paste it in{" "}
                  <Link to="/settings" className="text-violet-400 underline underline-offset-2">
                    Settings → Google Review Link
                  </Link>
                </li>
              </ol>
            </>
          )}
        </div>
      ),
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  const allDone = completedCount === steps.length;

  return (
    <div className="space-y-6 pb-10">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-white/45">Getting Started</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em]">Setup Guide</h1>
        <p className="mt-1 text-sm text-white/50">
          Complete these steps to get your AI front-desk agent fully operational.
        </p>
      </div>

      <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-white">
            {completedCount} of {steps.length} steps complete
          </p>
          {allDone && (
            <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-300">
              All done ✓
            </span>
          )}
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-emerald-400 transition-all duration-500"
            style={{ width: `${(completedCount / steps.length) * 100}%` }}
          />
        </div>
        {!allDone && (
          <p className="mt-2 text-xs text-white/35">
            {steps.length - completedCount} step{steps.length - completedCount !== 1 ? "s" : ""} remaining
          </p>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
        </div>
      ) : (
        <div className="space-y-3">
          {steps.map((step, i) => (
            <StepCard key={step.id} step={step} index={i + 1} />
          ))}
        </div>
      )}

      {allDone && (
        <div className="rounded-[24px] border border-emerald-500/20 bg-emerald-500/8 p-6 text-center">
          <p className="text-2xl mb-2">🎉</p>
          <p className="text-base font-semibold text-emerald-200">Your AI agent is fully configured!</p>
          <p className="mt-1 text-sm text-emerald-200/60">
            It's answering calls 24/7. Check your Dashboard to see live activity.
          </p>
          <Link
            to="/dashboard"
            className="mt-4 inline-block rounded-full bg-emerald-500/20 px-5 py-2 text-sm font-medium text-emerald-200 hover:bg-emerald-500/30"
          >
            Go to Dashboard →
          </Link>
        </div>
      )}
    </div>
  );
}
