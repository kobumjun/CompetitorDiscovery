import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { extractPostId } from "@/lib/utils";
import { scrapeThread } from "@/lib/scraper";
import { analyzeThread } from "@/lib/openai";
import { deductCredits, addCredits } from "@/lib/credits";
import type { UserOffer, OfferCategory, LeadSensitivity } from "@/types";

export const maxDuration = 300;

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
    const { url } = body;

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const postId = extractPostId(url);
    if (!postId) {
      return NextResponse.json(
        { error: "Invalid X/Twitter post URL" },
        { status: 400 }
      );
    }

    const creditResult = await deductCredits(user.id, 1);
    if (!creditResult.success) {
      return NextResponse.json(
        {
          error: "Insufficient credits. Upgrade your plan to continue.",
          credits: creditResult.remaining,
        },
        { status: 402 }
      );
    }

    const serviceClient = await createServiceClient();

    const { data: profile } = await serviceClient
      .from("users")
      .select("offer_categories, product_name, value_proposition, target_keywords, lead_sensitivity")
      .eq("id", user.id)
      .single();

    let offer: UserOffer | null = null;
    if (profile?.product_name) {
      offer = {
        offer_categories: (profile.offer_categories || []) as OfferCategory[],
        product_name: profile.product_name as string,
        value_proposition: (profile.value_proposition || "") as string,
        target_keywords: (profile.target_keywords || []) as string[],
      };
    }

    const sensitivity = (profile?.lead_sensitivity || "balanced") as LeadSensitivity;

    const { data: analysis, error: insertError } = await serviceClient
      .from("analyses")
      .insert({
        user_id: user.id,
        post_url: url,
        post_id: postId,
        status: "processing",
        credits_used: 1,
      })
      .select()
      .single();

    if (insertError || !analysis) {
      await addCredits(user.id, 1);
      return NextResponse.json(
        { error: "Failed to create analysis" },
        { status: 500 }
      );
    }

    const analysisId = analysis.id as string;

    try {
      const threadData = await scrapeThread(postId);
      const results = await analyzeThread(threadData, offer, sensitivity);

      const { error: updateError } = await serviceClient
        .from("analyses")
        .update({
          status: "completed",
          results,
          completed_at: new Date().toISOString(),
        })
        .eq("id", analysisId);

      if (updateError) {
        console.error("Failed to persist completed analysis:", updateError);
        await serviceClient
          .from("analyses")
          .update({
            status: "failed",
            completed_at: new Date().toISOString(),
          })
          .eq("id", analysisId);
        await addCredits(user.id, 1);
        return NextResponse.json(
          {
            id: analysisId,
            status: "failed",
            error: "Failed to save analysis results",
          },
          { status: 200 }
        );
      }

      return NextResponse.json({
        id: analysisId,
        status: "completed",
      });
    } catch (err) {
      console.error(`Analysis ${analysisId} failed:`, err);
      const message =
        err instanceof Error ? err.message : "Analysis failed";

      await serviceClient
        .from("analyses")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", analysisId);

      await addCredits(user.id, 1);

      return NextResponse.json(
        {
          id: analysisId,
          status: "failed",
          error: message,
        },
        { status: 200 }
      );
    }
  } catch (error) {
    console.error("Analyze error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
