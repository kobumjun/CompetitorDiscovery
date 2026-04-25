import Link from "next/link";
import type { Metadata } from "next";
import { Rocket, Check, Zap, Shield, RefreshCcw, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { PLANS } from "@/types";
import { PlanCheckoutButton } from "@/components/plan-checkout-button";
import type { PaidPlan } from "@/lib/lemonsqueezy";
import { SiteFooter } from "@/components/site-footer";
import { GoogleAuthTrigger } from "@/components/google-auth-trigger";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "ProposalPilot pricing plans. Start free with 10 credits. Pro plan $19/month, Agency plan $49/month.",
};

const FAQS = [
  {
    q: "What counts as one credit?",
    a: "One credit is used when you generate an AI pitch email or extract one contact email from a found prospect.",
  },
  {
    q: "Can I edit emails after generation?",
    a: "Yes. AI-generated subject and body are fully editable before you open them in your email client.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel anytime from your account settings. You'll retain access until the end of your billing period.",
  },
  {
    q: "Do unused credits roll over?",
    a: "No, credits reset each billing cycle. This keeps pricing simple and predictable.",
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b border-surface-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Rocket className="w-6 h-6 text-brand-500" strokeWidth={2.5} />
            <span className="text-lg font-bold text-ink-900">ProposalPilot</span>
          </Link>
          <div className="flex items-center gap-3">
            <GoogleAuthTrigger className="btn-ghost text-sm">Log in</GoogleAuthTrigger>
            <GoogleAuthTrigger className="btn-primary text-sm">Start Free</GoogleAuthTrigger>
          </div>
        </div>
      </nav>

      <section className="py-16 md:py-20 text-center">
        <div className="max-w-3xl mx-auto px-6">
          <h1 className="text-display-lg font-black text-ink-900 mb-4">
            Simple, transparent pricing
          </h1>
          <p className="text-lg text-ink-500">
            Start with 10 free credits. Upgrade when you need more.
          </p>
        </div>
      </section>

      <section className="pb-20">
        <div className="max-w-4xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-6">
            {/* Free */}
            <div className="card p-6 flex flex-col">
              <div className="mb-6">
                <h3 className="text-lg font-bold text-ink-900">Free</h3>
                <div className="mt-3">
                  <span className="text-4xl font-black text-ink-900">$0</span>
                  <span className="text-sm text-ink-400">/mo</span>
                </div>
                <div className="mt-1 text-sm text-ink-500">10 credits</div>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {[
                  "10 AI-powered emails",
                  "Keyword search to find prospects",
                  "Email extraction",
                  "View tracking",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-ink-700">
                    <Check className="w-4 h-4 text-brand-500 flex-shrink-0 mt-0.5" />{f}
                  </li>
                ))}
              </ul>
              <GoogleAuthTrigger className="btn-secondary w-full text-center">Get Started Free</GoogleAuthTrigger>
            </div>

            {PLANS.map((plan) => (
              <div
                key={plan.type}
                className={cn("card p-6 flex flex-col relative", plan.popular ? "border-brand-500 border-2 shadow-elevated" : "")}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-brand-500 text-white text-xs font-bold rounded-full whitespace-nowrap">
                    Most Popular
                  </div>
                )}
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-ink-900">{plan.name}</h3>
                  <div className="mt-3">
                    <span className="text-4xl font-black text-ink-900">${plan.price}</span>
                    <span className="text-sm text-ink-400">/mo</span>
                  </div>
                  <div className="mt-1 text-sm text-ink-500">{plan.credits} credits · {plan.pricePerCredit}/each</div>
                </div>
                <ul className="space-y-3 mb-8 flex-1">
                  {(plan.type === "pro"
                    ? [
                        "150 credits / month",
                        "Keyword prospect search",
                        "Bulk URL extraction (up to 20)",
                        "AI pitch generation (GPT-4o)",
                        "Unlimited clients",
                        "Shareable proposal links",
                        "View & engagement tracking",
                        "PDF export",
                        "Custom branding",
                      ]
                    : [
                        "500 credits / month",
                        "Everything in Pro",
                        "Priority AI generation",
                        "Custom templates library",
                        "Bulk prospect management",
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

      <section className="py-16 bg-surface-50 border-y border-surface-200">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-heading font-bold text-ink-900 mb-8">Included in every plan</h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { icon: Zap, title: "AI Generation (GPT-4o)", desc: "Personalized outreach emails in seconds" },
              { icon: Shield, title: "Electronic Signatures", desc: "Clients sign directly online" },
              { icon: RefreshCcw, title: "Full Edit Control", desc: "Edit every email before sending" },
            ].map((item) => (
              <div key={item.title} className="text-center">
                <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center mx-auto mb-3">
                  <item.icon className="w-5 h-5 text-brand-600" />
                </div>
                <h3 className="text-sm font-bold text-ink-900 mb-1">{item.title}</h3>
                <p className="text-xs text-ink-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-2xl mx-auto px-6">
          <h2 className="text-heading font-bold text-ink-900 mb-8 text-center">Frequently asked questions</h2>
          <div className="space-y-6">
            {FAQS.map((faq) => (
              <div key={faq.q}>
                <h3 className="text-sm font-bold text-ink-900 mb-1.5 flex items-start gap-2">
                  <HelpCircle className="w-4 h-4 text-brand-500 flex-shrink-0 mt-0.5" />{faq.q}
                </h3>
                <p className="text-sm text-ink-500 leading-relaxed pl-6">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-surface-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Rocket className="w-5 h-5 text-brand-500" />
            <span className="font-bold text-ink-900">ProposalPilot</span>
          </div>
        </div>
        <SiteFooter />
      </footer>
    </div>
  );
}
