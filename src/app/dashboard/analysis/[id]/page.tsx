"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  ArrowLeft,
  ExternalLink,
  Target,
  BarChart3,
  Layers,
  Lightbulb,
  FileText,
  Search,
  Compass,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle2,
  Shield,
  Loader2,
  XCircle,
  Users,
  Zap,
  ArrowUpRight,
  Globe,
  Hash,
  Signal,
} from "lucide-react";
import { formatDate, formatNumber, getSentimentColor, getThreatColor, cn } from "@/lib/utils";
import type { Analysis, AnalysisResult, Competitor, MarketCategory, MarketNeed, PositioningPattern, DifferentiationOpportunity, ProductIdea } from "@/types";

type TabKey = "overview" | "competitors" | "categories" | "needs" | "positioning" | "opportunities" | "ideas";

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "overview", label: "Overview", icon: FileText },
  { key: "competitors", label: "Competitors", icon: Target },
  { key: "categories", label: "Categories", icon: BarChart3 },
  { key: "needs", label: "Market Needs", icon: Search },
  { key: "positioning", label: "Positioning", icon: Layers },
  { key: "opportunities", label: "Opportunities", icon: Compass },
  { key: "ideas", label: "Ideas", icon: Lightbulb },
];

export default function AnalysisPage() {
  const params = useParams();
  const router = useRouter();
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  const fetchAnalysis = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("analyses")
      .select("*")
      .eq("id", params.id)
      .single();

    if (data) {
      setAnalysis(data as Analysis);
      if (data.status === "completed" || data.status === "failed") {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchAnalysis();
  }, [fetchAnalysis]);

  useEffect(() => {
    if (analysis?.status === "processing" || analysis?.status === "pending") {
      const interval = setInterval(fetchAnalysis, 3000);
      return () => clearInterval(interval);
    }
  }, [analysis?.status, fetchAnalysis]);

  if (loading && !analysis) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-surface-200 rounded w-1/3" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-surface-100 rounded-xl" />
            ))}
          </div>
          <div className="h-64 bg-surface-100 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-8 text-center">
        <XCircle className="w-12 h-12 text-ink-300 mx-auto mb-4" />
        <h2 className="text-lg font-bold text-ink-700">Analysis not found</h2>
        <Link href="/dashboard" className="btn-secondary mt-4">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  if (analysis.status === "processing" || analysis.status === "pending") {
    return (
      <div className="max-w-5xl mx-auto px-6 py-8">
        <Link href="/dashboard" className="btn-ghost mb-6 -ml-3 text-ink-500">
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
        <div className="card p-16 text-center">
          <div className="relative w-16 h-16 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-surface-200" />
            <div className="absolute inset-0 rounded-full border-4 border-brand-500 border-t-transparent animate-spin" />
          </div>
          <h2 className="text-xl font-bold text-ink-900 mb-2">Analyzing thread...</h2>
          <p className="text-sm text-ink-500 max-w-md mx-auto">
            Reading replies, extracting products, mapping the competitive landscape.
            This usually takes 15-30 seconds.
          </p>
          <div className="mt-6 inline-flex items-center gap-2 px-3 py-1.5 bg-surface-100 rounded-full text-xs text-ink-500">
            <Loader2 className="w-3 h-3 animate-spin" />
            Processing
          </div>
        </div>
      </div>
    );
  }

  if (analysis.status === "failed") {
    return (
      <div className="max-w-5xl mx-auto px-6 py-8">
        <Link href="/dashboard" className="btn-ghost mb-6 -ml-3 text-ink-500">
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
        <div className="card p-16 text-center border-red-200">
          <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-ink-900 mb-2">Analysis failed</h2>
          <p className="text-sm text-ink-500 mb-6">
            We couldn&apos;t analyze this thread. The post may be private, deleted, or the API may be temporarily unavailable.
          </p>
          <Link href="/dashboard" className="btn-primary">
            Try Another Thread
          </Link>
        </div>
      </div>
    );
  }

  const results = analysis.results as AnalysisResult;
  if (!results) return null;

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <Link href="/dashboard" className="btn-ghost -ml-3 text-ink-500 mb-4 inline-flex">
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-ink-900">
              Analysis of @{results.threadInfo.authorHandle}&apos;s thread
            </h1>
            <p className="text-sm text-ink-500 mt-1">
              Analyzed on {formatDate(results.threadInfo.analyzedAt)}
            </p>
          </div>
          <a
            href={analysis.post_url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost text-sm"
          >
            View Thread
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-blue-500" />
            <span className="stat-label">Replies Analyzed</span>
          </div>
          <span className="stat-value">{results.threadInfo.repliesAnalyzed}</span>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-1">
            <Target className="w-4 h-4 text-brand-500" />
            <span className="stat-label">Competitors</span>
          </div>
          <span className="stat-value">{results.competitors.length}</span>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="w-4 h-4 text-emerald-500" />
            <span className="stat-label">Categories</span>
          </div>
          <span className="stat-value">{results.categories.length}</span>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-1">
            <Lightbulb className="w-4 h-4 text-violet-500" />
            <span className="stat-label">Product Ideas</span>
          </div>
          <span className="stat-value">{results.productIdeas.length}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-surface-200 mb-6 -mx-6 px-6 overflow-x-auto">
        <div className="flex gap-0 min-w-max">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                activeTab === tab.key
                  ? "border-brand-500 text-brand-700"
                  : "border-transparent text-ink-500 hover:text-ink-700 hover:border-surface-300"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="animate-in">
        {activeTab === "overview" && <OverviewTab results={results} />}
        {activeTab === "competitors" && <CompetitorsTab competitors={results.competitors} />}
        {activeTab === "categories" && <CategoriesTab categories={results.categories} />}
        {activeTab === "needs" && <NeedsTab needs={results.marketNeeds} />}
        {activeTab === "positioning" && <PositioningTab patterns={results.positioningPatterns} />}
        {activeTab === "opportunities" && <OpportunitiesTab opportunities={results.differentiationOpportunities} />}
        {activeTab === "ideas" && <IdeasTab ideas={results.productIdeas} />}
      </div>
    </div>
  );
}

function OverviewTab({ results }: { results: AnalysisResult }) {
  const { marketBriefing } = results;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="card p-6">
        <h3 className="text-sm font-semibold text-ink-900 mb-3 flex items-center gap-2">
          <FileText className="w-4 h-4 text-brand-500" />
          Market Briefing
        </h3>
        <p className="text-sm text-ink-700 leading-relaxed">{marketBriefing.summary}</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Sentiment & Threat */}
        <div className="card p-5">
          <h4 className="section-title mb-3">Market Sentiment</h4>
          <div className="flex items-center gap-3">
            <span className={cn("text-lg font-bold capitalize", getSentimentColor(marketBriefing.marketSentiment))}>
              {marketBriefing.marketSentiment}
            </span>
          </div>
        </div>
        <div className="card p-5">
          <h4 className="section-title mb-3">Competition Level</h4>
          <div className={cn("inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold border capitalize", getThreatColor(marketBriefing.threatLevel))}>
            {marketBriefing.threatLevel === "critical" && <AlertTriangle className="w-4 h-4" />}
            {marketBriefing.threatLevel === "high" && <Signal className="w-4 h-4" />}
            {marketBriefing.threatLevel === "moderate" && <Shield className="w-4 h-4" />}
            {marketBriefing.threatLevel === "low" && <CheckCircle2 className="w-4 h-4" />}
            {marketBriefing.threatLevel}
          </div>
        </div>
      </div>

      {/* Key Takeaways */}
      <div className="card p-6">
        <h3 className="text-sm font-semibold text-ink-900 mb-4 flex items-center gap-2">
          <Zap className="w-4 h-4 text-brand-500" />
          Key Takeaways
        </h3>
        <ol className="space-y-3">
          {marketBriefing.keyTakeaways.map((takeaway, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-brand-50 text-brand-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                {i + 1}
              </span>
              <span className="text-sm text-ink-700 leading-relaxed">{takeaway}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Emerging Trends */}
      <div className="card p-6">
        <h3 className="text-sm font-semibold text-ink-900 mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-500" />
          Emerging Trends
        </h3>
        <div className="flex flex-wrap gap-2">
          {marketBriefing.emergingTrends.map((trend, i) => (
            <span key={i} className="badge bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1">
              {trend}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function CompetitorsTab({ competitors }: { competitors: Competitor[] }) {
  const sorted = [...competitors].sort((a, b) => b.mentionCount - a.mentionCount);

  const stageColors: Record<string, string> = {
    idea: "bg-slate-100 text-slate-600",
    building: "bg-blue-50 text-blue-700",
    launched: "bg-emerald-50 text-emerald-700",
    growing: "bg-amber-50 text-amber-700",
    established: "bg-violet-50 text-violet-700",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-ink-500">{competitors.length} competitors identified</p>
      </div>
      <div className="space-y-3">
        {sorted.map((comp, i) => (
          <div key={i} className="card p-5 hover:shadow-card-hover transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-surface-100 flex items-center justify-center font-bold text-ink-500 text-sm">
                  {comp.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-ink-900">{comp.name}</h4>
                    {comp.url && (
                      <a href={comp.url} target="_blank" rel="noopener noreferrer" className="text-ink-400 hover:text-brand-500">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                  <span className="text-xs text-ink-400">{comp.category}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn("badge text-xs", stageColors[comp.stage] || "bg-surface-100 text-ink-500")}>
                  {comp.stage}
                </span>
                <span className="text-xs text-ink-400">×{comp.mentionCount}</span>
              </div>
            </div>
            <p className="text-sm text-ink-600 mb-3">{comp.description}</p>
            <div className="border-t border-surface-100 pt-3">
              <p className="text-xs text-ink-400 mb-2">Positioning</p>
              <p className="text-sm text-ink-700">{comp.positioning}</p>
            </div>
            {comp.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {comp.tags.map((tag) => (
                  <span key={tag} className="text-xs px-2 py-0.5 bg-surface-100 text-ink-500 rounded">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function CategoriesTab({ categories }: { categories: MarketCategory[] }) {
  const maxCount = Math.max(...categories.map((c) => c.count), 1);
  const trendIcons: Record<string, React.ReactNode> = {
    rising: <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />,
    stable: <Minus className="w-3.5 h-3.5 text-ink-400" />,
    declining: <TrendingDown className="w-3.5 h-3.5 text-red-500" />,
  };
  const barColors = ["bg-brand-500", "bg-blue-500", "bg-emerald-500", "bg-violet-500", "bg-amber-500", "bg-rose-500", "bg-teal-500", "bg-indigo-500"];

  return (
    <div className="space-y-4">
      {categories.map((cat, i) => (
        <div key={i} className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <h4 className="text-sm font-bold text-ink-900">{cat.name}</h4>
              <span className="text-xs text-ink-400">{cat.count} mentions</span>
              <div className="flex items-center gap-1">
                {trendIcons[cat.trend]}
                <span className="text-xs text-ink-400 capitalize">{cat.trend}</span>
              </div>
            </div>
            <span className="text-sm font-bold text-ink-700">{cat.percentage}%</span>
          </div>
          <div className="w-full h-3 bg-surface-100 rounded-full overflow-hidden mb-3">
            <div
              className={cn("h-full rounded-full transition-all", barColors[i % barColors.length])}
              style={{ width: `${cat.percentage}%` }}
            />
          </div>
          {cat.examples.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {cat.examples.map((ex) => (
                <span key={ex} className="text-xs px-2 py-0.5 bg-surface-50 border border-surface-200 text-ink-500 rounded">
                  {ex}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function NeedsTab({ needs }: { needs: MarketNeed[] }) {
  const frequencyColors: Record<string, string> = {
    very_common: "bg-red-50 text-red-700 border-red-200",
    common: "bg-orange-50 text-orange-700 border-orange-200",
    occasional: "bg-amber-50 text-amber-700 border-amber-200",
    rare: "bg-slate-50 text-slate-600 border-slate-200",
  };
  const urgencyColors: Record<string, string> = {
    critical: "text-red-600",
    high: "text-orange-600",
    medium: "text-amber-600",
    low: "text-slate-500",
  };

  return (
    <div className="space-y-4">
      {needs.map((need, i) => (
        <div key={i} className="card p-5">
          <div className="flex items-start justify-between mb-3">
            <h4 className="text-sm font-bold text-ink-900 flex-1">{need.need}</h4>
            <div className="flex items-center gap-2 flex-shrink-0 ml-4">
              <span className={cn("badge text-xs border", frequencyColors[need.frequency])}>
                {need.frequency.replace("_", " ")}
              </span>
              <span className={cn("text-xs font-semibold capitalize", urgencyColors[need.urgency])}>
                {need.urgency} urgency
              </span>
            </div>
          </div>
          <div className="bg-brand-50 border border-brand-100 rounded-lg p-3 mb-3">
            <p className="text-xs font-semibold text-brand-700 mb-0.5">Opportunity</p>
            <p className="text-sm text-brand-800">{need.opportunityNote}</p>
          </div>
          {need.relatedProducts.length > 0 && (
            <div>
              <p className="text-xs text-ink-400 mb-1.5">Related products</p>
              <div className="flex flex-wrap gap-1.5">
                {need.relatedProducts.map((p) => (
                  <span key={p} className="text-xs px-2 py-0.5 bg-surface-100 text-ink-600 rounded">
                    {p}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function PositioningTab({ patterns }: { patterns: PositioningPattern[] }) {
  const effectColors: Record<string, string> = {
    strong: "text-emerald-600 bg-emerald-50",
    moderate: "text-amber-600 bg-amber-50",
    weak: "text-red-600 bg-red-50",
  };
  const saturationColors: Record<string, string> = {
    oversaturated: "text-red-700 bg-red-50 border-red-200",
    competitive: "text-amber-700 bg-amber-50 border-amber-200",
    open: "text-emerald-700 bg-emerald-50 border-emerald-200",
  };

  return (
    <div className="space-y-4">
      {patterns.map((pat, i) => (
        <div key={i} className="card p-5">
          <div className="flex items-start justify-between mb-3">
            <h4 className="text-sm font-bold text-ink-900">{pat.pattern}</h4>
            <div className="flex items-center gap-2 flex-shrink-0 ml-4">
              <span className={cn("badge text-xs", effectColors[pat.effectiveness])}>
                {pat.effectiveness}
              </span>
              <span className={cn("badge text-xs border", saturationColors[pat.saturation])}>
                {pat.saturation}
              </span>
            </div>
          </div>
          <p className="text-sm text-ink-600 mb-3">{pat.description}</p>
          {pat.examples.length > 0 && (
            <div className="border-t border-surface-100 pt-3">
              <p className="text-xs text-ink-400 mb-2">Examples from thread</p>
              <ul className="space-y-1.5">
                {pat.examples.map((ex, j) => (
                  <li key={j} className="text-xs text-ink-600 flex items-start gap-2">
                    <Hash className="w-3 h-3 text-ink-300 mt-0.5 flex-shrink-0" />
                    {ex}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function OpportunitiesTab({ opportunities }: { opportunities: DifferentiationOpportunity[] }) {
  const diffColors: Record<string, string> = {
    easy: "bg-emerald-50 text-emerald-700",
    medium: "bg-amber-50 text-amber-700",
    hard: "bg-red-50 text-red-700",
  };
  const impactColors: Record<string, string> = {
    high: "bg-brand-50 text-brand-700",
    medium: "bg-blue-50 text-blue-700",
    low: "bg-slate-50 text-slate-600",
  };

  return (
    <div className="space-y-4">
      {opportunities.map((opp, i) => (
        <div key={i} className={cn(
          "card p-5 border-l-4",
          opp.potentialImpact === "high" ? "border-l-brand-500" : opp.potentialImpact === "medium" ? "border-l-blue-400" : "border-l-slate-300"
        )}>
          <div className="flex items-start justify-between mb-3">
            <h4 className="text-sm font-bold text-ink-900 flex-1">{opp.opportunity}</h4>
            <div className="flex items-center gap-2 flex-shrink-0 ml-4">
              <span className={cn("badge text-xs", diffColors[opp.difficulty])}>
                {opp.difficulty}
              </span>
              <span className={cn("badge text-xs", impactColors[opp.potentialImpact])}>
                {opp.potentialImpact} impact
              </span>
            </div>
          </div>
          <p className="text-sm text-ink-600 mb-3">{opp.rationale}</p>
          <div className="bg-surface-50 rounded-lg p-3">
            <p className="text-xs font-semibold text-ink-500 mb-1">Suggested Approach</p>
            <p className="text-sm text-ink-700">{opp.suggestedApproach}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function IdeasTab({ ideas }: { ideas: ProductIdea[] }) {
  const diffColors: Record<string, string> = {
    low: "text-emerald-600",
    medium: "text-amber-600",
    high: "text-red-600",
  };

  return (
    <div className="space-y-4">
      {ideas.map((idea, i) => (
        <div key={i} className="card p-6 border-l-4 border-l-violet-400 hover:shadow-card-hover transition-shadow">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h4 className="text-base font-bold text-ink-900 mb-1">{idea.idea}</h4>
              <span className={cn("text-xs font-medium", diffColors[idea.estimatedDifficulty])}>
                {idea.estimatedDifficulty} difficulty
              </span>
            </div>
            <Lightbulb className="w-5 h-5 text-violet-400 flex-shrink-0" />
          </div>
          <p className="text-sm text-ink-700 mb-4">{idea.description}</p>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-ink-400 mb-1">Target Audience</p>
              <p className="text-sm text-ink-700">{idea.targetAudience}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-ink-400 mb-1">Market Gap</p>
              <p className="text-sm text-ink-700">{idea.marketGap}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-ink-400 mb-1">Competitive Advantage</p>
              <p className="text-sm text-ink-700">{idea.competitiveAdvantage}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-ink-400 mb-1">Revenue Model</p>
              <p className="text-sm text-ink-700">{idea.revenueModel}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
