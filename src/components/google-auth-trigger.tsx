"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type GoogleAuthTriggerProps = {
  children: React.ReactNode;
  className?: string;
};

export function GoogleAuthTrigger({ children, className }: GoogleAuthTriggerProps) {
  const router = useRouter();

  async function handleGoogleAuth() {
    const supabase = createClient();
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session) {
      router.push("/dashboard");
      router.refresh();
      return;
    }

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?redirect=/dashboard`,
      },
    });
  }

  return (
    <button type="button" onClick={handleGoogleAuth} className={className}>
      {children}
    </button>
  );
}
