import { motion } from "framer-motion";
import { cn } from "../lib/cn";
import { fadeUp, staggerContainer, staggerItem, viewportOnce } from "../lib/motion";

type SectionHeadingProps = {
  eyebrow: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  className?: string;
};

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
  className,
}: SectionHeadingProps) {
  const centered = align === "center";

  return (
    <motion.div
      className={cn(
        "mx-auto mb-14 max-w-3xl",
        centered ? "text-center" : "text-left",
        className,
      )}
      variants={staggerContainer}
      initial="hidden"
      whileInView="visible"
      viewport={viewportOnce}
    >
      <motion.p
        variants={staggerItem}
        className="mb-4 text-[11px] font-medium uppercase tracking-[0.32em] text-[var(--text-muted)]"
      >
        {eyebrow}
      </motion.p>
      <motion.h2
        variants={fadeUp}
        className="text-[clamp(2.625rem,5vw,3.5rem)] font-semibold leading-[1.02] tracking-[-0.04em] text-[var(--text-primary)]"
      >
        {title}
      </motion.h2>
      {description ? (
        <motion.p
          variants={staggerItem}
          className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-[var(--text-secondary)] sm:text-base"
        >
          {description}
        </motion.p>
      ) : null}
    </motion.div>
  );
}
