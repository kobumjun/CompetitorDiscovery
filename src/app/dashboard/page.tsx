"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { NewUserOnboarding } from "@/components/new-user-onboarding";
import {
  FileText,
  Send,
  Target,
  CheckCircle2,
  TrendingUp,
  Plus,
  ArrowRight,
  Clock,
  Sparkles,
} from "lucide-react";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { ExtractedLead, Proposal } from "@/types";
import { formatCurrency } from "@/types";
import type { User } from "@supabase/supabase-js";

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
  const [recentLeads, setRecentLeads] = useState<ExtractedLead[]>([]);
  const [leadCount, setLeadCount] = useState(0);
  const [credits, setCredits] = useState<number | null>(null);
  const [hasProfile, setHasProfile] = useState(true);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setAuthUser(user);

      const [proposalsRes, profileRes, creditsRes, leadCountRes, recentLeadsRes] = await Promise.all([
        supabase
          .from("proposals")
          .select("*, client:clients(*)")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(3),
        supabase
          .from("business_profiles")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase.from("users").select("credits").eq("id", user.id).single(),
        supabase
          .from("extracted_leads")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id),
        supabase
          .from("extracted_leads")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(3),
      ]);

      if (proposalsRes.data) setProposals(proposalsRes.data as Proposal[]);
      if (!profileRes.data) setHasProfile(false);
      if (creditsRes.data) setCredits(creditsRes.data.credits);
      setLeadCount(leadCountRes.count ?? 0);
      if (recentLeadsRes.data) setRecentLeads(recentLeadsRes.data as ExtractedLead[]);
      setLoading(false);
    }
    fetchData();
  }, []);

  const total = proposals.length;
  const sent = proposals.filter((p) => p.status === "sent" || p.status === "viewed").length;
  const accepted = proposals.filter((p) => p.status === "accepted").length;
  const winRate = total > 0 ? Math.round((accepted / total) * 100) : 0;
  const hasCreatedAnything = leadCount > 0 || proposals.length > 0;

  if (!loading && authUser && !hasCreatedAnything) {
    return <NewUserOnboarding user={authUser} />;
  }

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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
        <Link
          href="/dashboard/leads"
          className="card-hover p-5 border-brand-200 bg-brand-50"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-brand-600" />
              <h3 className="text-base font-bold text-ink-900">Find Contacts</h3>
            </div>
            <ArrowRight className="w-4 h-4 text-brand-600" />
          </div>
          <p className="text-sm text-ink-600 mt-2">Paste any website URL to extract emails and start outreach.</p>
        </Link>
        <Link
          href="/dashboard/proposals/new"
          className="card-hover p-5"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-ink-700" />
              <h3 className="text-base font-bold text-ink-900">Create Proposal</h3>
            </div>
            <ArrowRight className="w-4 h-4 text-ink-400" />
          </div>
          <p className="text-sm text-ink-500 mt-2">Generate a full project proposal with timeline and pricing.</p>
        </Link>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
        <StatCard icon={FileText} label="Total Proposals" value={total} />
        <StatCard icon={Send} label="Sent" value={sent} />
        <StatCard icon={CheckCircle2} label="Accepted" value={accepted} color="text-emerald-600" />
        <StatCard icon={TrendingUp} label="Win Rate" value={`${winRate}%`} />
      </div>

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
          <h2 className="text-lg font-bold text-ink-900">Recent Activity</h2>
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
        ) : proposals.length === 0 && recentLeads.length === 0 ? (
          <div className="card p-12 text-center">
            <FileText className="w-10 h-10 text-ink-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-ink-700 mb-1">No activity yet</h3>
            <p className="text-sm text-ink-400">Start with Find Contacts to see your first results.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-semibold text-ink-700 mb-2">Recent Leads</div>
              <div className="space-y-2">
                {recentLeads.length === 0 ? (
                  <div className="card p-4 text-xs text-ink-400">No leads yet.</div>
                ) : (
                  recentLeads.map((lead) => {
                    const emailCount = Array.isArray(lead.emails) ? lead.emails.length : 0;
                    return (
                      <Link
                        key={lead.id}
                        href={`/dashboard/leads/${lead.id}`}
                        className="card-hover group flex items-center justify-between p-4"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-ink-800">
                            {lead.company_name || lead.source_url}
                          </div>
                          <div className="mt-1 text-xs text-ink-400">
                            {emailCount} email{emailCount !== 1 ? "s" : ""} · {formatRelativeTime(lead.created_at)}
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-ink-300 group-hover:text-brand-500" />
                      </Link>
                    );
                  })
                )}
              </div>
            </div>
            <div>
              <div className="text-sm font-semibold text-ink-700 mb-2">Recent Proposals</div>
              <div className="space-y-2">
                {proposals.length === 0 ? (
                  <div className="card p-4 text-xs text-ink-400">No proposals yet.</div>
                ) : (
                  proposals.map((p) => (
                    <Link
                      key={p.id}
                      href={`/dashboard/proposals/${p.id}`}
                      className="card-hover group flex flex-col gap-2 p-4"
                    >
                      <div className="truncate text-sm font-medium text-ink-800">{p.title}</div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className={cn("badge text-xs", STATUS_COLOR[p.status])}>{p.status}</span>
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
                    </Link>
                  ))
                )}
              </div>
            </div>
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
