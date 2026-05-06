import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { fadeUp, viewportOnce } from "../lib/motion";
import { SectionParticleLayer } from "./SectionParticleLayer";

const navLinks = [
  { label: "Home", href: "#home" },
  { label: "How It Works", href: "#solutions" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
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
        <div className="grid gap-10 border-b border-[var(--border-muted)] pb-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <span className="text-sm font-bold tracking-[0.24em] text-white">FRONDEXAI</span>
            <p className="mt-4 max-w-xs text-sm leading-7 text-[var(--text-secondary)]">
              24/7 AI receptionist for plumbing, HVAC, and electrical businesses. Every call answered,
              every job booked, every emergency escalated — automatically.
            </p>
          </div>

          <div>
            <h3 className="text-[11px] uppercase tracking-[0.3em] text-[var(--text-muted)]">Navigation</h3>
            <ul className="mt-5 space-y-3">
              {navLinks.map((link) => (
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

          <div>
            <h3 className="text-[11px] uppercase tracking-[0.3em] text-[var(--text-muted)]">Contact</h3>
            <ul className="mt-5 space-y-3">
              <li>
                <a
                  href="mailto:growwitharup@gmail.com"
                  className="text-sm text-[var(--text-secondary)] transition-colors duration-200 hover:text-white"
                >
                  growwitharup@gmail.com
                </a>
              </li>
              <li>
                <span className="text-sm text-[var(--text-secondary)]">Sylhet, Bangladesh</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col gap-4 pt-6 text-sm text-[var(--text-muted)] sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 FrondexAI. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link to="/privacy" className="transition-colors duration-200 hover:text-white">
              Privacy Policy
            </Link>
            <Link to="/terms" className="transition-colors duration-200 hover:text-white">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </motion.footer>
  );
}
