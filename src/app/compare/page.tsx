import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Rocket } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "ProposalPilot vs Apollo vs Hunter vs Clay — Which Outreach Tool is Right for You?",
};

const comparisonRows = [
  {
    feature: "Real-time email extraction from any URL",
    proposalPilot: "Yes",
    apollo: "No (pre-built database)",
    hunter: "Yes (domain search)",
    clay: "No (enrichment)",
  },
  {
    feature: "AI-generated personalized outreach",
    proposalPilot: "Yes (GPT-4o)",
    apollo: "Yes (basic)",
    hunter: "No",
    clay: "Yes",
  },
  {
    feature: "Bulk URL processing",
    proposalPilot: "Yes (up to 20)",
    apollo: "No",
    hunter: "No",
    clay: "No",
  },
  {
    feature: "Sends from your own email",
    proposalPilot: "Yes",
    apollo: "No (built-in sender)",
    hunter: "No",
    clay: "No",
  },
  {
    feature: "Free tier",
    proposalPilot: "Yes (5 credits)",
    apollo: "Yes (limited)",
    hunter: "Yes (25/mo)",
    clay: "No",
  },
  {
    feature: "Starting price",
    proposalPilot: "$19/mo",
    apollo: "$49/mo",
    hunter: "$49/mo",
    clay: "$149/mo",
  },
  {
    feature: "Best for",
    proposalPilot: "Solo outreach — freelancers, founders, link builders",
    apollo: "Sales teams with large pipelines",
    hunter: "Email verification at scale",
    clay: "Revenue ops and enrichment workflows",
  },
];

export default function ComparePage() {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <nav className="border-b border-surface-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Rocket className="w-6 h-6 text-brand-500" strokeWidth={2.5} />
            <span className="text-lg font-bold text-ink-900">ProposalPilot</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login" className="btn-ghost text-sm">
              Log in
            </Link>
            <Link href="/signup" className="btn-primary text-sm">
              Start Free
            </Link>
          </div>
        </div>
      </nav>

      <main className="flex-1 max-w-6xl mx-auto px-6 py-12 w-full">
        <h1 className="text-display font-black text-ink-900 mb-4">
          ProposalPilot vs Other Outreach Tools
        </h1>
        <p className="text-ink-600 mb-8 max-w-3xl">
          Most outreach tools start with a database. ProposalPilot starts with the website you
          already found. Here&apos;s how it compares.
        </p>

        <div className="card overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-surface-50 border-b border-surface-200">
              <tr>
                <th className="text-left p-4 font-semibold text-ink-900">Feature</th>
                <th className="text-left p-4 font-semibold text-ink-900">ProposalPilot</th>
                <th className="text-left p-4 font-semibold text-ink-900">Apollo.io</th>
                <th className="text-left p-4 font-semibold text-ink-900">Hunter.io</th>
                <th className="text-left p-4 font-semibold text-ink-900">Clay</th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row) => (
                <tr key={row.feature} className="border-b border-surface-100">
                  <td className="p-4 text-ink-700 font-medium">{row.feature}</td>
                  <td className="p-4 text-ink-600">{row.proposalPilot}</td>
                  <td className="p-4 text-ink-600">{row.apollo}</td>
                  <td className="p-4 text-ink-600">{row.hunter}</td>
                  <td className="p-4 text-ink-600">{row.clay}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <section className="mt-10 grid gap-6 md:grid-cols-3">
          <article className="card p-6">
            <h2 className="text-base font-bold text-ink-900 mb-2">ProposalPilot vs Apollo</h2>
            <p className="text-sm text-ink-600 leading-relaxed">
              Apollo is a full sales platform with a massive contact database. ProposalPilot is
              lighter — paste a URL, get the email, generate a pitch, send. No database
              subscription needed.
            </p>
          </article>
          <article className="card p-6">
            <h2 className="text-base font-bold text-ink-900 mb-2">ProposalPilot vs Hunter</h2>
            <p className="text-sm text-ink-600 leading-relaxed">
              Hunter focuses on finding and verifying emails by domain. ProposalPilot adds AI
              outreach generation on top of extraction — find the email AND write the pitch in one
              flow.
            </p>
          </article>
          <article className="card p-6">
            <h2 className="text-base font-bold text-ink-900 mb-2">ProposalPilot vs Clay</h2>
            <p className="text-sm text-ink-600 leading-relaxed">
              Clay is an enrichment and workflow tool for revenue teams. ProposalPilot is simpler
              and cheaper — built for individuals who want to send personalized outreach without
              setting up complex automations.
            </p>
          </article>
        </section>

        <section className="mt-10 card p-8 text-center">
          <h2 className="text-heading font-bold text-ink-900 mb-3">See if ProposalPilot fits your workflow</h2>
          <p className="text-ink-500 mb-6">
            Start free and test real-time extraction plus AI outreach generation.
          </p>
          <Link href="/signup" className="btn-primary inline-flex">
            Try ProposalPilot free
            <ArrowRight className="w-4 h-4" />
          </Link>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
