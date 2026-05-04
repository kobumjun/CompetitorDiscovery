"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { createClient } from "@/lib/supabase/client";
import type { ExtractedEmail, ExtractedLead } from "@/types";
import { Copy, ExternalLink, Users } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import { ListPagination, LIST_PAGE_SIZE } from "@/components/list-pagination";

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

function primaryEmail(lead: ExtractedLead): string {
  const c = lead.contact_email?.trim();
  if (c) return c;
  const emails = Array.isArray(lead.emails) ? lead.emails : [];
  const first = emails[0] as ExtractedEmail | undefined;
  return first?.email?.trim() || "—";
}

function websiteForLead(lead: ExtractedLead): string {
  const w = lead.website_url?.trim() || lead.source_url?.trim();
  return w || "";
}

function statusLabel(status: string | null | undefined): string {
  switch (status) {
    case "pitch_drafted":
      return "Pitch drafted";
    case "sent":
      return "Sent";
    default:
      return "New";
  }
}

export default function LeadsPage() {
  const [listPage, setListPage] = useState(1);
  const { data: leadsData, isLoading: bootLoading, mutate } = useSWR("dashboard-extracted-leads", fetchLeadsDashboard, {
    revalidateOnFocus: true,
    dedupingInterval: 30_000,
  });
  const leads = leadsData?.leads ?? [];
  const listPageCount = Math.max(1, Math.ceil(leads.length / LIST_PAGE_SIZE));

  useEffect(() => {
    setListPage((p) => Math.min(p, listPageCount));
  }, [listPageCount, leads.length]);

  const pagedLeads = useMemo(
    () => leads.slice((listPage - 1) * LIST_PAGE_SIZE, listPage * LIST_PAGE_SIZE),
    [leads, listPage]
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-brand-600">
            <Users className="h-5 w-5" strokeWidth={2} />
            <span className="text-xs font-semibold uppercase tracking-wide">Leads</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-900 md:text-display md:font-black">Your prospects</h1>
          <p className="mt-1 max-w-xl text-sm text-ink-500">
            Emails you extract from the Dashboard are saved here automatically so you can follow up anytime.
          </p>
        </div>
        <Link href="/dashboard" className="btn-primary inline-flex w-full shrink-0 items-center justify-center gap-2 sm:w-auto">
          Find Prospects
        </Link>
      </div>

      {bootLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card animate-pulse p-4">
              <div className="mb-2 h-4 w-1/2 rounded bg-surface-200" />
              <div className="h-3 w-1/3 rounded bg-surface-100" />
            </div>
          ))}
        </div>
      ) : leads.length === 0 ? (
        <div className="card p-8 text-center md:p-10">
          <Users className="mx-auto mb-4 h-10 w-10 text-ink-300" strokeWidth={1.5} />
          <h2 className="text-lg font-bold text-ink-900">No leads yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-500">
            Search for prospects from your Dashboard. Extracted emails will be saved here.
          </p>
          <Link href="/dashboard" className="btn-primary mt-6 inline-flex items-center justify-center gap-2">
            Find Prospects
          </Link>
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-xl border border-surface-200 bg-white shadow-sm md:block">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-surface-200 bg-surface-50 text-xs font-semibold uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Website URL</th>
                  <th className="px-4 py-3">Source Keyword</th>
                  <th className="px-4 py-3">Created At</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {pagedLeads.map((lead) => {
                  const email = primaryEmail(lead);
                  const site = websiteForLead(lead);
                  return (
                    <tr key={lead.id} className="text-ink-800">
                      <td className="px-4 py-3 font-medium">{email}</td>
                      <td className="max-w-[140px] truncate px-4 py-3 text-ink-700">{lead.company_name || "—"}</td>
                      <td className="max-w-[200px] truncate px-4 py-3">
                        {site ? (
                          <a href={site} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">
                            {site}
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="max-w-[140px] truncate px-4 py-3 text-ink-600">{lead.search_keyword || "—"}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-ink-500">{formatRelativeTime(lead.created_at)}</td>
                      <td className="px-4 py-3">
                        <span className="badge bg-surface-100 text-ink-700">{statusLabel(lead.lead_status)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link href={`/dashboard/leads/${lead.id}`} className="btn-secondary inline-flex px-2.5 py-1.5 text-xs">
                            Write Pitch
                          </Link>
                          <button
                            type="button"
                            className="btn-ghost inline-flex px-2 py-1.5 text-xs"
                            onClick={() => void navigator.clipboard.writeText(email)}
                          >
                            <Copy className="mr-1 h-3.5 w-3.5" />
                            Copy Email
                          </button>
                          {site ? (
                            <a
                              href={site}
                              target="_blank"
                              rel="noreferrer"
                              className="btn-ghost inline-flex items-center gap-1 px-2 py-1.5 text-xs text-brand-600"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              Visit Website
                            </a>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {pagedLeads.map((lead) => {
              const email = primaryEmail(lead);
              const site = websiteForLead(lead);
              return (
                <div key={lead.id} className="card space-y-3 p-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Email</p>
                    <p className="mt-0.5 font-semibold text-ink-900">{email}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-ink-500">Company</p>
                      <p className="font-medium text-ink-800">{lead.company_name || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-ink-500">Status</p>
                      <p className="font-medium text-ink-800">{statusLabel(lead.lead_status)}</p>
                    </div>
                  </div>
                  {lead.search_keyword ? (
                    <div>
                      <p className="text-xs text-ink-500">Source Keyword</p>
                      <p className="text-sm text-ink-700">{lead.search_keyword}</p>
                    </div>
                  ) : null}
                  {site ? (
                    <div>
                      <p className="text-xs text-ink-500">Website</p>
                      <a href={site} target="_blank" rel="noreferrer" className="break-all text-sm text-brand-600 hover:underline">
                        {site}
                      </a>
                    </div>
                  ) : null}
                  <p className="text-xs text-ink-400">{formatRelativeTime(lead.created_at)}</p>
                  <div className="flex flex-col gap-2 border-t border-surface-100 pt-3">
                    <Link href={`/dashboard/leads/${lead.id}`} className="btn-secondary w-full text-center text-sm">
                      Write Pitch
                    </Link>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="btn-secondary flex-1 text-sm"
                        onClick={() => void navigator.clipboard.writeText(email)}
                      >
                        <Copy className="mr-1 inline h-4 w-4" />
                        Copy
                      </button>
                      {site ? (
                        <a href={site} target="_blank" rel="noreferrer" className="btn-secondary flex-1 text-center text-sm">
                          <ExternalLink className="mr-1 inline h-4 w-4" />
                          Visit
                        </a>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <ListPagination page={listPage} totalItems={leads.length} onPageChange={setListPage} className="pt-4" />
        </>
      )}
    </div>
  );
}
