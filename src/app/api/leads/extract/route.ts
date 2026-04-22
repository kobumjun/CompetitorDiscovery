import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { analyzeWebsiteContent } from "@/lib/openai";
import { addCredits, deductCredits } from "@/lib/credits";
import { extractWebsiteEmails } from "@/lib/leads/extraction";

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

    const { url } = await request.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const extraction = await extractWebsiteEmails(url);
    if (!extraction.ok) {
      return NextResponse.json(
        {
          error: extraction.code,
          message: extraction.message,
        },
        { status: extraction.code === "NO_EMAILS_FOUND" ? 404 : 400 }
      );
    }

    const { baseUrl, host, combinedHtml, emails: extractedEmails, sourceForEmail } = extraction;
    if (extractedEmails.length === 0) {
      return NextResponse.json(
        { error: "NO_EMAILS_FOUND", message: "No emails found. Try a different URL or check the contact page." },
        { status: 404 }
      );
    }

    const htmlTextSnippet = combinedHtml.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    const analysis = await analyzeWebsiteContent(htmlTextSnippet);

    const creditResult = await deductCredits(user.id, 1);
    if (!creditResult.success) {
      return NextResponse.json(
        { error: "Insufficient credits. Upgrade your plan to continue.", credits: creditResult.remaining },
        { status: 402 }
      );
    }

    const serviceClient = await createServiceClient();
    const { data: lead, error: insertError } = await serviceClient
      .from("extracted_leads")
      .insert({
        user_id: user.id,
        source_url: baseUrl,
        company_name: analysis.companyName || host,
        industry: analysis.industry || null,
        company_info: analysis.description || null,
        emails: extractedEmails.map((email) => ({
          email,
          source: sourceForEmail.get(email.toLowerCase()) ?? baseUrl,
          confidence: email.startsWith("info@") || email.startsWith("hello@") ? "medium" : "high",
        })),
      })
      .select("*")
      .single();

    if (insertError || !lead) {
      await addCredits(user.id, 1);
      return NextResponse.json({ error: "Failed to save extracted lead" }, { status: 500 });
    }

    return NextResponse.json({ lead, remainingCredits: creditResult.remaining });
  } catch (error) {
    console.error("Lead extraction error:", error);
    return NextResponse.json({ error: "EXTRACTION_FAILED" }, { status: 500 });
  }
}
