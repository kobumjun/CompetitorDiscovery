"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSWRConfig } from "swr";
import { createClient } from "@/lib/supabase/client";
import type { ExtractedLead, ExtractedEmail, OutreachType } from "@/types";
import { ArrowLeft, Copy, ExternalLink, Mail, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { DASHBOARD_CREDITS_KEY } from "@/lib/use-dashboard-credits";

const OUTREACH_TYPES: { key: OutreachType; label: string }[] = [
  { key: "proposal", label: "Proposal" },
  { key: "pitch", label: "Sales Pitch" },
  { key: "investment", label: "Investment Proposal" },
  { key: "quote", label: "Quote / Estimate" },
];

export default function LeadDetailPage() {
  const params = useParams<{ id: string }>();
  const leadId = params?.id;
  const { mutate } = useSWRConfig();

  const [lead, setLead] = useState<ExtractedLead | null>(null);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [type, setType] = useState<OutreachType>("proposal");
  const [writeMode, setWriteMode] = useState<"ai" | "manual">("ai");
  const [context, setContext] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [bccSelf, setBccSelf] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showFirstSuccess, setShowFirstSuccess] = useState(false);

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
      if (typeof payload.remainingCredits === "number") {
        void mutate(DASHBOARD_CREDITS_KEY, payload.remainingCredits, false);
      } else {
        void mutate(DASHBOARD_CREDITS_KEY);
      }
      if ((lead.outreach_count ?? 0) === 0) {
        setShowFirstSuccess(true);
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
          type,
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
    if (!subject || !body || selectedEmails.length === 0) return;
    const recipients = selectedEmails.join(",");
    const encodedSubject = encodeURIComponent(subject);
    const encodedBody = encodeURIComponent(withSignature(body));
    const bcc = bccSelf && userEmail ? `&bcc=${encodeURIComponent(userEmail)}` : "";
    const mailtoLink = `mailto:${recipients}?subject=${encodedSubject}&body=${encodedBody}${bcc}`;
    window.location.href = mailtoLink;
    setNotice("Opened your default email client.");
    void saveOutreachRecord();
  }

  function openInGmail() {
    if (!subject || !body || selectedEmails.length === 0) return;
    const recipients = selectedEmails.join(",");
    const encodedSubject = encodeURIComponent(subject);
    const encodedBody = encodeURIComponent(withSignature(body));
    const bcc = bccSelf && userEmail ? `&bcc=${encodeURIComponent(userEmail)}` : "";
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(recipients)}&su=${encodedSubject}&body=${encodedBody}${bcc}`;
    window.open(gmailUrl, "_blank");
    setNotice("Opened Gmail compose in a new tab.");
    void saveOutreachRecord();
  }

  async function copyToClipboard() {
    try {
      const fullEmail = `To: ${selectedEmails.join(", ")}\nSubject: ${subject}\n\n${withSignature(body)}`;
      await navigator.clipboard.writeText(fullEmail);
      setNotice("Email copied to clipboard.");
      void saveOutreachRecord();
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
          <span className="text-xs text-ink-500 bg-surface-100 px-2 py-1 rounded-md">
            Tip: use this tool for businesses you have a genuine reason to contact.
          </span>
        </div>
      </section>

      <section className="card p-5 space-y-4">
        <h2 className="text-lg font-semibold text-ink-900">Write Your Email</h2>
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            onClick={() => setWriteMode("ai")}
            className={cn(
              "btn-secondary justify-center",
              writeMode === "ai" && "bg-brand-50 border-brand-300 text-brand-700"
            )}
          >
            ✨ Generate with AI
          </button>
          <button
            onClick={() => setWriteMode("manual")}
            className={cn(
              "btn-secondary justify-center",
              writeMode === "manual" && "bg-brand-50 border-brand-300 text-brand-700"
            )}
          >
            ✍️ Write it myself
          </button>
        </div>

        {writeMode === "ai" && (
          <>
            <textarea
              className="input-field min-h-28"
              placeholder="Specific context for this outreach..."
              value={context}
              onChange={(e) => setContext(e.target.value)}
            />
            <button
              onClick={generateEmail}
              disabled={generating || selectedEmails.length === 0}
              className="btn-primary"
            >
              <Mail className="w-4 h-4" />
              {generating ? "Generating..." : "Generate Email with AI (1 credit)"}
            </button>
          </>
        )}

        {writeMode === "manual" && (
          <>
            <input
              className="input-field"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject line"
            />
            <textarea
              className="input-field min-h-64"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your email here..."
            />
            <p className="text-xs text-ink-400">No credits used when writing manually.</p>
          </>
        )}

        {subject && body && (
          <div className="space-y-3">
            <div className="rounded-xl border border-surface-200 bg-white shadow-sm">
              <div className="px-4 py-3 border-b border-surface-200">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Subject</p>
                <p className="text-sm font-semibold text-ink-900 mt-1 break-words">{subject}</p>
              </div>
              <div className="px-4 py-3 max-h-80 overflow-y-auto">
                <p className="text-sm text-ink-700 whitespace-pre-wrap leading-relaxed">{body}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {writeMode === "ai" && (
                <button onClick={generateEmail} className="btn-secondary" disabled={generating}>
                  <RefreshCw className="w-4 h-4" /> Regenerate
                </button>
              )}
              <button
                onClick={openInEmailClient}
                className="btn-primary"
                disabled={!subject || !body || selectedEmails.length === 0}
              >
                Open in Email Client
              </button>
              <button
                onClick={openInGmail}
                className="btn-secondary"
                disabled={!subject || !body || selectedEmails.length === 0}
              >
                Open in Gmail (Web)
              </button>
              <button onClick={copyToClipboard} className="btn-secondary">
                <Copy className="w-4 h-4" /> Copy Email
              </button>
            </div>
            <label className="flex items-center gap-2 text-sm text-ink-600">
              <input
                type="checkbox"
                checked={bccSelf}
                onChange={(e) => setBccSelf(e.target.checked)}
              />
              Also send a copy to myself (BCC)
            </label>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              This opens your email client with everything pre-filled. The email sends from your address, so replies come directly to your inbox.
            </div>
            {subject.length + body.length > 1800 && (
              <div className="text-xs text-amber-700">
                This email is long. If it looks cut off in your email client, use "Copy Email" instead.
              </div>
            )}
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        {notice && <p className="text-sm text-emerald-700">{notice}</p>}
        {showFirstSuccess && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <h3 className="text-sm font-semibold text-emerald-800">🎉 First outreach generated!</h3>
            <p className="text-sm text-emerald-700 mt-1">You just saved around 30 minutes of work.</p>
            <p className="text-xs text-ink-500 mt-3">
              Complete your business profile for even more personalized emails in
              {" "}
              <Link href="/dashboard/settings" className="text-brand-600 hover:text-brand-700">
                Settings
              </Link>.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
