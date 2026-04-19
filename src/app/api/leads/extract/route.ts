import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { analyzeWebsiteContent } from "@/lib/openai";
import { addCredits, deductCredits } from "@/lib/credits";

export const maxDuration = 120;

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const MAILTO_REGEX = /mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
const EXCLUDED_EMAIL_HINTS = [
  "noreply",
  "no-reply",
  "donotreply",
  "example",
  "test@",
  "privacy@",
  "legal@",
  "abuse@",
  "postmaster@",
  "webmaster@",
  "wordpress",
  ".png",
  ".jpg",
  "sentry",
  "cloudflare",
];
const PATHS_TO_CRAWL = ["", "/contact", "/about", "/team", "/about-us", "/contact-us"];
const BLOCKED_HOSTS = ["linkedin.com", "instagram.com", "facebook.com", "x.com", "twitter.com"];

function normalizeUrl(input: string): URL | null {
  try {
    const withProtocol = /^https?:\/\//i.test(input) ? input : `https://${input}`;
    return new URL(withProtocol);
  } catch {
    return null;
  }
}

async function fetchPageContent(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ProposalPilot/1.0)",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return "";
    return await res.text();
  } catch {
    return "";
  }
}

function extractEmailsFromHTML(html: string): string[] {
  const mailtoEmails = Array.from(html.matchAll(MAILTO_REGEX))
    .map((m) => m[1]?.trim())
    .filter(Boolean) as string[];
  const regularEmails = html.match(EMAIL_REGEX) ?? [];
  const allEmails = Array.from(new Set([...mailtoEmails, ...regularEmails]));

  return allEmails.filter((email) => {
    const lower = email.toLowerCase();
    return !EXCLUDED_EMAIL_HINTS.some((excluded) => lower.includes(excluded));
  });
}

function getSourceHint(email: string, pages: { path: string; html: string }[], baseUrl: string): string {
  const source = pages.find((p) => p.html.includes(email));
  if (!source) return baseUrl;
  return source.path ? `${baseUrl}${source.path}` : baseUrl;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { url } = await request.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const parsed = normalizeUrl(url.trim());
    if (!parsed) {
      return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
    }

    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    if (BLOCKED_HOSTS.some((blocked) => host.includes(blocked))) {
      return NextResponse.json(
        {
          error: "BLOCKED_DOMAIN",
          message: "This domain blocks crawling (e.g. social networks / protected sites). Try the company website.",
        },
        { status: 400 }
      );
    }

    const baseUrl = `${parsed.protocol}//${parsed.host}`;
    const crawled = await Promise.all(
      PATHS_TO_CRAWL.map(async (path) => ({
        path,
        html: await fetchPageContent(`${baseUrl}${path}`),
      }))
    );
    const validPages = crawled.filter((p) => p.html);
    const combinedHtml = validPages.map((p) => p.html).join("\n");

    if (!combinedHtml) {
      return NextResponse.json(
        {
          error: "FETCH_FAILED",
          message: "Could not access this website. It may block crawlers (Cloudflare/CORS) or the URL is invalid.",
        },
        { status: 400 }
      );
    }

    const extractedEmails = extractEmailsFromHTML(combinedHtml);
    if (extractedEmails.length === 0) {
      return NextResponse.json(
        {
          error: "NO_EMAILS_FOUND",
          message: "No emails found. Try a different URL or check the contact page.",
        },
        { status: 404 }
      );
    }

    const htmlTextSnippet = combinedHtml.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    const analysis = await analyzeWebsiteContent(htmlTextSnippet);

    const creditResult = await deductCredits(user.id, 1);
    if (!creditResult.success) {
      return NextResponse.json(
        { error: "Insufficient credits. Upgrade your plan to continue.", credits: creditResult.remaining },
        { status: 402 }
      );
    }

    const serviceClient = await createServiceClient();
    const { data: lead, error: insertError } = await serviceClient
      .from("extracted_leads")
      .insert({
        user_id: user.id,
        source_url: baseUrl,
        company_name: analysis.companyName || host,
        industry: analysis.industry || null,
        company_info: analysis.description || null,
        emails: extractedEmails.map((email) => ({
          email,
          source: getSourceHint(email, validPages, baseUrl),
          confidence: email.startsWith("info@") || email.startsWith("hello@") ? "medium" : "high",
        })),
      })
      .select("*")
      .single();

    if (insertError || !lead) {
      await addCredits(user.id, 1);
      return NextResponse.json({ error: "Failed to save extracted lead" }, { status: 500 });
    }

    return NextResponse.json({ lead, remainingCredits: creditResult.remaining });
  } catch (error) {
    console.error("Lead extraction error:", error);
    return NextResponse.json({ error: "EXTRACTION_FAILED" }, { status: 500 });
  }
}
