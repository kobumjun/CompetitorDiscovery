"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, CreditCard, ExternalLink, HelpCircle, Rocket, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { PLANS, planIncludedCredits, type User } from "@/types";
import type { PaidPlan } from "@/lib/lemonsqueezy";
import { PlanCheckoutButton } from "@/components/plan-checkout-button";
import { SiteFooter } from "@/components/site-footer";

const FREE_FEATURES = [
  "5 credits",
  "AI-powered customer discovery",
  "AI email writing",
  "Email sending via mailto",
];

const PRO_FEATURES = [
  "150 credits per month",
  "AI-powered customer discovery",
  "AI email writing",
  "Email sending via mailto",
  "Bulk URL extraction",
  "Priority support",
];

const AGENCY_FEATURES = [
  "500 credits per month",
  "Everything in Pro",
  "Higher volume searches",
  "Priority support",
];

const FAQS = [
  {
    q: "What counts as one credit?",
    a: "One credit is used when you extract one contact email or generate one AI outreach email.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. You can manage or cancel your subscription from Manage Subscription.",
  },
];

export default function PricingClientPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState("");

  useEffect(() => {
    async function bootstrap() {
      const supabase = createClient();
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      if (!authUser) {
        setLoading(false);
        return;
      }

      const { data } = await supabase.from("users").select("*").eq("id", authUser.id).single();
      if (data) setUser(data as User);
      setLoading(false);
    }
    void bootstrap();
  }, []);

  const maxCredits = useMemo(() => planIncludedCredits(user?.plan || "free"), [user?.plan]);
  const credits = user?.credits ?? 0;
  const usageRatio = maxCredits > 0 ? credits / maxCredits : 0;
  const barColor = usageRatio > 0.5 ? "bg-emerald-500" : usageRatio > 0.2 ? "bg-amber-500" : "bg-red-500";

  async function handleManageSubscription() {
    setPortalLoading(true);
    setPortalError("");
    try {
      const res = await fetch("/api/subscription/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setPortalError(data.error || "Failed to open subscription portal");
        return;
      }
      window.open(data.url, "_blank");
    } catch {
      setPortalError("Network error. Please try again.");
    } finally {
      setPortalLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b border-surface-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Rocket className="h-6 w-6 text-brand-500" strokeWidth={2.5} />
            <span className="text-lg font-bold text-ink-900">ProposalPilot</span>
          </Link>
          <Link href="/dashboard/settings" className="btn-ghost text-sm">
            Settings
          </Link>
        </div>
      </nav>

      <section className="py-14 text-center md:py-16">
        <div className="mx-auto max-w-3xl px-6">
          <h1 className="mb-3 text-display-lg font-black text-ink-900">Choose Your Plan</h1>
          <p className="text-lg text-ink-500">Get more credits to find leads and send emails</p>
        </div>
      </section>

      <section className="pb-16">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mb-8 rounded-2xl border border-surface-200 bg-surface-50 p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-500">Current Plan</span>
              <span className="badge bg-brand-50 text-brand-700 capitalize">{user?.plan || "free"}</span>
            </div>
            <p className="text-sm text-ink-700">
              {loading ? "Loading credits..." : `${credits} / ${maxCredits} credits remaining`}
            </p>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-200">
              <div className={cn("h-full rounded-full transition-all", barColor)} style={{ width: `${Math.min(usageRatio * 100, 100)}%` }} />
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <div className={cn("card flex flex-col p-6", user?.plan === "free" && "border-2 border-brand-500 shadow-elevated")}>
              {user?.plan === "free" && (
                <div className="mb-3 inline-flex w-fit rounded-full bg-brand-500 px-2.5 py-0.5 text-xs font-bold text-white">
                  Current Plan
                </div>
              )}
              <h3 className="text-lg font-bold text-ink-900">Free</h3>
              <div className="mt-2">
                <span className="text-4xl font-black text-ink-900">$0</span>
                <span className="text-sm text-ink-400">/mo</span>
              </div>
              <p className="mt-1 text-sm text-ink-500">5 credits</p>
              <ul className="mb-8 mt-6 flex-1 space-y-3">
                {FREE_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-ink-700">
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-500" />
                    {f}
                  </li>
                ))}
              </ul>
              <button className="btn-secondary w-full text-center" disabled>
                {user?.plan === "free" ? "Current Plan" : "Free Plan"}
              </button>
            </div>

            {PLANS.map((plan) => {
              const isCurrent = user?.plan === plan.type;
              const isPopular = plan.type === "pro";
              const featureList = plan.type === "pro" ? PRO_FEATURES : AGENCY_FEATURES;
              return (
                <div key={plan.type} className={cn("card relative flex flex-col p-6", isCurrent && "border-2 border-brand-500 shadow-elevated")}>
                  {isCurrent ? (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-500 px-3 py-0.5 text-xs font-bold text-white">
                      Current Plan
                    </div>
                  ) : isPopular ? (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-500 px-3 py-0.5 text-xs font-bold text-white">
                      Most Popular
                    </div>
                  ) : (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-amber-500 px-3 py-0.5 text-xs font-bold text-white">
                      Best Value
                    </div>
                  )}
                  <h3 className="text-lg font-bold text-ink-900">{plan.name}</h3>
                  <div className="mt-2">
                    <span className="text-4xl font-black text-ink-900">${plan.price}</span>
                    <span className="text-sm text-ink-400">/mo</span>
                  </div>
                  <p className="mt-1 text-sm text-ink-500">{plan.credits} credits</p>
                  <ul className="mb-8 mt-6 flex-1 space-y-3">
                    {featureList.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm text-ink-700">
                        <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-500" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  {isCurrent ? (
                    <button className="btn-secondary w-full text-center" disabled>
                      Current Plan
                    </button>
                  ) : (
                    <PlanCheckoutButton plan={plan.type as PaidPlan} popular={plan.popular} />
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4 text-sm">
            <button onClick={handleManageSubscription} disabled={portalLoading} className="btn-secondary inline-flex items-center gap-2">
              {portalLoading ? <Sparkles className="h-4 w-4 animate-pulse" /> : <ExternalLink className="h-4 w-4" />}
              Manage Subscription
            </button>
            <Link href="#faq" className="inline-flex items-center gap-1 text-brand-700 hover:text-brand-800">
              <HelpCircle className="h-4 w-4" />
              FAQ
            </Link>
            <Link href="/contact" className="inline-flex items-center gap-1 text-brand-700 hover:text-brand-800">
              <HelpCircle className="h-4 w-4" />
              Questions? Contact us
            </Link>
          </div>
          {portalError && <p className="mt-2 text-center text-xs text-red-600">{portalError}</p>}
        </div>
      </section>

      <section id="faq" className="border-t border-surface-200 py-12">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="mb-6 text-center text-heading font-bold text-ink-900">FAQ</h2>
          <div className="space-y-4">
            {FAQS.map((faq) => (
              <div key={faq.q} className="rounded-xl border border-surface-200 p-4">
                <p className="text-sm font-semibold text-ink-900">{faq.q}</p>
                <p className="mt-1 text-sm text-ink-600">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-surface-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-brand-500" />
            <span className="text-sm text-ink-600">Upgrade anytime. Cancel anytime.</span>
          </div>
        </div>
        <SiteFooter />
      </footer>
    </div>
  );
}
