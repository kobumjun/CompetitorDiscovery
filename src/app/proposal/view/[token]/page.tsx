import { createServiceClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { formatCurrency } from "@/types";
import type { ProposalContent } from "@/types";
import { SignatureSection } from "./signature";

export default async function PublicProposalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createServiceClient();

  const { data: proposal } = await supabase
    .from("proposals")
    .select("*, client:clients(*), user:users(email)")
    .eq("share_token", token)
    .single();

  if (!proposal) notFound();

  const { data: profile } = await supabase
    .from("business_profiles")
    .select("*")
    .eq("user_id", proposal.user_id)
    .maybeSingle();

  // Track view
  await supabase
    .from("proposals")
    .update({
      view_count: (proposal.view_count || 0) + 1,
      first_viewed_at: proposal.first_viewed_at || new Date().toISOString(),
      last_viewed_at: new Date().toISOString(),
      status: proposal.status === "sent" ? "viewed" : proposal.status,
    })
    .eq("id", proposal.id);

  await supabase.from("proposal_activities").insert({
    proposal_id: proposal.id,
    type: "viewed",
  });

  const content = proposal.content as ProposalContent;
  const currency = proposal.currency || "USD";
  const isExpired = proposal.expires_at && new Date(proposal.expires_at) < new Date();

  return (
    <div className="min-h-screen bg-surface-50">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="bg-white rounded-xl shadow-card overflow-hidden">
          {/* Header */}
          <div className="p-8 border-b border-surface-200">
            <div className="flex items-start justify-between mb-8">
              <div>
                <h2 className="text-lg font-bold text-ink-900">
                  {profile?.business_name || ""}
                </h2>
                {profile?.email && <p className="text-sm text-ink-500">{profile.email}</p>}
                {profile?.phone && <p className="text-sm text-ink-500">{profile.phone}</p>}
              </div>
              <p className="text-sm text-ink-400">
                {new Date(proposal.created_at).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
            <h1 className="text-2xl font-black text-ink-900 mb-2">{proposal.title}</h1>
            {proposal.client && (
              <p className="text-sm text-ink-500">
                Prepared for: <strong>{(proposal.client as any).company_name}</strong>
              </p>
            )}
          </div>

          <div className="p-8 space-y-8">
            {content.coverLetter && (
              <Sec title="Introduction">
                <p className="text-sm text-ink-700 leading-relaxed whitespace-pre-wrap">{content.coverLetter}</p>
              </Sec>
            )}

            {content.scope?.length > 0 && (
              <Sec title="Scope of Work">
                {content.scope.map((s, i) => (
                  <div key={i} className="mb-3">
                    <h4 className="text-sm font-bold text-ink-800">{s.title}</h4>
                    <p className="text-sm text-ink-600 mt-1">{s.description}</p>
                  </div>
                ))}
              </Sec>
            )}

            {content.deliverables?.length > 0 && (
              <Sec title="Deliverables">
                <ul className="space-y-1.5">
                  {content.deliverables.map((d, i) => (
                    <li key={i} className="text-sm text-ink-700">✓ {d}</li>
                  ))}
                </ul>
              </Sec>
            )}

            {content.timeline?.length > 0 && (
              <Sec title="Timeline">
                {content.timeline.map((t, i) => (
                  <div key={i} className="flex gap-4 mb-2">
                    <span className="text-sm font-bold text-brand-600 min-w-[90px]">{t.phase}</span>
                    <span className="text-sm text-ink-600">{t.description}</span>
                  </div>
                ))}
              </Sec>
            )}

            {content.pricing?.length > 0 && (
              <Sec title="Investment">
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
                          {formatCurrency(p.amount, currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={2} className="py-3 text-ink-900 font-bold text-lg">Total</td>
                      <td className="py-3 text-ink-900 font-bold text-lg text-right">
                        {formatCurrency(content.totalAmount, currency)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </Sec>
            )}

            {content.terms && (
              <Sec title="Terms & Conditions">
                <p className="text-sm text-ink-600 leading-relaxed whitespace-pre-wrap">{content.terms}</p>
              </Sec>
            )}

            {content.nextSteps && (
              <Sec title="Next Steps">
                <p className="text-sm text-ink-700 leading-relaxed whitespace-pre-wrap">{content.nextSteps}</p>
              </Sec>
            )}
          </div>

          {/* Signature area */}
          <div className="p-8 border-t border-surface-200 bg-surface-50">
            {proposal.signed_at ? (
              <div className="text-center">
                <p className="text-emerald-700 font-bold text-lg mb-1">✓ Proposal Accepted</p>
                <p className="text-sm text-ink-500">
                  Signed by {proposal.signed_by_name} on{" "}
                  {new Date(proposal.signed_at).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
            ) : isExpired ? (
              <div className="text-center">
                <p className="text-red-600 font-bold">This proposal has expired</p>
              </div>
            ) : (
              <SignatureSection proposalId={proposal.id} />
            )}
          </div>
        </div>

        <p className="text-center text-xs text-ink-400 mt-8">
          Powered by ProposalPilot
        </p>
      </div>
    </div>
  );
}

function Sec({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-bold text-ink-900 mb-3 pb-2 border-b border-surface-100">{title}</h2>
      {children}
    </section>
  );
}
