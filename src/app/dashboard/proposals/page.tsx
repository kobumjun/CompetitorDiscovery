"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  Plus,
  FileText,
  Eye,
  Clock,
  Trash2,
  Copy,
  ArrowRight,
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

const FILTERS = ["all", "draft", "sent", "viewed", "accepted", "rejected"] as const;

export default function ProposalsPage() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProposals() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("proposals")
        .select("*, client:clients(*)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (data) setProposals(data as Proposal[]);
      setLoading(false);
    }
    fetchProposals();
  }, []);

  const filtered = proposals.filter((p) => {
    if (filter !== "all" && p.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        p.title.toLowerCase().includes(q) ||
        (p.client as any)?.company_name?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  async function handleDelete(id: string) {
    if (!confirm("Delete this proposal?")) return;
    await fetch(`/api/proposals/${id}`, { method: "DELETE" });
    setProposals((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-display font-bold text-ink-900">Proposals</h1>
          <p className="text-ink-500 mt-1">Manage all your proposals</p>
        </div>
        <Link href="/dashboard/proposals/new" className="btn-primary">
          <Plus className="w-4 h-4" /> New Proposal
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex gap-1 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors",
                filter === f
                  ? "bg-brand-50 text-brand-700 border border-brand-200"
                  : "text-ink-500 hover:bg-surface-100"
              )}
            >
              {f}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field sm:max-w-xs"
          placeholder="Search by title or client..."
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-5 animate-pulse">
              <div className="h-4 bg-surface-200 rounded w-2/3 mb-3" />
              <div className="h-3 bg-surface-100 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <FileText className="w-10 h-10 text-ink-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-ink-700 mb-1">
            {proposals.length === 0 ? "No proposals yet" : "No matching proposals"}
          </h3>
          <p className="text-sm text-ink-400 mb-4">
            {proposals.length === 0
              ? "Create your first AI-generated proposal"
              : "Try a different filter or search term"}
          </p>
          {proposals.length === 0 && (
            <Link href="/dashboard/proposals/new" className="btn-primary">
              <Plus className="w-4 h-4" /> Create Proposal
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => (
            <div key={p.id} className="card-hover p-5 flex items-center justify-between">
              <Link href={`/dashboard/proposals/${p.id}`} className="min-w-0 flex-1 block">
                <div className="text-sm font-medium text-ink-800 truncate">{p.title}</div>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className={cn("badge text-xs", STATUS_COLOR[p.status])}>{p.status}</span>
                  {(p.client as any)?.company_name && (
                    <span className="text-xs text-ink-400">{(p.client as any).company_name}</span>
                  )}
                  {p.total_amount != null && (
                    <span className="text-xs text-ink-500 font-medium">
                      {formatCurrency(p.total_amount, p.currency)}
                    </span>
                  )}
                  {p.view_count > 0 && (
                    <span className="text-xs text-ink-400 flex items-center gap-1">
                      <Eye className="w-3 h-3" /> {p.view_count}
                    </span>
                  )}
                  <span className="text-xs text-ink-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {formatRelativeTime(p.created_at)}
                  </span>
                </div>
              </Link>
              <div className="flex items-center gap-1 ml-3 flex-shrink-0">
                <button
                  onClick={() => handleDelete(p.id)}
                  className="p-1.5 text-ink-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
