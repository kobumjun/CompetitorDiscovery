"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Rocket,
  ArrowRight,
  Sparkles,
  Send,
  Check,
  Zap,
} from "lucide-react";
import { PLANS } from "@/types";
import { PlanCheckoutButton } from "@/components/plan-checkout-button";
import type { PaidPlan } from "@/lib/lemonsqueezy";
import { SiteFooter } from "@/components/site-footer";
import { createClient } from "@/lib/supabase/client";

export default function LandingPage() {
  const router = useRouter();

  async function startGoogleAuth() {
    const supabase = createClient();
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session) {
      router.push("/dashboard");
      router.refresh();
      return;
    }

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?redirect=/dashboard`,
      },
    });
  }

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
            <button type="button" onClick={startGoogleAuth} className="btn-ghost text-sm">Log in</button>
            <button type="button" onClick={startGoogleAuth} className="btn-primary text-sm">Start Free</button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 md:pt-40 md:pb-28 relative overflow-hidden overflow-x-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-brand-50/50 via-white to-white" />
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-brand-100/30 rounded-full blur-3xl" />
        <div className="relative max-w-4xl mx-auto px-5 sm:px-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-brand-50 border border-brand-200 rounded-full text-xs font-semibold text-brand-700 mb-6">
            <Zap className="w-3.5 h-3.5" />
            Outreach on autopilot
          </div>
          <h1 className="mb-6 font-black text-ink-900 [font-size:clamp(2.5rem,9vw,3.25rem)] leading-[1.13] tracking-[-0.025em] [word-break:keep-all] [overflow-wrap:break-word] [hyphens:none] px-4 sm:px-0 max-[480px]:[font-size:clamp(2.25rem,8.5vw,2.75rem)] max-[480px]:leading-[1.1] md:text-display-xl md:leading-tight">
            Find your first leads and send emails in 10 seconds
          </h1>
          <p className="text-lg md:text-xl text-ink-500 max-w-2xl mx-auto mb-10 leading-relaxed">
            Describe what you sell — we&apos;ll find real customer emails and help you send personalized pitches, all in one page.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
            <button type="button" onClick={startGoogleAuth} className="btn-primary text-base px-8 py-3">
              Try it free
              <ArrowRight className="w-5 h-5" />
            </button>
            <a href="#how-it-works" className="btn-secondary text-base px-6 py-3">
              See How It Works
            </a>
          </div>
          <p className="text-sm text-ink-400">No credit card required</p>
        </div>
      </section>

      {/* Bulk Discovery */}
      <section className="py-10 border-y border-surface-200 bg-surface-50">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-8">
            <h2 className="text-heading font-bold text-ink-900 mb-2">
              Already have a list of prospects?
            </h2>
            <p className="text-sm text-ink-500 max-w-2xl mx-auto">
              Paste up to 20 URLs and extract all their contact emails at once.
              Write and send personalized pitches — all from one page.
            </p>
          </div>
          <div className="grid grid-cols-2 max-[480px]:grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            {[
              { icon: Sparkles, value: "20", label: "URLs per bulk run" },
              { icon: Zap, value: "1 credit", label: "Per email found" },
              { icon: Send, value: "1 page", label: "Manage all outreach in one place" },
            ].map((stat) => (
              <div key={stat.label} className="flex flex-col items-center text-center gap-2">
                <stat.icon className="w-4 h-4 text-brand-500" />
                <span className="[font-size:clamp(2rem,8vw,3rem)] leading-none font-bold text-ink-900 md:text-2xl">
                  {stat.value}
                </span>
                <span className="text-sm text-ink-500 leading-snug max-w-[16ch]">{stat.label}</span>
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
              Go from website to outreach in 3 steps
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                icon: Sparkles,
                title: "Describe what you sell",
                desc: "Just type your product or service — like 'coffee machines' or 'web design'.",
              },
              {
                step: "02",
                icon: Zap,
                title: "We find your ideal customers",
                desc: "AI identifies businesses that would buy from you and extracts their contact emails.",
              },
              {
                step: "03",
                icon: Send,
                title: "Send personalized emails",
                desc: "Write and send outreach emails directly — AI helps you draft them.",
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

      {/* Features */}
      <section id="features" className="py-20 md:py-28">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="section-title mb-3">Features</p>
            <h2 className="text-display font-bold text-ink-900">
              Built for people who do their own outreach
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: Sparkles, title: "AI customer discovery", desc: "Find businesses likely to buy your service and extract contact emails automatically." },
              { icon: Zap, title: "AI email writing", desc: "Generate personalized subject lines and email copy based on each company." },
              { icon: Send, title: "One-click sending", desc: "Open your mail client with a ready-to-send outreach message instantly." },
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
              Start with 5 free credits. Upgrade when you need more.
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
                <div className="mt-1 text-sm text-ink-500">5 credits included</div>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {[
                  "5 credits",
                  "AI-powered customer discovery",
                  "AI email writing",
                  "Email sending via mailto",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-ink-700">
                    <Check className="w-4 h-4 text-brand-500 flex-shrink-0 mt-0.5" />{f}
                  </li>
                ))}
              </ul>
              <button type="button" onClick={startGoogleAuth} className="btn-secondary w-full text-center">
                Get Started Free
              </button>
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
                    {plan.credits} credits · {plan.pricePerCredit}/each
                  </div>
                </div>
                <ul className="space-y-3 mb-8 flex-1">
                  {(plan.type === "pro"
                    ? [
                        "200 credits per month",
                        "AI-powered customer discovery",
                        "AI email writing",
                        "Email sending via mailto",
                        "Bulk URL extraction",
                        "Priority support",
                      ]
                    : [
                        "700 credits per month",
                        "Everything in Pro",
                        "Higher volume searches",
                        "Priority support",
                      ]).map((f) => (
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
            Stop spending hours on outreach. Let AI do the heavy lifting so you
            can focus on what you do best.
          </p>
          <button type="button" onClick={startGoogleAuth} className="btn-primary text-base px-8 py-3">
            Start Free — 5 Credits Included
            <ArrowRight className="w-5 h-5" />
          </button>
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
              <Link href="/privacy" className="hover:text-ink-700 transition-colors">Privacy</Link>
              <button type="button" onClick={startGoogleAuth} className="hover:text-ink-700 transition-colors">Login</button>
            </div>
          </div>
        </div>
        <SiteFooter />
      </footer>
    </div>
  );
}
