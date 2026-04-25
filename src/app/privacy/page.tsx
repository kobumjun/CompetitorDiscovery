import { LegalPageHeader } from "@/components/legal-page-header";
import { SiteFooter } from "@/components/site-footer";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col bg-surface-50">
      <LegalPageHeader />
      <main className="flex-1 max-w-2xl mx-auto px-6 py-10 w-full">
        <h1 className="text-2xl font-bold text-ink-900 mb-6">Privacy Policy</h1>
        <div className="space-y-4 text-sm text-ink-600 leading-relaxed">
          <p className="text-ink-500 text-xs">Last updated: April 2026</p>
          <p>
            ProposalPilot (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;) respects your privacy.
            This policy explains what data we collect, how we use it, and your rights.
          </p>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-ink-900">What we collect</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Account information: name and email address via Google OAuth sign-in</li>
              <li>Usage data: keywords searched, URLs submitted, emails extracted, proposals created</li>
              <li>Payment information: handled entirely by LemonSqueezy; we do not store credit card details</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-ink-900">How we use your data</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>To provide and operate the service</li>
              <li>To manage your account and credits</li>
              <li>To improve the product based on usage patterns</li>
              <li>To send transactional emails (e.g., credit confirmations)</li>
            </ul>
            <p>We do not sell your personal data to third parties.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-ink-900">Third-party services</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Google OAuth: for authentication</li>
              <li>Supabase: for data storage and authentication</li>
              <li>OpenAI: to generate AI-powered pitches (your input keywords and extracted site content may be sent to OpenAI&apos;s API)</li>
              <li>Serper.dev: to search for prospect companies based on your keywords</li>
              <li>LemonSqueezy: for payment processing</li>
              <li>Vercel: for hosting</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-ink-900">Data retention</h2>
            <p>
              Your data is retained as long as your account is active. You can request deletion
              of your account and associated data at any time by contacting us.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-ink-900">Cookies</h2>
            <p>
              We use essential cookies for authentication and session management only. We do not
              use tracking or advertising cookies.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-ink-900">Your rights</h2>
            <p>
              You may request access to, correction of, or deletion of your personal data by
              contacting us at dwasbum@gmail.com.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-ink-900">Contact</h2>
            <p>
              For privacy-related questions, contact us at dwasbum@gmail.com.
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
