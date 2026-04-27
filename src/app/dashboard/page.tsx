"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSWRConfig } from "swr";
import { createClient } from "@/lib/supabase/client";
import { fireSignupConversion } from "@/lib/gtag";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  FileText,
  Mail,
  Search,
  Send,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { INITIAL_FREE_CREDITS } from "@/types";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { ExtractedLead, OutreachType, Proposal } from "@/types";
import { formatCurrency } from "@/types";
import { DASHBOARD_CREDITS_KEY } from "@/lib/use-dashboard-credits";
import { EmailCountStepper } from "@/components/email-count-stepper";

type ProspectLead = {
  email: string;
  source_url: string;
  company_name: string;
  lead_id: string;
  client_id: string;
};

type BulkPayload = {
  success: boolean;
  requestedCount: number;
  searchedCount: number;
  processedCount: number;
  successfulUrls: number;
  failedUrls: number;
  creditsReserved: number;
  creditsUsed: number;
  creditsRefunded: number;
  creditsRemaining: number;
  leads: ProspectLead[];
  failed?: { url: string; reason: string }[];
  message?: string;
  stats?: {
    newEmails: number;
    duplicatesSkipped: number;
    websitesCrawled: number;
    candidateUrlsTotal: number;
    creditsUsed: number;
    creditsRefunded: number;
    plannerQueryCount?: number;
  };
  duplicateLeads?: { email: string; company_name: string; source_url: string; duplicate?: boolean }[];
  generatedSearchQueries?: string[];
};

type RowComposerState = {
  open: boolean;
  outreachType: OutreachType;
  writeMode: "ai" | "manual";
  context: string;
  subject: string;
  body: string;
  generating: boolean;
  error: string | null;
  notice: string | null;
};

const STATUS_COLOR: Record<string, string> = {
  draft: "bg-surface-100 text-ink-600",
  sent: "bg-blue-50 text-blue-700",
  viewed: "bg-amber-50 text-amber-700",
  accepted: "bg-emerald-50 text-emerald-700",
  rejected: "bg-red-50 text-red-700",
  expired: "bg-surface-100 text-ink-400",
};

const OUTREACH_TYPES: { key: OutreachType; label: string }[] = [
  { key: "proposal", label: "Proposal" },
  { key: "pitch", label: "Sales Pitch" },
  { key: "investment", label: "Investment Ask" },
  { key: "quote", label: "Quote" },
];

function defaultComposer(): RowComposerState {
  return {
    open: false,
    outreachType: "proposal",
    writeMode: "manual",
    context: "",
    subject: "",
    body: "",
    generating: false,
    error: null,
    notice: null,
  };
}

export default function DashboardPage() {
  const { mutate: mutateGlobal } = useSWRConfig();
  const searchParams = useSearchParams();
  const signupFiredRef = useRef(false);

  useEffect(() => {
    if (signupFiredRef.current) return;
    if (searchParams.get("new_signup") === "1") {
      signupFiredRef.current = true;
      fireSignupConversion();
    }
  }, [searchParams]);

  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [recentLeads, setRecentLeads] = useState<ExtractedLead[]>([]);
  const [leadCount, setLeadCount] = useState(0);
  const [credits, setCredits] = useState<number | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [urlFallback, setUrlFallback] = useState("");
  const [openUrlFallback, setOpenUrlFallback] = useState(false);
  const [prospectLoading, setProspectLoading] = useState(false);
  const [targetCount, setTargetCount] = useState(3);
  const [progress, setProgress] = useState<string | null>(null);
  const [processingCounter, setProcessingCounter] = useState(0);
  const [prospectError, setProspectError] = useState<string | null>(null);
  const [prospectResult, setProspectResult] = useState<BulkPayload | null>(null);
  const [rowComposers, setRowComposers] = useState<Record<string, RowComposerState>>({});
  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setUserEmail(user.email || null);

      const [proposalsRes, creditsRes, leadCountRes, recentLeadsRes] = await Promise.all([
        supabase
          .from("proposals")
          .select("*, client:clients(*)")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(3),
        supabase.from("users").select("credits").eq("id", user.id).single(),
        supabase.from("extracted_leads").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase
          .from("extracted_leads")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(3),
      ]);

      if (proposalsRes.data) setProposals(proposalsRes.data as Proposal[]);
      if (creditsRes.data) setCredits(creditsRes.data.credits);
      setLeadCount(leadCountRes.count ?? 0);
      if (recentLeadsRes.data) setRecentLeads(recentLeadsRes.data as ExtractedLead[]);
      setLoading(false);
    }
    fetchData();
  }, []);

  const queryHasEmail = query.includes("@");
  const queryHasUrl = /https?:\/\/|www\.|\.com\b|\.io\b|\.org\b|\.net\b/i.test(query);
  const queryInputError = queryHasEmail
    ? "This isn't for email addresses — describe who you want to reach in plain words."
    : queryHasUrl
      ? "Looks like a URL — use 'Already have a list of URLs? Extract in bulk' below."
      : null;

  /** Steer users toward "who to pitch" (blogs, agencies, etc.), not product-only. */
  const recipientHint =
    /blog|newsletter|agenc|agencies|websites?|companies?|cafes?|cafe|restaurant|communities?|media|partners?|that may|may need|to contact|pitch|operators?|publishers?|sites?/i;
  const showTargetRecipientHint =
    query.trim().length > 0 &&
    !queryInputError &&
    !recipientHint.test(query) &&
    query.trim().length < 120 &&
    query.trim().split(/\s+/).length <= 8;

  const total = proposals.length;
  const sent = proposals.filter((p) => p.status === "sent" || p.status === "viewed").length;
  const accepted = proposals.filter((p) => p.status === "accepted").length;
  const winRate = total > 0 ? Math.round((accepted / total) * 100) : 0;
  const hasCreatedAnything = leadCount > 0 || proposals.length > 0;

  function withSignature(content: string) {
    const signature = userEmail ? `\n\n---\n${userEmail}` : "";
    return `${content}${signature}`;
  }

  function rowKeyFor(row: ProspectLead) {
    return `${row.lead_id}:${row.email}`;
  }

  function updateComposer(rowKey: string, updater: (prev: RowComposerState) => RowComposerState) {
    setRowComposers((prev) => {
      const current = prev[rowKey] ?? defaultComposer();
      return { ...prev, [rowKey]: updater(current) };
    });
  }

  async function handleFindProspects() {
    const selectedTarget = query.trim();
    if (!selectedTarget) return;
    const count = Math.min(10, Math.max(1, targetCount));
    setProspectLoading(true);
    setProspectError(null);
    setProspectResult(null);
    setRowComposers({});
    setProcessingCounter(0);
    setProgress("Searching for prospects...");
    const timerA = setTimeout(() => setProgress("Found companies. Extracting emails..."), 2000);
    const timerB = setTimeout(() => setProgress("Almost done..."), 5000);
    const counterTimer = setInterval(() => {
      setProcessingCounter((prev) => Math.min(prev + 1, count));
    }, 2000);

    try {
      const searchRes = await fetch("/api/search-prospects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: selectedTarget, requestedCount: count }),
      });
      const searchPayload = await searchRes.json();
      if (!searchRes.ok) {
        setProspectError(searchPayload.error || "Search service unavailable. Please try again later.");
        return;
      }
      const payload = searchPayload as BulkPayload;
      setProspectResult(payload);
      setProcessingCounter(payload.leads.length);
      setProgress(payload.message || "Done!");
      if (
        payload.leads.length === 0 &&
        !(payload.stats && payload.stats.duplicatesSkipped > 0)
      ) {
        setProspectError(
          `No emails found — all ${payload.creditsReserved} credits refunded. Try different keywords.`
        );
      } else {
        setProspectError(null);
      }
      if (typeof payload.creditsRemaining === "number") {
        setCredits(payload.creditsRemaining);
        void mutateGlobal(DASHBOARD_CREDITS_KEY, payload.creditsRemaining, false);
      }
    } catch {
      setProspectError("Search service unavailable. Please try again later.");
    } finally {
      clearTimeout(timerA);
      clearTimeout(timerB);
      clearInterval(counterTimer);
      setProspectLoading(false);
      setTimeout(() => setProgress(null), 1200);
    }
  }

  async function handleGenerateAi(row: ProspectLead) {
    const key = rowKeyFor(row);
    const composer = rowComposers[key] ?? defaultComposer();
    updateComposer(key, (prev) => ({ ...prev, generating: true, error: null, notice: null }));
    try {
      const res = await fetch("/api/outreach/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: row.lead_id,
          type: composer.outreachType,
          context: composer.context,
          recipientEmails: [row.email],
        }),
      });
      const payload = await res.json();
      if (!res.ok) {
        updateComposer(key, (prev) => ({ ...prev, generating: false, error: payload.error || "Failed to generate email." }));
        return;
      }

      updateComposer(key, (prev) => ({
        ...prev,
        generating: false,
        subject: payload.subject || "",
        body: payload.body || "",
      }));

      if (typeof payload.remainingCredits === "number") {
        setCredits(payload.remainingCredits);
        void mutateGlobal(DASHBOARD_CREDITS_KEY, payload.remainingCredits, false);
      }
    } catch {
      updateComposer(key, (prev) => ({ ...prev, generating: false, error: "Unexpected error while generating email." }));
    }
  }

  function openInMail(row: ProspectLead) {
    const key = rowKeyFor(row);
    const composer = rowComposers[key];
    if (!composer || !composer.subject.trim() || !composer.body.trim()) return;
    const encodedSubject = encodeURIComponent(composer.subject.trim());
    const encodedBody = encodeURIComponent(withSignature(composer.body.trim()));
    window.location.href = `mailto:${encodeURIComponent(row.email)}?subject=${encodedSubject}&body=${encodedBody}`;
    updateComposer(key, (prev) => ({ ...prev, notice: "Opened your default email client." }));
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-display sm:font-black">Dashboard</h1>
        <p className="text-ink-500 mt-1">Your proposal command center</p>
      </div>

      <section className={cn("mb-8 rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 to-white", hasCreatedAnything ? "p-5 sm:p-6" : "p-6 sm:p-8")}>
        <h2 className={cn("font-black text-ink-900", hasCreatedAnything ? "text-2xl sm:text-3xl" : "text-3xl sm:text-4xl")}>
          Find your first leads in 10 seconds
        </h2>
        <p className="mt-2 text-sm sm:text-base text-ink-600">
          Enter the type of customers, partners, websites, blogs, communities, or companies you want to contact — not
          what you sell.
        </p>
        {credits !== null && credits >= INITIAL_FREE_CREDITS && !hasCreatedAnything && (
          <p className="mt-3 text-sm font-medium text-orange-700">👇 Click one to try it now</p>
        )}
        <div className={cn("mt-3 flex flex-wrap gap-2", credits !== null && credits >= INITIAL_FREE_CREDITS && !hasCreatedAnything ? "" : "mt-4")}>
          {[
            "cafes that may need coffee machines",
            "Japanese learning blogs",
            "AI automation agencies",
            "crypto finance media sites",
          ].map((text) => (
            <button
              key={text}
              type="button"
              disabled={prospectLoading}
              className={cn(
                "inline-flex items-center rounded-lg border px-3 py-2 text-left transition-colors disabled:opacity-50",
                credits !== null && credits >= INITIAL_FREE_CREDITS && !hasCreatedAnything
                  ? "bg-orange-100 border-orange-300 hover:bg-orange-200"
                  : "bg-orange-50 border-orange-200 hover:bg-orange-100"
              )}
              onClick={() => setQuery(text)}
            >
              <span className={cn("text-xs sm:text-sm text-orange-700", credits !== null && credits >= INITIAL_FREE_CREDITS && !hasCreatedAnything ? "font-medium" : "italic")}>
                {text}
              </span>
            </button>
          ))}
        </div>
        <label className="mt-4 block text-sm font-medium text-ink-700">Who should receive your pitch?</label>
        <input
          className={cn("input-field mt-2 h-12", queryInputError && "border-red-300 focus:border-red-400 focus:ring-red-200")}
          placeholder="e.g. cafes that may need coffee machines, Japanese learning blogs, AI automation agencies, crypto finance media sites"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleFindProspects();
          }}
        />
        {queryInputError && (
          <p className="mt-1.5 text-sm text-red-600">{queryInputError}</p>
        )}
        {showTargetRecipientHint && (
          <p className="mt-1.5 text-sm text-amber-800/90">
            Tip: name <span className="font-medium">who you want to contact or pitch</span> (e.g. cafes that may need
            coffee machines, or Japanese learning blogs) — not only a product like “coffee machines” by itself.
          </p>
        )}
        <div className="mt-4">
          <p className="text-sm font-medium text-ink-700 mb-2">How many emails to find?</p>
          <EmailCountStepper value={targetCount} onChange={setTargetCount} maxCredits={credits} disabled={prospectLoading} />
        </div>
        <button
          type="button"
          className="mt-3 inline-flex w-full sm:w-auto items-center justify-center rounded-lg bg-orange-500 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
          onClick={() => void handleFindProspects()}
          disabled={prospectLoading || !query.trim() || !!queryInputError || credits === 0 || (credits !== null && targetCount > credits)}
        >
          <Search className="w-4 h-4 mr-1.5" />
          Find {targetCount} Target Emails
          <ArrowRight className="w-4 h-4 ml-1.5" />
        </button>
        <p className="mt-2 text-xs text-ink-500">
          Uses {targetCount} credit{targetCount !== 1 ? "s" : ""}. Unused credits refunded if fewer emails are found.
        </p>

        <div className="mt-4 rounded-lg border border-surface-200 bg-white">
          <button
            className="w-full px-4 py-3 text-left text-sm font-medium text-ink-700 flex items-center justify-between"
            onClick={() => setOpenUrlFallback((v) => !v)}
          >
            Already have a list of URLs? Extract in bulk
            <ChevronDown className={cn("w-4 h-4 transition-transform", openUrlFallback && "rotate-180")} />
          </button>
          {openUrlFallback && (
            <div className="px-4 pb-4">
              <textarea
                className="input-field min-h-28"
                placeholder="Paste URLs here, one per line..."
                value={urlFallback}
                onChange={(e) => setUrlFallback(e.target.value)}
              />
              <Link
                href={urlFallback.trim() ? `/dashboard/find-contacts?urls=${encodeURIComponent(urlFallback.trim())}` : "/dashboard/find-contacts"}
                className="btn-secondary mt-2 inline-flex"
              >
                Go to Find Contacts
              </Link>
            </div>
          )}
        </div>

        {progress && (
          <div className="mt-3 space-y-1.5">
            <div className="flex items-center gap-2">
              {prospectLoading && (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-orange-300 border-t-orange-600" />
              )}
              <p className="text-sm font-medium text-brand-700">{progress}</p>
            </div>
            {prospectLoading && processingCounter > 0 && (
              <p className="text-xs text-ink-500">Found {processingCounter} of {targetCount} emails...</p>
            )}
          </div>
        )}
        {prospectError && <p className="mt-3 text-sm text-red-600">{prospectError}</p>}
      </section>

      {prospectResult && (
        <section className="card p-4 mb-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-emerald-700 font-medium">
              {prospectResult.message
                ? prospectResult.message
                : prospectResult.creditsUsed === 0
                  ? `No emails found — all ${prospectResult.creditsReserved} credits refunded. Try different keywords.`
                  : prospectResult.creditsRefunded > 0
                    ? `✓ Found ${prospectResult.creditsUsed} of ${prospectResult.creditsReserved} emails — ${prospectResult.creditsUsed} credits used, ${prospectResult.creditsRefunded} credits refunded`
                    : `✓ Found ${prospectResult.creditsUsed} emails — ${prospectResult.creditsUsed} credits used`}
            </p>
            <Link href="/dashboard/find-contacts" className="text-sm font-medium text-brand-600 hover:text-brand-700">
              View all in Find Contacts →
            </Link>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-ink-500 border-b border-surface-200">
                <tr>
                  <th className="py-2 pr-2">Email</th>
                  <th className="py-2 pr-2">Company</th>
                  <th className="py-2 pr-2">Source URL</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {prospectResult.leads.map((row) => {
                  const key = rowKeyFor(row);
                  const composer = rowComposers[key] ?? defaultComposer();
                  return (
                    <Fragment key={key}>
                      <tr className="border-b border-surface-100">
                        <td className="py-2 pr-2 text-ink-800">{row.email}</td>
                        <td className="py-2 pr-2 text-ink-700">{row.company_name}</td>
                        <td className="py-2 pr-2">
                          <a className="text-brand-600 hover:underline" href={row.source_url} target="_blank" rel="noreferrer">
                            {row.source_url}
                          </a>
                        </td>
                        <td className="py-2">
                          <div className="flex items-center gap-1.5">
                            <button
                              className="inline-flex items-center rounded-md bg-orange-500 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-orange-600"
                              onClick={() => updateComposer(key, (prev) => ({ ...prev, open: !prev.open }))}
                            >
                              {composer.open ? "Close" : "Write Email"}
                            </button>
                            <button
                              className="p-1.5 rounded-md text-ink-500 hover:bg-surface-100 hover:text-ink-700"
                              onClick={() => void navigator.clipboard.writeText(row.email)}
                              title="Copy Email"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                            <a
                              href={`mailto:${row.email}`}
                              className="p-1.5 rounded-md text-ink-500 hover:bg-surface-100 hover:text-ink-700"
                              title="Open in Mail"
                            >
                              <Mail className="w-4 h-4" />
                            </a>
                          </div>
                        </td>
                      </tr>
                      <tr className="border-b border-surface-100">
                        <td colSpan={4} className="p-0">
                          <div className={cn("overflow-hidden transition-all duration-300 ease-out", composer.open ? "max-h-[1200px] opacity-100" : "max-h-0 opacity-0")}>
                            <div className="bg-orange-50/30 border-l-2 border-orange-400 px-4 py-4 sm:px-5 sm:py-5">
                              <div className="rounded-lg border border-surface-200 bg-white p-4 space-y-3">
                                <div className="text-sm font-medium text-ink-800">Choose email type:</div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                  {OUTREACH_TYPES.map((item) => (
                                    <button
                                      key={item.key}
                                      type="button"
                                      onClick={() => updateComposer(key, (prev) => ({ ...prev, outreachType: item.key }))}
                                      className={cn("btn-secondary text-xs justify-center", composer.outreachType === item.key && "bg-brand-50 border-brand-300 text-brand-700")}
                                    >
                                      {item.label}
                                    </button>
                                  ))}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  <button
                                    type="button"
                                    onClick={() => updateComposer(key, (prev) => ({ ...prev, writeMode: "manual" }))}
                                    className={cn("btn-secondary justify-center", composer.writeMode === "manual" && "bg-brand-50 border-brand-300 text-brand-700")}
                                  >
                                    ✍️ Write manually (free)
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => updateComposer(key, (prev) => ({ ...prev, writeMode: "ai" }))}
                                    className={cn("btn-secondary justify-center", composer.writeMode === "ai" && "bg-brand-50 border-brand-300 text-brand-700")}
                                  >
                                    ✨ Generate with AI (1 credit)
                                  </button>
                                </div>

                                {composer.writeMode === "ai" && (
                                  <div className="space-y-2">
                                    <textarea
                                      className="input-field min-h-24"
                                      value={composer.context}
                                      onChange={(e) => updateComposer(key, (prev) => ({ ...prev, context: e.target.value }))}
                                      placeholder="Specific context for this outreach..."
                                    />
                                    <button className="btn-primary" onClick={() => handleGenerateAi(row)} disabled={composer.generating}>
                                      <Sparkles className="w-4 h-4" />
                                      {composer.generating ? "Generating..." : "Generate Email with AI (1 credit)"}
                                    </button>
                                  </div>
                                )}

                                <input
                                  className="input-field"
                                  value={composer.subject}
                                  onChange={(e) => updateComposer(key, (prev) => ({ ...prev, subject: e.target.value }))}
                                  placeholder="Email subject line"
                                />
                                <textarea
                                  className="input-field min-h-36"
                                  value={composer.body}
                                  onChange={(e) => updateComposer(key, (prev) => ({ ...prev, body: e.target.value }))}
                                  placeholder="Write your email here..."
                                />
                                {composer.subject && composer.body && (
                                  <div className="rounded-xl border border-surface-200 bg-white shadow-sm">
                                    <div className="px-4 py-3 border-b border-surface-200">
                                      <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Subject</p>
                                      <p className="text-sm font-semibold text-ink-900 mt-1 break-words">{composer.subject}</p>
                                    </div>
                                    <div className="px-4 py-3 max-h-60 overflow-y-auto">
                                      <p className="text-sm text-ink-700 whitespace-pre-wrap leading-relaxed">{composer.body}</p>
                                    </div>
                                  </div>
                                )}
                                <button
                                  className="btn-primary"
                                  onClick={() => openInMail(row)}
                                  disabled={!composer.subject.trim() || !composer.body.trim()}
                                >
                                  <Mail className="w-4 h-4" />
                                  Open in Mail
                                </button>
                                {composer.error && <p className="text-sm text-red-600">{composer.error}</p>}
                                {composer.notice && <p className="text-sm text-emerald-700">{composer.notice}</p>}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {hasCreatedAnything && (
        <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
          <StatCard icon={FileText} label="Total Proposals" value={total} />
          <StatCard icon={Send} label="Sent" value={sent} />
          <StatCard icon={CheckCircle2} label="Accepted" value={accepted} color="text-emerald-600" />
          <StatCard icon={TrendingUp} label="Win Rate" value={`${winRate}%`} />
        </div>
      )}

      {credits !== null && (
        <div className={cn("card p-4 mb-8", credits === 0 ? "border-red-200 bg-red-50" : credits <= 3 ? "border-amber-200 bg-amber-50" : "")}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3 sm:items-center">
              <Sparkles className={cn("w-5 h-5 flex-shrink-0", credits === 0 ? "text-red-500" : credits <= 3 ? "text-amber-500" : "text-brand-500")} />
              <span className="text-sm text-ink-700">
                {credits === 0 ? (
                  <span className="text-red-700 font-medium">No credits remaining</span>
                ) : (
                  <>
                    <strong className={cn("text-ink-900", credits <= 3 && "text-amber-800")}>{credits}</strong>{" "}
                    credit{credits !== 1 ? "s" : ""} remaining
                  </>
                )}
              </span>
            </div>
            <Link href="/pricing" className={cn("flex w-full flex-shrink-0 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-center text-sm font-semibold transition-colors sm:ml-4 sm:w-auto sm:justify-center", credits <= 3 ? "bg-brand-500 text-white hover:bg-brand-600" : "text-brand-600 hover:text-brand-700 hover:bg-brand-50")}>
              Upgrade Plan
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
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
            <p className="text-sm text-ink-400">Start with Smart Prospect Finder to see your first results.</p>
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
                      <Link key={lead.id} href={`/dashboard/leads/${lead.id}`} className="card-hover group flex items-center justify-between p-4">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-ink-800">{lead.company_name || lead.source_url}</div>
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
                    <Link key={p.id} href={`/dashboard/proposals/${p.id}`} className="card-hover group flex flex-col gap-2 p-4">
                      <div className="truncate text-sm font-medium text-ink-800">{p.title}</div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className={cn("badge text-xs", STATUS_COLOR[p.status])}>{p.status}</span>
                        {p.total_amount && <span className="text-xs text-ink-500 font-medium">{formatCurrency(p.total_amount, p.currency)}</span>}
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
