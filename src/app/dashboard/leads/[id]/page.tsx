"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { ExtractedLead, ExtractedEmail, Outreach, OutreachType } from "@/types";
import { ArrowLeft, Copy, ExternalLink, Mail, RefreshCw, Send } from "lucide-react";
import { cn } from "@/lib/utils";

const OUTREACH_TYPES: { key: OutreachType; label: string }[] = [
  { key: "proposal", label: "Proposal" },
  { key: "pitch", label: "Sales Pitch" },
  { key: "investment", label: "Investment Proposal" },
  { key: "quote", label: "Quote / Estimate" },
];

export default function LeadDetailPage() {
  const params = useParams<{ id: string }>();
  const leadId = params?.id;

  const [lead, setLead] = useState<ExtractedLead | null>(null);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [type, setType] = useState<OutreachType>("proposal");
  const [context, setContext] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [draftOutreachIds, setDraftOutreachIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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

  function toggleEmail(email: string) {
    setSelectedEmails((prev) =>
      prev.includes(email) ? prev.filter((item) => item !== email) : [...prev, email]
    );
  }

  async function generateEmail() {
    if (!lead || selectedEmails.length === 0) return;
    setGenerating(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/outreach/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: lead.id,
          type,
          context,
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
      setDraftOutreachIds((payload.outreaches || []).map((o: Outreach) => o.id));
      await fetchLead();
    } catch {
      setError("Unexpected error while generating outreach.");
    } finally {
      setGenerating(false);
    }
  }

  async function sendEmail() {
    if (!subject || !body || draftOutreachIds.length === 0) return;
    setSending(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/outreach/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outreachIds: draftOutreachIds,
          subject,
          body,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error || "Failed to send outreach");
        return;
      }

      const successCount = (payload.results || []).filter((r: { success: boolean }) => r.success).length;
      setNotice(`Sent ${successCount}/${draftOutreachIds.length} emails.`);
    } catch {
      setError("Unexpected error while sending outreach.");
    } finally {
      setSending(false);
    }
  }

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
      setNotice("Copied to clipboard.");
    } catch {
      setError("Clipboard copy failed.");
    }
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
        <div className="flex items-center justify-between mt-4">
          <span className="text-xs text-ink-500">{selectedEmails.length} selected</span>
          <span className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded-md">
            You must have permission to contact these emails.
          </span>
        </div>
      </section>

      <section className="card p-5 space-y-4">
        <h2 className="text-lg font-semibold text-ink-900">Compose Outreach</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {OUTREACH_TYPES.map((item) => (
            <button
              key={item.key}
              onClick={() => setType(item.key)}
              className={cn(
                "btn-secondary justify-start",
                type === item.key && "bg-brand-50 border-brand-300 text-brand-700"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        <textarea
          className="input-field min-h-28"
          placeholder="Specific context for this outreach..."
          value={context}
          onChange={(e) => setContext(e.target.value)}
        />

        {!subject && !body ? (
          <button
            onClick={generateEmail}
            disabled={generating || selectedEmails.length === 0}
            className="btn-primary"
          >
            <Mail className="w-4 h-4" />
            {generating ? "Generating..." : "Generate Email with AI (1 credit)"}
          </button>
        ) : (
          <div className="space-y-3">
            <input
              className="input-field"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
            />
            <textarea
              className="input-field min-h-64"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Body"
            />
            <div className="flex flex-wrap gap-2">
              <button onClick={generateEmail} className="btn-secondary" disabled={generating}>
                <RefreshCw className="w-4 h-4" /> Regenerate
              </button>
              <button onClick={copyToClipboard} className="btn-secondary">
                <Copy className="w-4 h-4" /> Copy
              </button>
              <button onClick={sendEmail} className="btn-primary" disabled={sending || draftOutreachIds.length === 0}>
                <Send className="w-4 h-4" /> {sending ? "Sending..." : "Send via Email"}
              </button>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        {notice && <p className="text-sm text-emerald-700">{notice}</p>}
      </section>
    </div>
  );
}
