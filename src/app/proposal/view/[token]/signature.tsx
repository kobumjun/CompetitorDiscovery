"use client";

import { useState } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";

export function SignatureSection({ proposalId }: { proposalId: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [signed, setSigned] = useState(false);
  const [error, setError] = useState("");

  async function handleSign() {
    if (!name.trim() || !email.trim() || !agreed) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/proposals/${proposalId}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to sign");
        setLoading(false);
        return;
      }

      setSigned(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleReject() {
    await fetch(`/api/proposals/${proposalId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "rejected" }),
    });
    window.location.reload();
  }

  if (signed) {
    return (
      <div className="text-center py-4">
        <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-ink-900 mb-1">Proposal Accepted!</h3>
        <p className="text-sm text-ink-500">
          Thank you, {name}. The proposal author has been notified.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-lg font-bold text-ink-900 mb-4">Accept this proposal</h3>

      <div className="space-y-3 mb-4">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input-field"
          placeholder="Your full name *"
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input-field"
          placeholder="Your email *"
          type="email"
        />
      </div>

      <label className="flex items-start gap-2 mb-4 cursor-pointer">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 w-4 h-4 rounded border-surface-300 text-brand-500 focus:ring-brand-500"
        />
        <span className="text-sm text-ink-600">
          I have read and agree to the terms of this proposal.
        </span>
      </label>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      <div className="flex gap-3">
        <button
          onClick={handleSign}
          disabled={loading || !name.trim() || !email.trim() || !agreed}
          className="btn-primary flex-1"
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Signing...</>
          ) : (
            "✓ Accept & Sign Proposal"
          )}
        </button>
        <button onClick={handleReject} className="btn-ghost text-sm text-ink-500">
          Decline
        </button>
      </div>
    </div>
  );
}
