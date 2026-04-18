import OpenAI from "openai";
import type {
  AnalysisResult,
  ThreadData,
  UserOffer,
  LeadSensitivity,
} from "@/types";

function getOpenAIClient() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

/* ------------------------------------------------------------------ */
/*  Sensitivity-specific prompt blocks                                 */
/* ------------------------------------------------------------------ */

const SENSITIVITY_PROMPT: Record<LeadSensitivity, string> = {
  conservative: `
=== EXTRACTION MODE: CONSERVATIVE ===
Extract ONLY high-intent leads — people who are explicitly requesting help, recommendations, or services RIGHT NOW.

Include a reply as a lead ONLY when it contains:
- An explicit ask ("who can help?", "recommend a tool", "looking for a dev")
- A stated buying decision ("evaluating X vs Y", "about to switch from…")
- A direct request for service ("need someone to build…", "hiring for…")

Exclude: general interest, sympathy, experience sharing without a clear need.

Target extraction rate: ~3-5% of total replies. Fewer is fine if the thread lacks strong signals.

Scoring bands:
- high (75-100): explicit request / active vendor search / hiring intent
- medium (50-74): strong pain point with implied need for a solution
- low (30-49): should NOT appear in conservative mode — skip these`,

  balanced: `
=== EXTRACTION MODE: BALANCED (recommended) ===
Extract both high-intent AND medium-intent leads — anyone who could realistically become a customer with the right outreach.

Include a reply as a lead when it contains ANY of:
HIGH INTENT (always include):
- Explicit requests for help, recommendations, or services
- Active evaluation or comparison of tools/vendors
- Stated buying decision or switching intent
- Hiring signals or project context with an unmet need

MEDIUM INTENT (include if substantive):
- Concrete pain point with enough context (>10 words, not just "same")
- Experience sharing that reveals an ongoing problem ("I've been struggling with…")
- Engaged interest with follow-up questions ("how did you solve X?", "tell me more")
- Agreement that implies shared need ("exactly my situation", "I need this too")
- Indirect exploration ("has anyone tried…?", "is there a tool for…?")

Exclude:
- One-word reactions ("nice", "cool", "+1", emoji-only)
- Pure self-promotion without a stated need
- Off-topic or spam
- Bot-like or generic replies under ~5 words with no context

Target extraction rate: ~8-15% of total replies.

Scoring bands:
- high (70-100): explicit request / recommendation ask / vendor search / hiring
- medium (40-69): clear pain point, follow-up questions, shared need, active exploration
- low (20-39): faint signal but still potentially reachable — include these too`,

  aggressive: `
=== EXTRACTION MODE: AGGRESSIVE ===
Cast the widest net. Include anyone who shows even a faint signal of relevance — the user wants to review all potential leads and filter manually.

Include a reply as a lead when it contains ANY of:
- Everything from "balanced" mode
- Casual interest or curiosity ("oh interesting", "might check this out")
- Related project mentions even without a stated need
- Engaged participation in a relevant problem domain
- Questions or comments that imply they work in a target industry

Only exclude:
- Pure emoji / one-word with zero context
- Completely off-topic
- Obvious spam / bots

Target extraction rate: ~15-25% of total replies.

Scoring bands:
- high (70-100): explicit request / recommendation / vendor search
- medium (40-69): pain point, exploration, curiosity, industry participation
- low (15-39): faint signal, casual interest, tangential relevance — include these`,
};

/* ------------------------------------------------------------------ */
/*  Base prompt + schema + scoring                                     */
/* ------------------------------------------------------------------ */

const BASE_SYSTEM_PROMPT = `You are a senior lead-generation analyst. Your job: given an X thread (original post + replies), extract outreach-ready leads from public conversation.

CRITICAL: You must extract a REALISTIC number of leads. A thread with 100+ replies should typically yield 8-20 leads depending on mode. Returning only 1-2 leads from a large thread is a failure — you are being too strict. Read every reply carefully and apply the extraction mode criteria below.

Intent signal types to detect:
- looking_for_service: "who can help?", "need someone to…", "hiring…"
- asking_for_recommendation: "recommend a tool?", "what do you use for…?"
- expressing_pain_point: "struggling with…", "this is so hard", "broken workflow"
- comparing_tools: "X vs Y", "switching from…", "looking for alternatives"
- actively_evaluating: "currently evaluating", "about to choose", "testing out…"
- potential_future_need: "might need this soon", "planning to…", "when I start…"`;

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
    "summary": "2-3 sentence summary of buyer intent observed in this thread",
    "keySignals": ["3-6 concrete intent signals found"],
    "recommendedNextActions": ["3-5 short actionable outreach steps"]
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
Offer Relevance scoring (offerRelevanceScore 0-100):
- relevant (70-100): lead's need directly matches the seller's product/service
- partial (30-69): some overlap — the lead could benefit from the offer
- low (0-29): weak or no connection to the seller's offer
If offer context is provided and a lead's offerRelevanceScore < 25, you may exclude that lead.

Rules:
- Read EVERY reply — do not skip or skim.
- Extract all leads that match the extraction mode criteria.
- Include the EXACT quoted text from their reply (not a paraphrase).
- If no valid lead exists, return empty arrays with zeroed summary.
- Return ONLY valid JSON.`;

/* ------------------------------------------------------------------ */
/*  Prompt builder                                                     */
/* ------------------------------------------------------------------ */

function buildSystemPrompt(
  sensitivity: LeadSensitivity,
  offer?: UserOffer | null
): string {
  let prompt = BASE_SYSTEM_PROMPT;

  prompt += SENSITIVITY_PROMPT[sensitivity];

  if (offer && offer.product_name) {
    prompt += `

=== SELLER'S OFFER CONTEXT ===
The user is selling/offering the following — tailor scoring, outreach angles, and pitches accordingly:
- Category: ${offer.offer_categories.join(", ") || "Not specified"}
- Product/Brand: ${offer.product_name}
- Value Proposition: ${offer.value_proposition || "Not specified"}
- Target Customer Keywords: ${offer.target_keywords.join(", ") || "Not specified"}

Based on this context:
1. Score each lead's offerRelevanceScore specifically for THIS product/service
2. Set offerRelevanceBand: "relevant" (70-100), "partial" (30-69), "low" (0-29)
3. Provide a relevanceReason explaining why this lead matches the offer
4. Adjust suggestedOutreachAngle to reference the seller's product
5. Write customPitchMessage: a natural, non-spammy DM pitching the seller's specific product
6. Rewrite draftMessages to pitch the seller's product naturally
7. Tailor briefing.recommendedNextActions to the seller's product`;
  } else {
    prompt += `

No specific offer context provided. Set offerRelevanceScore to 50 for all leads, offerRelevanceBand to "partial", relevanceReason to "", and customPitchMessage to null.`;
  }

  prompt += SCHEMA_INSTRUCTIONS;
  prompt += SCORING_RULES;

  return prompt;
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

export async function analyzeThread(
  threadData: ThreadData,
  offer?: UserOffer | null,
  sensitivity: LeadSensitivity = "balanced"
): Promise<AnalysisResult> {
  const threadContent = formatThreadForAnalysis(threadData);
  const systemPrompt = buildSystemPrompt(sensitivity, offer);

  const replyCount = threadData.replies.length;
  const maxTokens = replyCount > 80 ? 8000 : replyCount > 30 ? 6000 : 4000;

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
    max_tokens: maxTokens,
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
