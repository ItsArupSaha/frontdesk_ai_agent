import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPage() {
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

        <h1 className="text-3xl font-semibold tracking-tight text-white">Privacy Policy</h1>
        <p className="mt-2 text-sm text-white/40">Last updated: May 6, 2026</p>

        <div className="mt-10 space-y-8 text-sm leading-7 text-white/70">
          <section>
            <h2 className="mb-3 text-base font-semibold text-white">1. Information We Collect</h2>
            <p>We collect the following types of information:</p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>
                <strong className="text-white/90">Business information</strong> — name, email, phone
                number, and service area provided during onboarding.
              </li>
              <li>
                <strong className="text-white/90">Call data</strong> — transcripts and metadata from
                inbound calls handled by the AI receptionist.
              </li>
              <li>
                <strong className="text-white/90">Caller data</strong> — names, phone numbers, and
                service requests provided by your customers during calls.
              </li>
              <li>
                <strong className="text-white/90">Usage data</strong> — dashboard activity, feature
                usage, and session logs.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-white">2. How We Use Your Information</h2>
            <p>We use collected data to:</p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Operate and deliver the AI receptionist service.</li>
              <li>Book appointments and send SMS confirmations to your customers.</li>
              <li>Display call logs, bookings, and analytics in your dashboard.</li>
              <li>Improve service quality and reliability.</li>
              <li>Communicate with you about your account and service updates.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-white">3. Data Sharing</h2>
            <p>
              We do not sell your data. We share data only with third-party services required to
              operate the platform:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>
                <strong className="text-white/90">Vapi.ai</strong> — voice call routing and
                transcription.
              </li>
              <li>
                <strong className="text-white/90">Twilio</strong> — SMS delivery.
              </li>
              <li>
                <strong className="text-white/90">Supabase</strong> — database and authentication.
              </li>
              <li>
                <strong className="text-white/90">OpenAI</strong> — AI language processing.
              </li>
            </ul>
            <p className="mt-3">
              Each provider is bound by their own privacy policies and industry-standard data
              protection practices.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-white">4. Data Retention</h2>
            <p>
              Call logs and booking data are retained for the duration of your subscription. Upon
              account termination, data is retained for 30 days and then permanently deleted upon
              written request.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-white">5. Security</h2>
            <p>
              All sensitive credentials (API keys, OAuth tokens) are encrypted at rest. Data is
              transmitted over TLS. We do not log API keys or authentication tokens. Access to client
              data is restricted to the account owner and FrondexAI operations.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-white">6. Your Rights</h2>
            <p>You may request at any time:</p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>A copy of the data we hold about your business.</li>
              <li>Correction of inaccurate data.</li>
              <li>Deletion of your account and associated data.</li>
            </ul>
            <p className="mt-3">
              To exercise these rights, email{" "}
              <a
                href="mailto:growwitharup@gmail.com"
                className="text-violet-400 hover:text-violet-300"
              >
                growwitharup@gmail.com
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-white">7. Cookies</h2>
            <p>
              The dashboard uses browser session storage for authentication. We do not use tracking
              cookies or third-party advertising cookies.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-white">8. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. Active clients will be notified by
              email of material changes. Continued use of the Service after changes constitutes
              acceptance.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-white">9. Contact</h2>
            <p>
              For privacy-related questions, contact us at{" "}
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
