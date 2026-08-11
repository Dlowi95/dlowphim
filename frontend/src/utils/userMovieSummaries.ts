import Cookies from "js-cookie";

export interface UserMovieSummary {
  slug: string;
  resolvedSlug?: string;
  name: string;
  origin_name: string;
  thumb_url: string;
  poster_url?: string;
  backdrop_url?: string;
  artwork_source?: "tmdb-cache" | "movie-api";
  quality: string;
  lang: string;
  year?: number;
}

const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_CACHE_ENTRIES = 250;
const summaryCache = new Map<string, { value: UserMovieSummary; expiresAt: number }>();
const summaryInflight = new Map<string, Promise<UserMovieSummary[]>>();

function waitForSummaryRequest(
  request: Promise<UserMovieSummary[]>,
  signal?: AbortSignal,
) {
  if (!signal) return request;
  if (signal.aborted) return Promise.reject(new DOMException("Request aborted", "AbortError"));
  return new Promise<UserMovieSummary[]>((resolve, reject) => {
    const handleAbort = () => reject(new DOMException("Request aborted", "AbortError"));
    signal.addEventListener("abort", handleAbort, { once: true });
    request.then(resolve, reject).finally(() => signal.removeEventListener("abort", handleAbort));
  });
}

function fetchSummaryBatch(apiUrl: string, slugs: string[], token?: string) {
  const key = `${token || "public"}:${[...slugs].sort().join(",")}`;
  const existing = summaryInflight.get(key);
  if (existing) return existing;

  const request = fetch(`${apiUrl}/movies/resolved-summaries`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ slugs }),
  })
    .then(async (response) => {
      if (!response.ok) throw new Error(`Không thể tải thông tin phim (${response.status})`);
      const summaries = await response.json();
      return Array.isArray(summaries) ? summaries as UserMovieSummary[] : [];
    })
    .then((summaries) => {
      summaries.forEach((summary) => {
        if (!summary?.slug) return;
        summaryCache.set(summary.slug, {
          value: summary,
          expiresAt: Date.now() + CACHE_TTL_MS,
        });
        while (summaryCache.size > MAX_CACHE_ENTRIES) {
          const oldestKey = summaryCache.keys().next().value;
          if (!oldestKey) break;
          summaryCache.delete(oldestKey);
        }
      });
      return summaries;
    })
    .finally(() => summaryInflight.delete(key));

  summaryInflight.set(key, request);
  return request;
}

export async function getUserMovieSummaries(
  slugs: string[],
  signal?: AbortSignal,
): Promise<UserMovieSummary[]> {
  const uniqueSlugs = Array.from(new Set(slugs.filter(Boolean)));
  const now = Date.now();
  summaryCache.forEach((entry, slug) => {
    if (entry.expiresAt <= now) summaryCache.delete(slug);
  });
  const missing = uniqueSlugs.filter((slug) => {
    const cached = summaryCache.get(slug);
    return !cached || cached.expiresAt <= now;
  });

  if (missing.length > 0) {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
    const token = Cookies.get("token");
    for (let offset = 0; offset < missing.length; offset += 50) {
      const batch = missing.slice(offset, offset + 50);
      await waitForSummaryRequest(fetchSummaryBatch(apiUrl, batch, token), signal);
    }
  }

  return uniqueSlugs
    .map((slug) => summaryCache.get(slug)?.value)
    .filter((summary): summary is UserMovieSummary => Boolean(summary));
}

export function removeUserMovieSummaryFromCache(slug: string) {
  summaryCache.delete(slug);
}
