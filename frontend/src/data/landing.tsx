import type { LucideIcon } from "lucide-react";
import {
  Clock3,
  Gauge,
  Layers3,
  MessageSquareText,
  Network,
  ShieldCheck,
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
};

export type Benefit = {
  title: string;
  description: string;
  icon: LucideIcon;
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
    id: "analysis",
    label: "01",
    title: "Smart AI Analysis",
    description:
      "We audit your workflows, data quality, and delivery friction to identify high-leverage automation opportunities with measurable ROI.",
    tone: "Signal Map",
  },
  {
    id: "deployment",
    label: "02",
    title: "AI Deployment",
    description:
      "We implement production-ready agent flows, prompts, and automation logic with safeguards, observability, and business-specific context.",
    tone: "Flow Control",
  },
  {
    id: "integration",
    label: "03",
    title: "Seamless Integration",
    description:
      "We connect your CRM, inboxes, support tools, and reporting layers so each workflow runs inside the systems your team already uses.",
    tone: "Connected Stack",
  },
  {
    id: "optimization",
    label: "04",
    title: "Continuous Optimization",
    description:
      "We monitor performance, refine prompts, routing logic, integrations, and reporting after launch so the system continues improving as your requirements change.",
    tone: "Iterative Gains",
  },
];

export const benefits: Benefit[] = [
  {
    icon: Gauge,
    title: "Increased productivity",
    description: "Teams spend more time on revenue and less time on repetitive coordination.",
  },
  {
    icon: MessageSquareText,
    title: "Better customer experience",
    description: "Faster, more accurate responses across sales and support touchpoints.",
  },
  {
    icon: Layers3,
    title: "Lower operational overhead",
    description: "Manual admin shrinks as systems route, enrich, and update automatically.",
  },
  {
    icon: Network,
    title: "Scalable systems",
    description: "Workflows stay structured even as channels, volume, and team size expand.",
  },
  {
    icon: Clock3,
    title: "Faster response times",
    description: "AI agents triage and trigger actions immediately instead of waiting on queues.",
  },
  {
    icon: ShieldCheck,
    title: "Better data consistency",
    description: "Clean sync logic and defined steps reduce duplication and reporting drift.",
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
