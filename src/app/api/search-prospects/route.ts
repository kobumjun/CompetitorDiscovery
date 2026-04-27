import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { reserveCredits, refundCredits } from "@/lib/credits";
import { deriveCompanyNameFromHost, extractWebsiteEmails, normalizeUrl } from "@/lib/leads/extraction";

export const maxDuration = 60;

const SERPER_ENDPOINT = "https://google.serper.dev/search";
const URL_TIMEOUT_MS = 4000;
const OVERALL_TIMEOUT_MS = 55_000;
const BATCH_SIZE = 3;
const MAX_CRAWL_MS = 7000;
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

const SERPER_QUERY_SYSTEM = `The user describes what they sell.
Return exactly 2 different Google search queries to find businesses that would BUY this.
Each query should target a DIFFERENT type of buyer.

Format: simple "[buyer industry] contact email"

Examples:
- "coffee machines" →
cafes and coffee shops contact email
hotel restaurants contact email

- "web design" →
dental clinics contact email
law firms contact email

- "accounting services" →
small construction companies contact email
freelance contractors contact email

- "Japanese language learning product" →
international schools contact email
corporate language training departments contact email

- "fitness coaching" →
corporate HR wellness programs contact email
physical therapy clinics contact email

- "dental equipment" →
dental clinics contact email
orthodontist offices contact email

- "office furniture" →
coworking spaces contact email
startup offices contact email

- "marketing services" →
plumbing companies contact email
auto repair shops contact email

Return ONLY 2 queries, one per line. No numbers. No bullets. No explanation.`;

function stripSellPrefixes(raw: string) {
  return raw.replace(/^(i sell|i offer|we sell|we offer|i provide|we provide|selling)\s+/i, "").trim();
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

async function buildSerperQueriesFromGpt(userSellDescription: string, cleaned: string): Promise<string[]> {
  const fallback = `businesses that need ${cleaned || userSellDescription} contact email`;
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    console.log("[search-prospects] No OPENAI_API_KEY, using fallback Serper query");
    return [fallback];
  }

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
          { role: "system", content: SERPER_QUERY_SYSTEM },
          { role: "user", content: userSellDescription },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn("[search-prospects] OpenAI HTTP", response.status);
      return [fallback];
    }

    const gptData = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const gptText = gptData.choices?.[0]?.message?.content?.trim();
    let queries = (typeof gptText === "string" ? gptText : "")
      .split("\n")
      .map((q) => stripLineNoise(q))
      .filter((q) => q.length > 5 && q.length < 200)
      .slice(0, 2);

    if (queries.length === 0) {
      queries = [fallback];
    }
    console.log(`[GPT 쿼리 ${queries.length}개]`, queries);
    return queries;
  } catch (e) {
    console.log("[search-prospects] GPT Serper queries failed, fallback:", e instanceof Error ? e.message : e);
    return [fallback];
  } finally {
    clearTimeout(timer);
  }
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

async function loadExistingEmailContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<{ existingEmails: Set<string>; knownHostnames: Set<string> }> {
  const existingEmails = new Set<string>();
  const knownHostnames = new Set<string>();
  try {
    const { data: rows, error } = await supabase
      .from("extracted_leads")
      .select("emails, source_url")
      .eq("user_id", userId)
      .limit(3000);
    if (error) throw error;
    for (const row of rows ?? []) {
      if (row.source_url && typeof row.source_url === "string") {
        const h = hostOfLink(row.source_url);
        if (h) knownHostnames.add(h);
      }
      const raw = (row as { emails?: unknown }).emails;
      if (!raw || !Array.isArray(raw)) continue;
      for (const e of raw) {
        if (e && typeof e === "object" && "email" in e) {
          const em = (e as { email?: string }).email;
          if (typeof em === "string" && em.includes("@")) {
            const lower = em.toLowerCase();
            existingEmails.add(lower);
            const at = lower.lastIndexOf("@");
            if (at > 0) {
              const dom = lower.slice(at + 1).replace(/^www\./, "");
              if (dom) knownHostnames.add(dom);
            }
          }
        }
      }
    }
    console.log(`[중복 체크] 기존 이메일 ${existingEmails.size}개, 알려진 호스트/도메인 ${knownHostnames.size}개 로드`);
  } catch (err) {
    console.log(
      "[중복 체크 실패, 무시하고 진행]",
      err instanceof Error ? err.message : String(err)
    );
  }
  return { existingEmails, knownHostnames };
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

async function tryExtractFromUrl(
  url: string,
  emailSeen: Set<string>
): Promise<{ newRows: ExtractedProspectRow[]; dupRows: ExtractedProspectRow[] }> {
  const extraction = await extractWebsiteEmails(url, {
    timeoutMs: URL_TIMEOUT_MS,
    paths: SEARCH_EXTRACT_PATHS,
  });
  if (!extraction.ok || extraction.emails.length === 0) return { newRows: [], dupRows: [] };
  const ok = extraction as OkExtraction;
  const newRows: ExtractedProspectRow[] = [];
  const dupRows: ExtractedProspectRow[] = [];
  const pageSeen = new Set<string>();
  for (const email of ok.emails) {
    const el = email.toLowerCase();
    if (!el.includes("@")) continue;
    const row = rowFromExtraction(ok, email);
    if (emailSeen.has(el) || pageSeen.has(el)) {
      dupRows.push(row);
    } else {
      pageSeen.add(el);
      newRows.push(row);
    }
  }
  return { newRows, dupRows };
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
    const queries = await buildSerperQueriesFromGpt(keyword, cleaned);

    const { existingEmails, knownHostnames: dbKnownHosts } = await loadExistingEmailContext(supabase, user.id);
    // Session-level tracking (clone so we can mutate for same-run dedupe)
    const emailSeen = new Set<string>(existingEmails);

    // ── Serper: parallel (num=10 each) ──
    const serperPromises = queries.map((q) =>
      fetch(SERPER_ENDPOINT, {
        method: "POST",
        headers: {
          "X-API-KEY": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ q, num: SERPER_NUM_RESULTS }),
        signal: AbortSignal.timeout(3000),
      })
        .then(async (r) => (r.ok ? (await r.json().catch(() => ({})) as SerperResponse) : ({} as SerperResponse)))
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
    console.log(`[Serper] 쿼리 ${queries.length}개 → 합산 ${allOrganic.length}개 (도메인 중복 제거)`);

    const competitorKeywords = cleaned
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2);

    const filtered = allOrganic.filter((result) => {
      const titleAndLink = `${result.title || ""} ${result.link || ""}`.toLowerCase();
      return !competitorKeywords.some((w) => titleAndLink.includes(w));
    });

    const candidates = filtered.length > 0 ? filtered : allOrganic;
    console.log(`[필터] ${allOrganic.length}개 → ${filtered.length}개`);

    const blocklisted = dedupeBlocklistOrganic(candidates);
    const ordered = deprioritizeKnownHostSerpItems(blocklisted, dbKnownHosts);
    const candidateUrls: string[] = [];
    for (const it of ordered) {
      const link = it.link;
      if (!link) continue;
      const n = normalizedSerperLink(link);
      if (n) candidateUrls.push(n);
    }

    console.log("[search-prospects] Crawl candidate URL count:", candidateUrls.length);

    if (candidateUrls.length === 0) {
      await refundCredits(user.id, reservedCredits);
      return NextResponse.json({ error: "No companies found. Try broader keywords." }, { status: 404 });
    }

    // ── Batch crawl: fill new emails up to targetCount (7s crawl window) ──
    const crawlStart = Date.now();
    const newResultRows: ExtractedProspectRow[] = [];
    const dupResultRows: ExtractedProspectRow[] = [];
    const failures: { url: string; reason: string }[] = [];
    let candidateIndex = 0;
    let batchN = 0;

    while (
      newResultRows.length < targetCount &&
      candidateIndex < candidateUrls.length &&
      Date.now() - crawlStart < MAX_CRAWL_MS &&
      !isTimedOut()
    ) {
      const batch = candidateUrls.slice(candidateIndex, candidateIndex + BATCH_SIZE);
      candidateIndex += batch.length;
      batchN += 1;
      if (batch.length === 0) break;

      for (const url of batch) {
        if (newResultRows.length >= targetCount) break;
        if (Date.now() - crawlStart >= MAX_CRAWL_MS || isTimedOut()) break;

        let newRows: ExtractedProspectRow[] = [];
        let dupRows: ExtractedProspectRow[] = [];
        try {
          const r = await tryExtractFromUrl(url, emailSeen);
          newRows = r.newRows;
          dupRows = r.dupRows;
        } catch {
          failures.push({ url, reason: "Crawl failed" });
          continue;
        }
        if (newRows.length === 0 && dupRows.length === 0) {
          failures.push({ url, reason: "No email found" });
        }
        for (const r of dupRows) {
          dupResultRows.push(r);
        }
        for (const r of newRows) {
          if (newResultRows.length >= targetCount) break;
          const el = r.email.toLowerCase();
          if (emailSeen.has(el)) {
            dupResultRows.push(r);
            continue;
          }
          emailSeen.add(el);
          newResultRows.push(r);
        }
      }
      console.log(
        `[배치 ${batchN}] 새: ${newResultRows.length}/${targetCount}, 중복: ${dupResultRows.length}, index: ${candidateIndex}/${candidateUrls.length}`
      );
    }

    const duplicatesSkipped = dupResultRows.length;
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

    const dupPart =
      stats.duplicatesSkipped > 0
        ? ` (${stats.duplicatesSkipped} duplicate${stats.duplicatesSkipped === 1 ? "" : "s"} skipped)`
        : "";
    const refundWord = stats.creditsRefunded === 1 ? "credit" : "credits";
    const usedWord = stats.creditsUsed === 1 ? "credit" : "credits";

    let message: string;
    if (stats.creditsUsed > 0) {
      message =
        stats.creditsRefunded > 0
          ? `✓ Found ${stats.creditsUsed} new email${stats.creditsUsed === 1 ? "" : "s"}${dupPart} — ${stats.creditsUsed} ${usedWord} used, ${stats.creditsRefunded} ${refundWord} refunded`
          : `✓ Found ${stats.creditsUsed} new email${stats.creditsUsed === 1 ? "" : "s"}${dupPart} — ${stats.creditsUsed} ${usedWord} used`;
    } else if (stats.duplicatesSkipped > 0) {
      const credWord = reservedCredits === 1 ? "credit" : "credits";
      message = `No new emails found${dupPart} — all ${reservedCredits} ${credWord} refunded.`;
    } else {
      message = `No emails found — all ${reservedCredits} credits refunded. Try different keywords.`;
    }

    console.log("[search-prospects] === DONE === used:", creditsUsed, "refunded:", creditsRefunded, "elapsed:", Date.now() - startTime, "ms");

    return NextResponse.json({
      success: true,
      leads,
      stats,
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
