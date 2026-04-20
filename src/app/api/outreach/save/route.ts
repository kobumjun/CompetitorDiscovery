import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { OutreachType } from "@/types";

const VALID_TYPES: OutreachType[] = ["proposal", "pitch", "investment", "quote"];

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { leadId, type, recipientEmails, subject, body, status } = await request.json();
    if (
      !leadId ||
      !type ||
      !VALID_TYPES.includes(type) ||
      !Array.isArray(recipientEmails) ||
      recipientEmails.length === 0 ||
      !subject ||
      !body
    ) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const serviceClient = await createServiceClient();
    const { data: lead } = await serviceClient
      .from("extracted_leads")
      .select("id, outreach_count")
      .eq("id", leadId)
      .eq("user_id", user.id)
      .single();

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const normalizedStatus = status === "opened_in_client" ? "opened_in_client" : "draft";

    const rows = recipientEmails.map((email: string) => ({
      lead_id: leadId,
      type,
      recipient_email: email,
      subject,
      body,
      status: normalizedStatus,
      sent_at: new Date().toISOString(),
    }));

    const { data: outreaches, error: insertError } = await serviceClient
      .from("outreaches")
      .insert(rows)
      .select("*");

    if (insertError) {
      return NextResponse.json({ error: "Failed to save outreach record" }, { status: 500 });
    }

    await serviceClient
      .from("extracted_leads")
      .update({ outreach_count: (lead.outreach_count ?? 0) + recipientEmails.length })
      .eq("id", leadId)
      .eq("user_id", user.id);

    return NextResponse.json({ success: true, outreaches: outreaches || [] });
  } catch (error) {
    console.error("Save outreach error:", error);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
