import Link from "next/link";
import { LegalPageHeader } from "@/components/legal-page-header";
import { SiteFooter } from "@/components/site-footer";

export default function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-surface-50">
      <LegalPageHeader />
      <main className="flex-1 max-w-2xl mx-auto px-6 py-10 w-full">
        <h1 className="text-2xl font-bold text-ink-900 mb-6">Terms of Service</h1>
        <div className="space-y-4 text-sm text-ink-600 leading-relaxed">
          <p className="text-ink-500 text-xs">Last updated: April 2026</p>
          <p>
            Welcome to ThreadScope. By using our service, you agree to these terms. If you
            do not agree, please do not use the product.
          </p>
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-ink-900">Use of the service</h2>
            <p>
              You may submit <strong>public</strong> X (Twitter) thread URLs for analysis.
              ThreadScope processes publicly available content to produce AI-generated
              market and competitive insights. You are responsible for ensuring you have
              the right to use any URL you submit.
            </p>
          </section>
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-ink-900">AI-generated output</h2>
            <p>
              Results are produced by artificial intelligence. We do{" "}
              <strong>not</strong> guarantee accuracy, completeness, or fitness for any
              particular purpose. Outputs are for research and decision support only—not
              legal, financial, or professional advice.
            </p>
          </section>
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-ink-900">Purpose</h2>
            <p>
              The service is intended to help you explore patterns in{" "}
              <strong>public</strong> conversations (e.g. builder threads) for market
              intelligence. It is not intended for scraping private data, harassment, or
              any unlawful use.
            </p>
          </section>
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-ink-900">Acceptable use</h2>
            <p>
              You must not abuse accounts, circumvent limits, overload our systems, or use
              automation in a way that harms the service or other users. We may suspend
              or terminate access for violations.
            </p>
          </section>
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-ink-900">Plans, credits &amp; subscriptions</h2>
            <p>
              Paid plans, credits (analysis allowances), and billing are described on our
              pricing page and managed according to our policies and payment provider terms.
              We may adjust product features or limits with reasonable notice where required.
            </p>
          </section>
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-ink-900">Changes</h2>
            <p>
              We may update these terms or the service from time to time. Continued use
              after changes constitutes acceptance of the updated terms. For questions, see{" "}
              <Link href="/contact" className="text-brand-600 hover:text-brand-700 font-medium">
                Contact
              </Link>
              .
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
