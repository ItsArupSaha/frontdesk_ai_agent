import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cn } from "../lib/cn";

type FAQItemProps = {
  question: string;
  answer: string;
  open: boolean;
  onToggle: () => void;
};

export function FAQItem({ question, answer, open, onToggle }: FAQItemProps) {
  return (
    <div className="overflow-hidden rounded-[18px] border border-[var(--border-default)] bg-[rgba(13,13,17,0.94)]">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left text-sm text-white transition-colors duration-200 hover:bg-[rgba(255,255,255,0.02)] sm:px-6"
      >
        <span className="text-base font-medium tracking-[-0.02em]">{question}</span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            "inline-flex h-9 w-9 items-center justify-center rounded-full border",
            open
              ? "border-[rgba(139,92,246,0.3)] bg-[rgba(124,58,237,0.12)]"
              : "border-[var(--border-default)] bg-[rgba(255,255,255,0.02)]",
          )}
        >
          <ChevronDown className="h-4 w-4 text-[var(--text-secondary)]" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <p className="px-5 pb-6 pt-0 text-sm leading-7 text-[var(--text-secondary)] sm:px-6">
              {answer}
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
