"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  User as UserIcon,
  Zap,
  LogOut,
  Shield,
  ArrowUpRight,
  Package,
  Loader2,
  CheckCircle2,
  X,
  CreditCard,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { User, OfferCategory, LeadSensitivity } from "@/types";
import {
  planIncludedCredits,
  OFFER_CATEGORIES,
  LEAD_SENSITIVITIES,
  SENSITIVITY_LABELS,
  SENSITIVITY_DESCRIPTIONS,
} from "@/types";

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);

  const [offerCategories, setOfferCategories] = useState<OfferCategory[]>([]);
  const [productName, setProductName] = useState("");
  const [valueProposition, setValueProposition] = useState("");
  const [targetKeywordsInput, setTargetKeywordsInput] = useState("");
  const [targetKeywords, setTargetKeywords] = useState<string[]>([]);
  const [leadSensitivity, setLeadSensitivity] = useState<LeadSensitivity>("balanced");
  const [offerSaving, setOfferSaving] = useState(false);
  const [offerSaved, setOfferSaved] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState("");

  useEffect(() => {
    async function fetchUser() {
      const supabase = createClient();
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (authUser) {
        setEmail(authUser.email || "");
        const { data: profile } = await supabase
          .from("users")
          .select("*")
          .eq("id", authUser.id)
          .single();

        if (profile) {
          const u = profile as User;
          setUser(u);
          setOfferCategories((u.offer_categories as OfferCategory[]) || []);
          setProductName(u.product_name || "");
          setValueProposition(u.value_proposition || "");
          setTargetKeywords((u.target_keywords as string[]) || []);
          setLeadSensitivity((u.lead_sensitivity as LeadSensitivity) || "balanced");
        }
      }
      setLoading(false);
    }
    fetchUser();
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

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

  function toggleCategory(cat: OfferCategory) {
    setOfferCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
    setOfferSaved(false);
  }

  function addKeyword() {
    const trimmed = targetKeywordsInput.trim();
    if (trimmed && !targetKeywords.includes(trimmed)) {
      setTargetKeywords((prev) => [...prev, trimmed]);
      setTargetKeywordsInput("");
      setOfferSaved(false);
    }
  }

  function removeKeyword(kw: string) {
    setTargetKeywords((prev) => prev.filter((k) => k !== kw));
    setOfferSaved(false);
  }

  async function saveOffer() {
    if (!user) return;
    setOfferSaving(true);
    const supabase = createClient();
    await supabase
      .from("users")
      .update({
        offer_categories: offerCategories,
        product_name: productName,
        value_proposition: valueProposition,
        target_keywords: targetKeywords,
        lead_sensitivity: leadSensitivity,
      })
      .eq("id", user.id);
    setOfferSaving(false);
    setOfferSaved(true);
    setTimeout(() => setOfferSaved(false), 3000);
  }

  const maxCredits = user ? planIncludedCredits(user.plan) : 3;
  const creditPercentage = user
    ? Math.min((user.credits / maxCredits) * 100, 100)
    : 0;

  const planLabel =
    user?.plan === "free"
      ? "Free"
      : user?.plan === "lite"
      ? "Lite"
      : user?.plan === "standard"
      ? "Standard"
      : user?.plan === "pro"
      ? "Pro"
      : "Free";

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-surface-200 rounded w-1/4" />
          <div className="h-40 bg-surface-100 rounded-xl" />
          <div className="h-40 bg-surface-100 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-display font-bold text-ink-900">Settings</h1>
        <p className="text-ink-500 mt-1">
          Manage your offer profile, account, and subscription
        </p>
      </div>

      <div className="space-y-6">
        {/* My Offer */}
        <div className="card p-6">
          <h2 className="text-sm font-semibold text-ink-900 flex items-center gap-2 mb-1">
            <Package className="w-4 h-4 text-brand-500" />
            My Offer
          </h2>
          <p className="text-xs text-ink-400 mb-5">
            Describe what you sell so leads are scored and pitches are
            tailored to your offer.
          </p>

          <div className="space-y-5">
            {/* Categories */}
            <div>
              <label className="text-xs font-medium text-ink-500 mb-2 block">
                Product / Service Category
              </label>
              <div className="flex flex-wrap gap-2">
                {OFFER_CATEGORIES.map((cat) => {
                  const active = offerCategories.includes(cat);
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => toggleCategory(cat)}
                      className={cn(
                        "px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors",
                        active
                          ? "bg-brand-50 border-brand-300 text-brand-700"
                          : "bg-white border-surface-200 text-ink-500 hover:border-surface-300"
                      )}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Product Name */}
            <div>
              <label className="text-xs font-medium text-ink-500 mb-1.5 block">
                Product / Brand Name
              </label>
              <input
                type="text"
                value={productName}
                onChange={(e) => {
                  setProductName(e.target.value);
                  setOfferSaved(false);
                }}
                className="input-field"
                placeholder='e.g. "NextKit Pro", "삼성화재 운전자보험"'
              />
            </div>

            {/* Value Proposition */}
            <div>
              <label className="text-xs font-medium text-ink-500 mb-1.5 block">
                Value Proposition
              </label>
              <textarea
                value={valueProposition}
                onChange={(e) => {
                  setValueProposition(e.target.value);
                  setOfferSaved(false);
                }}
                rows={3}
                className="input-field resize-none"
                placeholder="Describe what you offer and why it matters to customers"
              />
            </div>

            {/* Target Keywords */}
            <div>
              <label className="text-xs font-medium text-ink-500 mb-1.5 block">
                Target Customer Keywords
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={targetKeywordsInput}
                  onChange={(e) => setTargetKeywordsInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      addKeyword();
                    }
                  }}
                  className="input-field flex-1"
                  placeholder="Type a keyword and press Enter"
                />
                <button
                  type="button"
                  onClick={addKeyword}
                  className="btn-secondary text-xs px-3"
                >
                  Add
                </button>
              </div>
              {targetKeywords.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {targetKeywords.map((kw) => (
                    <span
                      key={kw}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-surface-100 text-ink-700 text-xs rounded-lg"
                    >
                      {kw}
                      <button
                        type="button"
                        onClick={() => removeKeyword(kw)}
                        className="text-ink-400 hover:text-red-500"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Lead Sensitivity */}
            <div>
              <label className="text-xs font-medium text-ink-500 mb-2 block">
                Lead Extraction Sensitivity
              </label>
              <div className="space-y-2">
                {LEAD_SENSITIVITIES.map((mode) => {
                  const active = leadSensitivity === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => {
                        setLeadSensitivity(mode);
                        setOfferSaved(false);
                      }}
                      className={cn(
                        "w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-colors",
                        active
                          ? "bg-brand-50 border-brand-300"
                          : "bg-white border-surface-200 hover:border-surface-300"
                      )}
                    >
                      <div
                        className={cn(
                          "mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                          active
                            ? "border-brand-500"
                            : "border-surface-300"
                        )}
                      >
                        {active && (
                          <div className="w-2 h-2 rounded-full bg-brand-500" />
                        )}
                      </div>
                      <div>
                        <span
                          className={cn(
                            "text-sm font-medium",
                            active ? "text-brand-700" : "text-ink-700"
                          )}
                        >
                          {SENSITIVITY_LABELS[mode]}
                        </span>
                        <p className="text-xs text-ink-400 mt-0.5">
                          {SENSITIVITY_DESCRIPTIONS[mode]}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Save */}
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={saveOffer}
                disabled={offerSaving}
                className="btn-primary text-sm"
              >
                {offerSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Offer Profile"
                )}
              </button>
              {offerSaved && (
                <span className="text-xs text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Saved
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Account */}
        <div className="card p-6">
          <h2 className="text-sm font-semibold text-ink-900 flex items-center gap-2 mb-4">
            <UserIcon className="w-4 h-4 text-ink-500" />
            Account
          </h2>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-ink-400">Email</label>
              <p className="text-sm text-ink-800 mt-0.5">{email}</p>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-medium text-ink-400">
                  Current Plan
                </label>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="badge bg-brand-50 text-brand-700 border border-brand-200 text-xs">
                    {planLabel}
                  </span>
                </div>
              </div>
              <Link href="/pricing" className="btn-secondary text-sm">
                {user?.plan === "free" || user?.plan === "lite"
                  ? "Upgrade Plan"
                  : "Manage Plan"}
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* Credits */}
        <div className="card p-6">
          <h2 className="text-sm font-semibold text-ink-900 flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-brand-500" />
            Credits
          </h2>
          <div className="flex items-end justify-between mb-3">
            <div>
              <p className="text-3xl font-black text-ink-900">
                {user?.credits || 0}
              </p>
              <p className="text-sm text-ink-500 mt-0.5">
                credits remaining of {maxCredits}
              </p>
            </div>
          </div>
          <div className="w-full h-2.5 bg-surface-200 rounded-full overflow-hidden mb-4">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                creditPercentage > 50
                  ? "bg-brand-500"
                  : creditPercentage > 20
                  ? "bg-amber-500"
                  : "bg-red-500"
              )}
              style={{ width: `${creditPercentage}%` }}
            />
          </div>
          <p className="text-xs text-ink-400">
            Your {planLabel} plan includes {maxCredits} analyses per month.
            {user?.plan_expires_at && (
              <>
                {" "}
                Credits refresh on{" "}
                {new Date(user.plan_expires_at).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
                .
              </>
            )}
          </p>
        </div>

        {/* Subscription Management — only for paid plans */}
        {user && user.plan !== "free" && (
          <div className="card p-6">
            <h2 className="text-sm font-semibold text-ink-900 flex items-center gap-2 mb-1">
              <CreditCard className="w-4 h-4 text-ink-500" />
              Subscription Management
            </h2>
            <p className="text-xs text-ink-400 mb-4">
              Update your payment method, view billing history, or cancel your
              subscription.
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleManageSubscription}
                disabled={portalLoading}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-surface-300 text-ink-700 hover:bg-surface-50 transition-colors disabled:opacity-50"
              >
                {portalLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Opening...
                  </>
                ) : (
                  <>
                    Manage Subscription
                    <ExternalLink className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
              {portalError && (
                <span className="text-xs text-red-600">{portalError}</span>
              )}
            </div>
          </div>
        )}

        {/* Session */}
        <div className="card p-6 border-red-200">
          <h2 className="text-sm font-semibold text-ink-900 flex items-center gap-2 mb-4">
            <Shield className="w-4 h-4 text-red-500" />
            Session
          </h2>
          <p className="text-sm text-ink-500 mb-4">
            Sign out of your account on this device.
          </p>
          <button onClick={handleSignOut} className="btn-danger">
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
