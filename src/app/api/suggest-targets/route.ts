import { NextRequest, NextResponse } from "next/server";

const DEFAULT_TARGETS = [
  { label: "Cafes & Coffee Shops", query: "cafes and coffee shops" },
  { label: "Corporate Offices", query: "corporate offices" },
  { label: "Hotels & Restaurants", query: "hotels and restaurants" },
];

type TargetSuggestion = { label: string; query: string };

function cleanJson(text: string) {
  return text.replace(/```json\n?/gi, "").replace(/```/g, "").trim();
}

function normalizeSuggestions(value: unknown): TargetSuggestion[] {
  if (!Array.isArray(value)) return DEFAULT_TARGETS;
  const suggestions = value
    .filter((item): item is TargetSuggestion => {
      if (typeof item !== "object" || item === null) return false;
      const candidate = item as Record<string, unknown>;
      return typeof candidate.label === "string" && typeof candidate.query === "string";
    })
    .map((item) => ({
      label: item.label.trim(),
      query: item.query.trim(),
    }))
    .filter((item) => item.label && item.query)
    .slice(0, 3);
  return suggestions.length === 3 ? suggestions : DEFAULT_TARGETS;
}

export async function POST(request: NextRequest) {
  try {
    const { keyword } = (await request.json()) as { keyword?: string };
    if (!keyword?.trim()) {
      return NextResponse.json({ error: "Keyword is required." }, { status: 400 });
    }

    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      return NextResponse.json(DEFAULT_TARGETS);
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 250,
        temperature: 0.7,
        messages: [
          {
            role: "system",
            content: `The user describes what they sell.
Suggest exactly 3 types of businesses that would BUY this.
Return ONLY a JSON array of 3 objects:
[
  {"label": "Cafes & Coffee Shops", "query": "cafes and coffee shops"},
  {"label": "Corporate Offices", "query": "corporate offices"},
  {"label": "Hotels & Restaurants", "query": "hotels and restaurants"}
]
Each "query" will be used to search Google, so make it a simple industry name.
Each "label" is shown to the user as a button.`,
          },
          { role: "user", content: keyword.trim() },
        ],
      }),
      signal: AbortSignal.timeout(4000),
    });

    const data = await response.json();
    const text: string | undefined = data.choices?.[0]?.message?.content?.trim();
    if (!text) return NextResponse.json(DEFAULT_TARGETS);

    return NextResponse.json(normalizeSuggestions(JSON.parse(cleanJson(text))));
  } catch (error) {
    console.log("[suggest-targets] fallback:", error instanceof Error ? error.message : error);
    return NextResponse.json(DEFAULT_TARGETS);
  }
}
