import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { BlackHoleVisual } from "./BlackHoleVisual";
import { ParticleField } from "./ParticleField";

// Stagger container — 1.5s delay so rings + particles play first
const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.24,
      delayChildren: 1.5,
    },
  },
};

// Each element drifts in over 2s — barely moves, barely blurs
const itemVariants = {
  hidden: { opacity: 0, y: 7, filter: "blur(4px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      duration: 2.0,
      ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
    },
  },
};

// Headline — the longest, slowest settle of all
const headlineVariants = {
  hidden: { opacity: 0, y: 10, filter: "blur(6px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      duration: 2.2,
      ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
    },
  },
};

export function Hero() {
  return (
    <section
      id="home"
      className="relative min-h-screen overflow-hidden bg-black"
      style={{ paddingTop: "0" }}
    >
      {/* Particle field — subtle white dots drifting inward */}
      <ParticleField className="absolute inset-0 z-0" />

      {/* Purple vortex glow — centered precisely on the text block */}
      <BlackHoleVisual />

      {/* Content — centered, compact */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 flex h-full min-h-screen flex-col items-center justify-center px-5 pb-16 pt-20 text-center sm:px-8"
      >
        {/* Badge */}
        <motion.div
          variants={itemVariants}
          className="mb-7 inline-flex items-center gap-0 overflow-hidden rounded-full border border-[rgba(255,255,255,0.09)] bg-[rgba(14,14,18,0.82)] backdrop-blur-sm"
        >
          <span
            className="rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide text-white"
            style={{ background: "linear-gradient(135deg,#7C3AED 0%,#8B5CF6 100%)" }}
          >
            Introducing
          </span>
          <span className="px-3 py-1 text-[12px] text-[rgba(255,255,255,0.82)]">
            Your Smart Front-desk Agent
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          variants={headlineVariants}
          className="max-w-[700px] text-[clamp(2rem,5vw,3rem)] font-bold leading-[1.08] tracking-[-0.04em] text-white"
        >
          Front-Desk Voice Agent For Home Service Agencies.
        </motion.h1>

        {/* Subtext */}
        <motion.p
          variants={itemVariants}
          className="mt-5 max-w-[500px] text-[0.875rem] leading-[1.65] text-[rgba(255,255,255,0.52)]"
        >
          Xtract brings AI automation to your fingertips &amp; streamline tasks.
        </motion.p>

        {/* CTA buttons */}
        <motion.div
          variants={itemVariants}
          className="mt-8 flex flex-wrap items-center justify-center gap-3"
        >
          {/* Primary */}
          <a
            href="#cta"
            className="inline-flex items-center gap-1.5 rounded-[8px] px-4 py-[7px] text-[12.5px] font-medium text-white transition-opacity duration-150 hover:opacity-90"
            style={{
              background: "linear-gradient(135deg,#7C3AED 0%,#8B5CF6 100%)",
              boxShadow: "0 0 18px rgba(124,58,237,0.28)",
            }}
          >
            Get in touch
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </a>

          {/* Secondary */}
          <a
            href="#solutions"
            className="inline-flex items-center gap-1.5 rounded-[8px] border border-[rgba(255,255,255,0.10)] bg-[rgba(12,12,14,0.70)] px-4 py-[7px] text-[12.5px] font-medium text-[rgba(255,255,255,0.78)] backdrop-blur-sm transition-colors duration-150 hover:border-[rgba(139,92,246,0.26)] hover:text-white"
          >
            View services
          </a>
        </motion.div>
      </motion.div>
    </section>
  );
}
