"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  Loader2,
  LogOut,
  ExternalLink,
} from "lucide-react";
import type { User } from "@/types";
import { planIncludedCredits } from "@/types";

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState("");

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      if (!authUser) return;
      const { data: userRes } = await supabase.from("users").select("*").eq("id", authUser.id).single();
      if (userRes) setUser(userRes as User);

      setLoading(false);
    }
    fetchData();
  }, []);

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
        <p className="text-ink-500 mt-1">Manage your account and subscription</p>
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
          <LogOut className="w-4 h-4" /> Log out
        </button>
      </div>
    </div>
  );
}
