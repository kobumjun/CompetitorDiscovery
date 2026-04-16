"use client";

import { useState } from "react";
import { ChevronRight, Loader2 } from "lucide-react";
import type { PaidPlan } from "@/lib/lemonsqueezy";
import { cn } from "@/lib/utils";

type Props = {
  plan: PaidPlan;
  popular?: boolean;
  className?: string;
};

export function PlanCheckoutButton({ plan, popular, className }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function startCheckout() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = (await res.json()) as { url?: string; error?: string };

      if (!res.ok || !data.url) {
        setError(data.error || "Could not start checkout");
        setLoading(false);
        return;
      }

      window.location.assign(data.url);
    } catch {
      setError("Network error. Try again.");
      setLoading(false);
    }
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={startCheckout}
        disabled={loading}
        className={cn(
          popular ? "btn-primary" : "btn-secondary",
          "w-full text-center disabled:opacity-60"
        )}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Redirecting…
          </>
        ) : (
          <>
            Get Started
            <ChevronRight className="w-4 h-4" />
          </>
        )}
      </button>
      {error ? (
        <p className="text-xs text-red-600 mt-2 text-center">{error}</p>
      ) : null}
    </div>
  );
}
