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
  yearlyPrice: string;
  description: string;
  features: string[];
  featured?: boolean;
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
    price: "$2.9k",
    yearlyPrice: "$2.4k",
    description: "For teams launching one focused automation workflow.",
    features: [
      "Workflow audit and automation roadmap",
      "One core AI workflow deployment",
      "CRM or inbox integration",
      "Weekly performance review",
    ],
  },
  {
    name: "Professional",
    price: "$6.5k",
    yearlyPrice: "$5.4k",
    description: "For growth teams building AI operations across revenue and support.",
    features: [
      "Multi-workflow AI system design",
      "Lead routing, scoring, and reporting",
      "Cross-tool integrations and QA",
      "Ongoing optimization and iteration",
    ],
    featured: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    yearlyPrice: "Custom",
    description: "For complex organizations requiring custom orchestration and governance.",
    features: [
      "Custom architecture and deployment plan",
      "Advanced security and approval flows",
      "Dedicated implementation support",
      "Executive reporting and SLA options",
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
    question: "What types of AI automation do you build?",
    answer:
      "We design and implement workflow automation across sales, support, CRM operations, internal routing, reporting, and handoff logic. Most engagements combine agent behavior, business rules, and cross-tool integration.",
  },
  {
    question: "Do you work with our existing tools or replace them?",
    answer:
      "We usually integrate with the stack you already use. The goal is to make your current systems work better together, not force a migration unless the architecture is already broken.",
  },
  {
    question: "How long does a typical rollout take?",
    answer:
      "Focused automation builds can go live in a few weeks. Broader system deployments take longer depending on the number of workflows, integrations, approvals, and internal dependencies.",
  },
  {
    question: "How do you measure success after launch?",
    answer:
      "We track response times, manual workload reduction, lead flow quality, resolution speed, reporting clarity, and adoption metrics specific to the workflows we deploy.",
  },
  {
    question: "Can you support ongoing optimization?",
    answer:
      "Yes. We refine prompts, routing logic, integrations, and reporting after launch so the system continues improving as your team, volume, and requirements change.",
  },
];

export const showcaseBullets = [
  "Reduce manual work across sales, support, and internal ops.",
  "Improve response speed with event-driven AI routing and triage.",
  "Unify fragmented tools into one measurable automation layer.",
  "Increase revenue efficiency with cleaner qualification and follow-up.",
];
