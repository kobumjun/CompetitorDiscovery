import Link from "next/link";
import { LegalPageHeader } from "@/components/legal-page-header";
import { SiteFooter } from "@/components/site-footer";

const REFUND_EMAIL = "dwasbum@gmail.com";

export default function RefundPolicyPage() {
  return (
    <div className="min-h-screen flex flex-col bg-surface-50">
      <LegalPageHeader />
      <main className="flex-1 max-w-2xl mx-auto px-6 py-10 w-full">
        <h1 className="text-2xl font-bold text-ink-900 mb-6">Refund Policy</h1>
        <div className="space-y-4 text-sm text-ink-600 leading-relaxed">
          <p className="text-ink-500 text-xs">Last updated: April 2026</p>
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-ink-900">General rule</h2>
            <p>
              ThreadScope delivers digital access and AI-generated analysis.{" "}
              <strong>All sales are final</strong> except in the limited cases below.
              Dissatisfaction with the subjective quality of an AI report is{" "}
              <strong>not</strong> grounds for a refund.
            </p>
          </section>
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-ink-900">When we may issue a refund</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Service not delivered:</strong> You were charged but no analysis
                result was produced due to a clear failure on our side (e.g. persistent
                errors, no completed run after payment where applicable).
              </li>
              <li>
                <strong>Duplicate charge:</strong> You were billed twice for the same
                subscription period in error.
              </li>
              <li>
                <strong>Obvious system error:</strong> A demonstrable billing or access bug
                that we confirm on our end.
              </li>
            </ul>
          </section>
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-ink-900">What we do not refund</h2>
            <p>
              We do not refund because you dislike the wording of a report, disagree with
              AI conclusions, or expected different competitors or insights. Credits used
              for successful analyses are consumed as designed.
            </p>
          </section>
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-ink-900">How to request a review</h2>
            <p>
              Email{" "}
              <a
                href={`mailto:${REFUND_EMAIL}?subject=ThreadScope%20refund%20request`}
                className="text-brand-600 hover:text-brand-700 font-medium break-all"
              >
                {REFUND_EMAIL}
              </a>{" "}
              with your account email, approximate date of charge, and a short description
              of the issue. We will respond within a reasonable time and may ask for
              screenshots or transaction IDs.
            </p>
          </section>
          <p className="text-ink-500 text-xs pt-2">
            For general questions (non-refund), see{" "}
            <Link href="/contact" className="text-brand-600 hover:text-brand-700">
              Contact
            </Link>
            .
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
