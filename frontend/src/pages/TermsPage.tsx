import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#07050d] px-4 py-16 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[760px]">
        <Link
          to="/"
          className="mb-10 inline-flex items-center gap-2 text-sm text-white/50 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>

        <h1 className="text-3xl font-semibold tracking-tight text-white">Terms of Service</h1>
        <p className="mt-2 text-sm text-white/40">Last updated: May 6, 2026</p>

        <div className="mt-10 space-y-8 text-sm leading-7 text-white/70">
          <section>
            <h2 className="mb-3 text-base font-semibold text-white">1. Acceptance of Terms</h2>
            <p>
              By accessing or using FrondexAI ("the Service"), you agree to be bound by these Terms of
              Service. If you do not agree, do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-white">2. Description of Service</h2>
            <p>
              FrondexAI provides a 24/7 AI-powered receptionist service for plumbing, HVAC, and
              electrical businesses. The Service includes inbound call handling, lead qualification,
              emergency detection, appointment booking, and SMS confirmations.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-white">3. Account and Access</h2>
            <p>
              Access to the client dashboard is granted after successful payment and account setup by
              FrondexAI. You are responsible for maintaining the confidentiality of your login
              credentials and for all activity under your account.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-white">4. Payment and Billing</h2>
            <p>
              A one-time setup fee is charged at sign-up, followed by a recurring monthly subscription.
              Payments are processed securely through our payment provider. Subscriptions renew
              automatically unless cancelled. No refunds are issued for partial months.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-white">5. Acceptable Use</h2>
            <p>
              You agree not to use the Service for any unlawful purpose, to impersonate others, to
              transmit spam, or to interfere with the operation of the Service. FrondexAI reserves the
              right to suspend or terminate accounts that violate these terms.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-white">6. Call Recording and Data</h2>
            <p>
              The Service records and transcribes inbound calls for the purpose of lead qualification
              and appointment booking. By using the Service, you confirm you have obtained any required
              consent from callers as required by applicable law (e.g., two-party consent states).
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-white">7. Limitation of Liability</h2>
            <p>
              FrondexAI is not liable for missed calls, failed bookings, SMS delivery failures, or any
              indirect or consequential damages arising from use of the Service. The Service is provided
              "as is" without warranties of any kind.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-white">8. Termination</h2>
            <p>
              Either party may terminate the subscription at any time. Upon termination, your access to
              the dashboard and AI receptionist will be deactivated. Your data will be retained for 30
              days and then permanently deleted upon request.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-white">9. Changes to Terms</h2>
            <p>
              FrondexAI may update these Terms at any time. Continued use of the Service after changes
              constitutes acceptance of the new Terms. We will notify active clients by email of any
              material changes.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-white">10. Contact</h2>
            <p>
              For questions about these Terms, contact us at{" "}
              <a
                href="mailto:growwitharup@gmail.com"
                className="text-violet-400 hover:text-violet-300"
              >
                growwitharup@gmail.com
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
