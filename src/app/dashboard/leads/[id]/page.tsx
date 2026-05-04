"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSWRConfig } from "swr";
import { createClient } from "@/lib/supabase/client";
import type { ExtractedLead, ExtractedEmail, OutreachType } from "@/types";
import { ArrowLeft, ExternalLink, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { DASHBOARD_CREDITS_KEY } from "@/lib/use-dashboard-credits";

/** Fixed outreach type for AI generation (no per-email type picker in UI). */
const AI_OUTREACH_TYPE: OutreachType = "pitch";

function buildAiContextFromLead(lead: ExtractedLead, recipients: string[]): string {
  const lines = [
    recipients.length > 0 ? `Recipients: ${recipients.join(", ")}` : "",
    lead.company_name ? `Company: ${lead.company_name}` : "",
    lead.source_url ? `Website: ${lead.source_url}` : "",
    lead.search_keyword ? `Search keyword: ${lead.search_keyword}` : "",
    lead.company_info ? `Company info: ${lead.company_info}` : "",
  ].filter(Boolean);
  return lines.join("\n");
}

export default function LeadDetailPage() {
  const params = useParams<{ id: string }>();
  const leadId = params?.id;
  const { mutate } = useSWRConfig();

  const [lead, setLead] = useState<ExtractedLead | null>(null);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const emails = useMemo<ExtractedEmail[]>(
    () => (lead?.emails && Array.isArray(lead.emails) ? lead.emails : []),
    [lead]
  );

  async function fetchLead() {
    if (!leadId) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("extracted_leads")
      .select("*")
      .eq("id", leadId)
      .single();
    setLead((data as ExtractedLead) || null);
  }

  useEffect(() => {
    fetchLead().finally(() => setLoading(false));
  }, [leadId]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email || null);
    });
  }, []);

  function toggleEmail(email: string) {
    setSelectedEmails((prev) =>
      prev.includes(email) ? prev.filter((item) => item !== email) : [...prev, email]
    );
  }

  async function generateEmail() {
    if (!lead || selectedEmails.length === 0) return;
    setGenerating(true);
    setError(null);

    try {
      const response = await fetch("/api/outreach/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: lead.id,
          type: AI_OUTREACH_TYPE,
          context: buildAiContextFromLead(lead, selectedEmails),
          recipientEmails: selectedEmails,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error || "Failed to generate outreach");
        return;
      }

      setSubject(payload.subject || "");
      setBody(payload.body || "");
      if (typeof payload.remainingCredits === "number") {
        void mutate(DASHBOARD_CREDITS_KEY, payload.remainingCredits, false);
      } else {
        void mutate(DASHBOARD_CREDITS_KEY);
      }
      await fetchLead();
    } catch {
      setError("Unexpected error while generating outreach.");
    } finally {
      setGenerating(false);
    }
  }

  async function saveOutreachRecord() {
    if (!lead || !subject || !body || selectedEmails.length === 0) return;
    setError(null);
    try {
      const response = await fetch("/api/outreach/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: lead.id,
          type: AI_OUTREACH_TYPE,
          recipientEmails: selectedEmails,
          subject,
          body,
          status: "opened_in_client",
        }),
      });
      if (!response.ok) {
        const payload = await response.json();
        setError(payload.error || "Failed to save outreach record.");
      }
      await fetchLead();
    } catch {
      // keep silent in UI to avoid blocking mailto flow
    }
  }

  function withSignature(content: string) {
    const signature = userEmail ? `\n\n---\n${userEmail}` : "";
    return `${content}${signature}`;
  }

  function openInEmailClient() {
    if (selectedEmails.length === 0) return;
    if (!subject.trim() && !body.trim()) return;
    const recipients = selectedEmails.join(",");
    const encodedSubject = encodeURIComponent(subject.trim() || " ");
    const encodedBody = encodeURIComponent(withSignature(body.trim() || ""));
    const mailtoLink = `mailto:${recipients}?subject=${encodedSubject}&body=${encodedBody}`;
    window.location.href = mailtoLink;
    if (subject.trim() && body.trim()) void saveOutreachRecord();
  }

  function handlePrimaryOpenEmail() {
    setError(null);
    if (selectedEmails.length === 0) {
      setError("Select an email above.");
      return;
    }
    if (!subject.trim() && !body.trim()) {
      setError("Write a subject or body first.");
      return;
    }
    openInEmailClient();
  }

  if (loading) {
    return <div className="max-w-4xl mx-auto px-6 py-8 text-sm text-ink-500">Loading lead...</div>;
  }

  if (!lead) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-8">
        <p className="text-sm text-red-600 mb-3">Lead not found.</p>
        <Link href="/dashboard/leads" className="btn-secondary">
          <ArrowLeft className="w-4 h-4" /> Back to leads
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/dashboard/leads" className="btn-ghost text-sm">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
      </div>

      <section className="card p-5">
        <h1 className="text-2xl font-bold text-ink-900">{lead.company_name || "Unknown Company"}</h1>
        <div className="flex flex-wrap items-center gap-2 mt-2">
          {lead.industry && <span className="badge bg-brand-50 text-brand-700">{lead.industry}</span>}
          <a href={lead.source_url} target="_blank" rel="noreferrer" className="text-sm text-brand-600 inline-flex items-center gap-1">
            <ExternalLink className="w-3.5 h-3.5" /> {lead.source_url}
          </a>
        </div>
        {lead.company_info && <p className="text-sm text-ink-600 mt-3">{lead.company_info}</p>}
      </section>

      <section className="card p-5">
        <h2 className="text-lg font-semibold text-ink-900 mb-3">Extracted Emails ({emails.length})</h2>
        <div className="space-y-2">
          {emails.map((item, idx) => (
            <label key={`${item.email}-${idx}`} className="flex items-center justify-between gap-3 border border-surface-200 rounded-lg px-3 py-2">
              <div className="flex items-center gap-3 min-w-0">
                <input
                  type="checkbox"
                  checked={selectedEmails.includes(item.email)}
                  onChange={() => toggleEmail(item.email)}
                />
                <span className="text-sm text-ink-800 truncate">{item.email}</span>
              </div>
              <span
                className={cn(
                  "badge text-[10px]",
                  item.confidence === "high"
                    ? "bg-emerald-50 text-emerald-700"
                    : item.confidence === "medium"
                      ? "bg-amber-50 text-amber-700"
                      : "bg-surface-100 text-ink-500"
                )}
              >
                {item.confidence}
              </span>
            </label>
          ))}
        </div>
        <p className="mt-3 text-xs text-ink-500">
          {selectedEmails.length === 0
            ? "None selected"
            : selectedEmails.length === 1
              ? "1 selected"
              : `${selectedEmails.length} selected`}
        </p>
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="text-base font-semibold text-ink-900">Write Your Email</h2>

        <p className="text-xs text-ink-600">
          <span className="text-ink-500">To:</span>{" "}
          {selectedEmails.length === 0
            ? "Select an email above"
            : selectedEmails.length === 1
              ? selectedEmails[0]
              : `${selectedEmails.length} selected emails`}
        </p>

        <input
          className="input-field"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject"
        />
        <textarea
          className="input-field min-h-36"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write your email here..."
        />

        <div className="flex items-center justify-between gap-3 pt-1">
          <button
            type="button"
            onClick={() => void generateEmail()}
            disabled={generating || selectedEmails.length === 0}
            className="btn-secondary inline-flex shrink-0 items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold"
          >
            <Sparkles className="h-3.5 w-3.5 text-brand-600" />
            {generating ? "Generating…" : "AI Generate"}
          </button>
          <button
            type="button"
            onClick={handlePrimaryOpenEmail}
            className="btn-primary inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 py-2.5 text-sm font-semibold sm:flex-initial sm:px-6"
          >
            <ExternalLink className="h-4 w-4 shrink-0" />
            Open in Email
          </button>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </section>
    </div>
  );
}
