"use client";

import { useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import type { OnetimePack } from "@/lib/lemonsqueezy";
import { cn } from "@/lib/utils";

type Props = {
  pack: OnetimePack;
  popular?: boolean;
  className?: string;
};

export function OnetimeCheckoutButton({ pack, popular, className }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function startCheckout() {
    setError("");
    setLoading(true);
    try {
      // TODO: Add Lemon Squeezy variant IDs (LEMONSQUEEZY_ONETIME_*_VARIANT_ID); see src/config/pricing-one-time-packs.ts
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onetime: pack }),
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
          "w-full text-center disabled:opacity-60 inline-flex items-center justify-center gap-1.5"
        )}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Redirecting…
          </>
        ) : (
          <>
            Buy Now
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>
      {error ? <p className="mt-2 text-center text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
