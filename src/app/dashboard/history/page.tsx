"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  Clock,
  Target,
  ExternalLink,
  ArrowRight,
  Search,
  Filter,
  ChevronDown,
} from "lucide-react";
import { formatRelativeTime, getStatusColor, cn } from "@/lib/utils";
import type { Analysis } from "@/types";

type FilterStatus = "all" | "completed" | "processing" | "failed";

export default function HistoryPage() {
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 20;

  useEffect(() => {
    fetchAnalyses(true);
  }, [filter]);

  async function fetchAnalyses(reset = false) {
    const supabase = createClient();
    const currentPage = reset ? 0 : page;

    let query = supabase
      .from("analyses")
      .select("*")
      .order("created_at", { ascending: false })
      .range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1);

    if (filter !== "all") {
      query = query.eq("status", filter);
    }

    const { data } = await query;

    if (data) {
      if (reset) {
        setAnalyses(data as Analysis[]);
        setPage(0);
      } else {
        setAnalyses((prev) => [...prev, ...(data as Analysis[])]);
      }
      setHasMore(data.length === PAGE_SIZE);
    }

    setLoading(false);
  }

  function loadMore() {
    setPage((p) => p + 1);
    fetchAnalyses(false);
  }

  const FILTER_OPTIONS: { value: FilterStatus; label: string }[] = [
    { value: "all", label: "All" },
    { value: "completed", label: "Completed" },
    { value: "processing", label: "Processing" },
    { value: "failed", label: "Failed" },
  ];

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-display font-bold text-ink-900">Analysis History</h1>
        <p className="text-ink-500 mt-1">All your thread analyses in one place</p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-6">
        <Filter className="w-4 h-4 text-ink-400" />
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
              filter === opt.value
                ? "bg-ink-900 text-white"
                : "bg-surface-100 text-ink-500 hover:bg-surface-200"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="card p-4 animate-pulse">
              <div className="h-4 bg-surface-200 rounded w-3/4 mb-2" />
              <div className="h-3 bg-surface-100 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : analyses.length === 0 ? (
        <div className="card p-16 text-center">
          <Search className="w-10 h-10 text-ink-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-ink-700 mb-1">No analyses found</h3>
          <p className="text-sm text-ink-400 mb-4">
            {filter !== "all"
              ? `No ${filter} analyses. Try a different filter.`
              : "Start by analyzing a thread from the dashboard."}
          </p>
          <Link href="/dashboard" className="btn-primary">
            Go to Dashboard
          </Link>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {analyses.map((analysis) => (
              <Link
                key={analysis.id}
                href={`/dashboard/analysis/${analysis.id}`}
                className="card-hover p-4 flex items-center justify-between group block"
              >
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div className="w-9 h-9 rounded-lg bg-surface-100 flex items-center justify-center flex-shrink-0">
                    <Target className="w-4 h-4 text-ink-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-ink-800 truncate">
                      {analysis.post_url}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className={`badge text-xs ${getStatusColor(analysis.status)}`}>
                        {analysis.status}
                      </span>
                      <span className="text-xs text-ink-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatRelativeTime(analysis.created_at)}
                      </span>
                      {analysis.status === "completed" && analysis.results && (
                        <span className="text-xs text-ink-500">
                          {(analysis.results as any).competitors?.length || 0} competitors
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-ink-300 group-hover:text-brand-500 transition-colors flex-shrink-0" />
              </Link>
            ))}
          </div>
          {hasMore && (
            <div className="text-center mt-6">
              <button onClick={loadMore} className="btn-secondary">
                Load More
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
