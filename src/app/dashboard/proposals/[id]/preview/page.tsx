"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Printer, Copy, Check, FileText } from "lucide-react";
import type { Proposal, BusinessProfile } from "@/types";
import { formatCurrency } from "@/types";
import { createClient } from "@/lib/supabase/client";

export default function ProposalPreviewPage() {
  const params = useParams();
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function fetchData() {
      const [proposalRes, supabase] = await Promise.all([
        fetch(`/api/proposals/${params.id}`),
        Promise.resolve(createClient()),
      ]);

      if (proposalRes.ok) {
        setProposal(await proposalRes.json());
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("business_profiles")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();
        if (data) setProfile(data as BusinessProfile);
      }
      setLoading(false);
    }
    fetchData();
  }, [params.id]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-8 animate-pulse">
        <div className="h-8 bg-surface-200 rounded w-1/2 mb-4" />
        <div className="h-64 bg-surface-100 rounded-xl" />
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-8 text-center">
        <FileText className="w-12 h-12 text-ink-300 mx-auto mb-4" />
        <h2 className="text-lg font-bold text-ink-700">Proposal not found</h2>
      </div>
    );
  }

  const content = proposal.content;

  function copyShareLink() {
    const url = `${window.location.origin}/proposal/view/${proposal!.share_token}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <div className="no-print max-w-3xl mx-auto px-6 pt-8 pb-4 flex items-center justify-between">
        <Link href={`/dashboard/proposals/${proposal.id}`} className="btn-ghost text-ink-500">
          <ArrowLeft className="w-4 h-4" /> Back to Editor
        </Link>
        <div className="flex gap-2">
          <button onClick={copyShareLink} className="btn-secondary text-sm">
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            {copied ? "Copied!" : "Share Link"}
          </button>
          <button onClick={() => window.print()} className="btn-primary text-sm">
            <Printer className="w-4 h-4" /> Print / PDF
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 pb-16 print:px-0 print:max-w-none">
        <div className="bg-white print:shadow-none rounded-xl overflow-hidden">
          {/* Header */}
          <div className="p-8 border-b border-surface-200 print:border-ink-200">
            <div className="flex items-start justify-between mb-8">
              <div>
                <h2 className="text-lg font-bold text-ink-900">
                  {profile?.business_name || ""}
                </h2>
                {profile?.email && (
                  <p className="text-sm text-ink-500">{profile.email}</p>
                )}
                {profile?.phone && (
                  <p className="text-sm text-ink-500">{profile.phone}</p>
                )}
                {profile?.website && (
                  <p className="text-sm text-ink-500">{profile.website}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-sm text-ink-400">
                  {new Date(proposal.created_at).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
                {proposal.expires_at && (
                  <p className="text-xs text-ink-400 mt-1">
                    Valid until{" "}
                    {new Date(proposal.expires_at).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                )}
              </div>
            </div>

            <h1 className="text-2xl font-black text-ink-900 mb-2">{proposal.title}</h1>
            {(proposal.client as any)?.company_name && (
              <p className="text-sm text-ink-500">
                Prepared for: <strong>{(proposal.client as any).company_name}</strong>
                {(proposal.client as any)?.contact_name && (
                  <> — {(proposal.client as any).contact_name}</>
                )}
              </p>
            )}
          </div>

          <div className="p-8 space-y-8">
            {content.coverLetter && (
              <ProposalSection title="Introduction">
                <p className="text-sm text-ink-700 leading-relaxed whitespace-pre-wrap">
                  {content.coverLetter}
                </p>
              </ProposalSection>
            )}

            {content.scope?.length > 0 && (
              <ProposalSection title="Scope of Work">
                <div className="space-y-4">
                  {content.scope.map((s, i) => (
                    <div key={i}>
                      <h4 className="text-sm font-bold text-ink-800">{s.title}</h4>
                      <p className="text-sm text-ink-600 mt-1">{s.description}</p>
                    </div>
                  ))}
                </div>
              </ProposalSection>
            )}

            {content.deliverables?.length > 0 && (
              <ProposalSection title="Deliverables">
                <ul className="space-y-1.5">
                  {content.deliverables.map((d, i) => (
                    <li key={i} className="text-sm text-ink-700 flex items-start gap-2">
                      <Check className="w-4 h-4 text-brand-500 flex-shrink-0 mt-0.5" />
                      {d}
                    </li>
                  ))}
                </ul>
              </ProposalSection>
            )}

            {content.timeline?.length > 0 && (
              <ProposalSection title="Timeline">
                <div className="space-y-3">
                  {content.timeline.map((t, i) => (
                    <div key={i} className="flex gap-4 items-start">
                      <span className="text-sm font-bold text-brand-600 whitespace-nowrap min-w-[90px]">
                        {t.phase}
                      </span>
                      <span className="text-sm text-ink-600">{t.description}</span>
                    </div>
                  ))}
                </div>
              </ProposalSection>
            )}

            {content.pricing?.length > 0 && (
              <ProposalSection title="Investment">
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
                      <td colSpan={2} className="py-3 text-ink-900 font-bold text-lg">Total</td>
                      <td className="py-3 text-ink-900 font-bold text-lg text-right">
                        {formatCurrency(content.totalAmount, proposal.currency)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </ProposalSection>
            )}

            {content.terms && (
              <ProposalSection title="Terms & Conditions">
                <p className="text-sm text-ink-600 leading-relaxed whitespace-pre-wrap">
                  {content.terms}
                </p>
              </ProposalSection>
            )}

            {content.nextSteps && (
              <ProposalSection title="Next Steps">
                <p className="text-sm text-ink-700 leading-relaxed whitespace-pre-wrap">
                  {content.nextSteps}
                </p>
              </ProposalSection>
            )}

            {proposal.signed_at && (
              <div className="border-t border-surface-200 pt-6 mt-8">
                <p className="text-sm text-emerald-700 font-semibold">
                  ✓ Signed by {proposal.signed_by_name} on{" "}
                  {new Date(proposal.signed_at).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function ProposalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="print:break-inside-avoid">
      <h2 className="text-base font-bold text-ink-900 mb-3 pb-2 border-b border-surface-100">
        {title}
      </h2>
      {children}
    </section>
  );
}
