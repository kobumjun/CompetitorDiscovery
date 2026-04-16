"use client";

import Link from "next/link";
import {
  Crosshair,
  ArrowRight,
  Link2,
  Cpu,
  BarChart3,
  FileText,
  Target,
  Search,
  Layers,
  Lightbulb,
  Check,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { PLANS } from "@/types";
import { PlanCheckoutButton } from "@/components/plan-checkout-button";
import type { PaidPlan } from "@/lib/lemonsqueezy";
import { SiteFooter } from "@/components/site-footer";

const EXAMPLE_COMPETITORS = [
  { name: "Mina Park", category: "Web Development", stage: "High intent" },
  { name: "Joon Kim", category: "Design", stage: "High intent" },
  { name: "Alex Lee", category: "Automation", stage: "Medium intent" },
  { name: "Dana Choi", category: "Marketing", stage: "Medium intent" },
  { name: "Chris Shin", category: "AI Tooling", stage: "Low intent" },
  { name: "Nate Jung", category: "Operations", stage: "Medium intent" },
  { name: "Ella Han", category: "Lead Gen", stage: "High intent" },
  { name: "Tom Song", category: "Web Development", stage: "Low intent" },
];

const EXAMPLE_CATEGORIES = [
  { name: "Web Development", pct: 31, color: "bg-brand-500" },
  { name: "Automation", pct: 24, color: "bg-blue-500" },
  { name: "Design", pct: 18, color: "bg-emerald-500" },
  { name: "Marketing", pct: 16, color: "bg-violet-500" },
  { name: "Operations", pct: 11, color: "bg-amber-500" },
];

const EXAMPLE_PATTERNS = [
  "Asking for trusted freelancer",
  "Need help this week",
  "Seeking recommendation",
  "Comparing vendor options",
  "Pain point escalation",
  "Budget-ready project",
  "Looking for specialist",
  "Open to DM follow-up",
];

const EXAMPLE_IDEAS = [
  {
    name: "Quick homepage audit",
    desc: "Offer a fast conversion + UX review to high-intent leads",
    audience: "Founders asking for web help",
  },
  {
    name: "Automation teardown",
    desc: "Show one workflow you can automate in 48 hours",
    audience: "Ops-heavy solo teams",
  },
  {
    name: "Design refresh proposal",
    desc: "Send before/after direction for pages they complained about",
    audience: "Startup teams with design pain",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-surface-200">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Crosshair className="w-6 h-6 text-brand-500" strokeWidth={2.5} />
            <span className="text-lg font-bold text-ink-900">ThreadScope</span>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium text-ink-500 hover:text-ink-900 transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="text-sm font-medium text-ink-500 hover:text-ink-900 transition-colors">
              How It Works
            </a>
            <a href="#pricing" className="text-sm font-medium text-ink-500 hover:text-ink-900 transition-colors">
              Pricing
            </a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="btn-ghost text-sm">
              Log in
            </Link>
            <Link href="/signup" className="btn-primary text-sm">
              Get Started
            </Link>
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
            Buyer-intent extraction from public conversations
          </div>
          <h1 className="text-display-xl font-black text-ink-900 mb-6 leading-tight">
            Turn any X thread into{" "}
            <span className="gradient-text">qualified leads</span>
          </h1>
          <p className="text-lg md:text-xl text-ink-500 max-w-2xl mx-auto mb-10 leading-relaxed">
            Paste an X thread URL. Get outreach-ready prospects with intent score,
            pain category, and messaging angle in seconds.
          </p>
          <div className="max-w-xl mx-auto mb-4">
            <div className="flex gap-2 p-2 bg-white border border-surface-200 rounded-xl shadow-elevated">
              <div className="flex-1 flex items-center gap-3 px-4">
                <Link2 className="w-5 h-5 text-ink-400 flex-shrink-0" />
                <span className="text-sm text-ink-400 truncate">
                  https://x.com/naval/status/1832456...
                </span>
              </div>
              <Link href="/signup" className="btn-primary whitespace-nowrap">
                Extract Leads
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
          <p className="text-sm text-ink-400">
            3 free analyses on signup. No credit card required.
          </p>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="py-10 border-y border-surface-200 bg-surface-50">
        <div className="max-w-4xl mx-auto px-6">
          <div className="grid grid-cols-3 gap-8">
            {[
              { icon: Target, value: "200+", label: "Threads analyzed" },
              { icon: Users, value: "4,800+", label: "Leads extracted" },
              { icon: BarChart3, value: "1,600+", label: "High-intent leads flagged" },
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
              From thread to outreach-ready list in 3 steps
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                icon: Link2,
                title: "Paste a Thread URL",
                desc: "Drop any public X thread where people discuss problems, ask for recommendations, or seek help.",
              },
              {
                step: "02",
                icon: Cpu,
                title: "AI Analyzes the Conversation",
                desc: "Our engine reads each reply and flags purchase intent, pain signals, and service-seeking behavior.",
              },
              {
                step: "03",
                icon: BarChart3,
                title: "Get Structured Leads",
                desc: "Receive ranked leads with intent type, problem category, outreach angles, and draft DM messages.",
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
              Here&apos;s what you get from a single thread
            </h2>
            <p className="text-ink-400 max-w-xl mx-auto">
              Real structured leads from a public thread
              with 150+ replies.
            </p>
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { value: "42", label: "Qualified Leads", color: "text-brand-400" },
              { value: "16", label: "High-Intent Leads", color: "text-blue-400" },
              { value: "6", label: "Intent Types", color: "text-emerald-400" },
              { value: "8", label: "Outreach Angles", color: "text-violet-400" },
            ].map((s) => (
              <div key={s.label} className="bg-white/5 border border-white/10 rounded-xl p-5">
                <div className={`text-3xl font-bold ${s.color} mb-1`}>{s.value}</div>
                <div className="text-sm text-white/60">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Leads Preview */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-white/80 mb-4 flex items-center gap-2">
                <Target className="w-4 h-4 text-brand-400" />
                Lead List
              </h3>
              <div className="space-y-3">
                {EXAMPLE_COMPETITORS.slice(0, 5).map((c) => (
                  <div key={c.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-xs font-bold text-white/60">
                        {c.name[0]}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-white">{c.name}</div>
                        <div className="text-xs text-white/40">{c.category}</div>
                      </div>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/60">
                      {c.stage}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Problem Categories Preview */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-white/80 mb-4 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-400" />
                Problem Categories
              </h3>
              <div className="space-y-4">
                {EXAMPLE_CATEGORIES.map((cat) => (
                  <div key={cat.name}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm text-white/80">{cat.name}</span>
                      <span className="text-xs text-white/40">{cat.pct}%</span>
                    </div>
                    <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${cat.color}`}
                        style={{ width: `${cat.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Intent Patterns */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-white/80 mb-4 flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                Intent Signals
              </h3>
              <div className="flex flex-wrap gap-2">
                {EXAMPLE_PATTERNS.map((p) => (
                  <span key={p} className="text-xs px-3 py-1.5 rounded-full bg-white/10 text-white/70 border border-white/5">
                    {p}
                  </span>
                ))}
              </div>
            </div>

            {/* Outreach Ideas */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-white/80 mb-4 flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-violet-400" />
                Outreach Angles
              </h3>
              <div className="space-y-4">
                {EXAMPLE_IDEAS.map((idea) => (
                  <div key={idea.name} className="border-l-2 border-violet-500/40 pl-3">
                    <div className="text-sm font-medium text-white">{idea.name}</div>
                    <div className="text-xs text-white/50 mt-0.5">{idea.desc}</div>
                    <div className="text-xs text-violet-400/70 mt-1">→ {idea.audience}</div>
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
            <p className="section-title mb-3">Capabilities</p>
            <h2 className="text-display font-bold text-ink-900">
              Everything you need to find likely buyers
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: FileText,
                title: "Lead Summary",
                desc: "Instant summary of total leads and intent distribution from one public thread.",
              },
              {
                icon: Target,
                title: "Qualified Lead List",
                desc: "Extract people with strong service-seeking signals and rank them for fast outreach.",
              },
              {
                icon: BarChart3,
                title: "Intent Classification",
                desc: "Classify each lead by intent type: recommendation ask, active evaluation, pain point, and more.",
              },
              {
                icon: Search,
                title: "Problem Detection",
                desc: "Understand what each lead is struggling with so your message is directly relevant.",
              },
              {
                icon: Layers,
                title: "Outreach Angle Suggestions",
                desc: "Get concise outreach directions for each lead based on context and intent strength.",
              },
              {
                icon: Lightbulb,
                title: "Draft DM Messages",
                desc: "Generate short, usable DM-style drafts so you can move from signal to action quickly.",
              },
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
              Start with 3 free analyses. Upgrade when you need more.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {PLANS.map((plan) => (
              <div
                key={plan.type}
                className={`card p-6 flex flex-col relative ${
                  plan.popular ? "border-brand-500 border-2 shadow-elevated" : ""
                }`}
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
                    {plan.credits} analyses · {plan.pricePerCredit}/each
                  </div>
                </div>
                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-sm text-ink-700">
                      <Check className="w-4 h-4 text-brand-500 flex-shrink-0 mt-0.5" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <PlanCheckoutButton
                  plan={plan.type as PaidPlan}
                  popular={plan.popular}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 md:py-28">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-brand-50 flex items-center justify-center mx-auto mb-6">
            <Crosshair className="w-8 h-8 text-brand-500" />
          </div>
          <h2 className="text-display font-bold text-ink-900 mb-4">
            Ready to decode your market?
          </h2>
          <p className="text-lg text-ink-500 mb-8 max-w-lg mx-auto">
            Stop reading 100+ comments manually. Start extracting the people most
            likely to buy your service.
          </p>
          <Link href="/signup" className="btn-primary text-base px-8 py-3">
            Start Free — 3 Analyses Included
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
              <Crosshair className="w-5 h-5 text-brand-500" />
              <span className="font-bold text-ink-900">ThreadScope</span>
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
