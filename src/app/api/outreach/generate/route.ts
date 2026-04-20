import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { generateOutreachEmail } from "@/lib/openai";
import { addCredits, deductCredits } from "@/lib/credits";
import type { OutreachType } from "@/types";

const VALID_TYPES: OutreachType[] = ["proposal", "pitch", "investment", "quote"];

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

    const body = await request.json();
    const {
      leadId,
      type,
      context,
      recipientEmails,
    }: { leadId?: string; type?: OutreachType; context?: string; recipientEmails?: string[] } = body;

    if (!leadId || !type || !VALID_TYPES.includes(type) || !Array.isArray(recipientEmails) || recipientEmails.length === 0) {
      return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
    }

    const serviceClient = await createServiceClient();

    const [{ data: lead }, { data: profile }] = await Promise.all([
      serviceClient
        .from("extracted_leads")
        .select("*")
        .eq("id", leadId)
        .eq("user_id", user.id)
        .single(),
      serviceClient
        .from("business_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const creditResult = await deductCredits(user.id, 1);
    if (!creditResult.success) {
      return NextResponse.json(
        { error: "Insufficient credits. Upgrade your plan to continue.", credits: creditResult.remaining },
        { status: 402 }
      );
    }

    try {
      const generated = await generateOutreachEmail({
        type,
        senderName: profile?.owner_name || user.user_metadata?.name || "Me",
        businessName: profile?.business_name || "",
        industry: profile?.industry || "N/A",
        services: profile?.services?.join(", ") || "services",
        tone: profile?.tone || "professional",
        leadCompanyName: lead.company_name || "their company",
        leadIndustry: lead.industry || "N/A",
        leadInfo: lead.company_info || "N/A",
        context: context || "",
      });

      return NextResponse.json({
        subject: generated.subject,
        body: generated.body,
        remainingCredits: creditResult.remaining,
      });
    } catch (err) {
      await addCredits(user.id, 1);
      console.error("Outreach generation failed:", err);
      return NextResponse.json({ error: "Failed to generate outreach" }, { status: 500 });
    }
  } catch (error) {
    console.error("Outreach generate route error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
