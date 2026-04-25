"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useSWRConfig } from "swr";
import { createClient } from "@/lib/supabase/client";
import type { ExtractedLead, OutreachType } from "@/types";
import { ChevronDown, Copy, Download, Globe, Grid3X3, Mail, Plus, Search, Sparkles } from "lucide-react";
import { cn, formatRelativeTime } from "@/lib/utils";
import { ListPagination, LIST_PAGE_SIZE } from "@/components/list-pagination";
import { DASHBOARD_CREDITS_KEY } from "@/lib/use-dashboard-credits";
import { EmailCountStepper } from "@/components/email-count-stepper";

async function fetchLeadsDashboard(): Promise<{ leads: ExtractedLead[]; credits: number }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { leads: [], credits: 0 };

  const [{ data }, creditsRes] = await Promise.all([
    supabase
      .from("extracted_leads")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase.from("users").select("credits").eq("id", user.id).single(),
  ]);

  return {
    leads: (data ?? []) as ExtractedLead[],
    credits: creditsRes.data?.credits ?? 0,
  };
}

type BulkLeadResult = {
  email: string;
  source_url: string;
  company_name: string;
  lead_id: string;
  client_id: string;
};

type BulkResponse = {
  success: boolean;
  totalUrls: number;
  successfulUrls: number;
  failedUrls: number;
  emailsFound: number;
  creditsUsed: number;
  creditsRemaining: number;
  leads: BulkLeadResult[];
  failed?: { url: string; reason: string }[];
  partial?: boolean;
  message?: string;
};

type SmartProspectResponse = {
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
  leads: BulkLeadResult[];
  failed?: { url: string; reason: string }[];
  message?: string;
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

const OUTREACH_TYPES: { key: OutreachType; label: string }[] = [
  { key: "proposal", label: "Proposal" },
  { key: "pitch", label: "Sales Pitch" },
  { key: "investment", label: "Investment Ask" },
  { key: "quote", label: "Quote" },
];

export default function LeadsPage() {
  const searchParams = useSearchParams();
  const { mutate: mutateGlobal } = useSWRConfig();
  const autoExtractRanRef = useRef(false);

  const [listPage, setListPage] = useState(1);
  const [bulkInput, setBulkInput] = useState("");
  const { data: leadsData, isLoading: bootLoading, mutate } = useSWR(
    "dashboard-extracted-leads",
    fetchLeadsDashboard,
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );
  const leads = leadsData?.leads ?? [];
  const credits = leadsData?.credits ?? 0;
  const listPageCount = Math.max(1, Math.ceil(leads.length / LIST_PAGE_SIZE));

  useEffect(() => {
    setListPage((p) => Math.min(p, listPageCount));
  }, [listPageCount, leads.length]);

  const pagedLeads = useMemo(
    () => leads.slice((listPage - 1) * LIST_PAGE_SIZE, listPage * LIST_PAGE_SIZE),
    [leads, listPage]
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkWarning, setBulkWarning] = useState<string | null>(null);
  const [bulkResult, setBulkResult] = useState<BulkResponse | null>(null);
  const [openUrlInput, setOpenUrlInput] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [targetCount, setTargetCount] = useState(3);
  const [smartLoading, setSmartLoading] = useState(false);
  const [smartProgress, setSmartProgress] = useState<string | null>(null);
  const [smartCounter, setSmartCounter] = useState(0);
  const [smartError, setSmartError] = useState<string | null>(null);
  const [failedOpen, setFailedOpen] = useState(false);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [rowComposers, setRowComposers] = useState<Record<string, RowComposerState>>({});
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const progressSteps = [
    "Fetching website...",
    "Analyzing company...",
    "Extracting emails...",
    "Preparing results...",
  ];

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email || null);
    });
  }, []);

  useEffect(() => {
    const prefillUrls = searchParams.get("urls");
    if (!prefillUrls || autoExtractRanRef.current) return;
    setBulkInput(prefillUrls);
    setOpenUrlInput(true);
  }, [searchParams]);

  function parseBulkUrls(input: string): string[] {
    const rows = input
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const valid = rows
      .map((line) => {
        try {
          return /^https?:\/\//i.test(line) ? new URL(line) : new URL(`https://${line}`);
        } catch {
          return null;
        }
      })
      .filter((url): url is URL => Boolean(url))
      .map((url) => url.toString());
    return Array.from(new Set(valid));
  }

  const validBulkUrls = parseBulkUrls(bulkInput);
  const selectedBulkRows = bulkResult?.leads.filter((row) => selectedEmails.has(row.email)) ?? [];

  useEffect(() => {
    const prefillUrls = searchParams.get("urls");
    if (!prefillUrls || autoExtractRanRef.current || loading || validBulkUrls.length === 0) return;
    autoExtractRanRef.current = true;
    void handleBulkExtract();
  }, [searchParams, loading, validBulkUrls.length]);

  useEffect(() => {
    if (validBulkUrls.length > 20) {
      setBulkError("Max 20 URLs per batch. Please reduce the list.");
    } else {
      setBulkError(null);
    }
    if (credits < validBulkUrls.length && validBulkUrls.length > 0) {
      setBulkWarning(
        `You have ${credits} credits. You may not be able to process all URLs if multiple emails are found.`
      );
    } else {
      setBulkWarning(null);
    }
  }, [credits, validBulkUrls.length]);

  async function handleBulkExtract() {
    if (validBulkUrls.length === 0 || bulkError) return;
    setLoading(true);
    setBulkError(null);
    setBulkResult(null);
    setSelectedEmails(new Set());
    try {
      const response = await fetch("/api/find-contacts/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: validBulkUrls }),
      });
      const payload = (await response.json()) as BulkResponse & { error?: string };
      if (!response.ok) {
        setBulkError(payload.message || payload.error || "Bulk extraction failed");
        return;
      }
      setBulkResult(payload);
      if (payload.failed && payload.failed.length > 0) {
        setFailedOpen(false);
      }
      if (typeof payload.creditsRemaining === "number") {
        void mutateGlobal(DASHBOARD_CREDITS_KEY, payload.creditsRemaining, false);
      }
      await mutate();
      setListPage(1);
    } catch {
      setBulkError("Unexpected error while extracting in bulk.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSmartSearch() {
    if (!keyword.trim()) return;
    setSmartLoading(true);
    setSmartError(null);
    setSmartProgress("Searching for prospects...");
    setSmartCounter(0);
    setBulkResult(null);
    setSelectedEmails(new Set());

    const timerA = setTimeout(() => setSmartProgress("Found companies. Extracting emails..."), 4000);
    const timerB = setTimeout(() => setSmartProgress("Scanning more sites..."), 15000);
    const timerC = setTimeout(() => setSmartProgress("Expanding search to find more results..."), 30000);
    const timerD = setTimeout(() => setSmartProgress("Still searching... almost done"), 50000);
    const counterTimer = setInterval(() => {
      setSmartCounter((prev) => Math.min(prev + 1, targetCount));
    }, Math.max(2000, (targetCount * 3000) / targetCount));

    try {
      const response = await fetch("/api/search-prospects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: keyword.trim(), requestedCount: targetCount }),
      });
      const payload = (await response.json()) as SmartProspectResponse & { error?: string };
      if (!response.ok) {
        setSmartError(payload.error || "Search service unavailable. Please try again later.");
        return;
      }

      setBulkResult({
        success: true,
        totalUrls: payload.processedCount,
        successfulUrls: payload.successfulUrls,
        failedUrls: payload.failedUrls,
        emailsFound: payload.leads.length,
        creditsUsed: payload.creditsUsed,
        creditsRemaining: payload.creditsRemaining,
        leads: payload.leads,
        failed: payload.failed,
        partial: payload.creditsRefunded > 0,
        message: payload.message,
      });
      setSmartCounter(payload.leads.length);
      setSmartProgress(payload.message || "Done!");

      if (typeof payload.creditsRemaining === "number") {
        void mutateGlobal(DASHBOARD_CREDITS_KEY, payload.creditsRemaining, false);
      }
      await mutate();
      setListPage(1);
    } catch {
      setSmartError("Search service unavailable. Please try again later.");
    } finally {
      clearTimeout(timerA);
      clearTimeout(timerB);
      clearTimeout(timerC);
      clearTimeout(timerD);
      clearInterval(counterTimer);
      setSmartLoading(false);
      setTimeout(() => setSmartProgress(null), 1200);
    }
  }

  function toggleRow(email: string) {
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  }

  function getRowKey(row: BulkLeadResult) {
    return `${row.lead_id}:${row.email}`;
  }

  function getDefaultComposerState(): RowComposerState {
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

  function updateComposer(rowKey: string, updater: (prev: RowComposerState) => RowComposerState) {
    setRowComposers((prev) => {
      const current = prev[rowKey] ?? getDefaultComposerState();
      return {
        ...prev,
        [rowKey]: updater(current),
      };
    });
  }

  function toggleComposer(rowKey: string) {
    updateComposer(rowKey, (prev) => ({ ...prev, open: !prev.open }));
  }

  function withSignature(content: string) {
    const signature = userEmail ? `\n\n---\n${userEmail}` : "";
    return `${content}${signature}`;
  }

  async function saveBulkOutreachRecord(row: BulkLeadResult, subject: string, body: string, type: OutreachType) {
    try {
      await fetch("/api/outreach/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: row.lead_id,
          type,
          recipientEmails: [row.email],
          subject,
          body,
          status: "opened_in_client",
        }),
      });
    } catch {
      // keep silent so mail flow is never blocked
    }
  }

  function openRowMailto(row: BulkLeadResult, rowKey: string, subject: string, body: string, type: OutreachType) {
    const encodedSubject = encodeURIComponent(subject);
    const encodedBody = encodeURIComponent(withSignature(body));
    const mailtoLink = `mailto:${encodeURIComponent(row.email)}?subject=${encodedSubject}&body=${encodedBody}`;
    window.location.href = mailtoLink;
    updateComposer(rowKey, (prev) => ({ ...prev, notice: "Opened your default email client.", error: null }));
    void saveBulkOutreachRecord(row, subject, body, type);
  }

  async function handleGenerateBulkAi(row: BulkLeadResult) {
    const rowKey = getRowKey(row);
    const composer = rowComposers[rowKey] ?? getDefaultComposerState();
    updateComposer(rowKey, (prev) => ({ ...prev, generating: true, error: null, notice: null }));
    try {
      const response = await fetch("/api/outreach/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: row.lead_id,
          type: composer.outreachType,
          context: composer.context,
          recipientEmails: [row.email],
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        updateComposer(rowKey, (prev) => ({ ...prev, generating: false, error: payload.error || "Failed to generate outreach" }));
        return;
      }
      const generatedSubject = payload.subject || "";
      const generatedBody = payload.body || "";
      updateComposer(rowKey, (prev) => ({
        ...prev,
        subject: generatedSubject,
        body: generatedBody,
      }));
      if (typeof payload.remainingCredits === "number") {
        void mutateGlobal(DASHBOARD_CREDITS_KEY, payload.remainingCredits, false);
      }
      await mutate();
    } catch {
      updateComposer(rowKey, (prev) => ({ ...prev, error: "Unexpected error while generating outreach." }));
    } finally {
      updateComposer(rowKey, (prev) => ({ ...prev, generating: false }));
    }
  }

  function handleOpenManual(row: BulkLeadResult) {
    const rowKey = getRowKey(row);
    const composer = rowComposers[rowKey];
    if (!composer || !composer.subject.trim() || !composer.body.trim()) return;
    openRowMailto(row, rowKey, composer.subject.trim(), composer.body.trim(), composer.outreachType);
  }

  function handleDownloadCsv() {
    if (!bulkResult || bulkResult.leads.length === 0) return;
    const rows = selectedBulkRows.length > 0 ? selectedBulkRows : bulkResult.leads;
    const header = "email,company,source_url,extracted_at";
    const now = new Date().toISOString();
    const csvRows = rows.map((row) =>
      [row.email, row.company_name, row.source_url, now]
        .map((field) => `"${String(field).replaceAll('"', '""')}"`)
        .join(",")
    );
    const blob = new Blob([[header, ...csvRows].join("\n")], { type: "text/csv;charset=utf-8;" });
    const fileUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = fileUrl;
    a.download = "bulk-discovery-results.csv";
    a.click();
    URL.revokeObjectURL(fileUrl);
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-display font-bold text-ink-900">Find Contacts</h1>
        <p className="text-ink-500 mt-1">
          Search by keyword or paste URLs to find contact emails.
        </p>
      </div>

      <div className="card p-4 mb-6">
        <label className="text-sm font-medium text-ink-700 mb-2 block">
          What kind of businesses do you want to reach?
        </label>
        <input
          className="input-field h-12"
          placeholder="e.g., marketing agencies in London or SaaS companies"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
        <div className="mt-4">
          <p className="text-sm font-medium text-ink-700 mb-2">How many emails to find?</p>
          <EmailCountStepper
            value={targetCount}
            onChange={setTargetCount}
            maxCredits={credits}
            disabled={smartLoading}
          />
        </div>
        <button
          onClick={handleSmartSearch}
          disabled={smartLoading || !keyword.trim() || credits === 0 || (credits !== null && targetCount > credits)}
          className="mt-3 inline-flex w-full sm:w-auto items-center justify-center rounded-lg bg-orange-500 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
        >
          <Search className="w-4 h-4 mr-1.5" />
          Find {targetCount} Prospects & Emails
        </button>
        <p className="mt-2 text-xs text-ink-500">
          Uses {targetCount} credit{targetCount !== 1 ? "s" : ""}. Unused credits refunded if fewer emails are found.
        </p>
        {smartProgress && (
          <div className="mt-2 space-y-1.5">
            <div className="flex items-center gap-2">
              {smartLoading && (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-orange-300 border-t-orange-600" />
              )}
              <p className="text-sm font-medium text-brand-700">{smartProgress}</p>
            </div>
            {smartLoading && smartCounter > 0 && (
              <p className="text-xs text-ink-500">
                Found {smartCounter} of {targetCount} emails...
              </p>
            )}
            {smartLoading && targetCount > 3 && (
              <p className="text-xs text-ink-400">This may take up to a minute for larger requests.</p>
            )}
          </div>
        )}
        {smartError && <p className="mt-2 text-sm text-red-600">{smartError}</p>}

        <div className="mt-4 rounded-lg border border-surface-200 bg-white">
          <button
            className="w-full px-4 py-3 text-left text-sm font-medium text-ink-700 flex items-center justify-between"
            onClick={() => setOpenUrlInput((prev) => !prev)}
          >
            Already have URLs? Paste them here
            <ChevronDown className={cn("w-4 h-4 transition-transform", openUrlInput && "rotate-180")} />
          </button>

          {openUrlInput && (
            <div className="px-4 pb-4 pt-1">
              <label className="text-sm font-medium text-ink-700 mb-2 block">
                Paste website URLs (one per line, max 20)
              </label>
              <textarea
                className="input-field min-h-[180px]"
                placeholder="Paste URLs here, one per line..."
                value={bulkInput}
                onChange={(e) => setBulkInput(e.target.value)}
              />
              <p className="mt-2 text-xs text-ink-500">
                We&apos;ll crawl each site and extract contact emails. Costs 1 credit per email found.
              </p>
              <p className="mt-1 text-xs text-brand-700">{validBulkUrls.length} valid URLs detected</p>
              {bulkWarning && <p className="mt-2 text-xs text-amber-700">{bulkWarning}</p>}
              {bulkError && <p className="mt-2 text-sm text-red-600">{bulkError}</p>}
              <button
                onClick={handleBulkExtract}
                disabled={loading || validBulkUrls.length === 0 || credits <= 0 || Boolean(bulkError)}
                className="btn-primary mt-3"
              >
                <Grid3X3 className="w-4 h-4" />
                {loading ? "Extracting..." : "Extract Emails"}
              </button>
              {loading && (
                <div className="mt-3 rounded-lg border border-surface-200 bg-surface-50 p-3">
                  {progressSteps.map((step, idx) => (
                    <div key={step} className="text-xs text-ink-500 py-0.5">
                      {idx < 2 ? "●" : "○"} {step}
                    </div>
                  ))}
                </div>
              )}
              {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
            </div>
          )}
        </div>
      </div>

      {bulkResult && (
        <div className="card p-4 mb-6">
          <div className="text-sm text-emerald-700 font-medium">
            ✓ Processed {bulkResult.successfulUrls} of {bulkResult.totalUrls} sites — Found {bulkResult.emailsFound} unique emails — {bulkResult.creditsUsed} credits used
          </div>
          {bulkResult.message && (
            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              {bulkResult.message}{" "}
              <Link href="/pricing" className="font-semibold text-brand-700 hover:text-brand-800">Upgrade</Link>
            </div>
          )}

          {bulkResult.leads.length > 0 && (
            <>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button onClick={handleDownloadCsv} className="btn-secondary text-sm">
                  <Download className="w-4 h-4" /> Download CSV
                </button>
                <Link href="/dashboard/clients" className="btn-ghost text-sm">View in Clients</Link>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-ink-500 border-b border-surface-200">
                    <tr>
                      <th className="py-2 pr-2">
                        <input
                          type="checkbox"
                          checked={bulkResult.leads.length > 0 && selectedEmails.size === bulkResult.leads.length}
                          onChange={(e) =>
                            setSelectedEmails(
                              e.target.checked ? new Set(bulkResult.leads.map((row) => row.email)) : new Set()
                            )
                          }
                        />
                      </th>
                      <th className="py-2 pr-2">Email</th>
                      <th className="py-2 pr-2">Company</th>
                      <th className="py-2 pr-2">Source URL</th>
                      <th className="py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkResult.leads.map((row) => {
                      const rowKey = getRowKey(row);
                      const composer = rowComposers[rowKey] ?? getDefaultComposerState();
                      return (
                        <Fragment key={rowKey}>
                          <tr className="border-b border-surface-100">
                            <td className="py-2 pr-2 align-top">
                              <input
                                type="checkbox"
                                checked={selectedEmails.has(row.email)}
                                onChange={() => toggleRow(row.email)}
                              />
                            </td>
                            <td className="py-2 pr-2 text-ink-800 align-top">{row.email}</td>
                            <td className="py-2 pr-2 text-ink-700 align-top">{row.company_name}</td>
                            <td className="py-2 pr-2 align-top">
                              <a className="text-brand-600 hover:underline" href={row.source_url} target="_blank" rel="noreferrer">
                                {row.source_url}
                              </a>
                            </td>
                            <td className="py-2 align-top">
                              <div className="flex items-center gap-1.5">
                                <button
                                  className="inline-flex items-center rounded-md bg-orange-500 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-orange-600"
                                  onClick={() => toggleComposer(rowKey)}
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
                            <td colSpan={5} className="p-0">
                              <div
                                className={cn(
                                  "overflow-hidden transition-all duration-300 ease-out",
                                  composer.open ? "max-h-[1200px] opacity-100" : "max-h-0 opacity-0"
                                )}
                              >
                                <div className="bg-orange-50/30 border-l-2 border-orange-400 px-4 py-4 sm:px-5 sm:py-5">
                                  <div className="rounded-lg border border-surface-200 bg-white p-4 space-y-3">
                                    <div className="text-sm font-medium text-ink-800">Choose email type:</div>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                      {OUTREACH_TYPES.map((item) => (
                                        <button
                                          key={item.key}
                                          type="button"
                                          onClick={() =>
                                            updateComposer(rowKey, (prev) => ({ ...prev, outreachType: item.key }))
                                          }
                                          className={cn(
                                            "btn-secondary text-xs justify-center",
                                            composer.outreachType === item.key && "bg-brand-50 border-brand-300 text-brand-700"
                                          )}
                                        >
                                          {item.label}
                                        </button>
                                      ))}
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      <button
                                        type="button"
                                        onClick={() => updateComposer(rowKey, (prev) => ({ ...prev, writeMode: "manual" }))}
                                        className={cn(
                                          "btn-secondary justify-center",
                                          composer.writeMode === "manual" && "bg-brand-50 border-brand-300 text-brand-700"
                                        )}
                                      >
                                        ✍️ Write manually (free)
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => updateComposer(rowKey, (prev) => ({ ...prev, writeMode: "ai" }))}
                                        className={cn(
                                          "btn-secondary justify-center",
                                          composer.writeMode === "ai" && "bg-brand-50 border-brand-300 text-brand-700"
                                        )}
                                      >
                                        ✨ Generate with AI (1 credit)
                                      </button>
                                    </div>

                                    {composer.writeMode === "ai" && (
                                      <div className="space-y-2">
                                        <textarea
                                          className="input-field min-h-24"
                                          value={composer.context}
                                          onChange={(e) =>
                                            updateComposer(rowKey, (prev) => ({ ...prev, context: e.target.value }))
                                          }
                                          placeholder="Specific context for this outreach..."
                                        />
                                        <button className="btn-primary" onClick={() => handleGenerateBulkAi(row)} disabled={composer.generating}>
                                          <Sparkles className="w-4 h-4" />
                                          {composer.generating ? "Generating..." : "Generate Email with AI (1 credit)"}
                                        </button>
                                      </div>
                                    )}

                                    <input
                                      className="input-field"
                                      value={composer.subject}
                                      onChange={(e) =>
                                        updateComposer(rowKey, (prev) => ({ ...prev, subject: e.target.value }))
                                      }
                                      placeholder="Email subject line"
                                    />
                                    <textarea
                                      className="input-field min-h-36"
                                      value={composer.body}
                                      onChange={(e) =>
                                        updateComposer(rowKey, (prev) => ({ ...prev, body: e.target.value }))
                                      }
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
                                      onClick={() => handleOpenManual(row)}
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
            </>
          )}

          {bulkResult.failed && bulkResult.failed.length > 0 && (
            <div className="mt-4 border-t border-surface-200 pt-3">
              <button
                className="text-sm text-ink-700 flex items-center gap-1"
                onClick={() => setFailedOpen((prev) => !prev)}
              >
                <ChevronDown className={`w-4 h-4 transition-transform ${failedOpen ? "rotate-180" : ""}`} />
                {bulkResult.failed.length} URLs failed (click to expand)
              </button>
              {failedOpen && (
                <ul className="mt-2 space-y-1 text-xs text-ink-500">
                  {bulkResult.failed.map((failure) => (
                    <li key={failure.url}>- {failure.url} — {failure.reason}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {bootLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-4 animate-pulse">
              <div className="h-4 bg-surface-200 rounded w-1/2 mb-2" />
              <div className="h-3 bg-surface-100 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : leads.length === 0 ? (
        <div className="card p-8">
          <div className="text-center mb-5">
            <Globe className="w-10 h-10 text-ink-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-ink-700 mb-1">No contacts yet</h3>
            <p className="text-sm text-ink-400">Paste a URL above to try with any company.</p>
          </div>
          <div className="max-w-xl mx-auto rounded-xl border border-surface-200 bg-surface-50 p-4">
            <div className="flex items-center justify-between">
              <strong className="text-sm text-ink-900">Stripe Inc.</strong>
              <span className="badge bg-brand-50 text-brand-700">Fintech / Payments</span>
            </div>
            <p className="text-sm text-ink-500 mt-2">
              Payment infrastructure for internet businesses with APIs for online commerce.
            </p>
            <div className="mt-3 flex items-center gap-4 text-xs text-ink-500">
              <span>📧 3 emails found</span>
              <span>🎯 2 high confidence</span>
            </div>
          </div>
          <div className="text-center mt-4">
            <button onClick={() => setBulkInput("https://")} className="btn-secondary">
              <Plus className="w-4 h-4" /> Try your first extraction
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {pagedLeads.map((lead) => {
            const emails = Array.isArray(lead.emails) ? lead.emails : [];
            return (
              <Link
                key={lead.id}
                href={`/dashboard/leads/${lead.id}`}
                className="card-hover p-5 flex items-center justify-between"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-ink-900 truncate">
                    {lead.company_name || lead.source_url}
                  </div>
                  <div className="text-xs text-ink-500 mt-1 truncate">{lead.source_url}</div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-ink-400">
                    <span className="flex items-center gap-1">
                      <Mail className="w-3 h-3" /> {emails.length} emails
                    </span>
                    <span>{formatRelativeTime(lead.created_at)}</span>
                  </div>
                </div>
              </Link>
            );
          })}
          <ListPagination page={listPage} totalItems={leads.length} onPageChange={setListPage} className="pt-2" />
        </div>
      )}
    </div>
  );
}
