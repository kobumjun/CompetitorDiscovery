import { LegalPageHeader } from "@/components/legal-page-header";
import { SiteFooter } from "@/components/site-footer";

const CONTACT_EMAIL = "dwasbum@gmail.com";

export default function ContactPage() {
  return (
    <div className="min-h-screen flex flex-col bg-surface-50">
      <LegalPageHeader />
      <main className="flex-1 max-w-2xl mx-auto px-6 py-10 w-full">
        <h1 className="text-2xl font-bold text-ink-900 mb-6">Contact</h1>
        <div className="space-y-4 text-sm text-ink-600 leading-relaxed">
          <p>
            For product questions, billing support, or partnership inquiries, reach us at:
          </p>
          <div className="card p-5">
            <p className="text-xs font-semibold text-ink-400 uppercase tracking-wide mb-1">
              Email
            </p>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-lg font-semibold text-brand-600 hover:text-brand-700 break-all"
            >
              {CONTACT_EMAIL}
            </a>
          </div>
          <p className="text-ink-500">
            We are a small team; please allow a few business days for a reply. For refund
            requests, see our{" "}
            <a href="/refund-policy" className="text-brand-600 hover:text-brand-700 font-medium">
              Refund Policy
            </a>
            .
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
