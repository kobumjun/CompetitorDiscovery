import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Rocket } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "What is ProposalPilot? — Extract Emails & Send AI-Powered Outreach",
};

const keyFeatures = [
  "Single Site extraction (1 credit)",
  "Bulk Discovery — up to 20 URLs at once (1 credit per email found)",
  "4 outreach types: Proposal, Sales Pitch, Investment Ask, Quote",
  "Manual writing option (free, no credits)",
  "Sends from your own email client — no spam risk",
  "Client management — extracted leads auto-saved",
];

export default function WhatIsProposalPilotPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <nav className="border-b border-surface-200 bg-white">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
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

      <main className="flex-1 max-w-4xl mx-auto px-6 py-12 w-full space-y-10">
        <header className="space-y-4">
          <h1 className="text-display font-black text-ink-900">What is ProposalPilot?</h1>
          <p className="text-lg text-ink-600 leading-relaxed">
            ProposalPilot turns any website into an outreach opportunity — extract the contact
            email and generate a personalized pitch in under 60 seconds.
          </p>
        </header>

        <section className="card p-7">
          <h2 className="text-heading font-bold text-ink-900 mb-4">How it works</h2>
          <ol className="space-y-3 text-sm text-ink-600 leading-relaxed list-decimal list-inside">
            <li>Paste any website URL.</li>
            <li>ProposalPilot extracts contact emails automatically.</li>
            <li>
              Choose your outreach type, AI writes a personalized email, and your email client
              opens ready to send.
            </li>
          </ol>
        </section>

        <section className="card p-7">
          <h2 className="text-heading font-bold text-ink-900 mb-4">Key features</h2>
          <ul className="space-y-3">
            {keyFeatures.map((feature) => (
              <li key={feature} className="flex items-start gap-2 text-sm text-ink-600">
                <Check className="w-4 h-4 text-brand-500 flex-shrink-0 mt-0.5" />
                {feature}
              </li>
            ))}
          </ul>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <div className="card p-7">
            <h2 className="text-heading font-bold text-ink-900 mb-3">Who it&apos;s for</h2>
            <ul className="space-y-2 text-sm text-ink-600 leading-relaxed list-disc list-inside">
              <li>SEO outreach specialists building backlinks</li>
              <li>Freelancers pitching potential clients they found online</li>
              <li>Solo founders doing cold outreach to partners or investors</li>
              <li>Small agencies prospecting new clients</li>
            </ul>
          </div>
          <div className="card p-7">
            <h2 className="text-heading font-bold text-ink-900 mb-3">Pricing summary</h2>
            <ul className="space-y-2 text-sm text-ink-600">
              <li>Free: 5 credits</li>
              <li>Pro: $19/mo (50 credits)</li>
              <li>Agency: $49/mo (200 credits)</li>
            </ul>
          </div>
        </section>

        <section className="card p-8 text-center">
          <h2 className="text-heading font-bold text-ink-900 mb-3">Start outreach in minutes</h2>
          <p className="text-ink-500 mb-6">
            Find contact emails and send tailored outreach from one simple workflow.
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
