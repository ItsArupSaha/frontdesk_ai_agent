import { motion } from "framer-motion";
import { fadeUp, viewportOnce } from "../lib/motion";

const columns = [
  {
    title: "Pages",
    links: ["Home", "Solutions", "Pricing", "FAQ"],
  },
  {
    title: "Services",
    links: ["AI Workflows", "CRM Automation", "Support Systems", "Revenue Ops"],
  },
  {
    title: "Contact",
    links: ["hello@blackwood.ai", "+880 1700-000000", "Dhaka / Remote"],
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
      className="border-t border-[var(--border-muted)] bg-[linear-gradient(180deg,rgba(15,8,24,0.18),rgba(0,0,0,0))] px-4 pb-8 pt-16 sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-[1240px]">
        <div className="grid gap-10 border-b border-[var(--border-muted)] pb-10 md:grid-cols-[1.2fr_1.8fr]">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-[var(--border-default)] bg-[linear-gradient(180deg,rgba(124,58,237,0.22),rgba(13,13,17,0.95))]">
                <span className="text-base font-semibold tracking-[-0.06em] text-white">B</span>
              </span>
              <span className="text-sm font-medium tracking-[0.24em] text-white">BLACKWOOD AI</span>
            </div>
            <p className="mt-5 max-w-md text-sm leading-7 text-[var(--text-secondary)]">
              Premium AI automation systems for B2B teams that need sharper workflows, faster
              response cycles, and cleaner operating leverage.
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
                    <li key={link}>
                      <a
                        href="#home"
                        className="text-sm text-[var(--text-secondary)] transition-colors duration-200 hover:text-white"
                      >
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4 pt-6 text-sm text-[var(--text-low)] sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Blackwood AI. Built for high-control automation delivery.</p>
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
