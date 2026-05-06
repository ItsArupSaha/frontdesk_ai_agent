import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bell,
  Bot,
  CalendarCheck,
  ClipboardList,
  LayoutDashboard,
  PhoneCall,
  PhoneForwarded,
  ShieldAlert,
  TrendingUp,
} from "lucide-react";

export type Feature = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  chips: string[];
  stats: { label: string; value: string }[];
};

export type ProcessStep = {
  id: string;
  label: string;
  title: string;
  description: string;
  tone: string;
  icon: LucideIcon;
};

export type Benefit = {
  title: string;
  description: string;
  icon: LucideIcon;
  stat: string;
};

export type Plan = {
  name: string;
  price: string;
  description: string;
  features: string[];
  setupFee: string;
  featured?: boolean;
  ctaLabel: string;
};

export type Testimonial = {
  quote: string;
  name: string;
  role: string;
  initials: string;
};

export const navItems = [
  { label: "Home", href: "#home" },
  { label: "About", href: "#solutions" },
  { label: "Blog", href: "#pricing" },
  { label: "Contact", href: "#footer" },
];

export const trustLogos = ["Arc Layer", "Pulse CRM", "Northstar", "Vector Ops", "Halcyon"];

export const features: Feature[] = [
  {
    id: "automate",
    eyebrow: "24/7 Call Intake",
    title: "Don't miss another call. Secure every job.",
    description:
      "Your AI receptionist answers inbound calls around the clock, qualifies the customer, and collects the name, phone number, address, and job details needed to move fast.",
    chips: ["24/7 Answering", "Lead Capture", "Call Qualification", "Service Intake"],
    stats: [
      { label: "Coverage", value: "24/7" },
      { label: "Captured fields", value: "4 key details" },
      { label: "Next step", value: "Booking-ready" },
    ],
  },
  {
    id: "delegate",
    eyebrow: "Emergency Escalation",
    title: "Forward emergency calls to you to build customer trust.",
    description:
      "The system detects emergency situations like burst pipes, gas leaks, sparking wires, flooding, and no heat, then transfers the caller to the emergency number without delay.",
    chips: ["Emergency Detection", "Instant Transfer", "Urgent Dispatch", "Human Escalation"],
    stats: [
      { label: "Response path", value: "Immediate" },
      { label: "Escalation", value: "Live transfer" },
      { label: "Priority", value: "Emergency-first" },
    ],
  },
  {
    id: "sales",
    eyebrow: "Live Appointment Booking",
    title: "We book your jobs for you, saving your time and headache.",
    description:
      "Once the caller is qualified, the agent checks connected calendar availability, offers open slots, confirms the chosen time, and protects against duplicate bookings.",
    chips: ["Calendar Sync", "Slot Offering", "Booking Confirmation", "Duplicate Guard"],
    stats: [
      { label: "Calendar", value: "Live availability" },
      { label: "Booking mode", value: "On-call" },
      { label: "Confirmation", value: "Instant" },
    ],
  },
  {
    id: "systems",
    eyebrow: "Automatic Follow-Up",
    title: "We follow up automatically. so no lead goes cold!",
    description:
      "The system sends booking confirmations, queues reminders, recovers missed calls by SMS, and logs summaries so your team can follow up without manual admin.",
    chips: ["SMS Confirmations", "24h Reminders", "Missed-Call Recovery", "Call Summaries"],
    stats: [
      { label: "Recovery SMS", value: "2 min" },
      { label: "Reminder timing", value: "24h before" },
      { label: "Visibility", value: "Dashboard logs" },
    ],
  },
];

export const processSteps: ProcessStep[] = [
  {
    id: "setup",
    label: "01",
    title: "Share your business details",
    description:
      "Fill in your services, working hours, emergency contact, and service area. The intake form takes under 10 minutes. No tech setup needed from your side.",
    tone: "Onboarding",
    icon: ClipboardList,
  },
  {
    id: "configure",
    label: "02",
    title: "We build your AI agent",
    description:
      "We provision your dedicated AI assistant, assign a local phone number, and sync it to your Google Calendar — all within 90 minutes of sign-up.",
    tone: "Provisioning",
    icon: Bot,
  },
  {
    id: "golive",
    label: "03",
    title: "Forward calls and go live",
    description:
      "Forward your existing business number to your AI line. From that moment, every call is answered, qualified, and booked automatically — 24/7.",
    tone: "Activation",
    icon: PhoneForwarded,
  },
  {
    id: "monitor",
    label: "04",
    title: "Track everything on your dashboard",
    description:
      "See every call, booking, and emergency in real time. Update your hours, adjust settings, or pause the agent anytime — no tech skills required.",
    tone: "Dashboard",
    icon: LayoutDashboard,
  },
];

export const benefits: Benefit[] = [
  {
    icon: PhoneCall,
    title: "Never miss a call again",
    description:
      "Your AI answers every inbound call in under 2 seconds — at 2am, on weekends, while you're on a job. No voicemail, no missed revenue.",
    stat: "< 2s answer time",
  },
  {
    icon: TrendingUp,
    title: "Stop losing jobs to competitors",
    description:
      "When nobody picks up, customers call the next number. Your AI books them before they hang up — every single time.",
    stat: "62% of missed calls go elsewhere",
  },
  {
    icon: ShieldAlert,
    title: "Emergencies escalated instantly",
    description:
      "Burst pipes, gas leaks, no heat — detected from natural conversation and transferred to you live. No delay, no risk.",
    stat: "Zero-delay emergency transfer",
  },
  {
    icon: CalendarCheck,
    title: "Bookings while you're on the job",
    description:
      "Appointments are scheduled against your live calendar automatically. No double-bookings. No back-and-forth calls.",
    stat: "Live calendar sync",
  },
  {
    icon: Bell,
    title: "Automatic follow-up, zero effort",
    description:
      "SMS confirmations, 24h reminders, and missed-call recovery all fire automatically. No manual admin required.",
    stat: "Reminders sent 24h before",
  },
  {
    icon: BarChart3,
    title: "Your whole business in one view",
    description:
      "Every call, booking, and emergency logged and visible on your dashboard. Know exactly what's happening, anytime.",
    stat: "Real-time dashboard",
  },
];

export const plans: Plan[] = [
  {
    name: "Starter",
    price: "$99",
    description: "Perfect for small trades businesses ready to stop missing calls and start booking more jobs.",
    setupFee: "$100 one-time setup",
    ctaLabel: "Get Started",
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
    description: "For businesses that want full automation — confirmations, reminders, and follow-up on autopilot.",
    setupFee: "$100 one-time setup",
    ctaLabel: "Get Started",
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

export const testimonials: Testimonial[] = [
  {
    quote:
      "Blackwood replaced three manual handoff layers in our sales process. The system feels invisible to the team and the pipeline moves materially faster.",
    name: "Rina Das",
    role: "Revenue Lead, Northstar",
    initials: "RD",
  },
  {
    quote:
      "Their automation work cleaned up our support queue and response routing without creating another brittle ops project to babysit.",
    name: "Mason Cole",
    role: "COO, Arc Layer",
    initials: "MC",
  },
  {
    quote:
      "What stood out was the control. The flows are elegant, measurable, and actually fit our stack instead of fighting it.",
    name: "Nadia Shah",
    role: "Head of Ops, Halcyon",
    initials: "NS",
  },
  {
    quote:
      "We saw faster lead qualification in the first month and cleaner reporting immediately. It feels like an internal system, not a plugin.",
    name: "Ethan Vale",
    role: "Founder, Pulse CRM",
    initials: "EV",
  },
];

export const faqs = [
  {
    question: "How quickly can I go live?",
    answer:
      "Most businesses are live within 90 minutes of signing up. After you submit your business details — services, hours, emergency contact, and service area — we provision your AI assistant, assign a phone number, and sync your Google Calendar. Once done, you simply forward your existing business number to your AI line and calls start being handled immediately.",
  },
  {
    question: "Do I need to change my existing phone number?",
    answer:
      "No. You keep your current business number. We provide a separate AI phone number, and you set up a call forward from your existing number to it. This takes about 2 minutes through your phone carrier's settings and can be reversed anytime. Your customers always dial the same number they always have.",
  },
  {
    question: "What happens when there's an emergency call — like a burst pipe or gas leak?",
    answer:
      "Emergency detection is built into the AI. It listens for keywords and phrases like 'burst pipe', 'gas leak', 'no heat', 'flooding', or 'sparking wires' and immediately transfers the call live to your emergency phone number — with no delay. The AI does not try to book these. It escalates first, every time.",
  },
  {
    question: "How does the AI book appointments?",
    answer:
      "The AI connects to your Google Calendar and checks real-time availability before offering slots to the caller. Once the caller picks a time, the AI confirms it, creates a calendar event, and logs the booking to your dashboard. There are no double bookings — the calendar is always live. SMS confirmations (Pro plan) are sent automatically after booking.",
  },
  {
    question: "What if the AI can't answer a question about my business?",
    answer:
      "During setup we ingest your business details — services, pricing ranges, service area, working hours, and FAQs — into the AI's knowledge base. For questions it cannot confidently answer, it collects the caller's details and offers to have someone call them back. It never guesses or makes up information about your business.",
  },
  {
    question: "Can I pause or turn off the AI agent?",
    answer:
      "Yes, instantly. Your dashboard has an on/off toggle for the AI agent. When turned off, calls are transferred directly to your main phone number instead. You can also update your working hours, services, and emergency contact at any time from the Settings page — no tech support needed.",
  },
  {
    question: "What is the setup fee for?",
    answer:
      "The one-time $100 setup fee covers provisioning your dedicated AI assistant, purchasing and configuring your AI phone number, syncing your Google Calendar, ingesting your business knowledge base, and testing the full call flow before you go live. After setup, your only cost is the monthly subscription.",
  },
  {
    question: "What is included in the Pro plan that isn't in Starter?",
    answer:
      "Pro adds full SMS automation: booking confirmation texts sent immediately after a call, 24-hour appointment reminders to reduce no-shows, missed-call recovery texts sent within 2 minutes to callers who hung up, and Google review request texts after completed jobs. SMS requires US carrier registration (A2P 10DLC) which we handle — it typically takes 1 to 4 weeks after sign-up.",
  },
  {
    question: "Is my business data kept private?",
    answer:
      "Yes. Each client's data is fully isolated — your calls, bookings, and settings are never shared with or visible to other businesses on the platform. All API keys and credentials are encrypted at rest. We do not sell or share your data with third parties.",
  },
  {
    question: "What if I want to cancel?",
    answer:
      "You can cancel anytime — there are no long-term contracts. Your AI agent will be deactivated, your phone number released, and your data retained for 30 days in case you want to reactivate. After 30 days, all data is permanently deleted on request.",
  },
];

export const showcaseBullets = [
  "Reduce manual work across sales, support, and internal ops.",
  "Improve response speed with event-driven AI routing and triage.",
  "Unify fragmented tools into one measurable automation layer.",
  "Increase revenue efficiency with cleaner qualification and follow-up.",
];
