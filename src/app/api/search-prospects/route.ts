import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { reserveCredits, refundCredits } from "@/lib/credits";
import { deriveCompanyNameFromHost, extractWebsiteEmails, normalizeUrl } from "@/lib/leads/extraction";

export const maxDuration = 10;

const SERPER_ENDPOINT = "https://google.serper.dev/search";
const SERPER_NUM = 20;
const URL_TIMEOUT_MS = 3000;
const OVERALL_TIMEOUT_MS = 8_000;
const CONCURRENCY = 3;
const LIGHTWEIGHT_PATHS = ["", "/contact"];

const BLOCKED_HOSTS = [
  "g2.com",
  "capterra.com",
  "techcrunch.com",
  "forbes.com",
  "facebook.com",
  "linkedin.com",
  "youtube.com",
  "wikipedia.org",
  "quora.com",
  "producthunt.com",
  "trustpilot.com",
  "glassdoor.com",
  "crunchbase.com",
  "ycombinator.com",
  "instagram.com",
  "x.com",
  "twitter.com",
  "tiktok.com",
  "reddit.com",
  "medium.com",
  "yelp.com",
  "bbb.org",
  "yellowpages.com",
  "mapquest.com",
  "tripadvisor.com",
  "amazon.com",
  "ebay.com",
  "apple.com",
  "google.com",
  "microsoft.com",
  "github.com",
  "stackoverflow.com",
  "indeed.com",
  "ziprecruiter.com",
];

type SerperOrganicResult = { link?: string };
type SerperResponse = { organic?: SerperOrganicResult[] };

function isBlockedHost(hostname: string) {
  return BLOCKED_HOSTS.some((b) => hostname === b || hostname.endsWith(`.${b}`));
}

function buildSearchQuery(input: string): string {
  const q = input.trim();
  if (q.split(/\s+/).length <= 2) return `${q} company official site`;
  if (!/official|contact/i.test(q)) return `${q} official site contact`;
  return q;
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

function hostFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

async function fetchSerper(apiKey: string, query: string): Promise<SerperResponse> {
  console.log("[fetchSerper] Calling Serper with query:", query, "num:", SERPER_NUM);
  const res = await fetch(SERPER_ENDPOINT, {
    method: "POST",
    headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ q: query, num: SERPER_NUM }),
  });
  console.log("[fetchSerper] Response status:", res.status, res.statusText);

  if (res.status === 401 || res.status === 403) {
    const body = await res.text().catch(() => "");
    console.error("[fetchSerper] Auth error body:", body.slice(0, 200));
    throw new Error("Search service unavailable. Please try again later.");
  }
  if (res.status === 429) throw new Error("Daily search limit reached. Try again tomorrow or contact support.");
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[fetchSerper] Non-OK response body:", body.slice(0, 200));
    throw new Error("Search service unavailable. Please try again later.");
  }

  const data = (await res.json()) as SerperResponse;
  console.log("[fetchSerper] Organic results count:", data.organic?.length ?? 0);
  return data;
}

export async function POST(request: NextRequest) {
  let reservedCredits = 0;
  let userId = "";
  try {
    console.log("[search-prospects] === START ===");
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log("[search-prospects] ERROR: No authenticated user");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    userId = user.id;
    console.log("[search-prospects] User:", user.id, user.email);

    const apiKey = process.env.SERPER_API_KEY;
    console.log("[search-prospects] SERPER_API_KEY present:", Boolean(apiKey), "length:", apiKey?.length ?? 0);
    if (!apiKey) {
      console.log("[search-prospects] ERROR: SERPER_API_KEY is missing");
      return NextResponse.json({ error: "Search service unavailable. Please try again later." }, { status: 503 });
    }

    const body = await request.json();
    const { query, requestedCount } = body as { query?: string; requestedCount?: number };
    console.log("[search-prospects] Request body:", JSON.stringify({ query, requestedCount }));
    if (!query || !query.trim()) return NextResponse.json({ error: "Query is required." }, { status: 400 });

    const targetCount = Math.min(5, Math.max(1, Math.round(requestedCount ?? 3)));
    console.log("[search-prospects] targetCount:", targetCount);
    const reserve = await reserveCredits(user.id, targetCount);
    console.log("[search-prospects] Reserve result:", JSON.stringify(reserve));
    if (!reserve.success) {
      return NextResponse.json({ error: `Not enough credits. You have ${reserve.remaining} credits.` }, { status: 402 });
    }
    reservedCredits = targetCount;

    const startTime = Date.now();
    const isTimedOut = () => Date.now() - startTime > OVERALL_TIMEOUT_MS;

    console.log("[search-prospects] Loading existing leads...");
    const service = await createServiceClient();
    const { data: existingLeads, error: leadsErr } = await service
      .from("extracted_leads")
      .select("emails, source_url")
      .eq("user_id", user.id);
    console.log("[search-prospects] Existing leads:", existingLeads?.length ?? 0, "error:", leadsErr?.message ?? "none");

    const seenEmails = new Set<string>();
    const seenDomains = new Set<string>();
    const seenHosts = new Set<string>();

    if (existingLeads) {
      for (const lead of existingLeads) {
        if (lead.source_url) seenHosts.add(hostFromUrl(lead.source_url));
        const arr = Array.isArray(lead.emails) ? lead.emails : [];
        for (const entry of arr) {
          const email = typeof entry === "string" ? entry : (entry as { email?: string })?.email;
          if (!email) continue;
          const lower = email.toLowerCase();
          seenEmails.add(lower);
          const domain = lower.split("@")[1] ?? "";
          if (domain) seenDomains.add(domain);
        }
      }
    }

    const enhancedQuery = buildSearchQuery(query);
    console.log("[search-prospects] Serper query:", enhancedQuery);
    console.log("[search-prospects] seenEmails:", seenEmails.size, "seenDomains:", seenDomains.size, "seenHosts:", seenHosts.size);
    console.log("[search-prospects] Elapsed before Serper call:", Date.now() - startTime, "ms");

    let serperPayload: SerperResponse;
    try {
      serperPayload = await fetchSerper(apiKey, enhancedQuery);
      console.log("[search-prospects] Serper success. Organic results:", serperPayload.organic?.length ?? 0);
    } catch (firstErr) {
      console.log("[search-prospects] Serper 1st attempt failed:", firstErr instanceof Error ? firstErr.message : firstErr);
      await new Promise((r) => setTimeout(r, 1500));
      if (isTimedOut()) {
        console.log("[search-prospects] Timed out before retry");
        throw firstErr;
      }
      console.log("[search-prospects] Retrying Serper...");
      serperPayload = await fetchSerper(apiKey, enhancedQuery);
      console.log("[search-prospects] Serper retry success. Organic results:", serperPayload.organic?.length ?? 0);
    }

    const candidates = (serperPayload.organic ?? [])
      .map((r) => r.link?.trim() || "")
      .filter(Boolean)
      .map((url) => normalizeUrl(url))
      .filter((url): url is URL => Boolean(url))
      .filter((url) => {
        const host = url.hostname.replace(/^www\./, "").toLowerCase();
        return !isBlockedHost(host) && !seenHosts.has(host);
      })
      .map((url) => url.toString());

    console.log("[search-prospects] Candidates after filtering:", candidates.length);
    if (candidates.length > 0) console.log("[search-prospects] First 3 candidates:", candidates.slice(0, 3));

    const urlsToProcess = candidates.slice(0, targetCount * 3);
    console.log("[search-prospects] URLs to process:", urlsToProcess.length);
    console.log("[search-prospects] Elapsed before crawl:", Date.now() - startTime, "ms");

    if (urlsToProcess.length === 0) {
      await refundCredits(user.id, reservedCredits);
      return NextResponse.json({ error: "No companies found. Try broader keywords." }, { status: 404 });
    }

    const failures: { url: string; reason: string }[] = [];
    const uniqueRows: { email: string; source_url: string; company_name: string; host: string }[] = [];
    let processedCount = 0;

    // Process in batches of CONCURRENCY until we hit targetCount or timeout
    let cursor = 0;
    while (cursor < urlsToProcess.length && uniqueRows.length < targetCount && !isTimedOut()) {
      const batch = urlsToProcess.slice(cursor, cursor + CONCURRENCY);
      cursor += batch.length;
      processedCount += batch.length;

      const results = await runWithConcurrency(batch, async (url) => {
        if (isTimedOut()) throw new Error("Timeout");
        const extraction = await extractWebsiteEmails(url, {
          timeoutMs: URL_TIMEOUT_MS,
          paths: LIGHTWEIGHT_PATHS,
        });
        if (!extraction.ok) throw new Error(extraction.message || "No emails found");
        if (extraction.emails.length === 0) throw new Error("No emails found");

        const selected = extraction.emails.find((email) => {
          const lower = email.toLowerCase();
          if (seenEmails.has(lower)) return false;
          const domain = lower.split("@")[1] ?? "";
          return Boolean(domain) && !seenDomains.has(domain);
        });
        if (!selected) throw new Error("Only duplicate emails/domains found");

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
        const row = result.value;
        const emailLower = row.email.toLowerCase();
        const emailDomain = emailLower.split("@")[1] ?? "";
        if (!emailDomain || seenEmails.has(emailLower) || seenDomains.has(emailDomain)) {
          failures.push({ url, reason: "Only duplicate emails/domains found" });
          return;
        }
        seenEmails.add(emailLower);
        seenDomains.add(emailDomain);
        seenHosts.add(row.host.replace(/^www\./, "").toLowerCase());
        uniqueRows.push(row);
      });
    }

    // Persist results
    const leads: Array<{ email: string; source_url: string; company_name: string; lead_id: string; client_id: string }> = [];

    for (const row of uniqueRows) {
      if (isTimedOut()) break;
      const { data: lead } = await service
        .from("extracted_leads")
        .insert({
          user_id: user.id,
          source_url: row.source_url,
          company_name: row.company_name,
          emails: [{ email: row.email, source: row.source_url, confidence: row.email.startsWith("info@") || row.email.startsWith("hello@") ? "medium" : "high" }],
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
    }

    const creditsUsed = leads.length;
    const creditsRefunded = Math.max(reservedCredits - creditsUsed, 0);
    if (creditsRefunded > 0) await refundCredits(user.id, creditsRefunded);
    const finalCredits = reserve.remaining + creditsRefunded;

    return NextResponse.json({
      success: true,
      leads,
      requestedCount: targetCount,
      searchedCount: urlsToProcess.length,
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
    console.error("[search-prospects] CAUGHT ERROR:", error instanceof Error ? error.message : error);
    console.error("[search-prospects] Stack:", error instanceof Error ? error.stack : "N/A");
    const message = error instanceof Error ? error.message : "Search service unavailable. Please try again later.";
    const status = message.includes("Daily search limit reached") ? 429 : 500;
    return NextResponse.json({ error: message || "Search service unavailable. Please try again later." }, { status });
  }
}
