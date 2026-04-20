"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";

export function NewUserOnboarding({ user }: { user: User }) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const firstName =
    (user.user_metadata?.name as string | undefined)?.split(" ")[0] ||
    (user.email?.split("@")[0] ?? "there");

  async function handleStart() {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/leads/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.lead?.id) {
        setError(data.message || data.error || "Extraction failed. Try another URL.");
        return;
      }
      router.push(`/dashboard/leads/${data.lead.id}`);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <div className="card p-8 sm:p-10 text-center">
        <h1 className="text-3xl sm:text-4xl font-black text-ink-900">
          Welcome to ProposalPilot, {firstName} 👋
        </h1>
        <p className="text-ink-500 mt-3 max-w-2xl mx-auto">
          Paste any company website to see it in action. We will find contact emails
          and help you write a personalized outreach in under a minute.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row gap-3 max-w-2xl mx-auto">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleStart()}
            placeholder="https://example.com"
            autoFocus
            className="input-field h-14 text-base sm:text-lg"
          />
          <button
            onClick={handleStart}
            disabled={!url.trim() || loading}
            className="btn-primary h-14 px-7 text-base"
          >
            {loading ? "Extracting..." : "Try It Now →"}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm">
          <span className="text-ink-500">Try with:</span>
          {["https://stripe.com", "https://vercel.com", "https://linear.app"].map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => setUrl(suggestion)}
              className="rounded-full border border-surface-300 bg-surface-50 px-3 py-1 text-ink-700 hover:bg-surface-100"
            >
              {suggestion.replace("https://", "")}
            </button>
          ))}
        </div>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-ink-600">
          <div className="rounded-lg border border-surface-200 bg-surface-50 px-3 py-2">1. Paste URL</div>
          <div className="rounded-lg border border-surface-200 bg-surface-50 px-3 py-2">2. AI finds contacts</div>
          <div className="rounded-lg border border-surface-200 bg-surface-50 px-3 py-2">3. Write your email</div>
        </div>

        {error && <p className="mt-5 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
