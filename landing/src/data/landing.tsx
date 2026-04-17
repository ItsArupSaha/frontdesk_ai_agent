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
    eyebrow: "Automation Infrastructure",
    title: "Automate repetitive work without breaking your current stack",
    description:
      "We replace manual routing, repetitive admin, and fragmented workflows with AI-driven systems that operate cleanly across your sales, support, and delivery layers.",
    chips: ["CRM", "Email", "Support", "Workflows"],
    stats: [
      { label: "Tasks automated", value: "84%" },
      { label: "Cycle reduction", value: "31h" },
      { label: "Accuracy", value: "99.2%" },
    ],
  },
  {
    id: "delegate",
    eyebrow: "Delegation Systems",
    title: "Delegate daily operations to AI agents that know what to do next",
    description:
      "From lead qualification and inbox triage to handoff logic and reporting, every repetitive action is organized into a system with clear triggers and controlled outputs.",
    chips: ["Lead Gen", "Inbox", "Routing", "Analytics"],
    stats: [
      { label: "Qualified leads", value: "+42%" },
      { label: "Avg. response", value: "4 min" },
      { label: "Agent uptime", value: "24/7" },
    ],
  },
  {
    id: "sales",
    eyebrow: "Revenue Operations",
    title: "Accelerate sales growth with tighter qualification and follow-up",
    description:
      "We build AI workflows that score leads, trigger outreach, enrich records, and surface the next best action so your team spends time on deals instead of admin.",
    chips: ["Sales", "Sequences", "Scoring", "Pipeline"],
    stats: [
      { label: "Pipeline lift", value: "2.4x" },
      { label: "Close speed", value: "-18%" },
      { label: "No-show drop", value: "-37%" },
    ],
  },
  {
    id: "systems",
    eyebrow: "Unified Operations",
    title: "Build smarter internal systems that stay clean as you scale",
    description:
      "We connect tools, standardize data, and create intelligent automations that keep operations consistent across teams, channels, and growth stages.",
    chips: ["Data Sync", "Ops", "Dashboards", "Integrations"],
    stats: [
      { label: "Tool sync", value: "16 apps" },
      { label: "Reporting lag", value: "-92%" },
      { label: "Manual QA", value: "-68%" },
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
