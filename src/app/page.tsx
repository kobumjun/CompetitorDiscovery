"use client";

import Link from "next/link";
import {
  Rocket,
  ArrowRight,
  Sparkles,
  Clock,
  FileText,
  PenTool,
  Eye,
  Send,
  Check,
  Users,
  Zap,
  BarChart3,
  Shield,
  RefreshCcw,
} from "lucide-react";
import { PLANS } from "@/types";
import { PlanCheckoutButton } from "@/components/plan-checkout-button";
import type { PaidPlan } from "@/lib/lemonsqueezy";
import { SiteFooter } from "@/components/site-footer";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-surface-200">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Rocket className="w-6 h-6 text-brand-500" strokeWidth={2.5} />
            <span className="text-lg font-bold text-ink-900">ProposalPilot</span>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium text-ink-500 hover:text-ink-900 transition-colors">Features</a>
            <a href="#how-it-works" className="text-sm font-medium text-ink-500 hover:text-ink-900 transition-colors">How It Works</a>
            <a href="#pricing" className="text-sm font-medium text-ink-500 hover:text-ink-900 transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="btn-ghost text-sm">Log in</Link>
            <Link href="/signup" className="btn-primary text-sm">Start Free</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 md:pt-40 md:pb-28 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-brand-50/50 via-white to-white" />
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-brand-100/30 rounded-full blur-3xl" />
        <div className="relative max-w-4xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-brand-50 border border-brand-200 rounded-full text-xs font-semibold text-brand-700 mb-6">
            <Zap className="w-3.5 h-3.5" />
            Website to outreach automation
          </div>
          <h1 className="text-display-xl font-black text-ink-900 mb-6 leading-tight">
            From Website to{" "}
            <span className="gradient-text">Closed Deal</span> in Minutes
          </h1>
          <p className="text-lg md:text-xl text-ink-500 max-w-2xl mx-auto mb-10 leading-relaxed">
            Extract contacts from any website. Generate personalized proposals, pitches,
            and outreach emails. All in one tool.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
            <Link href="/signup" className="btn-primary text-base px-8 py-3">
              Start Free - Try It Now
              <ArrowRight className="w-5 h-5" />
            </Link>
            <a href="#how-it-works" className="btn-secondary text-base px-6 py-3">
              See How It Works
            </a>
          </div>
          <p className="text-sm text-ink-400">No credit card required</p>
        </div>
      </section>

      {/* Stats */}
      <section className="py-10 border-y border-surface-200 bg-surface-50">
        <div className="max-w-4xl mx-auto px-6">
          <div className="grid grid-cols-3 gap-8">
            {[
              { icon: FileText, value: "30s", label: "Average generation time" },
              { icon: Users, value: "5 free", label: "Proposals to start" },
              { icon: BarChart3, value: "100%", label: "Customizable output" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <stat.icon className="w-4 h-4 text-brand-500" />
                  <span className="text-2xl font-bold text-ink-900">{stat.value}</span>
                </div>
                <span className="text-sm text-ink-500">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 md:py-28">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="section-title mb-3">How It Works</p>
            <h2 className="text-display font-bold text-ink-900">
              From project brief to proposal in 3 steps
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                icon: PenTool,
                title: "Describe Your Project",
                desc: "Enter the client name, project description, budget, and timeline. Add as much or as little detail as you want.",
              },
              {
                step: "02",
                icon: Sparkles,
                title: "AI Generates Your Proposal",
                desc: "GPT-4o crafts a professional proposal with cover letter, scope, deliverables, pricing table, terms, and next steps.",
              },
              {
                step: "03",
                icon: Send,
                title: "Send & Track",
                desc: "Share via link, track when clients view it, and collect electronic signatures — all in one place.",
              },
            ].map((item) => (
              <div key={item.step} className="relative">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-xs font-bold text-brand-500 bg-brand-50 w-8 h-8 rounded-lg flex items-center justify-center">
                    {item.step}
                  </span>
                  <item.icon className="w-5 h-5 text-ink-700" />
                </div>
                <h3 className="text-lg font-bold text-ink-900 mb-2">{item.title}</h3>
                <p className="text-sm text-ink-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Example Output Preview */}
      <section className="py-20 md:py-28 bg-ink-900 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-ink-900 via-ink-800 to-ink-900" />
        <div className="relative max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-400 mb-3">
              Example Output
            </p>
            <h2 className="text-display font-bold text-white mb-3">
              What AI generates for you
            </h2>
            <p className="text-ink-400 max-w-xl mx-auto">
              A real proposal structure generated from a simple project description
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-white/80 mb-4">📝 Cover Letter</h3>
              <p className="text-sm text-white/60 leading-relaxed">
                &ldquo;Dear Sarah, thank you for considering us for the Acme Corp website redesign.
                With 8 years of experience in modern web design, we are excited to transform
                your digital presence into a conversion-focused experience...&rdquo;
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-white/80 mb-4">📋 Scope & Deliverables</h3>
              <div className="space-y-2">
                {["Discovery & Research", "UI/UX Design", "Development & QA", "Launch & Handoff"].map((s) => (
                  <div key={s} className="flex items-center gap-2 text-sm text-white/60">
                    <Check className="w-4 h-4 text-brand-400" /> {s}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-white/80 mb-4">💰 Pricing Table</h3>
              <div className="space-y-2">
                {[
                  { item: "Discovery & Research", amount: "$1,200" },
                  { item: "UI/UX Design", amount: "$2,800" },
                  { item: "Development", amount: "$3,500" },
                  { item: "QA & Launch", amount: "$1,500" },
                ].map((p) => (
                  <div key={p.item} className="flex justify-between text-sm">
                    <span className="text-white/60">{p.item}</span>
                    <span className="text-white/80 font-medium">{p.amount}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm pt-2 border-t border-white/10">
                  <span className="text-white font-bold">Total</span>
                  <span className="text-brand-400 font-bold">$9,000</span>
                </div>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-white/80 mb-4">📅 Timeline & Terms</h3>
              <div className="space-y-3">
                {[
                  { phase: "Week 1-2", desc: "Discovery & Wireframes" },
                  { phase: "Week 3-4", desc: "Visual Design" },
                  { phase: "Week 5-7", desc: "Development" },
                  { phase: "Week 8", desc: "QA & Launch" },
                ].map((t) => (
                  <div key={t.phase} className="flex gap-3 text-sm">
                    <span className="text-brand-400 font-bold min-w-[70px]">{t.phase}</span>
                    <span className="text-white/60">{t.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 md:py-28">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="section-title mb-3">Features</p>
            <h2 className="text-display font-bold text-ink-900">
              Everything you need to win more clients
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: Eye, title: "Auto Email Extraction", desc: "Scan website contact pages and extract usable business emails in one click." },
              { icon: Sparkles, title: "4 Outreach Types", desc: "Generate Proposals, Pitches, Investment outreach, and Quotes tailored to each lead." },
              { icon: Send, title: "Send or Copy Instantly", desc: "Open your own email client instantly or copy polished drafts to clipboard." },
              { icon: BarChart3, title: "Outreach Tracking", desc: "Track extracted leads and all outreach drafts/sent status in one place." },
              { icon: Users, title: "Client + Lead Workflow", desc: "Turn unknown websites into qualified contacts and active conversations quickly." },
              { icon: Shield, title: "Permission First", desc: "Built with a clear permission notice to avoid spam and keep outreach responsible." },
            ].map((feature) => (
              <div key={feature.title} className="card p-6 group hover:shadow-card-hover transition-all">
                <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center mb-4 group-hover:bg-brand-100 transition-colors">
                  <feature.icon className="w-5 h-5 text-brand-600" />
                </div>
                <h3 className="text-base font-bold text-ink-900 mb-2">{feature.title}</h3>
                <p className="text-sm text-ink-500 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 md:py-28 bg-surface-50 border-y border-surface-200">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="section-title mb-3">Pricing</p>
            <h2 className="text-display font-bold text-ink-900 mb-3">
              Simple, transparent pricing
            </h2>
            <p className="text-ink-500">
              Start with 5 free proposals. Upgrade when you need more.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {/* Free Plan */}
            <div className="card p-6 flex flex-col">
              <div className="mb-6">
                <h3 className="text-lg font-bold text-ink-900">Free</h3>
                <div className="mt-3">
                  <span className="text-3xl font-black text-ink-900">$0</span>
                  <span className="text-sm text-ink-400">/mo</span>
                </div>
                <div className="mt-1 text-sm text-ink-500">5 proposals included</div>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {[
                  "5 AI-generated proposals",
                  "All proposal sections",
                  "Shareable links",
                  "Basic view tracking",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-ink-700">
                    <Check className="w-4 h-4 text-brand-500 flex-shrink-0 mt-0.5" />{f}
                  </li>
                ))}
              </ul>
              <Link href="/signup" className="btn-secondary w-full text-center">
                Get Started Free
              </Link>
            </div>

            {/* Paid Plans */}
            {PLANS.map((plan) => (
              <div
                key={plan.type}
                className={`card p-6 flex flex-col relative ${plan.popular ? "border-brand-500 border-2 shadow-elevated" : ""}`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-brand-500 text-white text-xs font-bold rounded-full">
                    Most Popular
                  </div>
                )}
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-ink-900">{plan.name}</h3>
                  <div className="mt-3">
                    <span className="text-3xl font-black text-ink-900">${plan.price}</span>
                    <span className="text-sm text-ink-400">/mo</span>
                  </div>
                  <div className="mt-1 text-sm text-ink-500">
                    {plan.credits} proposals · {plan.pricePerCredit}/each
                  </div>
                </div>
                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-ink-700">
                      <Check className="w-4 h-4 text-brand-500 flex-shrink-0 mt-0.5" />{f}
                    </li>
                  ))}
                </ul>
                <PlanCheckoutButton plan={plan.type as PaidPlan} popular={plan.popular} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 md:py-28">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-brand-50 flex items-center justify-center mx-auto mb-6">
            <Rocket className="w-8 h-8 text-brand-500" />
          </div>
          <h2 className="text-display font-bold text-ink-900 mb-4">
            Win more clients with less effort
          </h2>
          <p className="text-lg text-ink-500 mb-8 max-w-lg mx-auto">
            Stop spending hours on proposals. Let AI do the heavy lifting so you
            can focus on what you do best.
          </p>
          <Link href="/signup" className="btn-primary text-base px-8 py-3">
            Start Free — 5 Proposals Included
            <ArrowRight className="w-5 h-5" />
          </Link>
          <p className="text-xs text-ink-400 mt-4">No credit card required</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-surface-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Rocket className="w-5 h-5 text-brand-500" />
              <span className="font-bold text-ink-900">ProposalPilot</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-ink-400">
              <a href="#features" className="hover:text-ink-700 transition-colors">Features</a>
              <a href="#pricing" className="hover:text-ink-700 transition-colors">Pricing</a>
              <Link href="/login" className="hover:text-ink-700 transition-colors">Login</Link>
            </div>
          </div>
        </div>
        <SiteFooter />
      </footer>
    </div>
  );
}
