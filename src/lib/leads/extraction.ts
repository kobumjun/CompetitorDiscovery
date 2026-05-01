import { isBlockedDomain, normalizeDomain } from "@/lib/search-prospects-crawl-utils";

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const MAILTO_REGEX = /mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
const EXCLUDED_EMAIL_HINTS = [
  "noreply",
  "no-reply",
  "donotreply",
  "do-not-reply",
  "unsubscribe",
  "bounce",
  "mailer-daemon",
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
  ".gif",
  ".svg",
  ".webp",
  ".woff",
  ".css",
  ".js@",
  "sentry",
  "cloudflare",
  "wixpress",
  "squarespace",
  "mailchimp",
  "sendgrid",
  "mailgun",
];
const PATHS_TO_CRAWL = ["", "/contact", "/about", "/team", "/about-us", "/contact-us"];

export type CrawledPage = { path: string; html: string };

export function normalizeUrl(input: string): URL | null {
  try {
    const withProtocol = /^https?:\/\//i.test(input) ? input : `https://${input}`;
    return new URL(withProtocol);
  } catch {
    return null;
  }
}

/**
 * Single HTTP GET for one path. Network entrypoint for prospect crawling.
 * Uses `fetch` + `Promise.race` hard deadline so hung TCP/body cannot exceed `timeoutMs`.
 */
async function fetchPageContent(url: string, timeoutMs: number): Promise<string> {
  const urlStart = Date.now();
  console.log(`[크롤링 시작] ${url}`);

  const controller = new AbortController();
  let hardTimer: ReturnType<typeof setTimeout> | undefined;

  const fetchWork = async (): Promise<string> => {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ProposalPilot/1.0)",
      },
      signal: controller.signal,
    });
    if (!res.ok) return "";
    return await res.text();
  };

  const hardDeadline = new Promise<never>((_, reject) => {
    hardTimer = setTimeout(() => {
      controller.abort();
      reject(new Error("hard_timeout"));
    }, timeoutMs);
  });

  try {
    const html = await Promise.race([fetchWork(), hardDeadline]);
    if (hardTimer !== undefined) clearTimeout(hardTimer);
    console.log(`[크롤링 완료] ${url} - ${Date.now() - urlStart}ms`);
    return html;
  } catch (err) {
    if (hardTimer !== undefined) clearTimeout(hardTimer);
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`[크롤링 실패] ${url} - ${msg} - ${Date.now() - urlStart}ms`);
    return "";
  }
}

export function extractEmailsFromHTML(html: string): string[] {
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

const PREFERRED_PREFIXES = ["info@", "hello@", "contact@", "support@", "sales@", "team@", "office@", "admin@", "help@"];

function emailPriorityScore(email: string): number {
  const lower = email.toLowerCase();
  const prefixIdx = PREFERRED_PREFIXES.findIndex((p) => lower.startsWith(p));
  if (prefixIdx !== -1) return prefixIdx;
  if (/@/.test(lower) && !/^\d/.test(lower)) return 100;
  return 200;
}

function prioritizeEmails(emails: string[]): string[] {
  return [...emails].sort((a, b) => emailPriorityScore(a) - emailPriorityScore(b));
}

export function getSourceHint(email: string, pages: CrawledPage[], baseUrl: string): string {
  const source = pages.find((p) => p.html.includes(email));
  if (!source) return baseUrl;
  return source.path ? `${baseUrl}${source.path}` : baseUrl;
}

export function deriveCompanyNameFromHost(hostname: string): string {
  const host = hostname.replace(/^www\./i, "").split(".")[0] || hostname;
  if (!host) return "Unknown";
  return host.charAt(0).toUpperCase() + host.slice(1);
}

export async function extractWebsiteEmails(
  inputUrl: string,
  options?: { timeoutMs?: number; paths?: string[] }
): Promise<
  | {
      ok: true;
      baseUrl: string;
      host: string;
      validPages: CrawledPage[];
      combinedHtml: string;
      emails: string[];
      sourceForEmail: Map<string, string>;
    }
  | { ok: false; code: "INVALID_URL" | "BLOCKED_DOMAIN" | "FETCH_FAILED" | "NO_EMAILS_FOUND"; message: string }
> {
  const parsed = normalizeUrl(inputUrl.trim());
  if (!parsed) {
    return { ok: false, code: "INVALID_URL", message: "Invalid URL format" };
  }

  const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
  if (isBlockedDomain(host)) {
    return {
      ok: false,
      code: "BLOCKED_DOMAIN",
      message: "This domain blocks crawling (e.g. social networks / protected sites). Try the company website.",
    };
  }

  const baseUrl = `${parsed.protocol}//${parsed.host}`;
  const timeoutMs = options?.timeoutMs ?? 7000;
  const rawPaths = options?.paths ?? PATHS_TO_CRAWL;
  const uniquePaths = Array.from(new Set(rawPaths));

  const pathTasks = uniquePaths
    .map((path) => {
      const fullUrl = `${baseUrl}${path}`;
      const dom = normalizeDomain(fullUrl);
      if (dom && isBlockedDomain(dom)) {
        return null;
      }
      return { path, fullUrl };
    })
    .filter((x): x is { path: string; fullUrl: string } => x !== null);

  const settled = await Promise.allSettled(
    pathTasks.map(async ({ path, fullUrl }) => ({
      path,
      html: await fetchPageContent(fullUrl, timeoutMs),
    })),
  );

  const crawled: CrawledPage[] = settled.map((s, idx) => {
    const pt = pathTasks[idx]!;
    if (s.status === "fulfilled") return s.value;
    return { path: pt.path, html: "" };
  });
  const validPages = crawled.filter((p) => p.html);
  const combinedHtml = validPages.map((p) => p.html).join("\n");

  if (!combinedHtml) {
    return {
      ok: false,
      code: "FETCH_FAILED",
      message: "Could not access this website. It may block crawlers (Cloudflare/CORS) or the URL is invalid.",
    };
  }

  const emails = prioritizeEmails(extractEmailsFromHTML(combinedHtml));
  if (emails.length === 0) {
    return {
      ok: false,
      code: "NO_EMAILS_FOUND",
      message: "No emails found. Try a different URL or check the contact page.",
    };
  }

  const sourceForEmail = new Map<string, string>();
  for (const email of emails) {
    sourceForEmail.set(email.toLowerCase(), getSourceHint(email, validPages, baseUrl));
  }

  return { ok: true, baseUrl, host, validPages, combinedHtml, emails, sourceForEmail };
}
