import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { buttonHover, fadeUp, viewportOnce } from "../lib/motion";

export function CTASection() {
  return (
    <motion.section
      id="cta"
      initial="hidden"
      whileInView="visible"
      viewport={viewportOnce}
      variants={fadeUp}
      className="px-4 py-20 sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-[1240px]">
        <div className="relative overflow-hidden rounded-[var(--radius-cta)] border border-[rgba(139,92,246,0.24)] bg-[linear-gradient(135deg,rgba(58,21,122,0.92),rgba(17,10,34,0.98))] px-6 py-14 text-center shadow-[0_0_60px_rgba(124,58,237,0.14)] sm:px-10 lg:px-16 lg:py-20">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(139,92,246,0.18),transparent_62%)]" />
          <div className="relative z-10 mx-auto max-w-3xl">
            <p className="text-[11px] uppercase tracking-[0.3em] text-[rgba(255,255,255,0.58)]">
              Ready to move
            </p>
            <h2 className="mt-5 text-[clamp(2.4rem,5vw,3.6rem)] font-semibold leading-[1.02] tracking-[-0.05em] text-white">
              Turn fragmented workflows into a controlled AI operating layer.
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-[rgba(255,255,255,0.72)] sm:text-base">
              Book a working session and we’ll map the highest-leverage automations for your
              revenue, support, and ops systems.
            </p>
            <motion.a
              href="#home"
              variants={buttonHover}
              initial="rest"
              whileHover="hover"
              animate="rest"
              className="mt-10 inline-flex items-center gap-2 rounded-[var(--radius-button)] border border-white/10 bg-white px-6 py-3.5 text-sm font-medium text-black transition-colors duration-200 hover:bg-[rgba(255,255,255,0.92)]"
            >
              Schedule a Strategy Call
              <ArrowRight className="h-4 w-4" />
            </motion.a>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
