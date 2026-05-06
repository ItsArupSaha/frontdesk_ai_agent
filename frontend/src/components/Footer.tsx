import { motion } from "framer-motion";
import { fadeUp, viewportOnce } from "../lib/motion";
import { SectionParticleLayer } from "./SectionParticleLayer";

const columns = [
  {
    title: "Pages",
    links: [
      { label: "Home", href: "#home" },
      { label: "How It Works", href: "#solutions" },
      { label: "Pricing", href: "#pricing" },
      { label: "FAQ", href: "#footer" },
    ],
  },
  {
    title: "Services",
    links: [
      { label: "24/7 Call Answering", href: "#solutions" },
      { label: "Emergency Escalation", href: "#solutions" },
      { label: "Appointment Booking", href: "#solutions" },
      { label: "SMS Follow-Up", href: "#pricing" },
    ],
  },
  {
    title: "Contact",
    links: [
      { label: "growwitharup@gmail.com", href: "mailto:growwitharup@gmail.com" },
      { label: "Dhaka / Remote", href: "#" },
    ],
  },
];

export function Footer() {
  return (
    <motion.footer
      id="footer"
      initial="hidden"
      whileInView="visible"
      viewport={viewportOnce}
      variants={fadeUp}
      className="relative isolate overflow-hidden border-t border-[var(--border-muted)] bg-[linear-gradient(180deg,rgba(15,8,24,0.18),rgba(0,0,0,0))] px-4 pb-8 pt-16 sm:px-6 lg:px-8"
    >
      <SectionParticleLayer glowClassName="bg-[radial-gradient(circle_at_top,rgba(124,58,237,0.08),transparent_40%)]" />
      <div className="relative z-10 mx-auto max-w-[1240px]">
        <div className="grid gap-10 border-b border-[var(--border-muted)] pb-10 md:grid-cols-[1.2fr_1.8fr]">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-[var(--border-default)] bg-[linear-gradient(180deg,rgba(124,58,237,0.22),rgba(13,13,17,0.95))]">
                <span className="text-base font-bold tracking-[-0.06em] text-white">F</span>
              </span>
              <span className="text-sm font-medium tracking-[0.24em] text-white">FRONDEXAI</span>
            </div>
            <p className="mt-5 max-w-md text-sm leading-7 text-[var(--text-secondary)]">
              24/7 AI receptionist for plumbing, HVAC, and electrical businesses. Every call answered,
              every job booked, every emergency escalated — automatically.
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-3">
            {columns.map((column) => (
              <div key={column.title}>
                <h3 className="text-[11px] uppercase tracking-[0.3em] text-[var(--text-muted)]">
                  {column.title}
                </h3>
                <ul className="mt-5 space-y-3">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        className="text-sm text-[var(--text-secondary)] transition-colors duration-200 hover:text-white"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4 pt-6 text-sm text-[var(--text-low)] sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 FrondexAI. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <a href="#home" className="transition-colors duration-200 hover:text-white">
              Privacy
            </a>
            <a href="#home" className="transition-colors duration-200 hover:text-white">
              Terms
            </a>
          </div>
        </div>
      </div>
    </motion.footer>
  );
}
