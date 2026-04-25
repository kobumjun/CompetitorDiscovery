import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown, Rocket, ArrowRight } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { GoogleAuthTrigger } from "@/components/google-auth-trigger";

export const metadata: Metadata = {
  title: "ProposalPilot FAQ — How Email Extraction & AI Outreach Works",
};

const faqItems = [
  {
    question: "What is ProposalPilot?",
    answer:
      "ProposalPilot is a web tool that extracts contact emails from any website URL and generates personalized outreach emails using AI. You paste a URL, it finds the contact emails, and GPT-4o writes a tailored proposal, sales pitch, investment ask, or quote. Your email client opens ready to send — the whole process takes under 60 seconds.",
  },
  {
    question: "How does email extraction work?",
    answer:
      "When you paste a website URL, ProposalPilot crawls the page and linked pages (like /contact, /about, /team) to find publicly listed email addresses. No scraping of private data — only emails that are already visible on the site.",
  },
  {
    question: "What is Bulk Discovery?",
    answer:
      "Bulk Discovery lets you paste up to 20 website URLs at once. ProposalPilot crawls all of them in parallel, extracts every contact email it finds, deduplicates them, and saves them to your client list. You can then generate a personalized proposal for each lead from one page. It costs 1 credit per email found.",
  },
  {
    question: "How much does ProposalPilot cost?",
    answer:
      "Free tier includes 10 credits. Pro plan is $19/month with 150 credits. Agency plan is $49/month with 500 credits. Each AI-generated proposal costs 1 credit. Manual writing is always free.",
  },
  {
    question: "Does ProposalPilot send emails for me?",
    answer:
      "No. ProposalPilot opens your default email client (Gmail, Outlook, Apple Mail, etc.) with the email pre-filled. You send it yourself from your own email address — no deliverability issues, no spam folder risk.",
  },
  {
    question: "How is ProposalPilot different from Apollo, Hunter, or Clay?",
    answer:
      "Those tools are built around pre-existing lead databases or enrichment workflows designed for sales teams. ProposalPilot is different — you start with a website you already found, extract the contact email from that site in real-time, and generate a personalized pitch in the same flow. It's built for people who do their own outreach manually and want to move faster, not for teams managing large sales pipelines.",
  },
  {
    question: "Is ProposalPilot safe to use? Is it legal?",
    answer:
      "ProposalPilot only extracts publicly visible email addresses from websites. It does not access private databases, bypass login walls, or scrape social media profiles. We recommend using it for businesses you have a genuine reason to contact.",
  },
  {
    question: "What outreach types can I generate?",
    answer:
      "Four types — Project Proposal, Sales Pitch, Investment Ask, and Quote Request. Each is personalized based on what the target company actually does, pulled from their website content.",
  },
];

export default function FAQPage() {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <nav className="border-b border-surface-200 bg-white">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Rocket className="w-6 h-6 text-brand-500" strokeWidth={2.5} />
            <span className="text-lg font-bold text-ink-900">ProposalPilot</span>
          </Link>
          <div className="flex items-center gap-3">
            <GoogleAuthTrigger className="btn-ghost text-sm">
              Log in
            </GoogleAuthTrigger>
            <GoogleAuthTrigger className="btn-primary text-sm">
              Start Free
            </GoogleAuthTrigger>
          </div>
        </div>
      </nav>

      <main className="flex-1 max-w-4xl mx-auto px-6 py-12 w-full">
        <h1 className="text-display font-black text-ink-900 mb-4">Frequently Asked Questions</h1>
        <p className="text-ink-500 mb-8 max-w-2xl">
          Everything you need to know about how ProposalPilot extracts emails and helps you send
          personalized outreach faster.
        </p>

        <section className="space-y-4">
          {faqItems.map((item) => (
            <details key={item.question} className="group card p-5">
              <summary className="list-none cursor-pointer flex items-start justify-between gap-3">
                <span className="font-semibold text-ink-900">{item.question}</span>
                <ChevronDown className="w-4 h-4 text-ink-500 mt-1 transition-transform group-open:rotate-180" />
              </summary>
              <p className="text-sm text-ink-600 leading-relaxed mt-3">{item.answer}</p>
            </details>
          ))}
        </section>

        <section className="mt-12 card p-8 text-center">
          <h2 className="text-heading font-bold text-ink-900 mb-3">Ready to try it?</h2>
          <p className="text-ink-500 mb-6">
            Start with 10 free credits and generate your first outreach email in under a minute.
          </p>
          <GoogleAuthTrigger className="btn-primary inline-flex">
            Try ProposalPilot free
            <ArrowRight className="w-4 h-4" />
          </GoogleAuthTrigger>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
