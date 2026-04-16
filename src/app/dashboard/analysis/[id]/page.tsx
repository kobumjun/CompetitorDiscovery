"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  ArrowLeft,
  ExternalLink,
  FileText,
  ListFilter,
  MessageSquare,
  Search,
  Target,
  UserRoundSearch,
  XCircle,
  Loader2,
  Sparkles,
  Layers,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import type { Analysis, AnalysisResult, Lead, IntentBreakdownItem, ProblemCategoryBreakdownItem, OutreachAngleItem, DraftMessageItem } from "@/types";

type TabKey = "overview" | "leads" | "intents" | "problems" | "outreach" | "drafts";

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "overview", label: "Overview", icon: FileText },
  { key: "leads", label: "Leads", icon: UserRoundSearch },
  { key: "intents", label: "Intent Types", icon: ListFilter },
  { key: "problems", label: "Problem Categories", icon: Search },
  { key: "outreach", label: "Outreach Angles", icon: Target },
  { key: "drafts", label: "Draft Messages", icon: MessageSquare },
];

const intentLabel: Record<string, string> = {
  looking_for_service: "Looking for service",
  asking_for_recommendation: "Asking for recommendation",
  expressing_pain_point: "Expressing pain point",
  comparing_tools: "Comparing tools",
  actively_evaluating: "Actively evaluating",
  potential_future_need: "Potential future need",
};

const problemLabel: Record<string, string> = {
  web_development: "Web development",
  design: "Design",
  automation: "Automation",
  ai_tooling: "AI tooling",
  marketing: "Marketing",
  lead_generation: "Lead generation",
  operations: "Operations",
  other: "Other",
};

export default function AnalysisPage() {
  const params = useParams();
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  const fetchAnalysis = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.from("analyses").select("*").eq("id", params.id).single();
    if (data) {
      setAnalysis(data as Analysis);
      if (data.status === "completed" || data.status === "failed") setLoading(false);
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

  if (loading && !analysis) return <LoadingState />;
  if (!analysis) return <NotFoundState />;
  if (analysis.status === "processing" || analysis.status === "pending") return <ProcessingState />;
  if (analysis.status === "failed") return <FailedState />;

  const results = analysis.results as AnalysisResult;
  if (!results) return <NotFoundState />;

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="mb-6">
        <Link href="/dashboard" className="btn-ghost -ml-3 text-ink-500 mb-4 inline-flex">
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-ink-900">
              Lead extraction from @{results.threadInfo.authorHandle}&apos;s thread
            </h1>
            <p className="text-sm text-ink-500 mt-1">
              Analyzed on {formatDate(results.threadInfo.analyzedAt)}
            </p>
          </div>
          <a href={analysis.post_url} target="_blank" rel="noopener noreferrer" className="btn-ghost text-sm">
            View Thread
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <StatCard title="Total Leads" value={results.leadSummary.totalLeads} />
        <StatCard title="High Intent" value={results.leadSummary.highIntentLeads} color="text-emerald-600" />
        <StatCard title="Medium Intent" value={results.leadSummary.mediumIntentLeads} color="text-amber-600" />
        <StatCard title="Low Intent" value={results.leadSummary.lowIntentLeads} color="text-slate-500" />
      </div>

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

      <div className="animate-in">
        {activeTab === "overview" && <OverviewTab results={results} />}
        {activeTab === "leads" && <LeadsTab leads={results.leads} />}
        {activeTab === "intents" && <IntentTab items={results.intentBreakdown} />}
        {activeTab === "problems" && <ProblemsTab items={results.problemCategories} />}
        {activeTab === "outreach" && <OutreachTab items={results.outreachAngles} />}
        {activeTab === "drafts" && <DraftsTab items={results.draftMessages} />}
      </div>
    </div>
  );
}

function LoadingState() {
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

function ProcessingState() {
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
        <h2 className="text-xl font-bold text-ink-900 mb-2">Extracting qualified leads...</h2>
        <p className="text-sm text-ink-500 max-w-md mx-auto">
          Scanning replies for buyer intent, pain points, and outreach-ready prospects.
        </p>
      </div>
    </div>
  );
}

function FailedState() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <Link href="/dashboard" className="btn-ghost mb-6 -ml-3 text-ink-500">
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </Link>
      <div className="card p-16 text-center border-red-200">
        <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-ink-900 mb-2">Lead extraction failed</h2>
        <p className="text-sm text-ink-500 mb-6">
          We could not process this thread. Try another public URL.
        </p>
        <Link href="/dashboard" className="btn-primary">
          Try Another Thread
        </Link>
      </div>
    </div>
  );
}

function NotFoundState() {
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

function StatCard({ title, value, color }: { title: string; value: number; color?: string }) {
  return (
    <div className="stat-card">
      <span className="stat-label">{title}</span>
      <span className={cn("stat-value", color)}>{value}</span>
    </div>
  );
}

function OverviewTab({ results }: { results: AnalysisResult }) {
  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h3 className="text-sm font-semibold text-ink-900 mb-3 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-brand-500" />
          Lead Summary Briefing
        </h3>
        <p className="text-sm text-ink-700 leading-relaxed">{results.briefing.summary}</p>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-5">
          <h4 className="section-title mb-3">Top Intent Signals</h4>
          <ul className="space-y-2">
            {results.briefing.keySignals.map((signal, i) => (
              <li key={i} className="text-sm text-ink-700">- {signal}</li>
            ))}
          </ul>
        </div>
        <div className="card p-5">
          <h4 className="section-title mb-3">Recommended Next Actions</h4>
          <ul className="space-y-2">
            {results.briefing.recommendedNextActions.map((action, i) => (
              <li key={i} className="text-sm text-ink-700">- {action}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function LeadsTab({ leads }: { leads: Lead[] }) {
  const sorted = [...leads].sort((a, b) => b.leadScore - a.leadScore);
  return (
    <div className="space-y-3">
      {sorted.map((lead, i) => (
        <div key={i} className="card p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h4 className="text-sm font-bold text-ink-900">{lead.displayName} @{lead.handle}</h4>
              <p className="text-xs text-ink-400">{intentLabel[lead.intentType] || lead.intentType} · {problemLabel[lead.problemCategory] || lead.problemCategory}</p>
            </div>
            <span className={cn(
              "badge text-xs",
              lead.scoreBand === "high" ? "bg-emerald-50 text-emerald-700" : lead.scoreBand === "medium" ? "bg-amber-50 text-amber-700" : "bg-surface-100 text-ink-600"
            )}>
              {lead.scoreBand.toUpperCase()} {lead.leadScore}
            </span>
          </div>
          <blockquote className="text-sm text-ink-700 border-l-2 border-brand-200 pl-3 mb-3">
            "{lead.quotedText}"
          </blockquote>
          <p className="text-sm text-ink-700 mb-3"><span className="text-ink-400">Outreach angle:</span> {lead.suggestedOutreachAngle}</p>
          {lead.outreachDraft ? (
            <p className="text-sm text-ink-600 bg-surface-50 rounded-lg p-3 mb-3">{lead.outreachDraft}</p>
          ) : null}
          <div className="flex items-center gap-3 text-xs">
            <a href={lead.profileLink} target="_blank" rel="noreferrer" className="text-brand-600 hover:text-brand-700">Profile</a>
            {lead.postLink ? <a href={lead.postLink} target="_blank" rel="noreferrer" className="text-brand-600 hover:text-brand-700">Source Post</a> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function IntentTab({ items }: { items: IntentBreakdownItem[] }) {
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="card p-5">
          <div className="flex justify-between mb-2">
            <span className="text-sm font-semibold text-ink-900">{intentLabel[item.intentType] || item.intentType}</span>
            <span className="text-sm text-ink-500">{item.count} · {item.percentage}%</span>
          </div>
          <div className="h-2 bg-surface-100 rounded-full overflow-hidden">
            <div className="h-full bg-brand-500 rounded-full" style={{ width: `${item.percentage}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function ProblemsTab({ items }: { items: ProblemCategoryBreakdownItem[] }) {
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="card p-5">
          <div className="flex justify-between mb-2">
            <span className="text-sm font-semibold text-ink-900">{problemLabel[item.category] || item.category}</span>
            <span className="text-sm text-ink-500">{item.count} · {item.percentage}%</span>
          </div>
          <div className="h-2 bg-surface-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${item.percentage}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function OutreachTab({ items }: { items: OutreachAngleItem[] }) {
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="card p-5">
          <h4 className="text-sm font-bold text-ink-900 mb-2">{item.angle}</h4>
          <p className="text-sm text-ink-600 mb-3">{item.whyItWorks}</p>
          <div className="flex flex-wrap gap-2">
            {item.bestForIntentTypes.map((intent) => (
              <span key={intent} className="badge bg-brand-50 text-brand-700 text-xs">
                {intentLabel[intent] || intent}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function DraftsTab({ items }: { items: DraftMessageItem[] }) {
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="card p-5">
          <div className="text-xs text-ink-400 mb-2">
            @{item.leadHandle} · {intentLabel[item.intentType] || item.intentType} · {item.channel.toUpperCase()}
          </div>
          <p className="text-sm text-ink-700">{item.message}</p>
        </div>
      ))}
    </div>
  );
}
