import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { generateProposal } from "@/lib/openai";
import { deductCredits, addCredits } from "@/lib/credits";
import type { BusinessProfile, ProposalTone } from "@/types";

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
      clientId,
      clientName,
      contactName,
      projectName,
      projectDescription,
      budget,
      timeline,
      sections,
      tone,
      additionalInstructions,
      isManual,
      manualContent,
    } = body;

    if (!projectName || !projectDescription) {
      return NextResponse.json(
        { error: "Project name and description are required" },
        { status: 400 }
      );
    }

    const serviceClient = await createServiceClient();

    const { data: profile } = await serviceClient
      .from("business_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    const currency = (profile as BusinessProfile | null)?.currency || "USD";
    const language = (profile as BusinessProfile | null)?.language || "en";

    try {
      if (isManual) {
        if (!manualContent || typeof manualContent !== "string") {
          return NextResponse.json({ error: "Manual proposal content is required" }, { status: 400 });
        }

        const content = {
          coverLetter: manualContent,
          scope: [],
          deliverables: [],
          timeline: [],
          pricing: [],
          totalAmount: budget || 0,
          terms: "",
          nextSteps: "",
        };

        const { data: proposal, error: insertError } = await serviceClient
          .from("proposals")
          .insert({
            user_id: user.id,
            client_id: clientId || null,
            title: `${projectName} Proposal`,
            project_name: projectName,
            project_description: projectDescription,
            estimated_budget: budget || null,
            estimated_timeline: timeline || null,
            content,
            currency,
            total_amount: budget || null,
            expires_at: new Date(
              Date.now() + 30 * 24 * 60 * 60 * 1000
            ).toISOString(),
          })
          .select()
          .single();

        if (insertError || !proposal) {
          return NextResponse.json(
            { error: "Failed to save proposal" },
            { status: 500 }
          );
        }

        await serviceClient.from("proposal_activities").insert({
          proposal_id: proposal.id,
          type: "created",
          metadata: { mode: "manual" },
        });

        return NextResponse.json({ proposal, remainingCredits: null });
      }

      const creditResult = await deductCredits(user.id, 1);
      if (!creditResult.success) {
        return NextResponse.json(
          { error: "Insufficient credits. Upgrade your plan to continue.", credits: creditResult.remaining },
          { status: 402 }
        );
      }

      const content = await generateProposal({
        profile: profile as BusinessProfile | null,
        clientName: clientName || "",
        contactName: contactName || null,
        projectName,
        projectDescription,
        budget: budget || null,
        timeline: timeline || null,
        sections: sections || [
          "Cover Letter",
          "Scope of Work",
          "Deliverables",
          "Timeline",
          "Pricing",
          "Terms & Conditions",
          "Next Steps",
        ],
        tone: (tone as ProposalTone) || "professional",
        additionalInstructions: additionalInstructions || null,
        currency,
        language,
      });

      const { data: proposal, error: insertError } = await serviceClient
        .from("proposals")
        .insert({
          user_id: user.id,
          client_id: clientId || null,
          title: content.coverLetter
            ? `${projectName} Proposal`
            : projectName,
          project_name: projectName,
          project_description: projectDescription,
          estimated_budget: budget || null,
          estimated_timeline: timeline || null,
          content,
          currency,
          total_amount: content.totalAmount || null,
          expires_at: new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000
          ).toISOString(),
        })
        .select()
        .single();

      if (insertError || !proposal) {
        await addCredits(user.id, 1);
        return NextResponse.json(
          { error: "Failed to save proposal" },
          { status: 500 }
        );
      }

      await serviceClient.from("proposal_activities").insert({
        proposal_id: proposal.id,
        type: "created",
      });

      return NextResponse.json({ proposal, remainingCredits: creditResult.remaining });
    } catch (err) {
      console.error("Proposal generation failed:", err);
      await addCredits(user.id, 1);
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Generation failed" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Generate error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
