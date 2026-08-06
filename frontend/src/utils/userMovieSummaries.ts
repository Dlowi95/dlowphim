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
      const response = await fetch(`${apiUrl}/movies/resolved-summaries`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ slugs: missing.slice(offset, offset + 50) }),
        signal,
      });
      if (!response.ok) throw new Error(`Không thể tải thông tin phim (${response.status})`);
      const summaries = await response.json();
      if (!Array.isArray(summaries)) continue;
      summaries.forEach((summary: UserMovieSummary) => {
        if (summary?.slug) {
          summaryCache.set(summary.slug, {
            value: summary,
            expiresAt: Date.now() + CACHE_TTL_MS,
          });
          while (summaryCache.size > MAX_CACHE_ENTRIES) {
            const oldestKey = summaryCache.keys().next().value;
            if (!oldestKey) break;
            summaryCache.delete(oldestKey);
          }
        }
      });
    }
  }

  return uniqueSlugs
    .map((slug) => summaryCache.get(slug)?.value)
    .filter((summary): summary is UserMovieSummary => Boolean(summary));
}

export function removeUserMovieSummaryFromCache(slug: string) {
  summaryCache.delete(slug);
}
