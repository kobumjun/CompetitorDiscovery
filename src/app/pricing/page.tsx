"use client";

import Link from "next/link";
import {
  Crosshair,
  Check,
  Zap,
  Shield,
  RefreshCcw,
  HelpCircle,
} from "lucide-react";
import { PLANS } from "@/types";
import { cn } from "@/lib/utils";
import { PlanCheckoutButton } from "@/components/plan-checkout-button";
import type { PaidPlan } from "@/lib/lemonsqueezy";
import { SiteFooter } from "@/components/site-footer";

const FAQS = [
  {
    q: "What counts as one analysis?",
    a: "One analysis = one X/Twitter thread URL processed. We scrape the original post and all replies, then run our AI analysis to generate the full market intelligence report.",
  },
  {
    q: "Do unused credits roll over?",
    a: "No, credits reset each billing cycle. This keeps pricing simple and predictable. If you consistently need more, consider upgrading to a higher plan for better per-credit pricing.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel anytime from your account settings. You'll retain access until the end of your billing period. No questions asked.",
  },
  {
    q: "What happens if an analysis fails?",
    a: "If an analysis fails (e.g., the thread is private or deleted), your credit is automatically refunded. You only pay for successful analyses.",
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-surface-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Crosshair className="w-6 h-6 text-brand-500" strokeWidth={2.5} />
            <span className="text-lg font-bold text-ink-900">ThreadScope</span>
          </Link>
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
      <section className="py-16 md:py-20 text-center">
        <div className="max-w-3xl mx-auto px-6">
          <h1 className="text-display-lg font-black text-ink-900 mb-4">
            Simple, transparent pricing
          </h1>
          <p className="text-lg text-ink-500">
            Start with 3 free analyses. Upgrade when you need more power.
          </p>
        </div>
      </section>

      {/* Plans */}
      <section className="pb-20">
        <div className="max-w-4xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-6">
            {PLANS.map((plan) => (
              <div
                key={plan.type}
                className={cn(
                  "card p-6 flex flex-col relative",
                  plan.popular
                    ? "border-brand-500 border-2 shadow-elevated"
                    : ""
                )}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-brand-500 text-white text-xs font-bold rounded-full whitespace-nowrap">
                    Most Popular
                  </div>
                )}
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-ink-900">{plan.name}</h3>
                  <div className="mt-3">
                    <span className="text-4xl font-black text-ink-900">
                      ${plan.price}
                    </span>
                    <span className="text-sm text-ink-400">/mo</span>
                  </div>
                  <div className="mt-1 text-sm text-ink-500">
                    {plan.credits} analyses · {plan.pricePerCredit}/each
                  </div>
                </div>
                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2.5 text-sm text-ink-700"
                    >
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

      {/* Included in all */}
      <section className="py-16 bg-surface-50 border-y border-surface-200">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-heading font-bold text-ink-900 mb-8">
            Included in every plan
          </h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              {
                icon: Zap,
                title: "Instant Analysis",
                desc: "Results in under 30 seconds",
              },
              {
                icon: Shield,
                title: "Failed Credit Refund",
                desc: "Auto-refund if analysis fails",
              },
              {
                icon: RefreshCcw,
                title: "Monthly Refresh",
                desc: "Credits reset each billing cycle",
              },
            ].map((item) => (
              <div key={item.title} className="text-center">
                <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center mx-auto mb-3">
                  <item.icon className="w-5 h-5 text-brand-600" />
                </div>
                <h3 className="text-sm font-bold text-ink-900 mb-1">
                  {item.title}
                </h3>
                <p className="text-xs text-ink-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16">
        <div className="max-w-2xl mx-auto px-6">
          <h2 className="text-heading font-bold text-ink-900 mb-8 text-center">
            Frequently asked questions
          </h2>
          <div className="space-y-6">
            {FAQS.map((faq) => (
              <div key={faq.q}>
                <h3 className="text-sm font-bold text-ink-900 mb-1.5 flex items-start gap-2">
                  <HelpCircle className="w-4 h-4 text-brand-500 flex-shrink-0 mt-0.5" />
                  {faq.q}
                </h3>
                <p className="text-sm text-ink-500 leading-relaxed pl-6">
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-surface-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crosshair className="w-5 h-5 text-brand-500" />
            <span className="font-bold text-ink-900">ThreadScope</span>
          </div>
        </div>
        <SiteFooter />
      </footer>
    </div>
  );
}
