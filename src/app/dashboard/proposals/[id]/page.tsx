"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  ArrowLeft,
  ExternalLink,
  Send,
  Eye,
  Printer,
  Copy,
  Check,
  Loader2,
  FileText,
  Trash2,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import type { Proposal, ProposalContent } from "@/types";
import { formatCurrency } from "@/types";

const STATUS_COLOR: Record<string, string> = {
  draft: "bg-surface-100 text-ink-600",
  sent: "bg-blue-50 text-blue-700",
  viewed: "bg-amber-50 text-amber-700",
  accepted: "bg-emerald-50 text-emerald-700",
  rejected: "bg-red-50 text-red-700",
  expired: "bg-surface-100 text-ink-400",
};

export default function ProposalEditorPage() {
  const params = useParams();
  const router = useRouter();
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [sendEmail, setSendEmail] = useState("");
  const [bccSelf, setBccSelf] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [openingEmail, setOpeningEmail] = useState(false);
  const [sendError, setSendError] = useState("");

  const fetchProposal = useCallback(async () => {
    const res = await fetch(`/api/proposals/${params.id}`);
    if (res.ok) {
      const data = await res.json();
      setProposal(data as Proposal);
    }
    setLoading(false);
  }, [params.id]);

  useEffect(() => {
    fetchProposal();
  }, [fetchProposal]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email || null));
  }, []);

  async function updateField(field: string, value: unknown) {
    if (!proposal) return;
    setSaving(true);
    await fetch(`/api/proposals/${proposal.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    setProposal((prev) => (prev ? { ...prev, [field]: value } : prev));
    setSaving(false);
  }

  async function updateContent(key: keyof ProposalContent, value: unknown) {
    if (!proposal) return;
    const updated = { ...proposal.content, [key]: value };
    await updateField("content", updated);
  }

  async function handleSendEmail() {
    if (!proposal || !sendEmail.trim()) return;
    setOpeningEmail(true);
    setSendError("");

    try {
      const recipient = sendEmail.trim();
      const shareUrl = `${window.location.origin}/proposal/view/${proposal.share_token}`;
      const clientName = proposal.client && (proposal.client as any)?.contact_name
        ? (proposal.client as any).contact_name
        : "there";
      const owner = (proposal as any)?.owner_name || "there";
      const subject = `Proposal: ${proposal.project_name || proposal.title}`;
      const body =
        `Hi ${clientName},\n\n` +
        `I've prepared a proposal for ${proposal.project_name || proposal.title}. ` +
        `You can view and sign it here:\n\n${shareUrl}\n\n` +
        `Looking forward to your feedback.\n\nBest regards,\n${owner}`;
      const bcc = bccSelf && userEmail ? `&bcc=${encodeURIComponent(userEmail)}` : "";
      const mailtoLink = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}${bcc}`;
      window.location.href = mailtoLink;

      setProposal((prev) => (prev ? { ...prev, status: "sent" } : prev));
      await fetch(`/api/proposals/${proposal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "sent" }),
      });
      setShowSendDialog(false);
      setSendEmail("");
    } catch {
      setSendError("Failed to open email client. Please try again.");
    } finally {
      setOpeningEmail(false);
    }
  }

  function copyShareLink() {
    if (!proposal) return;
    const url = `${window.location.origin}/proposal/view/${proposal.share_token}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleDelete() {
    if (!proposal || !confirm("Delete this proposal permanently?")) return;
    await fetch(`/api/proposals/${proposal.id}`, { method: "DELETE" });
    router.push("/dashboard/proposals");
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-surface-200 rounded w-1/3" />
          <div className="h-64 bg-surface-100 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-8 text-center">
        <FileText className="w-12 h-12 text-ink-300 mx-auto mb-4" />
        <h2 className="text-lg font-bold text-ink-700">Proposal not found</h2>
        <Link href="/dashboard/proposals" className="btn-secondary mt-4">Back to Proposals</Link>
      </div>
    );
  }

  const content = proposal.content;

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <Link href="/dashboard/proposals" className="btn-ghost -ml-3 text-ink-500">
          <ArrowLeft className="w-4 h-4" /> Proposals
        </Link>
        <div className="flex items-center gap-2">
          {saving && <Loader2 className="w-4 h-4 animate-spin text-ink-400" />}
          <span className={cn("badge text-xs", STATUS_COLOR[proposal.status])}>{proposal.status}</span>
        </div>
      </div>

      <div className="mb-6">
        <input
          value={proposal.title}
          onChange={(e) => setProposal((p) => p ? { ...p, title: e.target.value } : p)}
          onBlur={(e) => updateField("title", e.target.value)}
          className="text-xl font-bold text-ink-900 bg-transparent border-none outline-none w-full focus:ring-0 p-0"
        />
        <p className="text-sm text-ink-400 mt-1">
          Created {formatDate(proposal.created_at)}
          {proposal.client && <> · {(proposal.client as any).company_name}</>}
          {proposal.total_amount != null && (
            <> · {formatCurrency(proposal.total_amount, proposal.currency)}</>
          )}
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-8">
        <button onClick={copyShareLink} className="btn-secondary text-sm">
          {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
          {copied ? "Copied!" : "Copy Share Link"}
        </button>
        <Link href={`/dashboard/proposals/${proposal.id}/preview`} className="btn-secondary text-sm">
          <Eye className="w-4 h-4" /> Preview
        </Link>
        {(proposal.status === "draft" || proposal.status === "sent") && (
          <button onClick={() => { setSendEmail((proposal.client as any)?.email || ""); setShowSendDialog(true); }} className="btn-primary text-sm">
            <Send className="w-4 h-4" /> Send to Client
          </button>
        )}
        <button onClick={handleDelete} className="btn-ghost text-sm text-red-600 hover:bg-red-50">
          <Trash2 className="w-4 h-4" /> Delete
        </button>
      </div>

      {showSendDialog && (
        <div className="card p-5 mb-6 animate-in border-brand-200">
          <h3 className="text-sm font-bold text-ink-900 mb-3">Open proposal in your email client</h3>
          <div className="flex gap-2 mb-2">
            <input
              value={sendEmail}
              onChange={(e) => setSendEmail(e.target.value)}
              className="input-field flex-1"
              placeholder="client@example.com"
              type="email"
            />
            <button
              onClick={handleSendEmail}
              disabled={openingEmail || !sendEmail.trim()}
              className="btn-primary text-sm"
            >
              {openingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Open Email
            </button>
            <button onClick={() => setShowSendDialog(false)} className="btn-ghost text-sm">
              Cancel
            </button>
          </div>
          <label className="flex items-center gap-2 text-xs text-ink-600 mb-2">
            <input
              type="checkbox"
              checked={bccSelf}
              onChange={(e) => setBccSelf(e.target.checked)}
            />
            Also send a copy to myself (BCC)
          </label>
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            This opens your own mail app with recipient, subject, and body pre-filled.
          </p>
          {sendError && <p className="text-xs text-red-600 mt-2">{sendError}</p>}
        </div>
      )}

      <div className="space-y-6">
        {content.coverLetter && (
          <Section title="Cover Letter">
            <EditableText
              value={content.coverLetter}
              onChange={(v) => updateContent("coverLetter", v)}
            />
          </Section>
        )}

        {content.scope?.length > 0 && (
          <Section title="Scope of Work">
            {content.scope.map((s, i) => (
              <div key={i} className="mb-4">
                <h4 className="text-sm font-bold text-ink-800 mb-1">{s.title}</h4>
                <p className="text-sm text-ink-600">{s.description}</p>
              </div>
            ))}
          </Section>
        )}

        {content.deliverables?.length > 0 && (
          <Section title="Deliverables">
            <ul className="space-y-1.5">
              {content.deliverables.map((d, i) => (
                <li key={i} className="text-sm text-ink-700 flex items-start gap-2">
                  <Check className="w-4 h-4 text-brand-500 flex-shrink-0 mt-0.5" />
                  {d}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {content.timeline?.length > 0 && (
          <Section title="Timeline">
            <div className="space-y-3">
              {content.timeline.map((t, i) => (
                <div key={i} className="flex gap-4">
                  <span className="text-sm font-bold text-brand-600 whitespace-nowrap min-w-[80px]">{t.phase}</span>
                  <span className="text-sm text-ink-600">{t.description}</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {content.pricing?.length > 0 && (
          <Section title="Pricing">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-200">
                    <th className="text-left py-2 text-ink-500 font-medium">Item</th>
                    <th className="text-left py-2 text-ink-500 font-medium">Description</th>
                    <th className="text-right py-2 text-ink-500 font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {content.pricing.map((p, i) => (
                    <tr key={i} className="border-b border-surface-100">
                      <td className="py-2.5 text-ink-800 font-medium">{p.item}</td>
                      <td className="py-2.5 text-ink-600">{p.description}</td>
                      <td className="py-2.5 text-ink-800 text-right font-medium">
                        {formatCurrency(p.amount, proposal.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2} className="py-3 text-ink-900 font-bold">Total</td>
                    <td className="py-3 text-ink-900 font-bold text-right">
                      {formatCurrency(content.totalAmount, proposal.currency)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Section>
        )}

        {content.terms && (
          <Section title="Terms & Conditions">
            <EditableText value={content.terms} onChange={(v) => updateContent("terms", v)} />
          </Section>
        )}

        {content.nextSteps && (
          <Section title="Next Steps">
            <EditableText value={content.nextSteps} onChange={(v) => updateContent("nextSteps", v)} />
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-6">
      <h3 className="text-sm font-semibold text-ink-900 mb-4 uppercase tracking-wider">{title}</h3>
      {children}
    </div>
  );
}

function EditableText({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);

  if (editing) {
    return (
      <div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="input-field resize-none w-full"
          rows={6}
          autoFocus
        />
        <div className="flex gap-2 mt-2">
          <button
            onClick={() => { onChange(text); setEditing(false); }}
            className="btn-primary text-xs"
          >
            Save
          </button>
          <button onClick={() => { setText(value); setEditing(false); }} className="btn-ghost text-xs">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => setEditing(true)}
      className="text-sm text-ink-700 leading-relaxed whitespace-pre-wrap cursor-pointer hover:bg-surface-50 rounded-lg p-2 -m-2 transition-colors"
      title="Click to edit"
    >
      {value}
    </div>
  );
}
