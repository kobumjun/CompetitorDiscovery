"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useSWRConfig } from "swr";
import { createClient } from "@/lib/supabase/client";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  AlertCircle,
  Sparkles,
  Plus,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Client, ProposalTone, BusinessProfile } from "@/types";
import { DASHBOARD_CREDITS_KEY } from "@/lib/use-dashboard-credits";

const SECTIONS = [
  "Cover Letter",
  "Scope of Work",
  "Deliverables",
  "Timeline",
  "Pricing",
  "Terms & Conditions",
  "Next Steps",
];

export default function NewProposalPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { mutate } = useSWRConfig();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [credits, setCredits] = useState(0);
  const [profile, setProfile] = useState<BusinessProfile | null>(null);

  const [clientId, setClientId] = useState("");
  const [newClientName, setNewClientName] = useState("");
  const [newContactName, setNewContactName] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [timeline, setTimeline] = useState("");

  const [sections, setSections] = useState<string[]>([...SECTIONS]);
  const [tone, setTone] = useState<ProposalTone>("professional");
  const [additionalInstructions, setAdditionalInstructions] = useState("");
  const [proposalMode, setProposalMode] = useState<"ai" | "manual">("ai");
  const [manualContent, setManualContent] = useState("");

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const [clientsRes, creditsRes, profileRes] = await Promise.all([
        supabase.from("clients").select("*").eq("user_id", user.id).order("company_name"),
        supabase.from("users").select("credits").eq("id", user.id).single(),
        supabase.from("business_profiles").select("*").eq("user_id", user.id).maybeSingle(),
      ]);

      if (clientsRes.data) setClients(clientsRes.data as Client[]);
      if (creditsRes.data) setCredits(creditsRes.data.credits);
      if (profileRes.data) {
        const p = profileRes.data as BusinessProfile;
        setProfile(p);
        setTone(p.tone);
      }
    }
    fetchData();
  }, []);

  useEffect(() => {
    const prefClient = searchParams.get("client");
    const prefEmail = searchParams.get("email");
    const prefCompany = searchParams.get("company");
    if (prefClient) setClientId(prefClient);
    if (prefEmail) setNewClientEmail(prefEmail);
    if (prefCompany) setNewClientName(prefCompany);
  }, [searchParams]);

  function toggleSection(s: string) {
    setSections((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  }

  const selectedClient = clients.find((c) => c.id === clientId);
  const clientName = clientId === "new" ? newClientName : selectedClient?.company_name || "";
  const contactName = clientId === "new" ? newContactName : selectedClient?.contact_name || "";

  async function handleGenerate() {
    setError("");
    setLoading(true);

    try {
      let resolvedClientId = clientId === "new" || !clientId ? null : clientId;

      if (clientId === "new" && newClientName.trim()) {
        const res = await fetch("/api/clients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            company_name: newClientName.trim(),
            contact_name: newContactName.trim() || null,
            email: newClientEmail.trim() || null,
          }),
        });
        const clientData = await res.json();
        if (clientData.id) resolvedClientId = clientData.id;
      }

      const res = await fetch("/api/proposals/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: resolvedClientId,
          clientName,
          contactName,
          projectName,
          projectDescription,
          budget: budget ? parseFloat(budget) : null,
          timeline: timeline || null,
          sections,
          tone,
          additionalInstructions: additionalInstructions || null,
          isManual: proposalMode === "manual",
          manualContent: proposalMode === "manual" ? manualContent : null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to generate proposal");
        setLoading(false);
        return;
      }

      if (typeof data.remainingCredits === "number") {
        setCredits(data.remainingCredits);
        void mutate(DASHBOARD_CREDITS_KEY, data.remainingCredits, false);
      } else {
        void mutate(DASHBOARD_CREDITS_KEY);
      }

      router.push(`/dashboard/proposals/${data.proposal.id}`);
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <Link href="/dashboard" className="btn-ghost -ml-3 text-ink-500 mb-6 inline-flex">
        <ArrowLeft className="w-4 h-4" /> Back
      </Link>

      <div className="mb-8">
        <h1 className="text-display font-bold text-ink-900">Create Proposal</h1>
        <p className="text-ink-500 mt-1">Fill in project details and let AI craft your proposal</p>
      </div>

      <div className="flex gap-2 mb-8">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={cn(
              "flex-1 h-1.5 rounded-full",
              step >= s ? "bg-brand-500" : "bg-surface-200"
            )}
          />
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-5 animate-in">
          <h2 className="text-lg font-bold text-ink-900">Project Basics</h2>

          <div>
            <label className="text-sm font-medium text-ink-700 mb-1.5 block">Client</label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="input-field"
            >
              <option value="">No client selected</option>
              <option value="new">+ Add New Client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.company_name}</option>
              ))}
            </select>
          </div>

          {clientId === "new" && (
            <div className="space-y-3 pl-4 border-l-2 border-brand-200">
              <input value={newClientName} onChange={(e) => setNewClientName(e.target.value)} className="input-field" placeholder="Company name *" />
              <input value={newContactName} onChange={(e) => setNewContactName(e.target.value)} className="input-field" placeholder="Contact name" />
              <input value={newClientEmail} onChange={(e) => setNewClientEmail(e.target.value)} className="input-field" placeholder="Email" type="email" />
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-ink-700 mb-1.5 block">Project Name *</label>
            <input value={projectName} onChange={(e) => setProjectName(e.target.value)} className="input-field" placeholder="e.g., Website Redesign for Acme Corp" required />
          </div>

          <div>
            <label className="text-sm font-medium text-ink-700 mb-1.5 block">
              Project Description *
            </label>
            <textarea
              value={projectDescription}
              onChange={(e) => setProjectDescription(e.target.value)}
              className="input-field resize-none"
              rows={6}
              placeholder="Describe the project in your own words. Include what the client needs, goals, challenges, and specific requirements."
              required
            />
            <p className="text-xs text-ink-400 mt-1">
              The more detail you provide, the better the AI-generated proposal will be.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-ink-700 mb-1.5 block">Budget</label>
              <input value={budget} onChange={(e) => setBudget(e.target.value)} className="input-field" placeholder="e.g., 5000" type="number" />
            </div>
            <div>
              <label className="text-sm font-medium text-ink-700 mb-1.5 block">Timeline</label>
              <input value={timeline} onChange={(e) => setTimeline(e.target.value)} className="input-field" placeholder="e.g., 4 weeks" />
            </div>
          </div>

          <button
            onClick={() => setStep(2)}
            disabled={!projectName.trim() || !projectDescription.trim()}
            className="btn-primary w-full"
          >
            Next: Customize <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5 animate-in">
          <h2 className="text-lg font-bold text-ink-900">Customize</h2>

          <div>
            <label className="text-sm font-medium text-ink-700 mb-2 block">Include Sections</label>
            <div className="flex flex-wrap gap-2">
              {SECTIONS.map((s) => {
                const active = sections.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleSection(s)}
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1.5",
                      active ? "bg-brand-50 border-brand-300 text-brand-700" : "bg-white border-surface-200 text-ink-500"
                    )}
                  >
                    {active && <Check className="w-3 h-3" />}
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-ink-700 mb-2 block">Tone</label>
            <div className="grid grid-cols-3 gap-2">
              {(["professional", "friendly", "casual"] as ProposalTone[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTone(t)}
                  className={cn(
                    "px-3 py-2.5 text-sm font-medium rounded-lg border transition-colors capitalize",
                    tone === t ? "bg-brand-50 border-brand-300 text-brand-700" : "bg-white border-surface-200 text-ink-500"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-ink-700 mb-1.5 block">
              Additional Instructions (optional)
            </label>
            <textarea
              value={additionalInstructions}
              onChange={(e) => setAdditionalInstructions(e.target.value)}
              className="input-field resize-none"
              rows={3}
              placeholder="Anything specific you want the AI to emphasize?"
            />
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="btn-secondary flex-1">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <button onClick={() => setStep(3)} className="btn-primary flex-1">
              Next: Review <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-5 animate-in">
          <h2 className="text-lg font-bold text-ink-900">Ready to generate?</h2>

          <div className="card p-5 space-y-3">
            <Row label="Client" value={clientName || "None"} />
            <Row label="Project" value={projectName} />
            {budget && <Row label="Budget" value={`${profile?.currency || "USD"} ${budget}`} />}
            {timeline && <Row label="Timeline" value={timeline} />}
            <Row label="Tone" value={tone} capitalize />
            <Row label="Sections" value={sections.join(", ")} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => setProposalMode("ai")}
              className={cn(
                "text-left rounded-lg border p-4",
                proposalMode === "ai"
                  ? "border-brand-300 bg-brand-50"
                  : "border-surface-200 bg-white"
              )}
            >
              <div className="font-semibold text-ink-900">✨ AI Generate</div>
              <p className="text-xs text-ink-500 mt-1">
                AI writes the full proposal from project details. Uses 1 credit.
              </p>
            </button>
            <button
              onClick={() => setProposalMode("manual")}
              className={cn(
                "text-left rounded-lg border p-4",
                proposalMode === "manual"
                  ? "border-brand-300 bg-brand-50"
                  : "border-surface-200 bg-white"
              )}
            >
              <div className="font-semibold text-ink-900">✍️ Write Manually</div>
              <p className="text-xs text-ink-500 mt-1">
                Write your own proposal from scratch. No credits used.
              </p>
            </button>
          </div>

          {proposalMode === "ai" ? (
            <div className="card p-4 bg-brand-50 border-brand-200">
              <p className="text-sm text-brand-800">
                This will use <strong>1 credit</strong>. You have{" "}
                <strong>{credits}</strong> credit{credits !== 1 ? "s" : ""} remaining.
              </p>
            </div>
          ) : (
            <div className="card p-4">
              <textarea
                className="input-field min-h-[320px]"
                value={manualContent}
                onChange={(e) => setManualContent(e.target.value)}
                placeholder={"Write your proposal here...\n\nInclude:\n- Project overview\n- Scope of work\n- Timeline\n- Pricing\n- Terms and conditions"}
              />
              <p className="text-xs text-ink-400 mt-2">No credits used in manual mode.</p>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => setStep(2)} className="btn-secondary flex-1" disabled={loading}>
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <button
              onClick={handleGenerate}
              disabled={loading || (proposalMode === "ai" ? credits < 1 : !manualContent.trim())}
              className="btn-primary flex-1"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Generating...
                </>
              ) : (
                <>
                  {proposalMode === "ai" ? <Sparkles className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  {proposalMode === "ai" ? "Generate Proposal" : "Save Manual Proposal"}
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, capitalize }: { label: string; value: string; capitalize?: boolean }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-ink-500">{label}</span>
      <span className={cn("text-ink-900 font-medium text-right max-w-[60%] truncate", capitalize && "capitalize")}>
        {value}
      </span>
    </div>
  );
}
