import OpenAI from "openai";
import type { AnalysisResult, ThreadData } from "@/types";

function getOpenAIClient() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

const ANALYSIS_SYSTEM_PROMPT = `You are a sharp, senior market intelligence analyst. You specialize in extracting competitive insights from public conversations and builder threads on social media.

Your job: Given a thread (original post + replies), extract structured market intelligence that a founder, builder, or product strategist would pay for.

You must return a JSON object with this exact structure:

{
  "marketBriefing": {
    "summary": "2-3 sentence executive summary of what this thread reveals about the market",
    "keyTakeaways": ["3-5 actionable takeaways"],
    "marketSentiment": "bullish | bearish | neutral | mixed",
    "emergingTrends": ["2-4 emerging trends visible in the thread"],
    "threatLevel": "low | moderate | high | critical (how competitive is this space)"
  },
  "competitors": [
    {
      "name": "Product/service name",
      "description": "What it does (1-2 sentences)",
      "url": "URL if mentioned, null otherwise",
      "category": "Primary category",
      "stage": "idea | building | launched | growing | established",
      "positioning": "How they position themselves",
      "mentionCount": 1,
      "tags": ["relevant", "tags"]
    }
  ],
  "categories": [
    {
      "name": "Category name",
      "count": 5,
      "percentage": 25,
      "examples": ["Example products in this category"],
      "trend": "rising | stable | declining"
    }
  ],
  "marketNeeds": [
    {
      "need": "The problem or desire",
      "frequency": "very_common | common | occasional | rare",
      "urgency": "critical | high | medium | low",
      "relatedProducts": ["Products addressing this need"],
      "opportunityNote": "Why this is an opportunity"
    }
  ],
  "positioningPatterns": [
    {
      "pattern": "Pattern name (e.g., 'AI-first positioning')",
      "description": "How builders are positioning",
      "examples": ["Specific examples from thread"],
      "effectiveness": "strong | moderate | weak",
      "saturation": "oversaturated | competitive | open"
    }
  ],
  "differentiationOpportunities": [
    {
      "opportunity": "What to differentiate on",
      "rationale": "Why this works",
      "difficulty": "easy | medium | hard",
      "potentialImpact": "high | medium | low",
      "suggestedApproach": "How to execute this"
    }
  ],
  "productIdeas": [
    {
      "idea": "Product idea name",
      "description": "What it does",
      "targetAudience": "Who it's for",
      "marketGap": "What gap it fills",
      "competitiveAdvantage": "Why it would win",
      "estimatedDifficulty": "low | medium | high",
      "revenueModel": "How it makes money"
    }
  ]
}

Rules:
- Be specific, not generic. Use actual names, products, and details from the thread.
- Every competitor must be a real product/project mentioned or implied in the thread.
- Categories should reflect actual clusters you observe, not generic tech categories.
- Market needs should come from what builders say they're solving or what users ask for.
- Positioning patterns should reveal how people pitch/describe their products.
- Differentiation opportunities should be gaps you notice — things nobody is doing.
- Product ideas should be novel combinations or gaps visible in the data.
- If there are fewer than 3 items for any array, that's fine. Quality over quantity.
- Return ONLY valid JSON. No markdown, no explanation, just the JSON object.`;

export async function analyzeThread(
  threadData: ThreadData
): Promise<AnalysisResult> {
  const threadContent = formatThreadForAnalysis(threadData);

  const openai = getOpenAIClient();
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: ANALYSIS_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Analyze this thread for competitive intelligence:\n\n${threadContent}`,
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
    ...parsed,
  };
}

function formatThreadForAnalysis(threadData: ThreadData): string {
  const lines: string[] = [];

  lines.push(`=== ORIGINAL POST ===`);
  lines.push(`Author: ${threadData.originalPost.author} (@${threadData.originalPost.authorHandle})`);
  lines.push(`Content: ${threadData.originalPost.text}`);
  lines.push(`Engagement: ${threadData.originalPost.metrics.likes} likes, ${threadData.originalPost.metrics.retweets} retweets, ${threadData.originalPost.metrics.replies} replies`);
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
