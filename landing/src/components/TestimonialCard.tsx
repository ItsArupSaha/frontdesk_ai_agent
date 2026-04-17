import { motion } from "framer-motion";
import { Star } from "lucide-react";
import type { Testimonial } from "../data/landing";
import { cardHover, staggerItem } from "../lib/motion";

type TestimonialCardProps = {
  testimonial: Testimonial;
};

export function TestimonialCard({ testimonial }: TestimonialCardProps) {
  return (
    <motion.div
      variants={staggerItem}
      initial="rest"
      whileHover="hover"
      animate="rest"
      className="rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[rgba(13,13,17,0.96)] p-6"
    >
      <motion.div variants={cardHover}>
        <div className="flex items-center gap-1 text-[var(--accent-bright)]">
          {Array.from({ length: 5 }).map((_, index) => (
            <Star key={index} className="h-4 w-4 fill-current" />
          ))}
        </div>
        <p className="mt-5 text-base leading-8 text-[var(--text-primary)]">“{testimonial.quote}”</p>
        <div className="mt-8 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[rgba(139,92,246,0.3)] bg-[rgba(124,58,237,0.12)] text-sm font-medium text-white">
            {testimonial.initials}
          </div>
          <div>
            <div className="text-sm font-medium text-white">{testimonial.name}</div>
            <div className="text-sm text-[var(--text-muted)]">{testimonial.role}</div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
