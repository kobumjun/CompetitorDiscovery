"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSWRConfig } from "swr";
import { createClient } from "@/lib/supabase/client";
import { fireSignupConversion } from "@/lib/gtag";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Loader2,
  Mail,
  Search,
  Sparkles,
} from "lucide-react";
import { INITIAL_FREE_CREDITS } from "@/types";
import { cn } from "@/lib/utils";
import type { OutreachType } from "@/types";
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
  postSendSuccess: boolean;
  sentToEmail: string | null;
};

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
    postSendSuccess: false,
    sentToEmail: null,
  };
}

async function fetchUsageStatsForModal(): Promise<{ prospects: number; sent: number }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { prospects: 0, sent: 0 };

  const [{ count: prospectCount }, { data: leadRows }] = await Promise.all([
    supabase.from("extracted_leads").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("extracted_leads").select("id").eq("user_id", user.id),
  ]);

  const ids = (leadRows ?? []).map((r) => r.id as string);
  let sentTotal = 0;
  const batch = 200;
  for (let i = 0; i < ids.length; i += batch) {
    const slice = ids.slice(i, i + batch);
    if (slice.length === 0) break;
    const { count } = await supabase.from("outreaches").select("id", { count: "exact", head: true }).in("lead_id", slice);
    sentTotal += count ?? 0;
  }

  return { prospects: prospectCount ?? 0, sent: sentTotal };
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
  const [sessionSentRowKeys, setSessionSentRowKeys] = useState<Record<string, boolean>>({});
  const [creditsExhaustedModalOpen, setCreditsExhaustedModalOpen] = useState(false);
  const [usageStatsForModal, setUsageStatsForModal] = useState<{ prospects: number; sent: number } | null>(null);
  const searchSectionRef = useRef<HTMLDivElement>(null);
  const queryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setUserEmail(user.email || null);

      const [creditsRes, leadCountRes] = await Promise.all([
        supabase.from("users").select("credits").eq("id", user.id).single(),
        supabase.from("extracted_leads").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      ]);

      if (creditsRes.data) setCredits(creditsRes.data.credits);
      setLeadCount(leadCountRes.count ?? 0);
      setLoading(false);
    }
    fetchData();
  }, []);

  const queryHasEmail = query.includes("@");
  const queryHasUrl = /https?:\/\/|www\.|\.com\b|\.io\b|\.org\b|\.net\b/i.test(query);
  const queryInputError = queryHasEmail
    ? "This isn't for email addresses — describe the type of business you sell to instead."
    : queryHasUrl
      ? "Looks like a URL — use 'Already have a list of URLs? Extract in bulk' below."
      : null;

  const hasCreatedAnything = leadCount > 0;

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

  function openComposerForRow(rowKey: string) {
    setRowComposers((prev) => {
      const next: Record<string, RowComposerState> = {};
      for (const [k, v] of Object.entries(prev)) {
        next[k] = { ...v, open: false, postSendSuccess: false, sentToEmail: null };
      }
      const current = prev[rowKey] ?? defaultComposer();
      next[rowKey] = {
        ...current,
        open: true,
        postSendSuccess: false,
        sentToEmail: null,
        error: null,
        notice: null,
      };
      return next;
    });
  }

  function scrollToSearchAndFocus() {
    searchSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => queryInputRef.current?.focus(), 400);
  }

  function openNextUnsentProspect(currentKey: string) {
    if (!prospectResult?.leads.length) return;
    const keys = prospectResult.leads.map((r) => rowKeyFor(r));
    const idx = keys.indexOf(currentKey);
    for (let i = idx + 1; i < keys.length; i++) {
      const k = keys[i];
      if (!sessionSentRowKeys[k]) {
        openComposerForRow(k);
        return;
      }
    }
    scrollToSearchAndFocus();
  }

  async function openCreditsExhaustedModal() {
    setCreditsExhaustedModalOpen(true);
    setUsageStatsForModal(null);
    try {
      const stats = await fetchUsageStatsForModal();
      setUsageStatsForModal(stats);
    } catch {
      setUsageStatsForModal({ prospects: leadCount, sent: 0 });
    }
  }

  async function tryFindProspects() {
    if (credits === 0) {
      void openCreditsExhaustedModal();
      return;
    }
    await handleFindProspects();
  }

  async function handleFindProspects() {
    const selectedTarget = query.trim();
    if (!selectedTarget) return;
    const count = Math.min(10, Math.max(1, targetCount));
    setProspectLoading(true);
    setProspectError(null);
    setProspectResult(null);
    setRowComposers({});
    setSessionSentRowKeys({});
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
      const supabase = createClient();
      const {
        data: { user: u },
      } = await supabase.auth.getUser();
      if (u) {
        const { count } = await supabase.from("extracted_leads").select("id", { count: "exact", head: true }).eq("user_id", u.id);
        setLeadCount(count ?? 0);
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
          keyword: query.trim(),
          companyName: row.company_name,
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
    setSessionSentRowKeys((prev) => ({ ...prev, [key]: true }));
    updateComposer(key, (prev) => ({
      ...prev,
      notice: null,
      postSendSuccess: true,
      sentToEmail: row.email,
    }));
  }

  function sourceUrlLabel(url: string): string {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return url.length > 56 ? `${url.slice(0, 54)}…` : url;
    }
  }

  function prospectComposerCardBody(row: ProspectLead, key: string, composer: RowComposerState, showAiHint: boolean) {
    return composer.postSendSuccess && composer.sentToEmail ? (
      <div className="space-y-4 py-2">
        <div className="flex items-start gap-2 text-emerald-800">
          <Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600" strokeWidth={2.5} />
          <div className="min-w-0">
            <p className="text-base font-bold text-emerald-900">Email sent to {composer.sentToEmail}</p>
            <p className="mt-2 text-sm font-semibold text-ink-800">What&apos;s next?</p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            className="btn-primary inline-flex w-full flex-1 items-center justify-center gap-1 text-sm sm:w-auto"
            onClick={() => openNextUnsentProspect(key)}
          >
            Send to next prospect
            <ArrowRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="btn-secondary inline-flex w-full flex-1 items-center justify-center gap-1 text-sm sm:w-auto"
            onClick={() => {
              updateComposer(key, (prev) => ({ ...prev, open: false, postSendSuccess: false, sentToEmail: null }));
              scrollToSearchAndFocus();
            }}
          >
            Find more leads
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    ) : (
      <>
        <div className="text-sm text-ink-700">
          <span className="font-medium">To:</span> <span className="break-all">{row.email}</span>
        </div>
        <input
          className="input-field min-w-0"
          value={composer.subject}
          onChange={(e) => updateComposer(key, (prev) => ({ ...prev, subject: e.target.value }))}
          placeholder="Subject"
        />
        <div className="min-w-0 space-y-2">
          {showAiHint && (
            <p className="rounded-lg border border-dashed border-brand-200 bg-brand-50/60 px-3 py-2.5 text-sm leading-relaxed text-ink-700">
              Not sure what to write?{" "}
              <button
                type="button"
                className="font-semibold text-brand-700 underline decoration-brand-400 hover:text-brand-800"
                onClick={() => void handleGenerateAi(row)}
              >
                AI Generate
              </button>{" "}
              and we&apos;ll draft a personalized pitch for you.
            </p>
          )}
          <textarea
            className="input-field min-h-36 min-w-0 resize-y"
            value={composer.body}
            onChange={(e) => updateComposer(key, (prev) => ({ ...prev, body: e.target.value }))}
            placeholder="Body"
          />
        </div>
        <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 flex-col gap-1 sm:max-w-[55%]">
            <button
              type="button"
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-orange-200 bg-orange-100 px-4 py-2.5 text-sm font-semibold text-orange-900 shadow-sm transition-colors hover:bg-orange-200 disabled:opacity-50 sm:w-auto sm:px-5 sm:py-3 sm:text-base"
              onClick={() => void handleGenerateAi(row)}
              disabled={composer.generating}
            >
              <Sparkles className="h-5 w-5 flex-shrink-0" />
              {composer.generating ? "Writing..." : "AI Generate"}
            </button>
            <p className="text-xs text-ink-500">Auto-generate a personalized pitch in seconds</p>
          </div>
          <button
            type="button"
            className="btn-primary inline-flex w-full min-w-0 flex-shrink-0 items-center justify-center gap-2 sm:w-auto"
            onClick={() => openInMail(row)}
            disabled={!composer.subject.trim() || !composer.body.trim()}
          >
            <Mail className="h-4 w-4 flex-shrink-0" />
            Send Email
          </button>
        </div>
        {composer.error && <p className="text-sm text-red-600">{composer.error}</p>}
        {composer.notice && !composer.postSendSuccess && <p className="text-sm text-emerald-700">{composer.notice}</p>}
      </>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-display sm:font-black">Dashboard</h1>
        <p className="text-ink-500 mt-1">Your proposal command center</p>
      </div>

      <section
        ref={searchSectionRef}
        className={cn(
          "mb-8 rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 to-white",
          hasCreatedAnything ? "p-3.5 sm:p-6" : "p-4 sm:p-8"
        )}
      >
        <h2
          className={cn(
            "font-black text-ink-900",
            hasCreatedAnything ? "text-xl sm:text-3xl" : "text-2xl sm:text-3xl md:text-4xl"
          )}
        >
          What do you sell?
        </h2>
        <p className="mt-1 text-sm sm:mt-2 sm:text-base text-ink-600">
          Describe your product or service — we&apos;ll find matching prospects instantly.
        </p>
        {credits !== null && credits >= INITIAL_FREE_CREDITS && !hasCreatedAnything && (
          <p className="mt-2 text-sm font-medium text-orange-700 sm:mt-3">👇 Click one to try it now</p>
        )}
        <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-ink-500 sm:mt-3">Try an example:</p>
        <div className={cn("mt-1.5 flex flex-wrap gap-1.5 sm:mt-2 sm:gap-2", credits !== null && credits >= INITIAL_FREE_CREDITS && !hasCreatedAnything ? "" : "sm:mt-3")}>
          {["coffee machines", "accounting services", "web design"].map((text, i) => (
            <button
              key={text}
              type="button"
              disabled={prospectLoading}
              className={cn(
                "inline-flex cursor-pointer items-center rounded-lg border px-2 py-1.5 text-left transition-colors disabled:opacity-50 sm:px-3 sm:py-2",
                credits !== null && credits >= INITIAL_FREE_CREDITS && !hasCreatedAnything
                  ? "bg-orange-100 border-orange-300 hover:bg-orange-200"
                  : "bg-orange-50 border-orange-200 hover:bg-orange-100"
              )}
              onClick={() => setQuery(text)}
            >
              {i === 0 && <span className="mr-0.5 text-sm leading-none sm:mr-1 sm:text-base">☕</span>}
              {i === 1 && <span className="mr-0.5 text-sm leading-none sm:mr-1 sm:text-base">📊</span>}
              {i === 2 && <span className="mr-0.5 text-sm leading-none sm:mr-1 sm:text-base">🎨</span>}
              <span
                className={cn(
                  "text-[11px] text-orange-700 sm:text-sm",
                  credits !== null && credits >= INITIAL_FREE_CREDITS && !hasCreatedAnything ? "font-medium" : "italic"
                )}
              >
                {text}
              </span>
            </button>
          ))}
        </div>
        <label className="mt-3 block text-sm font-medium text-ink-700 sm:mt-4">What do you sell?</label>
        <input
          ref={queryInputRef}
          className={cn("input-field mt-1.5 h-11 sm:mt-2 sm:h-12", queryInputError && "border-red-300 focus:border-red-400 focus:ring-red-200")}
          placeholder="e.g. coffee machines, web design, accounting services"
          value={query}
          autoFocus={leadCount === 0 && !prospectResult}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void tryFindProspects();
          }}
        />
        {queryInputError && (
          <p className="mt-1.5 text-sm text-red-600">{queryInputError}</p>
        )}
        <div className="mt-3 sm:mt-4">
          <p className="text-sm font-medium text-ink-700 mb-2">How many emails to find?</p>
          <EmailCountStepper value={targetCount} onChange={setTargetCount} maxCredits={credits} disabled={prospectLoading} />
        </div>
        {credits !== null && credits > 0 && credits <= 2 && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 sm:mt-4">
            <span className="font-medium">⚠️ You have {credits} credit{credits !== 1 ? "s" : ""} left.</span>{" "}
            <Link href="/pricing" className="font-semibold text-brand-700 underline hover:text-brand-800">
              Upgrade
            </Link>{" "}
            for unlimited prospecting.
          </div>
        )}
        <button
          type="button"
          className="mt-3 inline-flex w-full sm:w-auto items-center justify-center rounded-lg bg-orange-500 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
          onClick={() => void tryFindProspects()}
          disabled={prospectLoading || !query.trim() || !!queryInputError || (credits !== null && credits > 0 && targetCount > credits)}
        >
          <Search className="w-4 h-4 mr-1.5" />
          Find {targetCount} Prospects & Emails
          <ArrowRight className="w-4 h-4 ml-1.5" />
        </button>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <p className="text-ink-500">
            Uses {targetCount} credit{targetCount !== 1 ? "s" : ""}. Unused credits refunded if fewer emails are found.
          </p>
          {credits !== null && (
            <p className={cn(credits <= 3 ? "text-amber-700 font-medium" : "text-ink-600")}>
              You have {credits} credit{credits !== 1 ? "s" : ""} remaining
            </p>
          )}
        </div>

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
        <section className="card p-4 mb-8 sm:p-5">
          <p className="text-xs text-emerald-800 sm:text-sm">
            {prospectResult.message
              ? prospectResult.message
              : prospectResult.creditsUsed === 0
                ? `No emails found — all ${prospectResult.creditsReserved} credits refunded. Try different keywords.`
                : prospectResult.creditsRefunded > 0
                  ? `✓ Found ${prospectResult.creditsUsed} of ${prospectResult.creditsReserved} emails — ${prospectResult.creditsUsed} credits used, ${prospectResult.creditsRefunded} credits refunded`
                  : `✓ Found ${prospectResult.creditsUsed} emails — ${prospectResult.creditsUsed} credits used`}
          </p>

          <div className="mt-4 md:hidden">
            <div className="flex flex-col gap-3 sm:gap-4">
              {prospectResult.leads.map((row) => {
                const key = rowKeyFor(row);
                const composer = rowComposers[key] ?? defaultComposer();
                const sent = !!sessionSentRowKeys[key];
                const showAiHint =
                  composer.open && !composer.postSendSuccess && !composer.subject.trim() && !composer.body.trim() && !composer.generating;

                return (
                  <div key={key} className="flex min-w-0 flex-col gap-3">
                    <div className="min-w-0 rounded-xl border border-surface-200 bg-white p-4 shadow-sm">
                      <p className="break-words text-base font-bold text-ink-900">{row.email}</p>
                      <p className="mt-1.5 text-xs text-ink-500">{row.company_name || "—"}</p>
                      <a
                        className="mt-2 block break-all text-xs font-medium text-brand-600 hover:underline"
                        href={row.source_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {sourceUrlLabel(row.source_url)}
                      </a>
                      <div className="mt-4">
                        {sent ? (
                          <span className="flex w-full items-center justify-center rounded-lg bg-surface-100 py-3 text-sm font-medium text-ink-500">
                            ✓ Sent
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="flex w-full items-center justify-center rounded-lg bg-orange-500 py-3 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
                            onClick={() => {
                              if (composer.open) {
                                updateComposer(key, (prev) => ({
                                  ...prev,
                                  open: false,
                                  postSendSuccess: false,
                                  sentToEmail: null,
                                }));
                              } else {
                                openComposerForRow(key);
                              }
                            }}
                          >
                            {composer.open ? "Close" : "Write →"}
                          </button>
                        )}
                      </div>
                    </div>
                    {composer.open && (
                      <div className="min-w-0 rounded-xl border border-orange-200 bg-orange-50/50 p-3">
                        <div className="rounded-lg border border-surface-200 bg-white p-4 space-y-3">
                          {prospectComposerCardBody(row, key, composer, showAiHint)}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 hidden overflow-x-auto md:block">
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
                  const sent = !!sessionSentRowKeys[key];
                  const showAiHint =
                    composer.open && !composer.postSendSuccess && !composer.subject.trim() && !composer.body.trim() && !composer.generating;

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
                          {sent ? (
                            <span className="inline-flex items-center rounded-md bg-surface-100 px-3 py-2 text-xs font-medium text-ink-500">
                              ✓ Sent
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="inline-flex items-center rounded-md bg-orange-500 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-orange-600"
                              onClick={() => {
                                if (composer.open) {
                                  updateComposer(key, (prev) => ({
                                    ...prev,
                                    open: false,
                                    postSendSuccess: false,
                                    sentToEmail: null,
                                  }));
                                } else {
                                  openComposerForRow(key);
                                }
                              }}
                            >
                              {composer.open ? "Close" : "Write →"}
                            </button>
                          )}
                        </td>
                      </tr>
                      <tr className="border-b border-surface-100">
                        <td colSpan={4} className="p-0">
                          <div className={cn("overflow-hidden transition-all duration-300 ease-out", composer.open ? "max-h-[1400px] opacity-100" : "max-h-0 opacity-0")}>
                            <div className="bg-orange-50/30 border-l-2 border-orange-400 px-4 py-4 sm:px-5 sm:py-5">
                              <div className="rounded-lg border border-surface-200 bg-white p-4 space-y-3">
                                {prospectComposerCardBody(row, key, composer, showAiHint)}
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

      {creditsExhaustedModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="credits-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setCreditsExhaustedModalOpen(false);
          }}
        >
          <div className="card max-w-md space-y-4 p-6 shadow-elevated">
            <h2 id="credits-modal-title" className="text-lg font-bold text-ink-900">
              You&apos;ve used all your free credits!
            </h2>
            {usageStatsForModal !== null && (usageStatsForModal.prospects > 0 || usageStatsForModal.sent > 0) && (
              <p className="text-sm text-ink-600">
                You&apos;ve already found <strong className="text-ink-900">{usageStatsForModal.prospects}</strong> prospect
                {usageStatsForModal.prospects !== 1 ? "s" : ""} and sent <strong className="text-ink-900">{usageStatsForModal.sent}</strong> email
                {usageStatsForModal.sent !== 1 ? "s" : ""}.
              </p>
            )}
            {usageStatsForModal === null && <Loader2 className="h-5 w-5 animate-spin text-brand-500" />}
            <p className="text-sm text-ink-600">
              Upgrade to Pro to get 150 credits every month and keep growing.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button type="button" className="btn-ghost order-2 sm:order-1" onClick={() => setCreditsExhaustedModalOpen(false)}>
                Maybe later
              </button>
              <Link href="/pricing" className="btn-primary order-1 text-center sm:order-2" onClick={() => setCreditsExhaustedModalOpen(false)}>
                Upgrade to Pro — $19/mo
                <ArrowRight className="ml-1 inline h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {credits !== null && (
        <Link
          href="/pricing"
          className={cn(
            "card mb-8 block p-4 transition-colors",
            credits === 0
              ? "border-red-200 bg-red-50 hover:bg-red-100/70"
              : credits <= 3
                ? "border-amber-200 bg-amber-50 hover:bg-amber-100/70"
                : "hover:bg-surface-50"
          )}
        >
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
            <span className={cn("flex w-full flex-shrink-0 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-center text-sm font-semibold transition-colors sm:ml-4 sm:w-auto sm:justify-center", credits <= 3 ? "bg-brand-500 text-white" : "text-brand-600 bg-brand-50/60")}>
              Upgrade Plan
              <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </Link>
      )}

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-4 animate-pulse">
              <div className="h-4 bg-surface-200 rounded w-3/4 mb-2" />
              <div className="h-3 bg-surface-100 rounded w-1/4" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
