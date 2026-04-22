"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { ExtractedLead } from "@/types";
import { ChevronDown, Copy, Download, Globe, Grid3X3, Mail, Plus, Sparkles } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";

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

export default function LeadsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode = searchParams.get("mode") === "bulk" ? "bulk" : "single";

  const [mode, setMode] = useState<"single" | "bulk">(initialMode);
  const [credits, setCredits] = useState<number>(0);
  const [url, setUrl] = useState("");
  const [bulkInput, setBulkInput] = useState("");
  const [leads, setLeads] = useState<ExtractedLead[]>([]);
  const [loading, setLoading] = useState(false);
  const [bootLoading, setBootLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkWarning, setBulkWarning] = useState<string | null>(null);
  const [bulkResult, setBulkResult] = useState<BulkResponse | null>(null);
  const [failedOpen, setFailedOpen] = useState(false);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const progressSteps = [
    "Fetching website...",
    "Analyzing company...",
    "Extracting emails...",
    "Preparing results...",
  ];

  async function fetchLeads() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const [{ data }, creditsRes] = await Promise.all([
      supabase
        .from("extracted_leads")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase.from("users").select("credits").eq("id", user.id).single(),
    ]);

    setLeads((data ?? []) as ExtractedLead[]);
    setCredits(creditsRes.data?.credits ?? 0);
  }

  useEffect(() => {
    fetchLeads().finally(() => setBootLoading(false));
  }, []);

  useEffect(() => {
    const modeParam = searchParams.get("mode");
    if (modeParam === "bulk") setMode("bulk");
  }, [searchParams]);

  function setModeAndUrl(nextMode: "single" | "bulk") {
    setMode(nextMode);
    const nextUrl = nextMode === "bulk" ? "/dashboard/find-contacts?mode=bulk" : "/dashboard/find-contacts";
    router.replace(nextUrl);
  }

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

  async function handleExtract() {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/leads/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.message || payload.error || "Extraction failed");
        return;
      }

      setUrl("");
      await fetchLeads();
    } catch {
      setError("Unexpected error while extracting emails.");
    } finally {
      setLoading(false);
    }
  }

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
      await fetchLeads();
    } catch {
      setBulkError("Unexpected error while extracting in bulk.");
    } finally {
      setLoading(false);
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
          Extract contacts from any website and generate personalized outreach.
        </p>
      </div>

      <div className="card p-4 mb-6">
        <div className="inline-flex rounded-lg border border-surface-200 bg-surface-50 p-1 mb-4">
          <button
            onClick={() => setModeAndUrl("single")}
            className={`px-3 py-1.5 text-sm rounded-md ${mode === "single" ? "bg-white text-ink-900 shadow-sm" : "text-ink-500"}`}
          >
            Single Site (1 credit)
          </button>
          <button
            onClick={() => setModeAndUrl("bulk")}
            className={`px-3 py-1.5 text-sm rounded-md ${mode === "bulk" ? "bg-white text-ink-900 shadow-sm" : "text-ink-500"}`}
          >
            Bulk Discovery (1 credit per email found)
          </button>
        </div>

        {mode === "single" ? (
          <>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="url"
                className="input-field"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <button
                onClick={handleExtract}
                disabled={loading || !url.trim()}
                className="btn-primary sm:min-w-[170px]"
              >
                <Sparkles className="w-4 h-4" />
                {loading ? "Extracting..." : "Find Contacts"}
              </button>
            </div>
            <p className="text-xs text-ink-400 mt-3">
              1 credit per extraction. Tip: use this for businesses you have a genuine reason to contact.
            </p>
            {loading && (
              <div className="mt-3 rounded-lg border border-surface-200 bg-surface-50 p-3">
                {progressSteps.map((step, idx) => (
                  <div key={step} className="text-xs text-ink-500 py-0.5">
                    {idx < 2 ? "●" : "○"} {step}
                  </div>
                ))}
              </div>
            )}
            {error && (
              <p className="text-sm text-red-600 mt-3">{error}</p>
            )}
          </>
        ) : (
          <>
            <label className="text-sm font-medium text-ink-700 mb-2 block">
              Paste website URLs (one per line, max 20)
            </label>
            <textarea
              className="input-field min-h-[180px]"
              placeholder={"https://example1.com\nhttps://example2.com\nhttps://example3.com"}
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
          </>
        )}
      </div>

      {mode === "bulk" && bulkResult && (
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
                    {bulkResult.leads.map((row) => (
                      <tr key={`${row.email}-${row.lead_id}`} className="border-b border-surface-100">
                        <td className="py-2 pr-2">
                          <input
                            type="checkbox"
                            checked={selectedEmails.has(row.email)}
                            onChange={() => toggleRow(row.email)}
                          />
                        </td>
                        <td className="py-2 pr-2 text-ink-800">{row.email}</td>
                        <td className="py-2 pr-2 text-ink-700">{row.company_name}</td>
                        <td className="py-2 pr-2">
                          <a className="text-brand-600 hover:underline" href={row.source_url} target="_blank" rel="noreferrer">
                            {row.source_url}
                          </a>
                        </td>
                        <td className="py-2">
                          <div className="flex items-center gap-1">
                            <Link
                              href={`/dashboard/proposals/new?client=${row.client_id}&email=${encodeURIComponent(row.email)}&company=${encodeURIComponent(row.company_name)}`}
                              className="btn-ghost text-xs"
                            >
                              Generate Proposal
                            </Link>
                            <button
                              className="p-1.5 text-ink-500 hover:text-ink-700"
                              onClick={() => navigator.clipboard.writeText(row.email)}
                              title="Copy Email"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                            <a
                              href={`mailto:${row.email}`}
                              className="p-1.5 text-ink-500 hover:text-ink-700"
                              title="Open in Mail"
                            >
                              <Mail className="w-4 h-4" />
                            </a>
                          </div>
                        </td>
                      </tr>
                    ))}
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
            <button onClick={() => setUrl("https://")} className="btn-secondary">
              <Plus className="w-4 h-4" /> Try your first extraction
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {leads.map((lead) => {
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
        </div>
      )}
    </div>
  );
}
