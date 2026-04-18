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
  Copy,
  Check,
  Megaphone,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import type {
  Analysis,
  AnalysisResult,
  Lead,
  IntentBreakdownItem,
  ProblemCategoryBreakdownItem,
  OutreachAngleItem,
  DraftMessageItem,
} from "@/types";

type TabKey =
  | "overview"
  | "leads"
  | "intents"
  | "problems"
  | "outreach"
  | "drafts"
  | "pitch";

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

function buildTabs(hasOffer: boolean) {
  const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
    { key: "overview", label: "Overview", icon: FileText },
    { key: "leads", label: "Leads", icon: UserRoundSearch },
    { key: "intents", label: "Intent Types", icon: ListFilter },
    { key: "problems", label: "Problem Categories", icon: Search },
    { key: "outreach", label: "Outreach Angles", icon: Target },
    { key: "drafts", label: "Draft Messages", icon: MessageSquare },
  ];
  if (hasOffer) {
    tabs.push({ key: "pitch", label: "Pitch Preview", icon: Megaphone });
  }
  return tabs;
}

export default function AnalysisPage() {
  const params = useParams();
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
      if (data.status === "completed" || data.status === "failed")
        setLoading(false);
    } else {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchAnalysis();
  }, [fetchAnalysis]);

  useEffect(() => {
    if (
      analysis?.status === "processing" ||
      analysis?.status === "pending"
    ) {
      const interval = setInterval(fetchAnalysis, 3000);
      return () => clearInterval(interval);
    }
  }, [analysis?.status, fetchAnalysis]);

  if (loading && !analysis) return <LoadingState />;
  if (!analysis) return <NotFoundState />;
  if (analysis.status === "processing" || analysis.status === "pending")
    return <ProcessingState />;
  if (analysis.status === "failed") return <FailedState />;

  const results = analysis.results as AnalysisResult;
  if (!results) return <NotFoundState />;

  const hasOffer = !!results.offerContext?.productName;
  const TABS = buildTabs(hasOffer);

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="btn-ghost -ml-3 text-ink-500 mb-4 inline-flex"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-ink-900">
              Lead extraction from @{results.threadInfo.authorHandle}&apos;s
              thread
            </h1>
            <p className="text-sm text-ink-500 mt-1">
              Analyzed on {formatDate(results.threadInfo.analyzedAt)}
              {hasOffer && (
                <>
                  {" "}
                  · Scored for{" "}
                  <strong className="text-ink-700">
                    {results.offerContext!.productName}
                  </strong>
                </>
              )}
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <StatCard
          title="Total Leads"
          value={results.leadSummary.totalLeads}
        />
        <StatCard
          title="High Intent"
          value={results.leadSummary.highIntentLeads}
          color="text-emerald-600"
        />
        <StatCard
          title="Medium Intent"
          value={results.leadSummary.mediumIntentLeads}
          color="text-amber-600"
        />
        <StatCard
          title="Low Intent"
          value={results.leadSummary.lowIntentLeads}
          color="text-slate-500"
        />
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
        {activeTab === "leads" && (
          <LeadsTab leads={results.leads} hasOffer={hasOffer} />
        )}
        {activeTab === "intents" && (
          <IntentTab items={results.intentBreakdown} />
        )}
        {activeTab === "problems" && (
          <ProblemsTab items={results.problemCategories} />
        )}
        {activeTab === "outreach" && (
          <OutreachTab items={results.outreachAngles} />
        )}
        {activeTab === "drafts" && (
          <DraftsTab items={results.draftMessages} />
        )}
        {activeTab === "pitch" && hasOffer && (
          <PitchTab leads={results.leads} />
        )}
      </div>
    </div>
  );
}

/* ---------- Utility states ---------- */

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
        <h2 className="text-xl font-bold text-ink-900 mb-2">
          Extracting qualified leads...
        </h2>
        <p className="text-sm text-ink-500 max-w-md mx-auto">
          Scanning replies for buyer intent, pain points, and outreach-ready
          prospects.
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
        <h2 className="text-xl font-bold text-ink-900 mb-2">
          Lead extraction failed
        </h2>
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

/* ---------- Small UI pieces ---------- */

function StatCard({
  title,
  value,
  color,
}: {
  title: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="stat-card">
      <span className="stat-label">{title}</span>
      <span className={cn("stat-value", color)}>{value}</span>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="text-ink-400 hover:text-brand-600 transition-colors"
      title="Copy to clipboard"
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-emerald-500" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
    </button>
  );
}

function RelevanceBadge({ score, band }: { score: number; band: string }) {
  const color =
    band === "relevant"
      ? "bg-emerald-50 text-emerald-700"
      : band === "partial"
      ? "bg-amber-50 text-amber-700"
      : "bg-surface-100 text-ink-500";
  return (
    <span className={cn("badge text-xs", color)}>
      {band.toUpperCase()} {score}
    </span>
  );
}

/* ---------- Tabs ---------- */

function OverviewTab({ results }: { results: AnalysisResult }) {
  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h3 className="text-sm font-semibold text-ink-900 mb-3 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-brand-500" />
          Lead Summary Briefing
          {results.offerContext?.productName && (
            <span className="text-xs font-normal text-ink-400 ml-1">
              — scored for {results.offerContext.productName}
            </span>
          )}
        </h3>
        <p className="text-sm text-ink-700 leading-relaxed">
          {results.briefing.summary}
        </p>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-5">
          <h4 className="section-title mb-3">Top Intent Signals</h4>
          <ul className="space-y-2">
            {results.briefing.keySignals.map((signal, i) => (
              <li key={i} className="text-sm text-ink-700">
                - {signal}
              </li>
            ))}
          </ul>
        </div>
        <div className="card p-5">
          <h4 className="section-title mb-3">Recommended Next Actions</h4>
          <ul className="space-y-2">
            {results.briefing.recommendedNextActions.map((action, i) => (
              <li key={i} className="text-sm text-ink-700">
                - {action}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function LeadsTab({
  leads,
  hasOffer,
}: {
  leads: Lead[];
  hasOffer: boolean;
}) {
  const [showLowRelevance, setShowLowRelevance] = useState(false);

  const sorted = [...leads].sort((a, b) => {
    if (hasOffer) return b.offerRelevanceScore - a.offerRelevanceScore;
    return b.leadScore - a.leadScore;
  });

  const highRelevance = sorted.filter(
    (l) => l.offerRelevanceBand !== "low"
  );
  const lowRelevance = sorted.filter(
    (l) => l.offerRelevanceBand === "low"
  );

  const displayLeads =
    hasOffer && !showLowRelevance ? highRelevance : sorted;

  return (
    <div className="space-y-3">
      {displayLeads.map((lead, i) => (
        <div
          key={i}
          className={cn(
            "card p-5",
            hasOffer &&
              lead.offerRelevanceBand === "low" &&
              "opacity-60"
          )}
        >
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h4 className="text-sm font-bold text-ink-900">
                {lead.displayName}{" "}
                <span className="font-normal text-ink-500">
                  @{lead.handle}
                </span>
              </h4>
              <p className="text-xs text-ink-400">
                {intentLabel[lead.intentType] || lead.intentType} ·{" "}
                {problemLabel[lead.problemCategory] ||
                  lead.problemCategory}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {hasOffer && (
                <RelevanceBadge
                  score={lead.offerRelevanceScore}
                  band={lead.offerRelevanceBand}
                />
              )}
              <span
                className={cn(
                  "badge text-xs",
                  lead.scoreBand === "high"
                    ? "bg-emerald-50 text-emerald-700"
                    : lead.scoreBand === "medium"
                    ? "bg-amber-50 text-amber-700"
                    : "bg-surface-100 text-ink-600"
                )}
              >
                {lead.scoreBand.toUpperCase()} {lead.leadScore}
              </span>
            </div>
          </div>
          <blockquote className="text-sm text-ink-700 border-l-2 border-brand-200 pl-3 mb-3">
            &ldquo;{lead.quotedText}&rdquo;
          </blockquote>
          {hasOffer && lead.relevanceReason && (
            <p className="text-xs text-brand-700 bg-brand-50 rounded-lg px-3 py-2 mb-3">
              <strong>Relevance:</strong> {lead.relevanceReason}
            </p>
          )}
          <p className="text-sm text-ink-700 mb-3">
            <span className="text-ink-400">Outreach angle:</span>{" "}
            {lead.suggestedOutreachAngle}
          </p>
          {lead.outreachDraft && (
            <div className="flex items-start gap-2 mb-3">
              <p className="text-sm text-ink-600 bg-surface-50 rounded-lg p-3 flex-1">
                {lead.outreachDraft}
              </p>
              <CopyButton text={lead.outreachDraft} />
            </div>
          )}
          <div className="flex items-center gap-3 text-xs">
            <a
              href={lead.profileLink}
              target="_blank"
              rel="noreferrer"
              className="text-brand-600 hover:text-brand-700"
            >
              Profile
            </a>
            {lead.postLink && (
              <a
                href={lead.postLink}
                target="_blank"
                rel="noreferrer"
                className="text-brand-600 hover:text-brand-700"
              >
                Source Post
              </a>
            )}
            <a
              href={`https://x.com/messages/compose?recipient_id=${lead.handle}`}
              target="_blank"
              rel="noreferrer"
              className="text-brand-600 hover:text-brand-700"
            >
              Send DM
            </a>
          </div>
        </div>
      ))}

      {hasOffer && lowRelevance.length > 0 && !showLowRelevance && (
        <button
          type="button"
          onClick={() => setShowLowRelevance(true)}
          className="text-sm text-ink-500 hover:text-ink-700 w-full text-center py-4"
        >
          Show {lowRelevance.length} low-relevance lead
          {lowRelevance.length > 1 ? "s" : ""}
        </button>
      )}
    </div>
  );
}

function IntentTab({ items }: { items: IntentBreakdownItem[] }) {
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="card p-5">
          <div className="flex justify-between mb-2">
            <span className="text-sm font-semibold text-ink-900">
              {intentLabel[item.intentType] || item.intentType}
            </span>
            <span className="text-sm text-ink-500">
              {item.count} · {item.percentage}%
            </span>
          </div>
          <div className="h-2 bg-surface-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-500 rounded-full"
              style={{ width: `${item.percentage}%` }}
            />
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
            <span className="text-sm font-semibold text-ink-900">
              {problemLabel[item.category] || item.category}
            </span>
            <span className="text-sm text-ink-500">
              {item.count} · {item.percentage}%
            </span>
          </div>
          <div className="h-2 bg-surface-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full"
              style={{ width: `${item.percentage}%` }}
            />
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
          <h4 className="text-sm font-bold text-ink-900 mb-2">
            {item.angle}
          </h4>
          <p className="text-sm text-ink-600 mb-3">{item.whyItWorks}</p>
          <div className="flex flex-wrap gap-2">
            {item.bestForIntentTypes.map((intent) => (
              <span
                key={intent}
                className="badge bg-brand-50 text-brand-700 text-xs"
              >
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
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <div className="text-xs text-ink-400 mb-2">
                @{item.leadHandle} ·{" "}
                {intentLabel[item.intentType] || item.intentType} ·{" "}
                {item.channel.toUpperCase()}
              </div>
              <p className="text-sm text-ink-700">{item.message}</p>
            </div>
            <CopyButton text={item.message} />
          </div>
        </div>
      ))}
    </div>
  );
}

function PitchTab({ leads }: { leads: Lead[] }) {
  const pitched = leads.filter((l) => l.customPitchMessage);
  const sorted = [...pitched].sort(
    (a, b) => b.offerRelevanceScore - a.offerRelevanceScore
  );

  if (sorted.length === 0) {
    return (
      <div className="card p-12 text-center">
        <Megaphone className="w-10 h-10 text-ink-300 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-ink-700 mb-1">
          No custom pitches generated
        </h3>
        <p className="text-sm text-ink-400">
          Pitches are generated when your offer profile matches detected leads.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sorted.map((lead, i) => (
        <div key={i} className="card p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h4 className="text-sm font-bold text-ink-900">
                {lead.displayName}{" "}
                <span className="font-normal text-ink-500">
                  @{lead.handle}
                </span>
              </h4>
              <p className="text-xs text-ink-400 mt-0.5">
                {intentLabel[lead.intentType] || lead.intentType}
              </p>
            </div>
            <RelevanceBadge
              score={lead.offerRelevanceScore}
              band={lead.offerRelevanceBand}
            />
          </div>

          {lead.relevanceReason && (
            <p className="text-xs text-brand-700 bg-brand-50 rounded-lg px-3 py-2 mb-3">
              {lead.relevanceReason}
            </p>
          )}

          <div className="bg-surface-50 rounded-lg p-4 mb-3">
            <p className="text-sm text-ink-700 leading-relaxed">
              {lead.customPitchMessage}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <CopyButton text={lead.customPitchMessage!} />
            <a
              href={`https://x.com/messages/compose?recipient_id=${lead.handle}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-brand-600 hover:text-brand-700"
            >
              Open X DM →
            </a>
            <a
              href={lead.profileLink}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-brand-600 hover:text-brand-700"
            >
              Profile
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}
