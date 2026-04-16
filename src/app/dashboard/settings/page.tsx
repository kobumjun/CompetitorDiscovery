"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  User as UserIcon,
  CreditCard,
  Zap,
  LogOut,
  Shield,
  ArrowUpRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { User } from "@/types";

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);

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

        if (profile) setUser(profile as User);
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

  const maxCredits =
    user?.plan === "pro"
      ? 150
      : user?.plan === "standard"
      ? 50
      : user?.plan === "lite"
      ? 15
      : 3;

  const creditPercentage = user ? Math.min((user.credits / maxCredits) * 100, 100) : 0;

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
        <p className="text-ink-500 mt-1">Manage your account and subscription</p>
      </div>

      <div className="space-y-6">
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
                <label className="text-xs font-medium text-ink-400">Current Plan</label>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="badge bg-brand-50 text-brand-700 border border-brand-200 text-xs">
                    {planLabel}
                  </span>
                </div>
              </div>
              <Link
                href="/pricing"
                className="btn-secondary text-sm"
              >
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
              <p className="text-3xl font-black text-ink-900">{user?.credits || 0}</p>
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
                {" "}Credits refresh on{" "}
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

        {/* Danger Zone */}
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
