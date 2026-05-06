import { Check, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { rootStyles } from "../lib/design-tokens";

const CHECKOUT_STARTER = "https://arupsaha.lemonsqueezy.com/buy/STARTER_PRODUCT_ID";
const CHECKOUT_PRO = "https://arupsaha.lemonsqueezy.com/buy/PRO_PRODUCT_ID";

const plans = [
  {
    name: "Starter",
    price: "$99",
    setupFee: "$100 one-time setup",
    description: "Perfect for small home service businesses ready to stop missing calls and start booking more jobs.",
    checkoutUrl: CHECKOUT_STARTER,
    featured: false,
    features: [
      "24/7 AI call answering",
      "Lead qualification & job intake",
      "Emergency detection & live transfer",
      "Google Calendar sync & booking",
      "Missed-call voicemail handling",
      "Call logs & bookings dashboard",
      "Email support",
    ],
  },
  {
    name: "Pro",
    price: "$149",
    setupFee: "$100 one-time setup",
    description: "For businesses that want full automation — confirmations, reminders, and follow-up on autopilot.",
    checkoutUrl: CHECKOUT_PRO,
    featured: true,
    features: [
      "Everything in Starter",
      "SMS booking confirmations",
      "24h appointment reminders",
      "Missed-call recovery SMS",
      "Google review request SMS",
      "Priority email support",
      "Settings & hours via dashboard",
    ],
  },
];

const steps = [
  { n: "1", title: "Pay securely", body: "Checkout via LemonSqueezy. Instant confirmation." },
  { n: "2", title: "Fill onboarding form", body: "Tell us your services, hours, and coverage area." },
  { n: "3", title: "We activate your agent", body: "Usually within 1 business day." },
  { n: "4", title: "Forward your calls", body: "Point your number to your new AI agent — done." },
];

export default function PaymentPage() {
  return (
    <div style={rootStyles} className="min-h-screen bg-[var(--bg-primary)] px-4 py-12 text-[var(--text-primary)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[900px]">
        <Link
          to="/"
          className="mb-10 inline-flex items-center gap-2 text-sm text-[var(--text-muted)] transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>

        <div className="mb-12 text-center">
          <p className="mb-3 text-[11px] uppercase tracking-[0.3em] text-[var(--accent-bright)]/70">Get Started</p>
          <h1 className="text-[clamp(1.9rem,4vw,3rem)] font-semibold leading-tight tracking-[-0.05em] text-white">
            Your AI front-desk, ready in 24 hours.
          </h1>
          <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-[var(--text-secondary)]">
            One-time setup fee. One flat monthly rate. No per-minute charges. Cancel anytime.
          </p>
        </div>

        {/* Plan cards */}
        <div className="grid gap-6 md:grid-cols-2">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={[
                "relative flex h-full flex-col rounded-[var(--radius-card)] border p-7",
                plan.featured
                  ? "border-[rgba(139,92,246,0.4)] bg-[linear-gradient(180deg,rgba(25,16,42,0.97),rgba(13,13,17,0.98))]"
                  : "border-[var(--border-default)] bg-[rgba(13,13,17,0.96)]",
              ].join(" ")}
            >
              {plan.featured && (
                <span className="mb-5 inline-flex w-fit rounded-full border border-[rgba(139,92,246,0.28)] bg-[rgba(124,58,237,0.12)] px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-[var(--accent-bright)]">
                  Most Popular
                </span>
              )}

              <h3 className="text-xl font-medium text-white">{plan.name}</h3>

              <div className="mt-4 flex items-end gap-1.5">
                <span className="text-5xl font-semibold tracking-[-0.05em] text-white">{plan.price}</span>
                <span className="mb-1 text-sm text-[var(--text-muted)]">/ month</span>
              </div>
              <p className="mt-2 text-xs text-[var(--text-low)]">+ {plan.setupFee}</p>

              <p className="mt-4 text-sm leading-7 text-[var(--text-secondary)]">{plan.description}</p>

              <div className="my-6 h-px bg-[var(--border-muted)]" />

              <ul className="flex-1 space-y-3.5">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-sm text-[var(--text-secondary)]">
                    <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[rgba(139,92,246,0.25)] bg-[rgba(124,58,237,0.1)]">
                      <Check className="h-3 w-3 text-[var(--accent-bright)]" />
                    </span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-auto pt-8">
                <a
                  href={plan.checkoutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={[
                    "inline-flex w-full items-center justify-center rounded-[var(--radius-button)] border px-4 py-3 text-sm font-medium transition-colors duration-200",
                    plan.featured
                      ? "border-[rgba(139,92,246,0.35)] bg-[linear-gradient(135deg,#7C3AED_0%,#8B5CF6_100%)] text-white shadow-[var(--shadow-button)]"
                      : "border-[var(--border-default)] bg-[rgba(255,255,255,0.02)] text-[var(--text-primary)] hover:border-[rgba(139,92,246,0.28)] hover:bg-[rgba(255,255,255,0.04)]",
                  ].join(" ")}
                >
                  Get Started — {plan.price}/mo
                </a>
                <p className="mt-3 text-center text-[11px] text-[var(--text-low)]">
                  Secure checkout · Cancel anytime
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* How it works */}
        <div className="mt-14">
          <h2 className="mb-6 text-center text-[11px] uppercase tracking-[0.3em] text-[var(--text-muted)]">
            How it works
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s) => (
              <div
                key={s.n}
                className="rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[rgba(13,13,17,0.96)] p-5"
              >
                <div className="mb-3 flex h-7 w-7 items-center justify-center rounded-full border border-[rgba(139,92,246,0.25)] bg-[rgba(124,58,237,0.1)] text-xs font-semibold text-[var(--accent-bright)]">
                  {s.n}
                </div>
                <p className="mb-1 text-sm font-medium text-white">{s.title}</p>
                <p className="text-xs leading-relaxed text-[var(--text-muted)]">{s.body}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-10 text-center text-xs text-[var(--text-low)]">
          Questions?{" "}
          <a
            href="mailto:growwitharup@gmail.com"
            className="text-[var(--accent-bright)] underline underline-offset-2 hover:opacity-80"
          >
            Email us
          </a>{" "}
          — we reply within a few hours.
        </p>
      </div>
    </div>
  );
}
