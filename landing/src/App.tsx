import { lazy, Suspense, useState } from "react";
import { motion } from "framer-motion";
import { Route, Routes } from "react-router-dom";
import { CheckCircle2, CircleDollarSign, Sparkles } from "lucide-react";
import { Navbar } from "./components/Navbar";
import { Hero } from "./components/Hero";
import { SectionHeading } from "./components/SectionHeading";
import { BenefitCard } from "./components/BenefitCard";
import { PricingCard } from "./components/PricingCard";
import { TestimonialCard } from "./components/TestimonialCard";
import { FAQItem } from "./components/FAQItem";
import { CTASection } from "./components/CTASection";
import { Footer } from "./components/Footer";
import {
  benefits,
  faqs,
  features,
  plans,
  processSteps,
  showcaseBullets,
  testimonials,
} from "./data/landing";
import { rootStyles } from "./lib/design-tokens";
import { fadeUp, staggerContainer, viewportOnce } from "./lib/motion";

const FeatureRow = lazy(() =>
  import("./components/FeatureRow").then((module) => ({ default: module.FeatureRow })),
);
const ProcessCard = lazy(() =>
  import("./components/ProcessCard").then((module) => ({ default: module.ProcessCard })),
);

function SectionSkeleton({ rows = 1 }: { rows?: number }) {
  return (
    <div className="grid gap-6">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="h-[420px] animate-pulse rounded-[var(--radius-panel)] border border-[var(--border-muted)] bg-[rgba(255,255,255,0.02)]"
        />
      ))}
    </div>
  );
}

function LandingPage() {
  const [yearly, setYearly] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);

  return (
    <div style={rootStyles} className="bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <Navbar />
      <main>
        <Hero />

        <section id="solutions" className="px-4 py-[clamp(4.5rem,8vw,7rem)] sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[1240px]">
            <SectionHeading
              eyebrow="Solutions"
              title="Systems designed to remove friction from the parts of the business that slow down growth."
              description="Each workflow is designed around controlled automation, measurable outcomes, and dark, productized interfaces that feel like part of your operating layer."
            />
          </div>
        </section>

        <section className="px-4 pb-[clamp(5rem,8vw,8rem)] sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-[1240px] flex-col gap-24">
            <Suspense fallback={<SectionSkeleton rows={2} />}>
              {features.map((feature, index) => (
                <FeatureRow key={feature.id} feature={feature} reverse={index % 2 === 1} />
              ))}
            </Suspense>
          </div>
        </section>

        <section className="px-4 py-[clamp(5rem,8vw,8rem)] sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[1240px]">
            <SectionHeading
              eyebrow="Process"
              title="Our simple, smart, and scalable process"
              description="We keep implementation tight: clear analysis, disciplined deployment, seamless integration, and continuous optimization after launch."
            />
            <motion.div
              className="grid gap-6 md:grid-cols-2"
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={viewportOnce}
            >
              <Suspense fallback={<SectionSkeleton rows={4} />}>
                {processSteps.map((step) => (
                  <ProcessCard key={step.id} step={step} />
                ))}
              </Suspense>
            </motion.div>
          </div>
        </section>

        <section
          id="showcase"
          className="px-4 py-[clamp(5rem,8vw,8rem)] sm:px-6 lg:px-8"
        >
          <div className="mx-auto max-w-[1240px]">
            <SectionHeading
              eyebrow="Showcase"
              title="A controlled automation layer for teams that need speed without chaos."
              description="The system below represents how we combine workflow visibility, event triggers, and operational intelligence into one measured surface."
            />
            <div className="grid items-center gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:gap-14">
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={viewportOnce}
                variants={fadeUp}
                className="relative overflow-hidden rounded-[var(--radius-panel)] border border-[var(--border-default)] bg-[linear-gradient(180deg,rgba(13,13,17,0.98),rgba(8,8,10,0.96))] p-5 sm:p-6"
              >
                <div className="absolute inset-x-10 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(139,92,246,0.55),transparent)]" />
                <div className="grid gap-5 lg:grid-cols-[0.88fr_1.12fr]">
                  <div className="rounded-[18px] border border-[var(--border-muted)] bg-[radial-gradient(circle_at_top,rgba(139,92,246,0.24),rgba(13,13,17,0.92)_56%)] p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-[var(--text-low)]">
                          Revenue engine
                        </p>
                        <p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-white">
                          92%
                        </p>
                      </div>
                      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[rgba(139,92,246,0.24)] bg-[rgba(124,58,237,0.14)]">
                        <CircleDollarSign className="h-6 w-6 text-[var(--accent-bright)]" />
                      </div>
                    </div>
                    <div className="mt-8 space-y-3">
                      <div className="h-2 rounded-full bg-[rgba(255,255,255,0.06)]">
                        <div className="h-full w-[86%] rounded-full bg-[linear-gradient(135deg,#7C3AED_0%,#8B5CF6_100%)]" />
                      </div>
                      <div className="flex justify-between text-sm text-[var(--text-muted)]">
                        <span>Qualification accuracy</span>
                        <span>86%</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-5">
                    <div className="rounded-[18px] border border-[var(--border-muted)] bg-[rgba(255,255,255,0.02)] p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs uppercase tracking-[0.3em] text-[var(--text-low)]">
                            Intelligent routing
                          </p>
                          <p className="mt-2 text-xl font-medium text-white">Event-driven decisions</p>
                        </div>
                        <Sparkles className="h-5 w-5 text-[var(--accent-bright)]" />
                      </div>
                      <div className="mt-5 grid gap-3 sm:grid-cols-3">
                        {["Lead intake", "Intent score", "Exec handoff"].map((item, index) => (
                          <div
                            key={item}
                            className="rounded-[14px] border border-[var(--border-muted)] bg-[rgba(255,255,255,0.02)] px-4 py-3 text-sm text-[var(--text-secondary)]"
                          >
                            <span className="mb-2 block text-[10px] uppercase tracking-[0.24em] text-[var(--text-low)]">
                              0{index + 1}
                            </span>
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-[18px] border border-[var(--border-muted)] bg-[rgba(255,255,255,0.02)] p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs uppercase tracking-[0.3em] text-[var(--text-low)]">
                            Operational signal
                          </p>
                          <p className="mt-2 text-xl font-medium text-white">Centralized visibility</p>
                        </div>
                        <CheckCircle2 className="h-5 w-5 text-[var(--accent-bright)]" />
                      </div>
                      <div className="mt-5 grid gap-4">
                        {[
                          "Response lag reduced across all channels",
                          "Unified records across CRM, support, and reporting",
                          "Escalations routed using business-specific logic",
                        ].map((item) => (
                          <div key={item} className="flex items-start gap-3 text-sm text-[var(--text-secondary)]">
                            <CheckCircle2 className="mt-0.5 h-4 w-4 text-[var(--accent-bright)]" />
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>

              <motion.div
                variants={staggerContainer}
                initial="hidden"
                whileInView="visible"
                viewport={viewportOnce}
                className="space-y-5"
              >
                {showcaseBullets.map((bullet) => (
                  <motion.div
                    key={bullet}
                    variants={fadeUp}
                    className="flex items-start gap-4 rounded-[18px] border border-[var(--border-default)] bg-[rgba(13,13,17,0.9)] px-5 py-4"
                  >
                    <span className="mt-1 inline-flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(139,92,246,0.24)] bg-[rgba(124,58,237,0.12)]">
                      <CheckCircle2 className="h-4 w-4 text-[var(--accent-bright)]" />
                    </span>
                    <p className="text-sm leading-7 text-[var(--text-secondary)]">{bullet}</p>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </div>
        </section>

        <section className="px-4 py-[clamp(5rem,8vw,8rem)] sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[1240px]">
            <SectionHeading
              eyebrow="Benefits"
              title="Operational outcomes that compound as the system matures."
              description="The objective is not novelty. It is cleaner execution, faster decisions, and measurable throughput gains across your stack."
            />
            <motion.div
              className="grid gap-6 md:grid-cols-2 xl:grid-cols-3"
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={viewportOnce}
            >
              {benefits.map((benefit) => (
                <BenefitCard key={benefit.title} benefit={benefit} />
              ))}
            </motion.div>
          </div>
        </section>

        <section id="pricing" className="px-4 py-[clamp(5rem,8vw,8rem)] sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[1240px]">
            <SectionHeading
              eyebrow="Pricing"
              title="Structured engagements for focused rollout or full AI operations."
              description="Choose a scope that matches the number of workflows, systems, and teams involved. Every plan is built for production delivery."
            />

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={viewportOnce}
              variants={fadeUp}
              className="mx-auto mb-10 flex w-fit items-center rounded-full border border-[var(--border-default)] bg-[rgba(13,13,17,0.92)] p-1"
            >
              <button
                type="button"
                onClick={() => setYearly(false)}
                className={[
                  "rounded-full px-4 py-2 text-sm transition-colors duration-200",
                  yearly ? "text-[var(--text-muted)]" : "bg-[rgba(124,58,237,0.18)] text-white",
                ].join(" ")}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setYearly(true)}
                className={[
                  "rounded-full px-4 py-2 text-sm transition-colors duration-200",
                  yearly ? "bg-[rgba(124,58,237,0.18)] text-white" : "text-[var(--text-muted)]",
                ].join(" ")}
              >
                Yearly
              </button>
            </motion.div>

            <motion.div
              className="grid gap-6 lg:grid-cols-3"
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={viewportOnce}
            >
              {plans.map((plan) => (
                <PricingCard key={plan.name} plan={plan} yearly={yearly} />
              ))}
            </motion.div>
          </div>
        </section>

        <section className="px-4 py-[clamp(5rem,8vw,8rem)] sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[1240px]">
            <SectionHeading
              eyebrow="Testimonials"
              title="Teams choose us when the automation needs to feel serious, reliable, and invisible."
              description="The common thread is trust: strong systems, restrained design, and measurable results without operational chaos."
            />
            <motion.div
              className="grid gap-6 lg:grid-cols-2"
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={viewportOnce}
            >
              {testimonials.map((testimonial) => (
                <TestimonialCard key={testimonial.name} testimonial={testimonial} />
              ))}
            </motion.div>
          </div>
        </section>

        <section className="px-4 py-[clamp(5rem,8vw,8rem)] sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[900px]">
            <SectionHeading
              eyebrow="FAQ"
              title="Questions teams ask before moving into implementation."
              description="We keep the process clear, scoped, and measurable from the first working session onward."
            />
            <div className="space-y-4">
              {faqs.map((faq, index) => (
                <FAQItem
                  key={faq.question}
                  question={faq.question}
                  answer={faq.answer}
                  open={openFaq === index}
                  onToggle={() => setOpenFaq((current) => (current === index ? -1 : index))}
                />
              ))}
            </div>
          </div>
        </section>

        <CTASection />
      </main>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
    </Routes>
  );
}
