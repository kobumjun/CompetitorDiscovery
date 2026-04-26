import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { INITIAL_FREE_CREDITS } from "@/types";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const redirectTo = searchParams.get("redirect") || "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      const serviceClient = await createServiceClient();

      const { data: existingUser } = await serviceClient
        .from("users")
        .select("id")
        .eq("id", data.user.id)
        .single();

      const isNewUser = !existingUser;
      if (isNewUser) {
        await serviceClient.from("users").insert({
          id: data.user.id,
          email: data.user.email!,
          credits: INITIAL_FREE_CREDITS,
          plan: "free",
        });
      }

      const separator = redirectTo.includes("?") ? "&" : "?";
      const dest = isNewUser ? `${redirectTo}${separator}new_signup=1` : redirectTo;
      return NextResponse.redirect(`${origin}${dest}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
