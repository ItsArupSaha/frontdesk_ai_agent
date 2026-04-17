import { lazy, Suspense, useState } from "react";
import { motion } from "framer-motion";
import { Navbar } from "../components/Navbar";
import { Hero } from "../components/Hero";
import { SectionParticleLayer } from "../components/SectionParticleLayer";
import { SectionHeading } from "../components/SectionHeading";
import { BenefitCard } from "../components/BenefitCard";
import { PricingCard } from "../components/PricingCard";
import { TestimonialCard } from "../components/TestimonialCard";
import { FAQItem } from "../components/FAQItem";
import { CTASection } from "../components/CTASection";
import { Footer } from "../components/Footer";
import { SectionSkeleton } from "../components/SectionSkeleton";
import { ShowcaseSection } from "../components/landing/ShowcaseSection";
import {
  benefits,
  faqs,
  features,
  plans,
  processSteps,
  testimonials,
} from "../data/landing";
import { rootStyles } from "../lib/design-tokens";
import { fadeUp, staggerContainer, viewportOnce } from "../lib/motion";
import { useLenisScroll } from "../lib/useLenisScroll";

const FeatureRow = lazy(() =>
  import("../components/FeatureRow").then((module) => ({ default: module.FeatureRow })),
);
const ProcessCard = lazy(() =>
  import("../components/ProcessCard").then((module) => ({ default: module.ProcessCard })),
);

export function LandingPage() {
  const [yearly, setYearly] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);

  useLenisScroll();

  return (
    <div style={rootStyles} className="bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <Navbar />
      <main>
        <Hero />

        <section
          id="solutions"
          className="relative isolate overflow-hidden px-4 py-[clamp(4.5rem,8vw,7rem)] sm:px-6 lg:px-8"
        >
          <SectionParticleLayer />
          <div className="relative z-10 mx-auto max-w-[1240px]">
            <SectionHeading
              eyebrow="What We Provide"
              title={
                <>
                  A 24/7 AI receptionist
                  <br />
                  that never misses a call.
                </>
              }
              description="We provide a 24/7 AI receptionist for plumbing, HVAC, and electrical businesses that answers every call, qualifies leads, detects emergencies, books appointments, and sends instant confirmations."
            />
          </div>
        </section>

        <section className="relative isolate overflow-hidden px-4 pb-[clamp(5rem,8vw,8rem)] sm:px-6 lg:px-8">
          <SectionParticleLayer glowClassName="bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.08),transparent_56%)]" />
          <div className="relative z-10 mx-auto flex max-w-[1240px] flex-col gap-24">
            <Suspense fallback={<SectionSkeleton rows={2} />}>
              {features.map((feature, index) => (
                <FeatureRow key={feature.id} feature={feature} reverse={index % 2 === 1} />
              ))}
            </Suspense>
          </div>
        </section>

        <section className="relative isolate overflow-hidden px-4 py-[clamp(5rem,8vw,8rem)] sm:px-6 lg:px-8">
          <SectionParticleLayer />
          <div className="relative z-10 mx-auto max-w-[1240px]">
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

        <ShowcaseSection />

        <section className="relative isolate overflow-hidden px-4 py-[clamp(5rem,8vw,8rem)] sm:px-6 lg:px-8">
          <SectionParticleLayer />
          <div className="relative z-10 mx-auto max-w-[1240px]">
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

        <section
          id="pricing"
          className="relative isolate overflow-hidden px-4 py-[clamp(5rem,8vw,8rem)] sm:px-6 lg:px-8"
        >
          <SectionParticleLayer />
          <div className="relative z-10 mx-auto max-w-[1240px]">
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

        <section className="relative isolate overflow-hidden px-4 py-[clamp(5rem,8vw,8rem)] sm:px-6 lg:px-8">
          <SectionParticleLayer />
          <div className="relative z-10 mx-auto max-w-[1240px]">
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

        <section className="relative isolate overflow-hidden px-4 py-[clamp(5rem,8vw,8rem)] sm:px-6 lg:px-8">
          <SectionParticleLayer />
          <div className="relative z-10 mx-auto max-w-[900px]">
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
        <Footer />
      </main>
    </div>
  );
}
