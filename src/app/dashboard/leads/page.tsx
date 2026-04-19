"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { ExtractedLead } from "@/types";
import { Globe, Mail, Plus, Sparkles } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";

export default function LeadsPage() {
  const [url, setUrl] = useState("");
  const [leads, setLeads] = useState<ExtractedLead[]>([]);
  const [loading, setLoading] = useState(false);
  const [bootLoading, setBootLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchLeads() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("extracted_leads")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    setLeads((data ?? []) as ExtractedLead[]);
  }

  useEffect(() => {
    fetchLeads().finally(() => setBootLoading(false));
  }, []);

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

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-display font-bold text-ink-900">Lead Extraction</h1>
        <p className="text-ink-500 mt-1">
          Extract contacts from any website and generate personalized outreach.
        </p>
      </div>

      <div className="card p-4 mb-6">
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
            {loading ? "Extracting..." : "Extract Emails"}
          </button>
        </div>
        <p className="text-xs text-ink-400 mt-3">
          1 credit per extraction. You must have permission to contact extracted emails.
        </p>
        {error && (
          <p className="text-sm text-red-600 mt-3">{error}</p>
        )}
      </div>

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
        <div className="card p-12 text-center">
          <Globe className="w-10 h-10 text-ink-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-ink-700 mb-1">No leads yet</h3>
          <p className="text-sm text-ink-400 mb-4">
            Enter a website URL to extract contact emails.
          </p>
          <button onClick={() => setUrl("https://")} className="btn-secondary">
            <Plus className="w-4 h-4" /> Try your first extraction
          </button>
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
