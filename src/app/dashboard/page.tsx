"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  ArrowRight,
  Link2,
  Loader2,
  AlertCircle,
  Target,
  Clock,
  ExternalLink,
  Sparkles,
  ArrowUpRight,
} from "lucide-react";
import { formatRelativeTime, getStatusColor, extractPostId } from "@/lib/utils";
import type { Analysis } from "@/types";

export default function DashboardPage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [credits, setCredits] = useState<number | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const [analysesRes, creditsRes] = await Promise.all([
        supabase
          .from("analyses")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase.from("users").select("credits").eq("id", user.id).single(),
      ]);

      if (analysesRes.data) setAnalyses(analysesRes.data as Analysis[]);
      if (creditsRes.data) setCredits(creditsRes.data.credits);
      setLoadingData(false);
    }

    fetchData();
  }, []);

  async function handleAnalyze(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const postId = extractPostId(url);
    if (!postId) {
      setError("Please enter a valid X/Twitter post URL");
      return;
    }

    if (credits !== null && credits < 1) {
      setError("No credits remaining. Upgrade your plan to continue.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Analysis failed. Please try again.");
        setLoading(false);
        return;
      }

      router.push(`/dashboard/analysis/${data.id}`);
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-display font-bold text-ink-900">Market Intelligence</h1>
        <p className="text-ink-500 mt-1">
          Analyze any X builder thread for competitive insights
        </p>
      </div>

      {/* URL Input */}
      <form onSubmit={handleAnalyze} className="card p-6 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Link2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-400" />
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="input-field pl-12 h-12 text-base"
              placeholder="Paste an X thread URL — e.g., https://x.com/user/status/123456"
              disabled={loading}
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading || (credits !== null && credits < 1)}
            className="btn-primary h-12 px-6 text-base whitespace-nowrap"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                Analyze Thread
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 mt-3 text-sm text-red-600">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <p className="text-xs text-ink-400 mt-3">
          Supports any public X/Twitter post URL with replies. Each analysis uses 1 credit.
        </p>
      </form>

      {/* Credits Banner */}
      {credits !== null && (
        <div
          className={`card p-4 mb-8 flex items-center justify-between ${
            credits === 0 ? "border-red-200 bg-red-50" : ""
          }`}
        >
          <div className="flex items-center gap-3">
            <Sparkles
              className={`w-5 h-5 ${credits === 0 ? "text-red-500" : "text-brand-500"}`}
            />
            <span className="text-sm text-ink-700">
              {credits === 0 ? (
                <>
                  No credits remaining.{" "}
                  <Link href="/pricing" className="text-brand-600 font-semibold hover:underline">
                    Upgrade your plan
                  </Link>{" "}
                  to continue.
                </>
              ) : (
                <>
                  You have <strong className="text-ink-900">{credits}</strong> credit
                  {credits !== 1 ? "s" : ""} remaining
                </>
              )}
            </span>
          </div>
        </div>
      )}

      {/* Recent Analyses */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-ink-900">Recent Analyses</h2>
          {analyses.length > 0 && (
            <Link
              href="/dashboard/history"
              className="text-sm text-brand-600 font-medium hover:text-brand-700 flex items-center gap-1"
            >
              View all
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>

        {loadingData ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card p-4 animate-pulse">
                <div className="h-4 bg-surface-200 rounded w-3/4 mb-2" />
                <div className="h-3 bg-surface-100 rounded w-1/4" />
              </div>
            ))}
          </div>
        ) : analyses.length === 0 ? (
          <div className="card p-12 text-center">
            <Target className="w-10 h-10 text-ink-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-ink-700 mb-1">No analyses yet</h3>
            <p className="text-sm text-ink-400">
              Paste a thread URL above to get started
            </p>
          </div>
        ) : (
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
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-ink-800 truncate max-w-md">
                      {analysis.post_url}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span
                        className={`badge text-xs ${getStatusColor(analysis.status)}`}
                      >
                        {analysis.status}
                      </span>
                      <span className="text-xs text-ink-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatRelativeTime(analysis.created_at)}
                      </span>
                      {analysis.status === "completed" && analysis.results && (
                        <span className="text-xs text-ink-500">
                          {analysis.results.competitors?.length || 0} competitors
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-ink-300 group-hover:text-brand-500 transition-colors flex-shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
