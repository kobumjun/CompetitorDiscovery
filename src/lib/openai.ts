import OpenAI from "openai";
import type { AnalysisResult, ThreadData, UserOffer } from "@/types";

function getOpenAIClient() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

const BASE_SYSTEM_PROMPT = `You are a senior lead-generation analyst for freelancers, agencies, and sales teams.

Your job: Given an X thread (original post + replies), extract only outreach-ready leads from public conversation.

Focus on buyer intent signals:
- asking for recommendations
- looking for someone to help
- expressing a concrete pain point
- comparing tools/vendors
- actively evaluating options
- likely near-future service need

Do NOT include generic chatter, builder self-promo, or random mentions unless they show clear demand-side intent.`;

const SCHEMA_INSTRUCTIONS = `
Return JSON with this exact schema:
{
  "leadSummary": {
    "totalLeads": 0,
    "highIntentLeads": 0,
    "mediumIntentLeads": 0,
    "lowIntentLeads": 0
  },
  "briefing": {
    "summary": "2-3 sentence summary of buyer intent observed",
    "keySignals": ["3-6 concrete signals found in the thread"],
    "recommendedNextActions": ["3-5 short outreach actions"]
  },
  "leads": [
    {
      "displayName": "person name",
      "handle": "username without @",
      "quotedText": "exact or near-exact sentence showing intent",
      "leadScore": 0,
      "scoreBand": "high | medium | low",
      "intentType": "looking_for_service | asking_for_recommendation | expressing_pain_point | comparing_tools | actively_evaluating | potential_future_need",
      "problemCategory": "web_development | design | automation | ai_tooling | marketing | lead_generation | operations | other",
      "suggestedOutreachAngle": "short actionable angle",
      "profileLink": "https://x.com/<handle>",
      "postLink": "reply link if available, else null",
      "outreachDraft": "1 concise DM draft or null",
      "offerRelevanceScore": 0,
      "offerRelevanceBand": "relevant | partial | low",
      "relevanceReason": "why this lead matches the seller's offer, or empty string if no offer context",
      "customPitchMessage": "pitch message tailored to the seller's specific product, or null if no offer context"
    }
  ],
  "intentBreakdown": [
    { "intentType": "looking_for_service", "count": 0, "percentage": 0 }
  ],
  "problemCategories": [
    { "category": "web_development", "count": 0, "percentage": 0 }
  ],
  "outreachAngles": [
    {
      "angle": "Offer a quick homepage audit",
      "whyItWorks": "short rationale",
      "bestForIntentTypes": ["asking_for_recommendation", "actively_evaluating"]
    }
  ],
  "draftMessages": [
    {
      "leadHandle": "username",
      "intentType": "actively_evaluating",
      "channel": "dm | email",
      "message": "short outreach line"
    }
  ]
}`;

const SCORING_RULES = `
Scoring guidance:
- high (75-100): explicit request/recommendation/vendor search right now
- medium (45-74): clear pain + active exploration
- low (20-44): weaker but still meaningful potential need

Offer Relevance scoring (offerRelevanceScore 0-100):
- relevant (70-100): lead's need directly matches the seller's product/service
- partial (30-69): some overlap — the lead could benefit from the offer
- low (0-29): weak or no connection to the seller's offer

Rules:
- Be conservative; prioritize true prospects over quantity.
- Keep leads useful for immediate outreach.
- If no valid lead, return empty arrays with zeroed summary.
- Return ONLY valid JSON.`;

function buildSystemPrompt(offer?: UserOffer | null): string {
  let prompt = BASE_SYSTEM_PROMPT;

  if (offer && offer.product_name) {
    prompt += `

=== SELLER'S OFFER CONTEXT ===
The user selling/offering the following — use this to tailor scoring, outreach angles, and pitches:
- Category: ${offer.offer_categories.join(", ") || "Not specified"}
- Product/Brand: ${offer.product_name}
- Value Proposition: ${offer.value_proposition || "Not specified"}
- Target Customer Keywords: ${offer.target_keywords.join(", ") || "Not specified"}

Based on this context:
1. Re-score each lead's offerRelevanceScore specifically for THIS product/service (not generic intent)
2. Set offerRelevanceBand based on the score: "relevant" (70-100), "partial" (30-69), "low" (0-29)
3. Provide a relevanceReason explaining why/how this lead matches the seller's offer
4. Adjust suggestedOutreachAngle to be specific to the seller's product
5. Write customPitchMessage: a natural, non-spammy DM that pitches the seller's specific product to this lead
6. Rewrite draftMessages entries to pitch the seller's specific product/service naturally
7. In briefing.recommendedNextActions, tailor actions to the seller's product`;
  } else {
    prompt += `

No specific offer context provided. Set offerRelevanceScore to 50 for all leads, offerRelevanceBand to "partial", relevanceReason to "", and customPitchMessage to null.`;
  }

  prompt += SCHEMA_INSTRUCTIONS;
  prompt += SCORING_RULES;

  return prompt;
}

export async function analyzeThread(
  threadData: ThreadData,
  offer?: UserOffer | null
): Promise<AnalysisResult> {
  const threadContent = formatThreadForAnalysis(threadData);
  const systemPrompt = buildSystemPrompt(offer);

  const openai = getOpenAIClient();
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Analyze this thread for lead extraction and buyer intent:\n\n${threadContent}`,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
    max_tokens: 4000,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("No response from OpenAI");

  const parsed = JSON.parse(content);

  return {
    threadInfo: {
      author: threadData.originalPost.author,
      authorHandle: threadData.originalPost.authorHandle,
      content: threadData.originalPost.text,
      repliesAnalyzed: threadData.replies.length,
      totalEngagement:
        threadData.originalPost.metrics.likes +
        threadData.originalPost.metrics.retweets +
        threadData.originalPost.metrics.replies,
      analyzedAt: new Date().toISOString(),
    },
    offerContext:
      offer && offer.product_name
        ? {
            productName: offer.product_name,
            categories: offer.offer_categories as string[],
          }
        : null,
    ...parsed,
  };
}

function formatThreadForAnalysis(threadData: ThreadData): string {
  const lines: string[] = [];

  lines.push(`=== ORIGINAL POST ===`);
  lines.push(
    `Author: ${threadData.originalPost.author} (@${threadData.originalPost.authorHandle})`
  );
  lines.push(`Content: ${threadData.originalPost.text}`);
  lines.push(
    `Engagement: ${threadData.originalPost.metrics.likes} likes, ${threadData.originalPost.metrics.retweets} retweets, ${threadData.originalPost.metrics.replies} replies`
  );
  lines.push("");
  lines.push(`=== REPLIES (${threadData.replies.length} total) ===`);

  threadData.replies.forEach((reply, i) => {
    lines.push(`--- Reply ${i + 1} ---`);
    lines.push(`@${reply.authorHandle}: ${reply.text}`);
    if (reply.urls.length > 0) {
      lines.push(`Links: ${reply.urls.join(", ")}`);
    }
    lines.push("");
  });

  return lines.join("\n");
}
