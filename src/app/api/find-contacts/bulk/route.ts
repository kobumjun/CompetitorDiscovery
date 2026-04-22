import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getUserCredits } from "@/lib/credits";
import { deriveCompanyNameFromHost, extractWebsiteEmails, normalizeUrl } from "@/lib/leads/extraction";

export const maxDuration = 120;

const MAX_URLS_PER_BATCH = 20;
const MAX_REQUESTS_PER_MINUTE = 3;
const URL_TIMEOUT_MS = 15000;
const CONCURRENCY = 5;

type RateEntry = { timestamps: number[] };
const bulkRateLimit = new Map<string, RateEntry>();

type BulkLead = {
  email: string;
  source_url: string;
  company_name: string;
  lead_id: string;
  client_id: string;
};

function checkBulkRateLimit(userId: string): boolean {
  const now = Date.now();
  const oneMinuteAgo = now - 60_000;
  const entry = bulkRateLimit.get(userId) ?? { timestamps: [] };
  const recent = entry.timestamps.filter((ts) => ts > oneMinuteAgo);
  if (recent.length >= MAX_REQUESTS_PER_MINUTE) return false;
  recent.push(now);
  bulkRateLimit.set(userId, { timestamps: recent });
  return true;
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

type UrlExtractionResult = {
  url: string;
  baseUrl: string;
  host: string;
  emails: string[];
  sourceForEmail: Map<string, string>;
};

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!checkBulkRateLimit(user.id)) {
      return NextResponse.json(
        { error: "RATE_LIMITED", message: "Bulk discovery is limited to 3 requests per minute." },
        { status: 429 }
      );
    }

    const { urls } = await request.json();
    if (!Array.isArray(urls)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const normalized = Array.from(
      new Set(
        urls
          .map((u: unknown) => (typeof u === "string" ? u.trim() : ""))
          .filter(Boolean)
          .map((u) => {
            const parsed = normalizeUrl(u);
            return parsed ? parsed.toString() : "";
          })
          .filter(Boolean)
      )
    );

    if (normalized.length === 0) {
      return NextResponse.json({ error: "No valid URLs provided" }, { status: 400 });
    }

    if (normalized.length > MAX_URLS_PER_BATCH) {
      return NextResponse.json({ error: "Max 20 URLs per batch. Please reduce the list." }, { status: 400 });
    }

    const initialCredits = await getUserCredits(user.id);
    if (initialCredits < 1) {
      return NextResponse.json(
        { error: "Insufficient credits. Upgrade your plan to continue.", creditsRemaining: initialCredits },
        { status: 402 }
      );
    }

    const extractionResults = await runWithConcurrency<string, UrlExtractionResult>(normalized, async (url) => {
      const extraction = await extractWebsiteEmails(url, { timeoutMs: URL_TIMEOUT_MS });
      if (!extraction.ok) {
        throw new Error(extraction.message);
      }
      return {
        url,
        baseUrl: extraction.baseUrl,
        host: extraction.host,
        emails: extraction.emails,
        sourceForEmail: extraction.sourceForEmail,
      };
    });

    const failures: { url: string; reason: string }[] = [];
    const successes: UrlExtractionResult[] = [];
    extractionResults.forEach((result, index) => {
      if (result.status === "fulfilled") {
        successes.push(result.value);
      } else {
        const message = result.reason instanceof Error ? result.reason.message : "Unknown error";
        failures.push({ url: normalized[index], reason: message });
      }
    });

    const dedupedByEmail = new Map<
      string,
      { email: string; source_url: string; company_name: string; host: string }
    >();

    for (const row of successes) {
      for (const email of row.emails) {
        const lower = email.toLowerCase();
        if (dedupedByEmail.has(lower)) continue;
        dedupedByEmail.set(lower, {
          email,
          source_url: row.sourceForEmail.get(lower) ?? row.baseUrl,
          company_name: deriveCompanyNameFromHost(row.host),
          host: row.host,
        });
      }
    }

    const allUnique = Array.from(dedupedByEmail.values());
    const emailsFound = allUnique.length;
    const creditsToUse = Math.min(initialCredits, emailsFound);
    const selected = allUnique.slice(0, creditsToUse);

    if (emailsFound === 0) {
      return NextResponse.json({
        success: true,
        totalUrls: normalized.length,
        successfulUrls: successes.length,
        failedUrls: failures.length,
        emailsFound: 0,
        creditsUsed: 0,
        creditsRemaining: initialCredits,
        leads: [],
        failed: failures,
        message: "No emails found on any of the provided URLs. No credits were used.",
      });
    }

    const service = await createServiceClient();
    const createdLeads: BulkLead[] = [];
    let creditsUsed = 0;

    for (const item of selected) {
      const { data: lead, error: leadError } = await service
        .from("extracted_leads")
        .insert({
          user_id: user.id,
          source_url: item.source_url,
          company_name: item.company_name,
          emails: [
            {
              email: item.email,
              source: item.source_url,
              confidence: item.email.startsWith("info@") || item.email.startsWith("hello@") ? "medium" : "high",
            },
          ],
        })
        .select("id")
        .single();

      if (leadError || !lead) continue;

      const { data: client, error: clientError } = await service
        .from("clients")
        .insert({
          user_id: user.id,
          email: item.email,
          company_name: item.company_name,
          website: `https://${item.host}`,
          source_url: item.source_url,
          status: "new",
        })
        .select("id")
        .single();

      if (clientError || !client) continue;

      createdLeads.push({
        email: item.email,
        source_url: item.source_url,
        company_name: item.company_name,
        lead_id: lead.id,
        client_id: client.id,
      });
      creditsUsed += 1;
    }

    if (creditsUsed > 0) {
      const updatedCredits = Math.max(initialCredits - creditsUsed, 0);
      await service.from("users").update({ credits: updatedCredits, updated_at: new Date().toISOString() }).eq("id", user.id);
    }

    const creditsRemaining = initialCredits - creditsUsed;
    const ranOutOfCredits = creditsUsed < emailsFound;
    const hadInsertFailures = creditsUsed < selected.length;

    return NextResponse.json({
      success: true,
      totalUrls: normalized.length,
      successfulUrls: successes.length,
      failedUrls: failures.length,
      emailsFound,
      creditsUsed,
      creditsRemaining,
      leads: createdLeads,
      failed: failures,
      partial: ranOutOfCredits || hadInsertFailures,
      message: ranOutOfCredits
        ? `You ran out of credits. Saved ${creditsUsed} emails. Upgrade to process more.`
        : hadInsertFailures
          ? `Saved ${creditsUsed} emails. Some results could not be persisted.`
          : undefined,
    });
  } catch (error) {
    console.error("Bulk discovery error:", error);
    return NextResponse.json({ error: "BULK_EXTRACTION_FAILED" }, { status: 500 });
  }
}
