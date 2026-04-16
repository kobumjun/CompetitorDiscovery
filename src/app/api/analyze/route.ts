import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { extractPostId } from "@/lib/utils";
import { scrapeThread } from "@/lib/scraper";
import { analyzeThread } from "@/lib/openai";
import { deductCredits, addCredits } from "@/lib/credits";

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
      return NextResponse.json(
        { error: "URL is required" },
        { status: 400 }
      );
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

    runAnalysis(analysis.id, postId, user.id).catch(console.error);

    return NextResponse.json({
      id: analysis.id,
      status: "processing",
    });
  } catch (error) {
    console.error("Analyze error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function runAnalysis(
  analysisId: string,
  postId: string,
  userId: string
) {
  const serviceClient = await createServiceClient();

  try {
    const threadData = await scrapeThread(postId);
    const results = await analyzeThread(threadData);

    await serviceClient
      .from("analyses")
      .update({
        status: "completed",
        results,
        completed_at: new Date().toISOString(),
      })
      .eq("id", analysisId);
  } catch (error) {
    console.error(`Analysis ${analysisId} failed:`, error);

    await serviceClient
      .from("analyses")
      .update({ status: "failed" })
      .eq("id", analysisId);

    await addCredits(userId, 1);
  }
}
