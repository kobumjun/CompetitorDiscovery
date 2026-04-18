"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  FileText,
  Send,
  CheckCircle2,
  TrendingUp,
  Plus,
  ArrowRight,
  Clock,
  Sparkles,
} from "lucide-react";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { Proposal } from "@/types";
import { formatCurrency } from "@/types";

const STATUS_COLOR: Record<string, string> = {
  draft: "bg-surface-100 text-ink-600",
  sent: "bg-blue-50 text-blue-700",
  viewed: "bg-amber-50 text-amber-700",
  accepted: "bg-emerald-50 text-emerald-700",
  rejected: "bg-red-50 text-red-700",
  expired: "bg-surface-100 text-ink-400",
};

export default function DashboardPage() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [credits, setCredits] = useState<number | null>(null);
  const [hasProfile, setHasProfile] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const [proposalsRes, profileRes, creditsRes] = await Promise.all([
        supabase
          .from("proposals")
          .select("*, client:clients(*)")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("business_profiles")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase.from("users").select("credits").eq("id", user.id).single(),
      ]);

      if (proposalsRes.data) setProposals(proposalsRes.data as Proposal[]);
      if (!profileRes.data) setHasProfile(false);
      if (creditsRes.data) setCredits(creditsRes.data.credits);
      setLoading(false);
    }
    fetchData();
  }, []);

  const total = proposals.length;
  const sent = proposals.filter((p) => p.status === "sent" || p.status === "viewed").length;
  const accepted = proposals.filter((p) => p.status === "accepted").length;
  const winRate = total > 0 ? Math.round((accepted / total) * 100) : 0;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-display sm:font-black">
          Dashboard
        </h1>
        <p className="text-ink-500 mt-1">Your proposal command center</p>
      </div>

      {!loading && !hasProfile && (
        <Link
          href="/dashboard/settings"
          className="card mb-6 flex flex-col gap-3 border-brand-200 bg-brand-50 p-4 transition-colors hover:bg-brand-100 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex min-w-0 items-start gap-3 sm:items-center">
            <Sparkles className="w-5 h-5 text-brand-600" />
            <span className="text-sm text-brand-800 font-medium">
              Set up your business profile for personalized proposals
            </span>
          </div>
          <ArrowRight className="hidden h-4 w-4 flex-shrink-0 text-brand-600 sm:block" />
        </Link>
      )}

      <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
        <StatCard icon={FileText} label="Total Proposals" value={total} />
        <StatCard icon={Send} label="Sent" value={sent} />
        <StatCard icon={CheckCircle2} label="Accepted" value={accepted} color="text-emerald-600" />
        <StatCard icon={TrendingUp} label="Win Rate" value={`${winRate}%`} />
      </div>

      <Link
        href="/dashboard/proposals/new"
        className="btn-primary w-full h-14 text-base mb-8 justify-center"
      >
        <Plus className="w-5 h-5" />
        Create New Proposal
      </Link>

      {credits !== null && (
        <div
          className={cn(
            "card p-4 mb-8",
            credits === 0
              ? "border-red-200 bg-red-50"
              : credits <= 3
                ? "border-amber-200 bg-amber-50"
                : ""
          )}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3 sm:items-center">
              <Sparkles
                className={cn(
                  "w-5 h-5 flex-shrink-0",
                  credits === 0 ? "text-red-500" : credits <= 3 ? "text-amber-500" : "text-brand-500"
                )}
              />
              <span className="text-sm text-ink-700">
                {credits === 0 ? (
                  <span className="text-red-700 font-medium">No credits remaining</span>
                ) : (
                  <>
                    <strong className={cn("text-ink-900", credits <= 3 && "text-amber-800")}>
                      {credits}
                    </strong>{" "}
                    proposal credit{credits !== 1 ? "s" : ""} remaining
                  </>
                )}
              </span>
            </div>
            <Link
              href="/pricing"
              className={cn(
                "flex w-full flex-shrink-0 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-center text-sm font-semibold transition-colors sm:ml-4 sm:w-auto sm:justify-center",
                credits <= 3
                  ? "bg-brand-500 text-white hover:bg-brand-600"
                  : "text-brand-600 hover:text-brand-700 hover:bg-brand-50"
              )}
            >
              Upgrade Plan
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          {credits > 0 && credits <= 3 && (
            <p className="mt-2 text-xs text-amber-700 sm:ml-8">
              Running low on credits! Upgrade for more proposals at a better per-credit price.
            </p>
          )}
        </div>
      )}

      <div>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-bold text-ink-900">Recent Proposals</h2>
          {proposals.length > 0 && (
            <Link href="/dashboard/proposals" className="flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700">
              View all <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card p-4 animate-pulse">
                <div className="h-4 bg-surface-200 rounded w-3/4 mb-2" />
                <div className="h-3 bg-surface-100 rounded w-1/4" />
              </div>
            ))}
          </div>
        ) : proposals.length === 0 ? (
          <div className="card p-12 text-center">
            <FileText className="w-10 h-10 text-ink-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-ink-700 mb-1">No proposals yet</h3>
            <p className="text-sm text-ink-400">Create your first AI-generated proposal</p>
          </div>
        ) : (
          <div className="space-y-2">
            {proposals.map((p) => (
              <Link
                key={p.id}
                href={`/dashboard/proposals/${p.id}`}
                className="card-hover group flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-ink-800">{p.title}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className={cn("badge text-xs", STATUS_COLOR[p.status])}>{p.status}</span>
                    {p.client && (
                      <span className="text-xs text-ink-400">{(p.client as any).company_name}</span>
                    )}
                    {p.total_amount && (
                      <span className="text-xs text-ink-500 font-medium">
                        {formatCurrency(p.total_amount, p.currency)}
                      </span>
                    )}
                    <span className="text-xs text-ink-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatRelativeTime(p.created_at)}
                    </span>
                  </div>
                </div>
                <ArrowRight className="ml-auto h-4 w-4 flex-shrink-0 self-end text-ink-300 transition-colors group-hover:text-brand-500 sm:ml-0 sm:self-center" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div className="stat-card">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4 text-ink-400" />
        <span className="stat-label">{label}</span>
      </div>
      <span className={cn("stat-value", color)}>{value}</span>
    </div>
  );
}
