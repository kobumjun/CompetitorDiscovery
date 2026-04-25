"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Rocket, Loader2, AlertCircle, Sparkles } from "lucide-react";
import { GoogleAuthTrigger } from "@/components/google-auth-trigger";

export default function SignupPageClient() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function startGoogleAuth() {
    setError("");
    setLoading(true);

    try {
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session) {
        router.push("/dashboard");
        router.refresh();
        return;
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?redirect=/dashboard`,
        },
      });

      if (error) {
        setError(error.message);
      }
    } catch {
      setError("Google sign-in failed. Please try again.");
      setLoading(false);
      return;
    }

    setLoading(false);
  }

  useEffect(() => {
    void startGoogleAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <Rocket className="w-7 h-7 text-brand-500" strokeWidth={2.5} />
            <span className="text-xl font-bold text-ink-900">ProposalPilot</span>
          </Link>
          <h1 className="text-heading font-bold text-ink-900">
            Start free with Google
          </h1>
          <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 bg-brand-50 border border-brand-200 rounded-full">
            <Sparkles className="w-3.5 h-3.5 text-brand-600" />
            <span className="text-xs font-semibold text-brand-700">5 free credits included</span>
          </div>
        </div>

        <div className="card p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
            </div>
          )}

          <button type="button" onClick={startGoogleAuth} disabled={loading} className="btn-primary w-full">
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Redirecting to Google...
              </>
            ) : (
              "Continue with Google"
            )}
          </button>
        </div>

        <p className="text-center text-sm text-ink-500 mt-6">
          Already have an account?{" "}
          <GoogleAuthTrigger className="text-brand-600 font-medium hover:text-brand-700">Continue with Google</GoogleAuthTrigger>
        </p>
      </div>
    </div>
  );
}
