import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { reserveCredits, refundCredits } from "@/lib/credits";
import { deriveCompanyNameFromHost, extractWebsiteEmails, normalizeUrl } from "@/lib/leads/extraction";

export const maxDuration = 60;

const SERPER_ENDPOINT = "https://google.serper.dev/search";
/** Per-path HTTP fetch inside `extractWebsiteEmails` (paths run in parallel per site). */
const CRAWL_FETCH_TIMEOUT_MS = 5000;
/** Concurrent prospect URLs per crawl batch (`Promise.allSettled`). */
const CRAWL_PARALLEL_BATCH = 4;
/** Hard cap for entire POST (planner + Serper + crawl + inserts); stay under `maxDuration`. */
const OVERALL_TIMEOUT_MS = 58_000;
/** Upper bound for one prospect `extractWebsiteEmails` (parallel paths; avoids stuck Promise.all). */
const SITE_EXTRACT_HARD_MS = 20_000;
const MAX_SERPER_URLS = 20;
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
const SERPER_NUM_RESULTS = 10;
const GPT_TIMEOUT_MS = 4000;

const SELLER_TO_BUYER_SYSTEM_PROMPT = `The user describes what they sell.
Do two things:

1. Return exactly 2 Google search queries to find businesses that would BUY this.
   Each query targets a DIFFERENT buyer type.
   Format: "[specific buyer industry] contact email"
   IMPORTANT: queries must NOT contain words from what the user sells.

2. Return competitor keywords (words that identify companies selling the same thing as the user).

Return ONLY this JSON:
{
  "queries": ["query1", "query2"],
  "competitor_keywords": ["kw1", "kw2", "kw3"]
}

Examples:
- "coffee machines" → {"queries":["cafes and coffee shops contact email","hotel restaurants contact email"],"competitor_keywords":["coffee machine","espresso","vending"]}
- "web design" → {"queries":["dental clinics contact email","law firms contact email"],"competitor_keywords":["web design","web agency","digital agency","website builder"]}
- "accounting services" → {"queries":["small construction companies contact email","freelance contractors contact email"],"competitor_keywords":["accounting","bookkeeping","CPA firm","tax services"]}
- "Japanese language learning product" → {"queries":["international schools contact email","corporate language training departments contact email"],"competitor_keywords":["language learning","language school","Japanese course","language app"]}
- "fitness coaching" → {"queries":["corporate HR wellness programs contact email","physical therapy clinics contact email"],"competitor_keywords":["fitness coach","personal trainer","gym","fitness program"]}
- "dental equipment" → {"queries":["dental clinics contact email","orthodontist offices contact email"],"competitor_keywords":["dental equipment","dental supply","dental tools"]}
- "marketing services" → {"queries":["plumbing companies contact email","auto repair shops contact email"],"competitor_keywords":["marketing agency","digital marketing","SEO agency","advertising"]}
- "office furniture" → {"queries":["coworking spaces contact email","startup offices contact email"],"competitor_keywords":["office furniture","desk supplier","chair manufacturer"]}

No explanation. Return ONLY the JSON.`;

function stripSellPrefixes(raw: string) {
  return raw.replace(/^(i sell|i offer|we sell|we offer|i provide|we provide|selling)\s+/i, "").trim();
}

function cleanJsonFence(text: string): string {
  return text.replace(/```json\n?/gi, "").replace(/```/g, "").trim();
}

/** One representative email per site: prefer business-facing roles over generic. */
const EMAIL_PREFIX_PRIORITY = [
  "partnership",
  "partnerships",
  "partner",
  "advertising",
  "adteam",
  "adverts",
  "ads",
  "sponsor",
  "sponsorship",
  "sponsored",
  "marketing",
  "growth",
  "business",
  "bd",
  "contact",
  "hello",
  "hi",
  "sales",
  "info",
  "press",
  "media",
  "editorial",
  "content",
  "editor",
  "support",
] as const;

const EXCLUDED_LOCAL_PREFIX = /^(career|careers|recruit|recruitment|job|jobs|intern|hr|people|humanresources|apply|hiring|talent|unsubscribe|dmca|phishing|abuse|security|compliance|privacy|legal|copyright|licensing|webmaster|postmaster|no-?reply|no-?replies|mailer-daemon|bounces?|return|undeliverable|donotreply|root|system|uploader|devops?|noc|ithelp)/i;

function scoreLocalPartForTarget(email: string): number {
  const at = email.indexOf("@");
  if (at < 0) return -1;
  const rawLocal = email.slice(0, at).toLowerCase();
  const local = rawLocal.split("+")[0] || rawLocal;
  if (EXCLUDED_LOCAL_PREFIX.test(local) || /^(admin|webmaster|noreply|no-reply)$/i.test(local)) {
    return -1000;
  }
  for (let i = 0; i < EMAIL_PREFIX_PRIORITY.length; i++) {
    const p = EMAIL_PREFIX_PRIORITY[i]!;
    if (local === p || local.startsWith(p + ".") || local.startsWith(p + "-")) {
      return 10_000 - i;
    }
  }
  return 1000;
}

function selectPreferredTargetEmail(candidates: string[] | undefined): string | null {
  if (!candidates?.length) return null;
  const scored: { email: string; score: number }[] = [];
  for (const e of candidates) {
    if (!e.includes("@")) continue;
    const s = scoreLocalPartForTarget(e);
    if (s > -500) scored.push({ email: e, score: s });
  }
  if (scored.length === 0) return null;
  scored.sort((a, b) => b.score - a.score || a.email.toLowerCase().localeCompare(b.email.toLowerCase()));
  return scored[0]!.email;
}

function stripLineNoise(line: string) {
  return line
    .replace(/^[-*•]\s*/, "")
    .replace(/^\d+[.)]\s*/, "")
    .replace(/^["'`]+|["'`]+$/g, "")
    .trim();
}

function hostOfLink(link: string | undefined): string | null {
  if (!link?.trim()) return null;
  const key = normalizedSerperLink(link);
  if (!key) return null;
  const host = normalizeUrl(key)?.hostname.replace(/^www\./, "").toLowerCase();
  return host || null;
}

function parsePlannerOutput(text: string): { queries: string[]; competitorKeywords: string[] } {
  const raw = cleanJsonFence(text);
  let queries: string[] = [];
  let competitorKeywords: string[] = [];
  try {
    const parsed = JSON.parse(raw) as { queries?: unknown; competitor_keywords?: unknown };
    if (Array.isArray(parsed.queries)) {
      queries = parsed.queries
        .map((q) => (typeof q === "string" ? stripLineNoise(q) : ""))
        .filter((q) => q.length > 5 && q.length < 200)
        .slice(0, 2);
    }
    if (Array.isArray(parsed.competitor_keywords)) {
      competitorKeywords = parsed.competitor_keywords
        .map((q) => (typeof q === "string" ? q.trim().toLowerCase() : ""))
        .filter((q) => q.length > 1 && q.length < 80);
    }
  } catch {
    // ignore parse failure
  }
  return { queries, competitorKeywords };
}

async function buildBuyerQueriesAndCompetitorsFromGpt(cleaned: string): Promise<{ queries: string[]; competitorKeywords: string[] }> {
  let queries: string[] = [];
  let competitorKeywords: string[] = [];
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) return { queries: [`businesses that need ${cleaned} contact email`], competitorKeywords: [] };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GPT_TIMEOUT_MS);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 200,
        temperature: 0,
        messages: [
          { role: "system", content: SELLER_TO_BUYER_SYSTEM_PROMPT },
          { role: "user", content: cleaned },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn("[search-prospects] OpenAI HTTP", response.status);
      return { queries: [`businesses that need ${cleaned} contact email`], competitorKeywords: [] };
    }

    const gptData = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const gptText = gptData.choices?.[0]?.message?.content?.trim();
    if (gptText) {
      const parsed = parsePlannerOutput(gptText);
      queries = parsed.queries;
      competitorKeywords = parsed.competitorKeywords;
      console.log(`[GPT 성공] 쿼리: ${queries.join(" | ")} 경쟁사: ${competitorKeywords.join(", ")}`);
    }
  } catch (e) {
    console.log(`[GPT 실패] ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    clearTimeout(timer);
  }

  if (queries.length === 0) {
    queries = [`businesses that need ${cleaned} contact email`];
  }
  return { queries, competitorKeywords };
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

function deprioritizeKnownHostSerpItems(organic: SerperOrganicResult[], knownHostnames: Set<string>): SerperOrganicResult[] {
  if (knownHostnames.size === 0) return organic;
  const a: SerperOrganicResult[] = [];
  const b: SerperOrganicResult[] = [];
  for (const it of organic) {
    const h = hostOfLink(it.link);
    if (h && knownHostnames.has(h)) b.push(it);
    else a.push(it);
  }
  return [...a, ...b];
}

async function loadExistingEmails(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<Set<string>> {
  const existingEmails = new Set<string>();
  try {
    const direct = await supabase
      .from("extracted_leads")
      .select("email")
      .eq("user_id", userId);
    if (!direct.error && Array.isArray(direct.data)) {
      for (const row of direct.data as Array<{ email?: string | null }>) {
        const e = row.email?.toLowerCase();
        if (e) existingEmails.add(e);
      }
    } else {
      const fallback = await supabase
        .from("extracted_leads")
        .select("emails")
        .eq("user_id", userId)
        .limit(3000);
      if (fallback.error) throw fallback.error;
      for (const row of (fallback.data ?? []) as Array<{ emails?: unknown }>) {
        const arr = row.emails;
        if (!Array.isArray(arr)) continue;
        for (const item of arr) {
          const em = typeof item === "object" && item && "email" in item ? (item as { email?: string }).email : undefined;
          if (em) existingEmails.add(em.toLowerCase());
        }
      }
    }
    console.log(`[중복 체크] 기존 이메일 ${existingEmails.size}개`);
  } catch (err) {
    console.log(`[중복 체크 실패, 무시] ${err instanceof Error ? err.message : String(err)}`);
  }
  return existingEmails;
}

type OkExtraction = {
  ok: true;
  emails: string[];
  sourceForEmail: Map<string, string>;
  baseUrl: string;
  host: string;
};

function rowFromExtraction(extraction: OkExtraction, email: string): ExtractedProspectRow {
  const el = email.toLowerCase();
  return {
    email,
    source_url: extraction.sourceForEmail.get(el) ?? extraction.baseUrl,
    company_name: deriveCompanyNameFromHost(extraction.host),
    host: extraction.host,
  };
}

type CrawlSingleResult =
  | { kind: "row"; row: ExtractedProspectRow }
  | { kind: "failure"; url: string; reason: string };

/**
 * Fetch + parse one prospect URL (no shared mutable state). Caller merges into `emailSeen` in batch order.
 */
async function crawlSingleUrlForRow(url: string): Promise<CrawlSingleResult> {
  const siteStart = Date.now();
  try {
    const extraction = await Promise.race([
      extractWebsiteEmails(url, {
        timeoutMs: CRAWL_FETCH_TIMEOUT_MS,
        paths: SEARCH_EXTRACT_PATHS,
      }),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("site_extract_hard_timeout")), SITE_EXTRACT_HARD_MS);
      }),
    ]);
    if (!extraction.ok) {
      const detail = `${extraction.code}: ${extraction.message}`;
      console.log(`[크롤링 실패] ${url} - ${detail} - ${Date.now() - siteStart}ms`);
      return { kind: "failure", url, reason: extraction.code };
    }
    if (extraction.emails.length === 0) {
      console.log(`[크롤링 실패] ${url} - No email found - ${Date.now() - siteStart}ms`);
      return { kind: "failure", url, reason: "No email found" };
    }
    const ok = extraction as OkExtraction;
    const best = selectPreferredTargetEmail(ok.emails);
    if (!best) {
      console.log(`[크롤링 실패] ${url} - No suitable email - ${Date.now() - siteStart}ms`);
      return { kind: "failure", url, reason: "No email found" };
    }
    console.log(`[크롤링 완료] ${url} - ${Date.now() - siteStart}ms`);
    return { kind: "row", row: rowFromExtraction(ok, best) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`[크롤링 실패] ${url} - ${msg} - ${Date.now() - siteStart}ms`);
    return { kind: "failure", url, reason: "Crawl failed" };
  }
}

export async function POST(request: NextRequest) {
  let reservedCredits = 0;
  let userId = "";
  try {
    console.log("[search-prospects] === START ===");
    const PROCESS_START = Date.now();

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
    const targetCount = Math.min(10, Math.max(1, Math.round(requestedCount ?? 3)));
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

    const isTimedOut = () => Date.now() - PROCESS_START > OVERALL_TIMEOUT_MS;

    const keyword = query.trim();
    const cleaned = stripSellPrefixes(keyword) || keyword;
    const planner = await buildBuyerQueriesAndCompetitorsFromGpt(cleaned);
    const queries = planner.queries.slice(0, 2);
    let competitorKeywords = planner.competitorKeywords;
    const words = cleaned.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    competitorKeywords = Array.from(new Set([...competitorKeywords, ...words]));

    const existingEmails = await loadExistingEmails(supabase, user.id);
    const emailSeen = new Set<string>(existingEmails);

    // ── Serper: 2회 병렬 ──
    const serperPromises = queries.slice(0, 2).map((q) =>
      fetch(SERPER_ENDPOINT, {
        method: "POST",
        headers: {
          "X-API-KEY": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ q, num: SERPER_NUM_RESULTS }),
        signal: AbortSignal.timeout(3000),
      })
        .then(async (r) => (r.ok ? (await r.json().catch(() => ({ organic: [] })) as SerperResponse) : ({ organic: [] } as SerperResponse)))
        .catch(() => ({} as SerperResponse))
    );

    const serperResults = await Promise.all(serperPromises);

    const allOrganic: SerperOrganicResult[] = [];
    const seenDomain = new Set<string>();
    for (const result of serperResults) {
      for (const item of result.organic || []) {
        if (!item.link) continue;
        let domain: string;
        try {
          const u = new URL(
            /^(https?:)?\/\//i.test(String(item.link)) ? String(item.link) : `https://${item.link}`
          );
          domain = u.hostname.replace(/^www\./, "").toLowerCase();
        } catch {
          continue;
        }
        if (seenDomain.has(domain)) continue;
        seenDomain.add(domain);
        allOrganic.push(item);
        if (allOrganic.length >= MAX_SERPER_URLS) break;
      }
      if (allOrganic.length >= MAX_SERPER_URLS) break;
    }
    console.log(`[Serper] 합산 ${allOrganic.length}개 (도메인 중복 제거)`);

    const filtered = allOrganic.filter((result) => {
      const titleAndLink = `${result.title || ""} ${result.link || ""}`.toLowerCase();
      return !competitorKeywords.some((kw) => titleAndLink.includes(kw));
    });
    const candidates = filtered.length > 0 ? filtered : allOrganic;
    console.log(`[필터] ${allOrganic.length}개 → ${candidates.length}개`);

    const ordered = dedupeBlocklistOrganic(candidates);
    const candidateUrls: string[] = [];
    for (const it of ordered) {
      const link = it.link;
      if (!link) continue;
      const n = normalizedSerperLink(link);
      if (n) candidateUrls.push(n);
    }

    console.log("[search-prospects] Crawl candidate URL count:", candidateUrls.length);

    if (candidateUrls.length === 0) {
      console.log(
        "[search-prospects:metrics]",
        JSON.stringify({
          serperOrganicLinksDeduped: allOrganic.length,
          crawlCandidateUrls: 0,
          urlsVisitedDuringCrawl: 0,
          emailsInserted: 0,
          crawlFailures: 0,
          duplicatesSkipped: 0,
          note: "no_crawl_candidates_after_filter",
        }),
      );
      await refundCredits(user.id, reservedCredits);
      return NextResponse.json({ error: "No companies found. Try broader keywords." }, { status: 404 });
    }

    // ── Batch crawl: parallel batches (Promise.allSettled), strict crawl deadline + per-fetch timeouts ──
    const crawlStart = Date.now();
    const newResultRows: ExtractedProspectRow[] = [];
    const dupResultRows: ExtractedProspectRow[] = [];
    const failures: { url: string; reason: string }[] = [];
    let candidateIndex = 0;
    let batchN = 0;
    let skippedDups = 0;
    let crawlStoppedForSafeDeadline = false;

    crawlLoop: while (
      newResultRows.length < targetCount &&
      candidateIndex < candidateUrls.length &&
      !isTimedOut()
    ) {
      if (Date.now() - PROCESS_START > 50000) {
        crawlStoppedForSafeDeadline = true;
        console.log("[search-prospects] 50초 안전 타임아웃 - 루프 중단");
        break;
      }

      const batch = candidateUrls.slice(candidateIndex, candidateIndex + CRAWL_PARALLEL_BATCH);
      candidateIndex += batch.length;
      batchN += 1;
      if (batch.length === 0) break;

      if (Date.now() - PROCESS_START > 50000) {
        crawlStoppedForSafeDeadline = true;
        console.log("[search-prospects] 50초 안전 타임아웃 - 루프 중단");
        break;
      }

      const settled = await Promise.allSettled(batch.map((url) => crawlSingleUrlForRow(url)));

      for (let i = 0; i < settled.length; i++) {
        const url = batch[i]!;
        if (newResultRows.length >= targetCount) break;
        if (Date.now() - PROCESS_START > 50000) {
          crawlStoppedForSafeDeadline = true;
          console.log("[search-prospects] 50초 안전 타임아웃 - 루프 중단");
          break crawlLoop;
        }

        const s = settled[i]!;
        if (s.status === "rejected") {
          console.log(`[크롤링 스킵] ${url} - timeout or error`, s.reason);
          failures.push({ url, reason: "Crawl failed" });
          continue;
        }

        const v = s.value;
        if (v.kind === "failure") {
          failures.push({ url: v.url, reason: v.reason });
          continue;
        }

        const row = v.row;
        const el = row.email.toLowerCase();
        if (emailSeen.has(el)) {
          dupResultRows.push(row);
          skippedDups += 1;
          continue;
        }
        emailSeen.add(el);
        newResultRows.push(row);
        console.log(`[새 이메일] ${row.email}`);
      }

      console.log(
        `[배치 ${batchN}] 병렬×${CRAWL_PARALLEL_BATCH} 새: ${newResultRows.length}/${targetCount} 중복스킵: ${skippedDups} 후보남음: ${candidateUrls.length - candidateIndex}`,
      );
    }

    const duplicatesSkipped = skippedDups;
    const crawlElapsed = Date.now() - crawlStart;
    console.log(
      "[search-prospects] Crawl done — new:",
      newResultRows.length,
      "dups:",
      dupResultRows.length,
      "failures:",
      failures.length,
      "crawl ms:",
      crawlElapsed,
      "safeDeadline:",
      crawlStoppedForSafeDeadline,
    );

    // ── Persist NEW rows only (each success → credit used) ──
    const service = await createServiceClient();
    const leads: Array<{ email: string; source_url: string; company_name: string; lead_id: string; client_id: string }> = [];

    for (const row of newResultRows) {
      if (isTimedOut()) break;
      try {
        const { data: lead } = await service
          .from("extracted_leads")
          .insert({
            user_id: user.id,
            source_url: row.source_url,
            company_name: row.company_name,
            emails: [
              { email: row.email, source: row.source_url, confidence: row.email.startsWith("info@") || row.email.startsWith("hello@") ? "medium" : "high" },
            ],
            search_keyword: keyword,
          })
          .select("id")
          .single();
        if (!lead) continue;

        const { data: client } = await service
          .from("clients")
          .insert({
            user_id: user.id,
            email: row.email,
            company_name: row.company_name,
            website: `https://${row.host}`,
            source_url: row.source_url,
            status: "new",
          })
          .select("id")
          .single();
        if (!client) continue;

        leads.push({ email: row.email, source_url: row.source_url, company_name: row.company_name, lead_id: lead.id, client_id: client.id });
      } catch (insertErr) {
        console.warn("[search-prospects] Insert failed for", row.email, ":", insertErr instanceof Error ? insertErr.message : insertErr);
      }
    }

    const creditsUsed = leads.length;
    const creditsRefunded = Math.max(reservedCredits - creditsUsed, 0);
    if (creditsRefunded > 0) await refundCredits(user.id, creditsRefunded);
    const finalCredits = reserve.remaining + creditsRefunded;

    console.log(
      `[크레딧] 선차감: ${reservedCredits}, 사용(저장): ${creditsUsed}, 환불: ${creditsRefunded}, duplicatesSkipped(미저장): ${duplicatesSkipped}`
    );

    const stats = {
      newEmails: creditsUsed,
      duplicatesSkipped,
      websitesCrawled: Math.min(candidateIndex, candidateUrls.length),
      candidateUrlsTotal: candidateUrls.length,
      creditsUsed,
      creditsRefunded,
    };

    /** Single-line metrics for ops dashboards / grep (Serper → crawl → DB). */
    console.log(
      "[search-prospects:metrics]",
      JSON.stringify({
        serperOrganicLinksDeduped: allOrganic.length,
        crawlCandidateUrls: candidateUrls.length,
        urlsVisitedDuringCrawl: stats.websitesCrawled,
        emailsInserted: creditsUsed,
        crawlFailures: failures.length,
        duplicatesSkipped,
        crawlStoppedForSafeDeadline,
      }),
    );

    let message: string;
    if (creditsUsed === targetCount) {
      message = `✓ Found ${creditsUsed} emails — ${creditsUsed} credits used`;
    } else if (creditsUsed > 0) {
      message = `✓ Found ${creditsUsed} emails — ${creditsUsed} credits used, ${creditsRefunded} credits refunded`;
    } else {
      message = `No emails found — all ${targetCount} credits refunded. Try different keywords.`;
    }

    console.log("[search-prospects] === DONE === used:", creditsUsed, "refunded:", creditsRefunded, "elapsed:", Date.now() - PROCESS_START, "ms");

    return NextResponse.json({
      success: true,
      leads,
      stats,
      generatedSearchQueries: queries,
      duplicateLeads: dupResultRows.map((r) => ({
        email: r.email,
        company_name: r.company_name,
        source_url: r.source_url,
        duplicate: true,
      })),
      requestedCount: targetCount,
      searchedCount: candidateUrls.length,
      processedCount: candidateIndex,
      successfulUrls: leads.length,
      failedUrls: failures.length,
      failed: failures,
      creditsReserved: reservedCredits,
      creditsUsed,
      creditsRefunded,
      creditsRemaining: finalCredits,
      message,
    });
  } catch (error) {
    if (reservedCredits > 0 && userId) await refundCredits(userId, reservedCredits).catch(() => undefined);
    console.error("[search-prospects] === FATAL ===", error instanceof Error ? error.message : String(error));
    const errMsg = error instanceof Error ? error.message : "An unexpected error occurred.";
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
