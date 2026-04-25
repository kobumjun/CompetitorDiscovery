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

export async function POST(request: NextRequest) {
  let reservedCredits = 0;
  let userId = "";
  try {
    console.log("[search-prospects] === START ===");

    // ── Step 1: Auth ──
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log("[search-prospects] FAIL: No authenticated user");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    userId = user.id;
    console.log("[search-prospects] Step 1 OK — User:", user.id);

    // ── Step 2: API key ──
    const apiKey = process.env.SERPER_API_KEY;
    console.log("[search-prospects] Step 2 — SERPER_API_KEY exists:", Boolean(apiKey), "length:", apiKey?.length ?? 0);
    if (!apiKey) {
      return NextResponse.json({ error: "Search service unavailable. SERPER_API_KEY not configured." }, { status: 503 });
    }

    // ── Step 3: Parse request ──
    const { query, requestedCount } = (await request.json()) as { query?: string; requestedCount?: number };
    console.log("[search-prospects] Step 3 — query:", query, "requestedCount:", requestedCount);
    if (!query || !query.trim()) {
      return NextResponse.json({ error: "Query is required." }, { status: 400 });
    }

    // ── Step 4: Reserve credits ──
    const targetCount = Math.min(5, Math.max(1, Math.round(requestedCount ?? 3)));
    let reserve: { success: boolean; remaining: number };
    try {
      reserve = await reserveCredits(user.id, targetCount);
      console.log("[search-prospects] Step 4 OK — Credits reserved:", targetCount, "remaining:", reserve.remaining);
    } catch (creditErr) {
      console.error("[search-prospects] Step 4 FAIL — reserveCredits threw:", creditErr instanceof Error ? creditErr.message : creditErr);
      return NextResponse.json({ error: "Could not verify credits. Please try again." }, { status: 500 });
    }
    if (!reserve.success) {
      return NextResponse.json({ error: `Not enough credits. You have ${reserve.remaining} credits.` }, { status: 402 });
    }
    reservedCredits = targetCount;

    const startTime = Date.now();
    const isTimedOut = () => Date.now() - startTime > OVERALL_TIMEOUT_MS;

    // ── Step 5: Load existing leads (NON-FATAL) ──
    const seenEmails = new Set<string>();
    const seenDomains = new Set<string>();
    const seenHosts = new Set<string>();
    let service: Awaited<ReturnType<typeof createServiceClient>>;

    try {
      service = await createServiceClient();
      const { data: existingLeads, error: leadsErr } = await service
        .from("extracted_leads")
        .select("emails, source_url")
        .eq("user_id", user.id);

      if (leadsErr) {
        console.warn("[search-prospects] Step 5 WARN — Supabase query error:", leadsErr.message);
      } else if (existingLeads) {
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
      console.log("[search-prospects] Step 5 OK — seenEmails:", seenEmails.size, "seenHosts:", seenHosts.size);
    } catch (dbErr) {
      console.warn("[search-prospects] Step 5 WARN — DB query failed, continuing without dedup:", dbErr instanceof Error ? dbErr.message : dbErr);
      service = await createServiceClient();
    }

    console.log("[search-prospects] Elapsed after Step 5:", Date.now() - startTime, "ms");

    // ── Step 6: Call Serper API ──
    const enhancedQuery = buildSearchQuery(query);
    console.log("[search-prospects] Step 6 — Calling Serper with:", enhancedQuery);

    let serperPayload: SerperResponse;
    try {
      const serperRes = await fetch(SERPER_ENDPOINT, {
        method: "POST",
        headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ q: enhancedQuery, num: SERPER_NUM }),
      });

      console.log("[search-prospects] Step 6 — Serper HTTP status:", serperRes.status, serperRes.statusText);

      if (!serperRes.ok) {
        const errorBody = await serperRes.text().catch(() => "(could not read body)");
        console.error("[search-prospects] Step 6 FAIL — Serper error body:", errorBody.slice(0, 500));
        console.error("[search-prospects] Step 6 FAIL — Serper status:", serperRes.status);

        if (serperRes.status === 429) {
          throw new Error("Daily search limit reached. Try again tomorrow or contact support.");
        }
        throw new Error(`Serper API returned ${serperRes.status}: ${errorBody.slice(0, 100)}`);
      }

      serperPayload = (await serperRes.json()) as SerperResponse;
      console.log("[search-prospects] Step 6 OK — Organic results:", serperPayload.organic?.length ?? 0);
    } catch (serperErr) {
      console.error("[search-prospects] Step 6 FAIL — Serper call error:", serperErr instanceof Error ? serperErr.message : serperErr);
      throw serperErr;
    }

    // ── Step 7: Filter candidates ──
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

    const urlsToProcess = candidates.slice(0, targetCount * 3);
    console.log("[search-prospects] Step 7 — Candidates:", candidates.length, "→ processing:", urlsToProcess.length);

    if (urlsToProcess.length === 0) {
      await refundCredits(user.id, reservedCredits);
      return NextResponse.json({ error: "No companies found. Try broader keywords." }, { status: 404 });
    }

    console.log("[search-prospects] Elapsed before crawl:", Date.now() - startTime, "ms");

    // ── Step 8: Crawl & extract ──
    const failures: { url: string; reason: string }[] = [];
    const uniqueRows: { email: string; source_url: string; company_name: string; host: string }[] = [];
    let processedCount = 0;
    let cursor = 0;

    while (cursor < urlsToProcess.length && uniqueRows.length < targetCount && !isTimedOut()) {
      const batch = urlsToProcess.slice(cursor, cursor + CONCURRENCY);
      cursor += batch.length;
      processedCount += batch.length;

      const results = await runWithConcurrency(batch, async (url) => {
        if (isTimedOut()) throw new Error("Timeout");
        const extraction = await extractWebsiteEmails(url, { timeoutMs: URL_TIMEOUT_MS, paths: LIGHTWEIGHT_PATHS });
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

    console.log("[search-prospects] Step 8 OK — Found:", uniqueRows.length, "Failed:", failures.length, "Elapsed:", Date.now() - startTime, "ms");

    // ── Step 9: Persist results ──
    const leads: Array<{ email: string; source_url: string; company_name: string; lead_id: string; client_id: string }> = [];

    for (const row of uniqueRows) {
      if (isTimedOut()) {
        console.log("[search-prospects] Step 9 — Timed out during persist, saving partial");
        break;
      }
      try {
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
      } catch (insertErr) {
        console.warn("[search-prospects] Step 9 — Insert failed for", row.email, ":", insertErr instanceof Error ? insertErr.message : insertErr);
      }
    }

    console.log("[search-prospects] Step 9 OK — Persisted:", leads.length, "of", uniqueRows.length);

    // ── Step 10: Refund unused credits ──
    const creditsUsed = leads.length;
    const creditsRefunded = Math.max(reservedCredits - creditsUsed, 0);
    if (creditsRefunded > 0) await refundCredits(user.id, creditsRefunded);
    const finalCredits = reserve.remaining + creditsRefunded;

    console.log("[search-prospects] === DONE === Used:", creditsUsed, "Refunded:", creditsRefunded, "Total elapsed:", Date.now() - startTime, "ms");

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
    console.error("[search-prospects] === FATAL ERROR ===");
    console.error("[search-prospects] Message:", error instanceof Error ? error.message : String(error));
    console.error("[search-prospects] Stack:", error instanceof Error ? error.stack : "N/A");
    const message = error instanceof Error ? error.message : "An unexpected error occurred.";
    const status = message.includes("Daily search limit") ? 429 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
