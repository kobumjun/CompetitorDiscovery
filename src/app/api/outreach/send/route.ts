import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendCustomOutreachEmail } from "@/lib/email";

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { outreachIds, subject, body } = await request.json();
    if (!Array.isArray(outreachIds) || outreachIds.length === 0 || !subject || !body) {
      return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
    }

    const serviceClient = await createServiceClient();

    const { data: profile } = await serviceClient
      .from("business_profiles")
      .select("business_name")
      .eq("user_id", user.id)
      .maybeSingle();

    const { data: outreaches, error: outreachFetchError } = await serviceClient
      .from("outreaches")
      .select("*, lead:extracted_leads(user_id)")
      .in("id", outreachIds);

    if (outreachFetchError || !outreaches || outreaches.length === 0) {
      return NextResponse.json({ error: "No valid outreaches found" }, { status: 404 });
    }

    const ownedOutreaches = outreaches.filter((o) => (o.lead as { user_id?: string } | null)?.user_id === user.id);
    if (ownedOutreaches.length === 0) {
      return NextResponse.json({ error: "No valid outreaches found" }, { status: 404 });
    }

    const senderName = profile?.business_name || user.email || "ProposalPilot User";

    const results = await Promise.all(
      ownedOutreaches.map(async (outreach) => {
        try {
          await sendCustomOutreachEmail({
            fromName: senderName,
            replyTo: user.email || "noreply@example.com",
            to: outreach.recipient_email,
            subject,
            body,
          });

          await serviceClient
            .from("outreaches")
            .update({
              status: "sent",
              sent_at: new Date().toISOString(),
              subject,
              body,
            })
            .eq("id", outreach.id);

          return { email: outreach.recipient_email, success: true };
        } catch (err) {
          await serviceClient
            .from("outreaches")
            .update({ status: "failed" })
            .eq("id", outreach.id);

          return {
            email: outreach.recipient_email,
            success: false,
            error: err instanceof Error ? err.message : "Send failed",
          };
        }
      })
    );

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Outreach send route error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
