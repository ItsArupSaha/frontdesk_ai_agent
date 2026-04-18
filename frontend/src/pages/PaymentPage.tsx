import { CheckCircle2, Zap, Phone, MessageSquare, BarChart2, Shield } from "lucide-react";

// Replace this URL with your actual LemonSqueezy product/checkout URL.
const LEMONSQUEEZY_CHECKOUT_URL = "https://arupsaha.lemonsqueezy.com/buy/YOUR_PRODUCT_ID";

const features = [
  { icon: Phone, text: "24/7 AI receptionist answers every call" },
  { icon: CheckCircle2, text: "Automatic appointment booking via Google Calendar" },
  { icon: MessageSquare, text: "SMS confirmations & reminders (after activation)" },
  { icon: Zap, text: "Emergency detection & instant escalation" },
  { icon: BarChart2, text: "Real-time dashboard — calls, bookings, analytics" },
  { icon: Shield, text: "Zero-downtime, multi-tenant, production-grade" },
];

const steps = [
  { step: "1", title: "Pay securely", body: "One-click checkout via LemonSqueezy. Instant confirmation." },
  { step: "2", title: "Fill onboarding form", body: "Tell us about your business — services, hours, coverage area." },
  { step: "3", title: "We activate your agent", body: "Usually within 1 business day. Voice calls live immediately." },
  { step: "4", title: "Forward your calls", body: "Point your existing number to your new AI agent — done." },
];

export default function PaymentPage() {
  return (
    <div className="min-h-screen bg-[#06050a] px-4 py-16 text-white">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-12 text-center">
          <p className="mb-3 text-xs uppercase tracking-[0.3em] text-violet-300/70">Get Started</p>
          <h1 className="text-[clamp(2rem,5vw,3.5rem)] font-semibold leading-tight tracking-[-0.06em]">
            Your AI front-desk,<br />ready in 24 hours.
          </h1>
          <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-white/55">
            One flat monthly fee. No per-minute surprises. Cancel anytime.
          </p>
        </div>

        {/* Pricing card */}
        <div className="mb-10 rounded-[32px] border border-violet-400/20 bg-[linear-gradient(135deg,rgba(70,56,190,0.18),rgba(11,9,20,0.95))] p-8 text-center shadow-[0_28px_80px_rgba(109,74,255,0.12)]">
          <p className="text-sm text-white/50">Monthly subscription</p>
          <div className="mt-3 flex items-end justify-center gap-1">
            <span className="text-[3.5rem] font-semibold leading-none tracking-[-0.06em] text-white">$150</span>
            <span className="mb-2 text-white/40">/mo</span>
          </div>
          <p className="mt-2 text-xs text-white/35">per business location</p>

          <div className="my-8 border-t border-white/8" />

          <ul className="space-y-3 text-left">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <li key={f.text} className="flex items-center gap-3 text-sm text-white/75">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-500/15">
                    <Icon className="h-3.5 w-3.5 text-violet-300" />
                  </span>
                  {f.text}
                </li>
              );
            })}
          </ul>

          <a
            href={LEMONSQUEEZY_CHECKOUT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 flex w-full items-center justify-center gap-2 rounded-full bg-violet-500 py-4 text-sm font-semibold text-white shadow-[0_4px_20px_rgba(109,74,255,0.4)] transition-colors hover:bg-violet-400"
          >
            Subscribe — $150/mo
          </a>
          <p className="mt-3 text-xs text-white/30">Secure payment via LemonSqueezy · Cancel anytime</p>
        </div>

        {/* How it works */}
        <div className="rounded-[28px] border border-white/8 bg-white/[0.02] p-7">
          <h2 className="mb-6 text-center text-base font-medium text-white/80">How it works</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {steps.map((s) => (
              <div
                key={s.step}
                className="rounded-[20px] border border-white/8 bg-white/[0.03] p-5"
              >
                <div className="mb-3 flex h-7 w-7 items-center justify-center rounded-full bg-violet-500/15 text-xs font-semibold text-violet-300">
                  {s.step}
                </div>
                <p className="mb-1 text-sm font-medium text-white">{s.title}</p>
                <p className="text-xs leading-relaxed text-white/45">{s.body}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-white/28">
          Questions before subscribing?{" "}
          <a
            href="mailto:growwitharup@gmail.com"
            className="text-violet-300 underline underline-offset-2"
          >
            Email us
          </a>{" "}
          — we reply within a few hours.
        </p>
      </div>
    </div>
  );
}
