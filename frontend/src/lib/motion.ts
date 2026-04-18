import type { Variants } from "framer-motion";
import { designTokens } from "./design-tokens";

const ease = designTokens.motion.ease;

export const viewportOnce = { once: true, amount: 0.2 };

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: designTokens.motion.base, ease },
  },
};

export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: designTokens.motion.stagger,
      delayChildren: 0.04,
    },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease },
  },
};

export const heroHeadline: Variants = {
  hidden: { opacity: 0, y: 18, filter: "blur(8px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.9, ease, delay: 0.28 },
  },
};

export const splitReveal = (direction: "left" | "right"): Variants => ({
  hidden: {
    opacity: 0,
    y: 28,
    x: direction === "left" ? -12 : 12,
  },
  visible: {
    opacity: 1,
    y: 0,
    x: 0,
    transition: { duration: 0.7, ease },
  },
});

export const cardHover = {
  rest: {
    y: 0,
    boxShadow: "0 0 0 1px rgba(255,255,255,0.05)",
    borderColor: "rgba(255,255,255,0.08)",
  },
  hover: {
    y: -2,
    boxShadow: "0 0 0 1px rgba(139,92,246,0.35), 0 0 28px rgba(124,58,237,0.12)",
    borderColor: "rgba(139,92,246,0.28)",
    transition: { duration: 0.2, ease },
  },
};

export const buttonHover = {
  rest: { y: 0, scale: 1 },
  hover: {
    y: -1,
    scale: 1.01,
    transition: { duration: designTokens.motion.fast, ease },
  },
};

export const orbFloat = {
  scale: [0.985, 1.02, 0.995],
  rotate: [0, 4, 0],
  opacity: [0.72, 0.9, 0.78],
  transition: {
    duration: designTokens.motion.ambient,
    repeat: Number.POSITIVE_INFINITY,
    repeatType: "mirror" as const,
    ease: "easeInOut" as const,
  },
};
