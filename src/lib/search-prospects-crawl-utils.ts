/**
 * Shared helpers for /api/search-prospects crawling (domains, timeouts, concurrency).
 */

function parseUrl(input: string): URL | null {
  try {
    const withProtocol = /^https?:\/\//i.test(input) ? input : `https://${input}`;
    return new URL(withProtocol);
  } catch {
    return null;
  }
}

/** Domains excluded from Serper organic results and from generated path URLs. */
const BLOCKED_ROOTS = [
  "openai.com",
  "canva.com",
  "atlassian.com",
  "facebook.com",
  "linkedin.com",
  "youtube.com",
  "instagram.com",
  "twitter.com",
  "x.com",
  "github.com",
  "wikipedia.org",
  "medium.com",
  "reddit.com",
  "g2.com",
  "capterra.com",
  "trustpilot.com",
  "crunchbase.com",
  // Previously blocked in-route aggregators / noise
  "techcrunch.com",
  "forbes.com",
  "quora.com",
  "producthunt.com",
  "glassdoor.com",
  "ycombinator.com",
  "tiktok.com",
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
  "stackoverflow.com",
  "indeed.com",
  "ziprecruiter.com",
] as const;

/** Normalize hostname: lowercase, strip leading `www.`. */
export function normalizeDomain(url: string): string | null {
  const nu = parseUrl(url.trim());
  if (!nu) return null;
  return nu.hostname.replace(/^www\./i, "").toLowerCase() || null;
}

/** True if host (or parent zone) is in the blocklist (e.g. `help.openai.com` → openai.com). */
export function isBlockedDomain(hostOrUrl: string): boolean {
  const raw = hostOrUrl.trim();
  const host = raw.includes("/") ? normalizeDomain(raw) : raw.replace(/^www\./i, "").toLowerCase();
  if (!host) return true;
  for (const root of BLOCKED_ROOTS) {
    if (host === root || host.endsWith(`.${root}`)) return true;
  }
  return false;
}

export function isBlockedHost(hostname: string): boolean {
  return isBlockedDomain(hostname);
}

/**
 * `fetch` with AbortController + wall-clock race (per-path crawl).
 */
export async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const controller = new AbortController();
  let t: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    t = setTimeout(() => {
      controller.abort();
      reject(new Error("fetch_timeout"));
    }, ms);
  });
  try {
    const res = await Promise.race([
      fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; ProposalPilot/1.0)" },
        signal: controller.signal,
      }),
      deadline,
    ]);
    if (t !== undefined) clearTimeout(t);
    return res;
  } catch (e) {
    if (t !== undefined) clearTimeout(t);
    throw e;
  }
}

export function isGlobalTimeoutReached(processStartMs: number, globalMaxMs: number): boolean {
  return Date.now() - processStartMs >= globalMaxMs;
}

/**
 * Pool of up to `limit` concurrent workers; each item runs `worker` once.
 * Stops scheduling new work when `shouldStop()` is true (in-flight tasks still finish).
 */
export async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
  shouldStop?: () => boolean,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let nextIndex = 0;

  async function runWorker() {
    for (;;) {
      if (shouldStop?.()) return;
      const i = nextIndex++;
      if (i >= items.length) return;
      try {
        const value = await worker(items[i]!, i);
        results[i] = { status: "fulfilled", value };
      } catch (reason) {
        results[i] = { status: "rejected", reason };
      }
    }
  }

  const n = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: n }, () => runWorker()));
  return results;
}
