import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { reserveCredits, refundCredits } from "@/lib/credits";
import { deriveCompanyNameFromHost, extractWebsiteEmails, normalizeUrl } from "@/lib/leads/extraction";

export const maxDuration = 60;

const SERPER_ENDPOINT = "https://google.serper.dev/search";
const URL_TIMEOUT_MS = 4000;
const OVERALL_TIMEOUT_MS = 55_000;
const CONCURRENCY = 5;
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
const GPT_TIMEOUT_MS = 4000;

const SERPER_QUERY_SYSTEM = `The user describes what they sell.
Return ONE simple Google search query to find businesses that would BUY this.

Your query must be a simple industry name + "contact email". Nothing fancy.

Examples:
- "coffee machines" → "cafes and restaurants contact email"
- "web design" → "law firms contact email"
- "accounting services" → "small construction companies contact email"
- "dental equipment" → "dental clinics contact email"
- "HR software" → "manufacturing companies hiring contact email"
- "fitness coaching" → "corporate offices HR department contact email"
- "office furniture" → "coworking spaces contact email"

Keep it short. Just: [buyer industry] contact email
Return ONLY the query. No quotes. No explanation.`;

function stripSellPrefixes(raw: string) {
  return raw.replace(/^(i sell|i offer|we sell|we offer|i provide|we provide|selling)\s+/i, "").trim();
}

function normalizeGptSerperQuery(text: string): string {
  const line = text.trim().split("\n")[0]?.trim() ?? "";
  const unquoted = line.replace(/^["'`]+|["'`]+$/g, "").trim();
  return unquoted;
}

async function buildSerperQueryFromGpt(userSellDescription: string, cleaned: string): Promise<string> {
  const fallback = `businesses that need ${cleaned || userSellDescription} contact email`;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.log("[search-prospects] No OPENAI_API_KEY, using fallback Serper query");
    return fallback;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GPT_TIMEOUT_MS);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 80,
        temperature: 0.3,
        messages: [
          { role: "system", content: SERPER_QUERY_SYSTEM },
          { role: "user", content: userSellDescription },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn("[search-prospects] OpenAI HTTP", response.status);
      return fallback;
    }

    const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = data.choices?.[0]?.message?.content;
    const q = typeof raw === "string" ? normalizeGptSerperQuery(raw) : "";
    if (q.length > 0) {
      console.log("[search-prospects] GPT Serper query:", q);
      return q;
    }
  } catch (e) {
    console.log("[search-prospects] GPT Serper query failed, fallback:", e instanceof Error ? e.message : e);
  } finally {
    clearTimeout(timer);
  }

  return fallback;
}

function isBlockedHost(hostname: string) {
  return BLOCKED_HOSTS.some((b) => hostname === b || hostname.endsWith(`.${b}`));
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

    const keyword = query.trim();
    const cleaned = stripSellPrefixes(keyword) || keyword;
    const serperQuery = await buildSerperQueryFromGpt(keyword, cleaned);
    console.log("[search-prospects] Serper query:", serperQuery);

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

    const competitorKeywords = cleaned
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2);

    const filtered = serperOrganic.filter((result) => {
      const titleAndLink = `${result.title || ""} ${result.link || ""}`.toLowerCase();
      return !competitorKeywords.some((w) => titleAndLink.includes(w));
    });

    const toScrapeOrganic =
      filtered.length > 0 ? filtered.slice(0, targetCount) : serperOrganic.slice(0, targetCount);

    const mergedOrganic = dedupeBlocklistOrganic(toScrapeOrganic);
    const toScrape = mergedOrganic.slice(0, Math.min(MAX_CRAWL_URLS, targetCount, mergedOrganic.length));
    console.log(
      `[search-prospects] organic ${serperOrganic.length} → filtered ${filtered.length} → deduped ${mergedOrganic.length} → crawl ${toScrape.length}`
    );

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
            search_keyword: keyword,
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
