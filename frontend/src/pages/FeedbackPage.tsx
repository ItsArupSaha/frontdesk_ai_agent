import { useState } from "react";
import { MessageSquare, Bug, Lightbulb, Send, Copy, Check, Mail } from "lucide-react";

const SUPPORT_EMAIL = "growwitharup@gmail.com";

type FeedbackType = "bug" | "feature" | "general";

const typeConfig: Record<FeedbackType, { label: string; icon: React.ComponentType<{ className?: string }>; subject: string }> = {
  bug: { label: "Bug Report", icon: Bug, subject: "Bug Report" },
  feature: { label: "Feature Request", icon: Lightbulb, subject: "Feature Request" },
  general: { label: "General Feedback", icon: MessageSquare, subject: "Feedback" },
};

export default function FeedbackPage() {
  const [type, setType] = useState<FeedbackType>("general");
  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);

  const config = typeConfig[type];

  function buildSubject() {
    return `[${config.subject}] — ${businessName || "AI Front-Desk Agent"}`;
  }

  function buildBody() {
    return (
      `Name: ${name || "(not provided)"}\n` +
      `Business: ${businessName || "(not provided)"}\n` +
      `Type: ${config.label}\n\n` +
      `---\n\n${message}`
    );
  }

  // Opens Gmail compose in the browser tab — works even without a desktop email app.
  function buildGmailUrl() {
    const subject = encodeURIComponent(buildSubject());
    const body = encodeURIComponent(buildBody());
    return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(SUPPORT_EMAIL)}&su=${subject}&body=${body}`;
  }

  // Fallback: copies the full message to clipboard so they can paste into any web mail.
  async function handleCopyMessage() {
    const full = `To: ${SUPPORT_EMAIL}\nSubject: ${buildSubject()}\n\n${buildBody()}`;
    await navigator.clipboard.writeText(full);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }

  const canSubmit = message.trim().length > 0;

  return (
    <div className="min-h-screen bg-[#06050a] px-4 py-16 text-white">
      <div className="mx-auto max-w-xl">
        {/* Header */}
        <div className="mb-10 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/12">
            <MessageSquare className="h-6 w-6 text-violet-200" />
          </div>
          <h1 className="text-3xl font-semibold tracking-[-0.05em]">Feedback & Support</h1>
          <p className="mt-3 text-sm text-white/55">
            Bug, idea, or question? We read every message.
          </p>
        </div>

        <div className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(22,17,37,0.74),rgba(11,9,20,0.84))] p-7 shadow-[0_18px_48px_rgba(0,0,0,0.24)]">
          {/* Type selector */}
          <div className="mb-6 grid grid-cols-3 gap-2">
            {(Object.entries(typeConfig) as [FeedbackType, typeof typeConfig[FeedbackType]][]).map(
              ([key, cfg]) => {
                const Icon = cfg.icon;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setType(key)}
                    className={`flex flex-col items-center gap-2 rounded-[20px] border py-4 text-xs font-medium transition-colors ${
                      type === key
                        ? "border-violet-400/40 bg-violet-500/15 text-violet-200"
                        : "border-white/10 bg-white/[0.03] text-white/45 hover:text-white/70"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {cfg.label}
                  </button>
                );
              },
            )}
          </div>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-[11px] uppercase tracking-[0.22em] text-white/38">
                  Your Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Optional"
                  className="w-full rounded-[20px] border border-white/10 bg-[#0d0a16] px-4 py-3 text-sm text-white placeholder:text-white/28 focus:outline-none focus:ring-2 focus:ring-violet-500/60"
                />
              </div>
              <div>
                <label className="mb-2 block text-[11px] uppercase tracking-[0.22em] text-white/38">
                  Business Name
                </label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Optional"
                  className="w-full rounded-[20px] border border-white/10 bg-[#0d0a16] px-4 py-3 text-sm text-white placeholder:text-white/28 focus:outline-none focus:ring-2 focus:ring-violet-500/60"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-[11px] uppercase tracking-[0.22em] text-white/38">
                Message *
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
                placeholder={
                  type === "bug"
                    ? "Describe what happened, what you expected, and steps to reproduce…"
                    : type === "feature"
                      ? "Describe the feature you'd like and why it would help your business…"
                      : "Share your thoughts, questions, or suggestions…"
                }
                className="w-full resize-none rounded-[20px] border border-white/10 bg-[#0d0a16] px-4 py-3 text-sm text-white placeholder:text-white/28 focus:outline-none focus:ring-2 focus:ring-violet-500/60"
              />
            </div>

            {/* Primary: open Gmail in browser */}
            <a
              href={canSubmit ? buildGmailUrl() : undefined}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => { if (!canSubmit) e.preventDefault(); }}
              className={`flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-medium transition-colors ${
                canSubmit
                  ? "bg-violet-500 text-white hover:bg-violet-400"
                  : "cursor-not-allowed bg-white/8 text-white/30"
              }`}
            >
              <Send className="h-4 w-4" />
              Send via Gmail
            </a>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 border-t border-white/10" />
              <span className="text-xs text-white/30">or</span>
              <div className="flex-1 border-t border-white/10" />
            </div>

            {/* Secondary options */}
            <div className="grid grid-cols-2 gap-3">
              {/* Copy to clipboard — paste into any web mail (Outlook, Yahoo, etc.) */}
              <button
                type="button"
                disabled={!canSubmit}
                onClick={() => void handleCopyMessage()}
                className="flex items-center justify-center gap-2 rounded-full border border-white/10 py-2.5 text-xs font-medium text-white/60 transition-colors hover:border-violet-400/30 hover:text-white/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied!" : "Copy message"}
              </button>

              {/* Mailto fallback for desktop email clients */}
              <a
                href={
                  canSubmit
                    ? `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(buildSubject())}&body=${encodeURIComponent(buildBody())}`
                    : undefined
                }
                onClick={(e) => { if (!canSubmit) e.preventDefault(); }}
                className="flex items-center justify-center gap-2 rounded-full border border-white/10 py-2.5 text-xs font-medium text-white/60 transition-colors hover:border-violet-400/30 hover:text-white/90"
              >
                <Mail className="h-3.5 w-3.5" />
                Open email app
              </a>
            </div>

            <p className="text-center text-xs text-white/28">
              <span className="font-medium text-white/45">Send via Gmail</span> opens in your browser — no app needed.{" "}
              <span className="font-medium text-white/45">Copy message</span> works with any web mail (Outlook, Yahoo, etc.).
              We reply within 24 hours.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
