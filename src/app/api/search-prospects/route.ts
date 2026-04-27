import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { reserveCredits, refundCredits } from "@/lib/credits";
import { deriveCompanyNameFromHost, extractWebsiteEmails, normalizeUrl } from "@/lib/leads/extraction";

export const maxDuration = 60;

const SERPER_ENDPOINT = "https://google.serper.dev/search";
const URL_TIMEOUT_MS = 4000;
const OVERALL_TIMEOUT_MS = 55_000;
const CONCURRENCY = 5;
const GPT_TIMEOUT_MS = 2000;

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

type SerperOrganicResult = { link?: string };
type SerperResponse = { organic?: SerperOrganicResult[] };
type ExtractedProspectRow = { email: string; source_url: string; company_name: string; host: string };

function isBlockedHost(hostname: string) {
  return BLOCKED_HOSTS.some((b) => hostname === b || hostname.endsWith(`.${b}`));
}

function buildSearchQuery(input: string): string {
  const q = input.trim();
  if (q.split(/\s+/).length <= 2) return `${q} company official site`;
  if (!/official|contact/i.test(q)) return `${q} official site contact`;
  return q;
}

async function generateBuyerQueries(keyword: string): Promise<string[]> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) return [];

  try {
    const gptResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 200,
        temperature: 0.7,
        messages: [
          {
            role: "system",
            content: `The user describes what they sell. Convert this into 3 Google search queries that find their potential CUSTOMERS (businesses that would BUY this).

Rules:
- Find the BUYER industry, not the seller's industry
- Example: "web design services" → search for restaurants, dentists, lawyers (they need websites)
- Example: "HR software" → search for manufacturing, logistics, retail companies (they hire people)
- Example: "dental equipment" → search for dental clinics, orthodontists (they buy equipment)

Add a city or region if the user mentions one.
Return ONLY a JSON array of 3 queries. No explanation.`,
          },
          { role: "user", content: keyword },
        ],
      }),
      signal: AbortSignal.timeout(GPT_TIMEOUT_MS),
    });

    const gptData = await gptResponse.json();
    const gptText: string | undefined = gptData.choices?.[0]?.message?.content?.trim();

    if (gptText) {
      const parsed = JSON.parse(gptText);
      const arr: unknown[] = Array.isArray(parsed) ? parsed : parsed.queries ?? parsed.search_queries ?? [];
      const queries = arr.filter((q): q is string => typeof q === "string" && q.trim().length > 0).slice(0, 3);
      if (queries.length > 0) {
        console.log("[GPT 변환 성공]", queries);
        return queries;
      }
    }
    return [];
  } catch (err) {
    console.log("[GPT 변환 실패, 원래 키워드 사용]", err instanceof Error ? err.message : err);
    return [];
  }
}

function urlsReferToSameResult(rowUrl: string, filterUrl: string) {
  if (rowUrl.includes(filterUrl) || filterUrl.includes(rowUrl)) return true;

  try {
    const rowHost = normalizeUrl(rowUrl)?.hostname.replace(/^www\./, "").toLowerCase();
    const filterHost = normalizeUrl(filterUrl)?.hostname.replace(/^www\./, "").toLowerCase();
    return Boolean(rowHost && filterHost && rowHost === filterHost);
  } catch {
    return false;
  }
}

async function filterCustomerRows(keyword: string, rows: ExtractedProspectRow[]): Promise<ExtractedProspectRow[]> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey || rows.length === 0) return rows;

  try {
    const filterResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 300,
        temperature: 0,
        messages: [
          {
            role: "system",
            content: `You are a B2B sales filter. The user sells a specific product/service. You will receive a list of companies found online. Your job: determine which companies are potential CUSTOMERS (would BUY from the user), and which are COMPETITORS (sell similar things).

Return ONLY a JSON array of objects: [{"url": "...", "is_customer": true/false, "reason": "short reason"}]

CRITICAL: A company is a COMPETITOR if it sells the same or similar service as the user. A company is a CUSTOMER if it would benefit from BUYING the user's service.

Example: User sells "web design".
- "Joe's Dental Clinic" → is_customer: true (needs a website)
- "WebAgency Pro" → is_customer: false (competitor, also sells web design)
- "Mario's Italian Restaurant" → is_customer: true (needs a website)`,
          },
          {
            role: "user",
            content: `I sell: "${keyword}"

Companies found:
${rows.map((row) => `- ${row.company_name} (${row.source_url})`).join("\n")}`,
          },
        ],
      }),
      signal: AbortSignal.timeout(GPT_TIMEOUT_MS),
    });

    const filterData = await filterResponse.json();
    const filterText: string | undefined = filterData.choices?.[0]?.message?.content?.trim();
    if (!filterText) return rows;

    const parsed: unknown = JSON.parse(filterText);
    if (!Array.isArray(parsed)) return rows;

    const customerUrls = parsed
      .filter((item): item is { url: string; is_customer: boolean } => (
        typeof item === "object" &&
        item !== null &&
        "url" in item &&
        "is_customer" in item &&
        typeof item.url === "string" &&
        item.is_customer === true
      ))
      .map((item) => item.url);

    if (customerUrls.length === 0) return [];

    const filteredRows = rows.filter((row) =>
      customerUrls.some((url) => urlsReferToSameResult(row.source_url, url))
    );
    const removedCount = rows.length - filteredRows.length;

    if (removedCount > 0) {
      console.log(`[GPT 필터] ${removedCount}개 경쟁사 제거, ${filteredRows.length}개 타겟 유지`);
    } else {
      console.log("[GPT 필터] 제거된 경쟁사 없음");
    }

    return filteredRows;
  } catch (err) {
    console.log("[GPT 필터 실패, 전체 결과 유지]", err instanceof Error ? err.message : err);
    return rows;
  }
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

    // ── Generate buyer-targeting queries via OpenAI ──
    const buyerQueries = await generateBuyerQueries(query);
    const useBuyerQueries = buyerQueries.length >= 2;
    console.log("[search-prospects] Buyer queries:", useBuyerQueries ? buyerQueries : "fallback to direct search");

    // ── Call Serper API ──
    let candidates: string[];

    if (useBuyerQueries) {
      let queriesToRun: string[];
      if (targetCount <= 2) {
        queriesToRun = [buyerQueries[0]];
      } else if (targetCount === 3) {
        queriesToRun = buyerQueries.slice(0, 3);
      } else {
        queriesToRun = buyerQueries.slice(0, 3);
      }

      const perQueryNum = Math.min(30, Math.max(8, Math.ceil((targetCount * 4) / queriesToRun.length)));
      console.log("[search-prospects] Running", queriesToRun.length, "Serper queries, num per query:", perQueryNum);

      const allOrganic: SerperOrganicResult[] = [];
      for (const sq of queriesToRun) {
        if (isTimedOut()) break;
        try {
          const serperRes = await fetch(SERPER_ENDPOINT, {
            method: "POST",
            headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
            body: JSON.stringify({ q: sq, num: perQueryNum }),
          });
          if (!serperRes.ok) {
            const errorBody = await serperRes.text().catch(() => "");
            console.warn("[search-prospects] Serper error for query:", sq, serperRes.status, errorBody.slice(0, 200));
            if (serperRes.status === 429) {
              throw new Error("Daily search limit reached. Try again tomorrow or contact support.");
            }
            continue;
          }
          const payload = (await serperRes.json()) as SerperResponse;
          console.log("[search-prospects] Serper OK for:", sq, "results:", payload.organic?.length ?? 0);
          allOrganic.push(...(payload.organic ?? []));
        } catch (err) {
          if (err instanceof Error && err.message.includes("Daily search limit")) throw err;
          console.warn("[search-prospects] Serper call failed for query:", sq, err instanceof Error ? err.message : err);
        }
      }

      const seenLinks = new Set<string>();
      candidates = allOrganic
        .map((r) => r.link?.trim() || "")
        .filter(Boolean)
        .map((url) => normalizeUrl(url))
        .filter((url): url is URL => Boolean(url))
        .filter((url) => !isBlockedHost(url.hostname.replace(/^www\./, "").toLowerCase()))
        .map((url) => url.toString())
        .filter((url) => { if (seenLinks.has(url)) return false; seenLinks.add(url); return true; });
    } else {
      const enhancedQuery = buildSearchQuery(query);
      const serperNum = Math.min(100, targetCount * 4);
      console.log("[search-prospects] Fallback Serper query:", enhancedQuery, "num:", serperNum);

      const serperRes = await fetch(SERPER_ENDPOINT, {
        method: "POST",
        headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ q: enhancedQuery, num: serperNum }),
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
      console.log("[search-prospects] Serper OK — results:", serperPayload.organic?.length ?? 0);

      candidates = (serperPayload.organic ?? [])
        .map((r) => r.link?.trim() || "")
        .filter(Boolean)
        .map((url) => normalizeUrl(url))
        .filter((url): url is URL => Boolean(url))
        .filter((url) => !isBlockedHost(url.hostname.replace(/^www\./, "").toLowerCase()))
        .map((url) => url.toString());
    }

    console.log("[search-prospects] Candidates after blocklist filter:", candidates.length);

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
        const extraction = await extractWebsiteEmails(url, { timeoutMs: URL_TIMEOUT_MS });
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

    // ── Filter out competitors after extraction, before charging/persisting ──
    uniqueRows = await filterCustomerRows(query.trim(), uniqueRows);

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
