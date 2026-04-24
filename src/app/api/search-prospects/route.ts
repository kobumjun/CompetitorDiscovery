import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { reserveCredits, refundCredits } from "@/lib/credits";
import { deriveCompanyNameFromHost, extractWebsiteEmails, normalizeUrl } from "@/lib/leads/extraction";

const SERPER_ENDPOINT = "https://google.serper.dev/search";
const MAX_RESULTS = 80;
const URL_TIMEOUT_MS = 15000;
const CONCURRENCY = 5;
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
];

type SerperOrganicResult = {
  link?: string;
};

type SerperResponse = {
  organic?: SerperOrganicResult[];
};

function isBlockedHost(hostname: string) {
  return BLOCKED_HOSTS.some((blocked) => hostname === blocked || hostname.endsWith(`.${blocked}`));
}

function buildSearchQuery(input: string) {
  const trimmed = input.trim();
  if (trimmed.split(/\s+/).length <= 2) {
    return `${trimmed} company official site`;
  }
  if (!/official|contact/i.test(trimmed)) {
    return `${trimmed} official site contact`;
  }
  return trimmed;
}

async function runWithConcurrency<TInput, TOutput>(
  items: TInput[],
  worker: (item: TInput, index: number) => Promise<TOutput>
): Promise<PromiseSettledResult<TOutput>[]> {
  const results: PromiseSettledResult<TOutput>[] = new Array(items.length);
  let cursor = 0;

  async function runner() {
    while (cursor < items.length) {
      const index = cursor++;
      const item = items[index];
      try {
        const value = await worker(item, index);
        results[index] = { status: "fulfilled", value };
      } catch (error) {
        results[index] = { status: "rejected", reason: error };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, () => runner()));
  return results;
}

export async function POST(request: NextRequest) {
  let reservedCredits = 0;
  let userId = "";
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    userId = user.id;

    const apiKey = process.env.SERPER_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Search service unavailable. Please try again later." },
        { status: 503 }
      );
    }

    const { query, requestedCount } = (await request.json()) as { query?: string; requestedCount?: number };
    if (!query || !query.trim()) {
      return NextResponse.json({ error: "Query is required." }, { status: 400 });
    }
    const targetCount = [1, 3, 5, 10].includes(requestedCount ?? 0) ? Number(requestedCount) : 3;
    const reserve = await reserveCredits(user.id, targetCount);
    if (!reserve.success) {
      return NextResponse.json(
        { error: `Not enough credits. You have ${reserve.remaining} credits.` },
        { status: 402 }
      );
    }
    reservedCredits = targetCount;

    const enhancedQuery = buildSearchQuery(query);
    const targetUrls = Math.min(targetCount + 15, MAX_RESULTS);
    let candidates: string[] = [];

    for (const num of [30, 60, 80]) {
      const response = await fetch(SERPER_ENDPOINT, {
        method: "POST",
        headers: {
          "X-API-KEY": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          q: enhancedQuery,
          num,
        }),
      });

      if (response.status === 401 || response.status === 403) {
        throw new Error("Search service unavailable. Please try again later.");
      }

      if (response.status === 429) {
        throw new Error("Daily search limit reached. Try again tomorrow or contact support.");
      }

      if (!response.ok) {
        throw new Error("Search service unavailable. Please try again later.");
      }

      const payload = (await response.json()) as SerperResponse;
      const filtered = (payload.organic ?? [])
        .map((result) => result.link?.trim() || "")
        .filter(Boolean)
        .map((url) => normalizeUrl(url))
        .filter((url): url is URL => Boolean(url))
        .filter((url) => !isBlockedHost(url.hostname.toLowerCase()))
        .map((url) => url.toString());

      candidates = Array.from(new Set([...candidates, ...filtered]));
      if (candidates.length >= targetUrls) break;
    }

    if (candidates.length === 0) {
      if (reservedCredits > 0) {
        await refundCredits(user.id, reservedCredits);
      }
      return NextResponse.json(
        { error: "No companies found. Try broader keywords." },
        { status: 404 }
      );
    }

    const failures: { url: string; reason: string }[] = [];
    const uniqueRows: { email: string; source_url: string; company_name: string; host: string }[] = [];
    const seenEmails = new Set<string>();
    const seenDomains = new Set<string>();
    let cursor = 0;
    let processedCount = 0;

    while (cursor < candidates.length && uniqueRows.length < targetCount) {
      const remaining = targetCount - uniqueRows.length;
      const batchSize = Math.max(CONCURRENCY, remaining * 2);
      const batch = candidates.slice(cursor, cursor + batchSize);
      cursor += batch.length;
      processedCount += batch.length;

      const extractionResults = await runWithConcurrency(batch, async (url) => {
        const extraction = await extractWebsiteEmails(url, { timeoutMs: URL_TIMEOUT_MS });
        if (!extraction.ok) {
          throw new Error(extraction.message || "No emails found");
        }
        if (extraction.emails.length === 0) {
          throw new Error("No emails found");
        }

        const selectedEmail = extraction.emails.find((email) => {
          const lowerEmail = email.toLowerCase();
          if (seenEmails.has(lowerEmail)) return false;
          const emailDomain = lowerEmail.split("@")[1] ?? "";
          return Boolean(emailDomain) && !seenDomains.has(emailDomain);
        });

        if (!selectedEmail) {
          throw new Error("Only duplicate emails/domains found");
        }

        return {
          email: selectedEmail,
          source_url: extraction.sourceForEmail.get(selectedEmail.toLowerCase()) ?? extraction.baseUrl,
          company_name: deriveCompanyNameFromHost(extraction.host),
          host: extraction.host,
        };
      });

      extractionResults.forEach((result, index) => {
        const url = batch[index];
        if (result.status !== "fulfilled") {
          const reason = result.reason instanceof Error ? result.reason.message : "Unknown error";
          failures.push({ url, reason });
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
        uniqueRows.push(row);
      });
    }

    const service = await createServiceClient();
    const leads: Array<{
      email: string;
      source_url: string;
      company_name: string;
      lead_id: string;
      client_id: string;
    }> = [];

    for (const row of uniqueRows) {
      const { data: lead } = await service
        .from("extracted_leads")
        .insert({
          user_id: user.id,
          source_url: row.source_url,
          company_name: row.company_name,
          emails: [
            {
              email: row.email,
              source: row.source_url,
              confidence: row.email.startsWith("info@") || row.email.startsWith("hello@") ? "medium" : "high",
            },
          ],
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

      leads.push({
        email: row.email,
        source_url: row.source_url,
        company_name: row.company_name,
        lead_id: lead.id,
        client_id: client.id,
      });
    }

    const creditsUsed = leads.length;
    const creditsRefunded = Math.max(reservedCredits - creditsUsed, 0);
    if (creditsRefunded > 0) {
      await refundCredits(user.id, creditsRefunded);
    }
    const finalCredits = reserve.remaining + creditsRefunded;

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
    if (reservedCredits > 0 && userId) {
      await refundCredits(userId, reservedCredits).catch(() => undefined);
    }
    console.error("Search prospects error:", error);
    const message = error instanceof Error ? error.message : "Search service unavailable. Please try again later.";
    const status = message.includes("Daily search limit reached") ? 429 : 500;
    return NextResponse.json(
      { error: message || "Search service unavailable. Please try again later." },
      { status }
    );
  }
}
