import { motion, useScroll, useTransform } from "framer-motion";
import { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";

const NAV_LINKS = [
  { label: "Home", href: "#home" },
  { label: "About", href: "#about" },
  { label: "Blog", href: "#blog" },
  { label: "Contact", href: "#contact" },
];

export function Navbar() {
  const [mounted, setMounted] = useState(false);
  const { scrollY } = useScroll();

  // Subtle background darkening on scroll
  const bgOpacity = useTransform(scrollY, [0, 80], [0, 0.4]);

  useEffect(() => {
    const timer = window.setTimeout(() => setMounted(true), 1500);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={mounted ? { opacity: 1, y: 0 } : { opacity: 0, y: -10 }}
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-x-0 top-0 z-50 border-b border-[rgba(255,255,255,0.07)] backdrop-blur-[8px]"
      style={{ backgroundColor: "rgba(0,0,0,0.72)" }}
    >
      <div className="mx-auto flex max-w-[1240px] items-center justify-between px-5 py-3 sm:px-8">
        {/* Logo */}
        <a href="#home" className="flex items-center gap-2.5" aria-label="Xtract home">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-[6px]"
            style={{
              background: "linear-gradient(135deg,#7C3AED 0%,#5B21B6 100%)",
              boxShadow: "0 0 14px rgba(124,58,237,0.40)",
            }}
            aria-hidden="true"
          >
            {/* Simple X icon */}
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M2 2L12 12M12 2L2 12" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </span>
          <span
            className="text-sm font-bold tracking-[0.18em] text-white"
            style={{ letterSpacing: "0.18em" }}
          >
            XTRACT
          </span>
        </a>

        {/* Nav links */}
        <nav className="hidden items-center gap-7 md:flex" aria-label="Primary navigation">
          {NAV_LINKS.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="text-sm text-[rgba(255,255,255,0.78)] transition-colors duration-150 hover:text-white"
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* CTA */}
        <a
          href="#cta"
          className="inline-flex items-center gap-1.5 rounded-[8px] px-3.5 py-1.5 text-xs font-medium text-white transition-opacity duration-150 hover:opacity-90"
          style={{
            background: "linear-gradient(135deg,#7C3AED 0%,#8B5CF6 100%)",
            boxShadow: "0 0 16px rgba(124,58,237,0.30)",
          }}
        >
          Book a call
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      </div>
    </motion.header>
  );
}
