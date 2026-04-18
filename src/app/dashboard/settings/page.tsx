"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  Loader2,
  CheckCircle2,
  LogOut,
  Plus,
  X,
  ExternalLink,
  CreditCard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { User, BusinessProfile, ProposalTone } from "@/types";
import { planIncludedCredits, INDUSTRIES, CURRENCIES } from "@/types";

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [bizEmail, setBizEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [address, setAddress] = useState("");
  const [industry, setIndustry] = useState("");
  const [services, setServices] = useState<string[]>([]);
  const [serviceInput, setServiceInput] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [tone, setTone] = useState<ProposalTone>("professional");
  const [language, setLanguage] = useState("en");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [standardTerms, setStandardTerms] = useState("");

  const [profileId, setProfileId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState("");

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      if (!authUser) return;

      const [userRes, profileRes] = await Promise.all([
        supabase.from("users").select("*").eq("id", authUser.id).single(),
        supabase
          .from("business_profiles")
          .select("*")
          .eq("user_id", authUser.id)
          .maybeSingle(),
      ]);

      if (userRes.data) setUser(userRes.data as User);

      if (profileRes.data) {
        const p = profileRes.data as BusinessProfile;
        setProfileId(p.id);
        setBusinessName(p.business_name);
        setOwnerName(p.owner_name);
        setBizEmail(p.email);
        setPhone(p.phone || "");
        setWebsite(p.website || "");
        setAddress(p.address || "");
        setIndustry(p.industry || "");
        setServices(p.services || []);
        setHourlyRate(p.hourly_rate?.toString() || "");
        setCurrency(p.currency);
        setTone(p.tone);
        setLanguage(p.language);
        setPaymentTerms(p.payment_terms || "");
        setStandardTerms(p.standard_terms || "");
      } else {
        setBizEmail(authUser.email || "");
      }

      setLoading(false);
    }
    fetchData();
  }, []);

  function addService() {
    const val = serviceInput.trim();
    if (val && !services.includes(val)) {
      setServices((prev) => [...prev, val]);
      setServiceInput("");
    }
  }

  async function saveProfile() {
    if (!user) return;
    setSaving(true);

    const supabase = createClient();
    const data = {
      user_id: user.id,
      business_name: businessName,
      owner_name: ownerName,
      email: bizEmail,
      phone: phone || null,
      website: website || null,
      address: address || null,
      industry: industry || null,
      services,
      hourly_rate: hourlyRate ? parseFloat(hourlyRate) : null,
      currency,
      tone,
      language,
      payment_terms: paymentTerms || null,
      standard_terms: standardTerms || null,
    };

    if (profileId) {
      await supabase.from("business_profiles").update(data).eq("id", profileId);
    } else {
      const { data: created } = await supabase
        .from("business_profiles")
        .insert(data)
        .select("id")
        .single();
      if (created) setProfileId(created.id);
    }

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
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

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-surface-200 rounded w-1/3" />
          <div className="h-64 bg-surface-100 rounded-xl" />
        </div>
      </div>
    );
  }

  const maxCredits = planIncludedCredits(user?.plan || "free");

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="text-display font-bold text-ink-900">Settings</h1>
        <p className="text-ink-500 mt-1">Manage your business profile and account</p>
      </div>

      {/* Business Profile */}
      <div className="card p-6 space-y-4">
        <h2 className="text-sm font-bold text-ink-900 uppercase tracking-wider">Business Profile</h2>

        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Business Name" value={businessName} onChange={setBusinessName} placeholder="Acme Design Studio" />
          <Field label="Your Name" value={ownerName} onChange={setOwnerName} placeholder="John Doe" />
          <Field label="Email" value={bizEmail} onChange={setBizEmail} placeholder="hello@acme.com" />
          <Field label="Phone" value={phone} onChange={setPhone} placeholder="+1 555-0100" />
          <Field label="Website" value={website} onChange={setWebsite} placeholder="https://acme.com" />
          <Field label="Address" value={address} onChange={setAddress} placeholder="123 Main St" />
        </div>

        <div>
          <label className="text-sm font-medium text-ink-700 mb-1.5 block">Industry</label>
          <select value={industry} onChange={(e) => setIndustry(e.target.value)} className="input-field">
            <option value="">Select industry</option>
            {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-ink-700 mb-1.5 block">Services</label>
          <div className="flex gap-2 mb-2">
            <input
              value={serviceInput}
              onChange={(e) => setServiceInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addService())}
              className="input-field flex-1"
              placeholder="Add a service (press Enter)"
            />
            <button type="button" onClick={addService} className="btn-secondary">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          {services.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {services.map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-brand-50 text-brand-700 text-xs font-medium rounded-lg"
                >
                  {s}
                  <button
                    type="button"
                    onClick={() => setServices((prev) => prev.filter((x) => x !== s))}
                    className="text-brand-400 hover:text-brand-700"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Hourly Rate" value={hourlyRate} onChange={setHourlyRate} placeholder="100" type="number" />
          <div>
            <label className="text-sm font-medium text-ink-700 mb-1.5 block">Currency</label>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="input-field">
              {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code} ({c.symbol}) — {c.name}</option>)}
            </select>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-ink-700 mb-2 block">Tone</label>
            <div className="flex gap-2">
              {(["professional", "friendly", "casual"] as ProposalTone[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTone(t)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded-lg border capitalize transition-colors",
                    tone === t ? "bg-brand-50 border-brand-300 text-brand-700" : "bg-white border-surface-200 text-ink-500"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-ink-700 mb-1.5 block">Language</label>
            <select value={language} onChange={(e) => setLanguage(e.target.value)} className="input-field">
              <option value="en">English</option>
              <option value="ko">한국어</option>
              <option value="es">Español</option>
              <option value="ja">日本語</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-ink-700 mb-1.5 block">Default Payment Terms</label>
          <textarea
            value={paymentTerms}
            onChange={(e) => setPaymentTerms(e.target.value)}
            className="input-field resize-none"
            rows={2}
            placeholder="e.g., 50% upfront, 50% on delivery"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-ink-700 mb-1.5 block">Default Terms & Conditions</label>
          <textarea
            value={standardTerms}
            onChange={(e) => setStandardTerms(e.target.value)}
            className="input-field resize-none"
            rows={3}
            placeholder="Standard terms that appear in every proposal..."
          />
        </div>

        <button onClick={saveProfile} disabled={saving} className="btn-primary w-full">
          {saving ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
          ) : saved ? (
            <><CheckCircle2 className="w-4 h-4 text-emerald-300" /> Saved!</>
          ) : (
            "Save Profile"
          )}
        </button>
      </div>

      {/* Subscription & Credits */}
      <div className="card p-6 space-y-4">
        <h2 className="text-sm font-bold text-ink-900 uppercase tracking-wider">Subscription & Credits</h2>
        <div className="flex items-center justify-between">
          <span className="text-sm text-ink-500">Current Plan</span>
          <span className="badge bg-brand-50 text-brand-700 capitalize">{user?.plan || "free"}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-ink-500">Credits</span>
          <span className="text-sm font-bold text-ink-900">{user?.credits || 0} / {maxCredits}</span>
        </div>
        <div className="flex gap-2">
          <Link href="/pricing" className="btn-primary flex-1 text-sm justify-center">
            Upgrade Plan
          </Link>
          {user?.plan !== "free" && (
            <button
              onClick={handleManageSubscription}
              disabled={portalLoading}
              className="btn-secondary text-sm flex items-center gap-2"
            >
              {portalLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ExternalLink className="w-4 h-4" />
              )}
              Manage Subscription
            </button>
          )}
        </div>
        {portalError && <p className="text-xs text-red-600">{portalError}</p>}
      </div>

      {/* Account */}
      <div className="card p-6 space-y-4">
        <h2 className="text-sm font-bold text-ink-900 uppercase tracking-wider">Account</h2>
        <div className="flex items-center justify-between">
          <span className="text-sm text-ink-500">Email</span>
          <span className="text-sm text-ink-800">{user?.email}</span>
        </div>
        <button onClick={handleSignOut} className="btn-ghost text-red-600 hover:bg-red-50 w-full justify-center">
          <LogOut className="w-4 h-4" /> Sign Out
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="text-sm font-medium text-ink-700 mb-1.5 block">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input-field"
        placeholder={placeholder}
        type={type}
      />
    </div>
  );
}
