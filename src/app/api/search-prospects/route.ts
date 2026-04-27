import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { reserveCredits, refundCredits } from "@/lib/credits";
import { deriveCompanyNameFromHost, extractWebsiteEmails, normalizeUrl } from "@/lib/leads/extraction";

export const maxDuration = 60;

const SERPER_ENDPOINT = "https://google.serper.dev/search";
const URL_TIMEOUT_MS = 4000;
const OVERALL_TIMEOUT_MS = 55_000;
const CONCURRENCY = 5;
const GPT_OPTIONAL_QUERY_TIMEOUT_MS = 4000;
const SEARCH_EXTRACT_PATHS = ["", "/contact", "/about"];

const BLOCKED_HOSTS = [
  "g2.com", "capterra.com", "techcrunch.com", "forbes.com",
  "facebook.com", "linkedin.com", "youtube.com", "wikipedia.org",
  "quora.com", "producthunt.com", "trustpilot.com", "glassdoor.com",
  "crunchbase.com", "ycombinator.com", "instagram.com", "x.com",
  "twitter.com", "tiktok.com", "reddit.com", "medium.com",
  "yelp.com", "bbb.org", "yellowpages.com", "mapquest.com",
  "tripadvisor.com", "amazon.com", "ebay.com", "apple.com",
  "google.com", "microsoft.com", "github.com", "stackoverflow.com",
  "indeed.com", "ziprecruiter.com",
];

type SerperOrganicResult = { link?: string; title?: string; snippet?: string };
type SerperResponse = { organic?: SerperOrganicResult[] };
type ExtractedProspectRow = { email: string; source_url: string; company_name: string; host: string };
const MAX_CRAWL_URLS = 3;
const SERPER_NUM_RESULTS = 10;

function isBlockedHost(hostname: string) {
  return BLOCKED_HOSTS.some((b) => hostname === b || hostname.endsWith(`.${b}`));
}

function getCleanedSellerPhrase(keyword: string): string {
  let cleaned = keyword.replace(/^(i sell|i offer|i provide|we sell|we offer)\s+/i, "").trim();
  if (!cleaned) cleaned = keyword.trim();
  return cleaned;
}

function buildCompetitorKeywordsFromCleaned(cleaned: string): string[] {
  return cleaned.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
}

async function maybeRefineSearchQueryWithGpt(cleaned: string, fallbackQuery: string): Promise<string> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) return fallbackQuery;

  try {
    const gptRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 150,
        temperature: 0.7,
        messages: [
          {
            role: "system",
            content: `The user describes what they SELL.
Write ONE Google search query to find businesses that would BUY this.

ABSOLUTE RULE: Your search query must NOT contain ANY word from what the user sells.
Instead, search for the BUYER'S industry directly.

Think step by step:
1. What type of business would pay money for this?
2. Search for THAT type of business by their industry name.

Examples:
- User sells "fitness coaching" → Buyers: corporations with employees, HR departments
  → Query: "corporate offices employee wellness program contact email"
  (NO "fitness", NO "coaching", NO "training" in the query)

- User sells "web design services" → Buyers: small businesses without good websites
  → Query: "small restaurant owner contact email"
  (NO "web", NO "design", NO "agency" in the query)

- User sells "coffee machines" → Buyers: cafes, restaurants, offices
  → Query: "new cafe opening contact email"
  (NO "coffee", NO "machine" in the query)

- User sells "accounting services" → Buyers: small business owners
  → Query: "small business owner freelancer contact"
  (NO "accounting", NO "bookkeeping" in the query)

- User sells "dental equipment" → Buyers: dental clinics
  → Query: "dental clinic private practice contact email"
  (NO "equipment", NO "supplier" in the query. "dental" is OK because dental clinics ARE the buyer)

- User sells "HR software" → Buyers: growing companies that hire people
  → Query: "manufacturing company hiring employees contact"
  (NO "HR", NO "software" in the query)

IMPORTANT: Your query must target a SPECIFIC type of business (e.g., "dental clinics", "law firms", "restaurants", "real estate agencies").
Never search for generic terms like "small business" or "companies". Be specific about the buyer's industry.
If the user doesn't specify a target, pick the most likely buyer industry.

Return ONLY the search query string. Nothing else. No quotes. No explanation.`,
          },
          { role: "user", content: cleaned },
        ],
      }),
      signal: AbortSignal.timeout(GPT_OPTIONAL_QUERY_TIMEOUT_MS),
    });
    const gptData = await gptRes.json();
    let gptQuery: string = gptData.choices?.[0]?.message?.content?.trim() ?? "";
    gptQuery = gptQuery.replace(/^["']|["']$/g, "").replace(/```[\s\S]*?```/g, "").trim();
    if (gptQuery && gptQuery.length > 5 && gptQuery.length < 200) {
      console.log(`[GPT 성공] "${gptQuery}"`);
      return gptQuery;
    }
  } catch (err) {
    console.log(`[GPT 타임아웃, fallback 사용] "${fallbackQuery}"`, err instanceof Error ? err.message : "");
  }
  return fallbackQuery;
}

function normalizedSerperLink(link: string): string | null {
  const trimmed = link.trim();
  if (!trimmed) return null;
  const nu = normalizeUrl(trimmed);
  return nu ? nu.toString() : null;
}

function dedupeBlocklistOrganic(organic: SerperOrganicResult[]): SerperOrganicResult[] {
  const seen = new Set<string>();
  const out: SerperOrganicResult[] = [];
  for (const r of organic) {
    const key = normalizedSerperLink(r.link ?? "");
    if (!key) continue;
    const host = normalizeUrl(key)?.hostname.replace(/^www\./, "").toLowerCase();
    if (!host || isBlockedHost(host)) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...r, link: key });
  }
  return out;
}

function filterSerperOrganicByCompetitorKeywords(
  organic: SerperOrganicResult[],
  competitorKeywords: string[]
): SerperOrganicResult[] {
  const kws = competitorKeywords.map((w) => w.toLowerCase()).filter(Boolean);
  if (kws.length === 0) return organic;

  return organic.filter((result) => {
    const titleAndLink = `${result.title ?? ""} ${result.link ?? ""}`.toLowerCase();
    return !kws.some((w) => titleAndLink.includes(w));
  });
}

async function runWithConcurrency<TInput, TOutput>(
  items: TInput[],
  worker: (item: TInput) => Promise<TOutput>,
  concurrency: number
): Promise<PromiseSettledResult<TOutput>[]> {
  const results: PromiseSettledResult<TOutput>[] = new Array(items.length);
  let cursor = 0;
  async function runner() {
    while (cursor < items.length) {
      const idx = cursor++;
      try {
        results[idx] = { status: "fulfilled", value: await worker(items[idx]) };
      } catch (error) {
        results[idx] = { status: "rejected", reason: error };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => runner()));
  return results;
}

export async function POST(request: NextRequest) {
  let reservedCredits = 0;
  let userId = "";
  try {
    console.log("[search-prospects] === START ===");

    // ── Auth ──
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log("[search-prospects] FAIL: No authenticated user");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    userId = user.id;
    console.log("[search-prospects] Auth OK:", user.id);

    // ── API key ──
    const apiKey = process.env.SERPER_API_KEY;
    console.log("[search-prospects] SERPER_API_KEY exists:", Boolean(apiKey), "length:", apiKey?.length ?? 0);
    if (!apiKey) {
      return NextResponse.json({ error: "Search service unavailable. SERPER_API_KEY not configured." }, { status: 503 });
    }

    // ── Parse request ──
    const { query, requestedCount } = (await request.json()) as { query?: string; requestedCount?: number };
    console.log("[search-prospects] query:", query, "requestedCount:", requestedCount);
    if (!query || !query.trim()) {
      return NextResponse.json({ error: "Query is required." }, { status: 400 });
    }

    // ── Reserve credits ──
    const targetCount = Math.min(20, Math.max(1, Math.round(requestedCount ?? 3)));
    let reserve: { success: boolean; remaining: number };
    try {
      reserve = await reserveCredits(user.id, targetCount);
      console.log("[search-prospects] Credits reserved:", targetCount, "remaining:", reserve.remaining);
    } catch (creditErr) {
      console.error("[search-prospects] reserveCredits error:", creditErr instanceof Error ? creditErr.message : creditErr);
      return NextResponse.json({ error: "Could not verify credits. Please try again." }, { status: 500 });
    }
    if (!reserve.success) {
      return NextResponse.json({ error: `Not enough credits. You have ${reserve.remaining} credits.` }, { status: 402 });
    }
    reservedCredits = targetCount;

    const startTime = Date.now();
    const isTimedOut = () => Date.now() - startTime > OVERALL_TIMEOUT_MS;

    // ── cleaned → GPT Serper 쿼리(최대 4초) → 경쟁사 키워드(Serper 전) ──
    const cleaned = getCleanedSellerPhrase(query.trim());
    const fallbackSerperQuery = `businesses that need ${cleaned} contact email`;
    const serperQuery = await maybeRefineSearchQueryWithGpt(cleaned, fallbackSerperQuery);
    const competitorKeywords = buildCompetitorKeywordsFromCleaned(cleaned);
    console.log(
      `[쿼리 변환] "${query.trim()}" → Serper: "${serperQuery}" / 경쟁사 키워드(title+link): ${competitorKeywords.join(", ") || "(없음)"}`
    );

    // ── Serper: 1회만 ──
    const serperRes = await fetch(SERPER_ENDPOINT, {
      method: "POST",
      headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ q: serperQuery, num: SERPER_NUM_RESULTS }),
    });

    if (!serperRes.ok) {
      const errorBody = await serperRes.text().catch(() => "");
      console.error("[search-prospects] Serper error:", serperRes.status, errorBody.slice(0, 300));
      if (serperRes.status === 429) {
        throw new Error("Daily search limit reached. Try again tomorrow or contact support.");
      }
      throw new Error(`Serper API returned ${serperRes.status}: ${errorBody.slice(0, 100)}`);
    }

    const serperPayload = (await serperRes.json()) as SerperResponse;
    const serperOrganic = serperPayload.organic ?? [];
    console.log("[search-prospects] Serper OK — organic:", serperOrganic.length);

    const mergedOrganic = dedupeBlocklistOrganic(serperOrganic);
    const filteredOrganic = filterSerperOrganicByCompetitorKeywords(mergedOrganic, competitorKeywords);
    const toScrape =
      filteredOrganic.length > 0
        ? filteredOrganic.slice(0, MAX_CRAWL_URLS)
        : mergedOrganic.slice(0, MAX_CRAWL_URLS);
    console.log(`[필터] ${serperOrganic.length}개 → ${filteredOrganic.length}개 → ${toScrape.length}개 크롤링`);

    const candidates: string[] = toScrape.map((r) => r.link ?? "").filter(Boolean);

    console.log("[search-prospects] Crawl URL count:", candidates.length);

    if (candidates.length === 0) {
      await refundCredits(user.id, reservedCredits);
      return NextResponse.json({ error: "No companies found. Try broader keywords." }, { status: 404 });
    }

    // ── Crawl & extract (deduplicate by email address only) ──
    const seenEmails = new Set<string>();
    const failures: { url: string; reason: string }[] = [];
    let uniqueRows: ExtractedProspectRow[] = [];
    let processedCount = 0;
    let cursor = 0;

    while (cursor < candidates.length && uniqueRows.length < targetCount && !isTimedOut()) {
      const batch = candidates.slice(cursor, cursor + CONCURRENCY);
      cursor += batch.length;
      processedCount += batch.length;

      const results = await runWithConcurrency(batch, async (url) => {
        if (isTimedOut()) throw new Error("Timeout");
        const extraction = await extractWebsiteEmails(url, {
          timeoutMs: URL_TIMEOUT_MS,
          paths: SEARCH_EXTRACT_PATHS,
        });
        if (!extraction.ok) throw new Error(extraction.message || "No emails found");
        if (extraction.emails.length === 0) throw new Error("No emails found");

        const selected = extraction.emails.find((e) => {
          const lower = e.toLowerCase();
          return !seenEmails.has(lower);
        });
        if (!selected) throw new Error("Only duplicate emails found");

        return {
          email: selected,
          source_url: extraction.sourceForEmail.get(selected.toLowerCase()) ?? extraction.baseUrl,
          company_name: deriveCompanyNameFromHost(extraction.host),
          host: extraction.host,
        };
      }, CONCURRENCY);

      results.forEach((result, i) => {
        const url = batch[i];
        if (result.status !== "fulfilled") {
          failures.push({ url, reason: result.reason instanceof Error ? result.reason.message : "Unknown error" });
          return;
        }
        if (uniqueRows.length >= targetCount) return;
        const row = result.value;
        const emailLower = row.email.toLowerCase();
        if (seenEmails.has(emailLower)) {
          failures.push({ url, reason: "Duplicate email" });
          return;
        }
        seenEmails.add(emailLower);
        uniqueRows.push(row);
      });
    }

    console.log("[search-prospects] Crawl done — found:", uniqueRows.length, "failed:", failures.length, "elapsed:", Date.now() - startTime, "ms");

    // ── Persist results ──
    const service = await createServiceClient();
    const leads: Array<{ email: string; source_url: string; company_name: string; lead_id: string; client_id: string }> = [];

    for (const row of uniqueRows) {
      if (isTimedOut()) break;
      try {
        const { data: lead } = await service
          .from("extracted_leads")
          .insert({
            user_id: user.id,
            source_url: row.source_url,
            company_name: row.company_name,
            emails: [{ email: row.email, source: row.source_url, confidence: row.email.startsWith("info@") || row.email.startsWith("hello@") ? "medium" : "high" }],
            search_keyword: query.trim(),
          })
          .select("id")
          .single();
        if (!lead) continue;

        const { data: client } = await service
          .from("clients")
          .insert({ user_id: user.id, email: row.email, company_name: row.company_name, website: `https://${row.host}`, source_url: row.source_url, status: "new" })
          .select("id")
          .single();
        if (!client) continue;

        leads.push({ email: row.email, source_url: row.source_url, company_name: row.company_name, lead_id: lead.id, client_id: client.id });
      } catch (insertErr) {
        console.warn("[search-prospects] Insert failed for", row.email, ":", insertErr instanceof Error ? insertErr.message : insertErr);
      }
    }

    // ── Refund unused credits ──
    const creditsUsed = leads.length;
    const creditsRefunded = Math.max(reservedCredits - creditsUsed, 0);
    if (creditsRefunded > 0) await refundCredits(user.id, creditsRefunded);
    const finalCredits = reserve.remaining + creditsRefunded;

    console.log("[search-prospects] === DONE === used:", creditsUsed, "refunded:", creditsRefunded, "elapsed:", Date.now() - startTime, "ms");

    return NextResponse.json({
      success: true,
      leads,
      requestedCount: targetCount,
      searchedCount: candidates.length,
      processedCount,
      successfulUrls: leads.length,
      failedUrls: failures.length,
      failed: failures,
      creditsReserved: reservedCredits,
      creditsUsed,
      creditsRefunded,
      creditsRemaining: finalCredits,
      message:
        creditsUsed === 0
          ? `No emails found — all ${reservedCredits} credits refunded. Try different keywords.`
          : creditsRefunded > 0
            ? `✓ Found ${creditsUsed} of ${reservedCredits} emails — ${creditsUsed} credits used, ${creditsRefunded} credits refunded`
            : `✓ Found ${creditsUsed} emails — ${creditsUsed} credits used`,
    });
  } catch (error) {
    if (reservedCredits > 0 && userId) await refundCredits(userId, reservedCredits).catch(() => undefined);
    console.error("[search-prospects] === FATAL ===", error instanceof Error ? error.message : String(error));
    const message = error instanceof Error ? error.message : "An unexpected error occurred.";
    const status = message.includes("Daily search limit") ? 429 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
