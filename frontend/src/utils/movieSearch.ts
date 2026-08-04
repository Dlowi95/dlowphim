import { getProxyUrl, MovieSourcePreference } from "@/utils/api";

interface MovieSearchOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface MovieSearchResult {
  data: any | null;
  source: "phimapi" | "ophim" | null;
  items: any[];
}

const SEARCH_SOURCES: MovieSourcePreference[] = ["phimapi", "ophim"];

const fetchWithTimeout = async (
  url: string,
  signal?: AbortSignal,
  timeoutMs = 3500,
) => {
  const controller = new AbortController();
  const abortRequest = () => controller.abort();
  signal?.addEventListener("abort", abortRequest, { once: true });
  const timeoutId = window.setTimeout(abortRequest, timeoutMs);

  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    window.clearTimeout(timeoutId);
    signal?.removeEventListener("abort", abortRequest);
  }
};

/**
 * PhimAPI luôn là nguồn tìm kiếm chính. Chỉ thử OPhim khi PhimAPI lỗi,
 * tạm ngưng tìm kiếm hoặc không có kết quả phù hợp.
 */
export async function searchMovies(
  keyword: string,
  page = 1,
  options: MovieSearchOptions = {},
): Promise<MovieSearchResult> {
  const normalizedKeyword = keyword.trim();
  if (!normalizedKeyword) return { data: null, source: null, items: [] };

  const path = `/v1/api/tim-kiem?keyword=${encodeURIComponent(normalizedKeyword)}&page=${page}`;
  let emptyResult: MovieSearchResult | null = null;

  for (const source of SEARCH_SOURCES) {
    if (options.signal?.aborted) throw new DOMException("Aborted", "AbortError");

    try {
      const response = await fetchWithTimeout(
        getProxyUrl(path, source),
        options.signal,
        options.timeoutMs,
      );
      if (!response.ok) continue;

      const data = await response.json();
      if (data.status !== "success" && data.status !== true) continue;

      const items = data.data?.items || data.items || [];
      const result = {
        data,
        source: source as "phimapi" | "ophim",
        items,
      };
      if (items.length > 0) return result;
      emptyResult ??= result;
    } catch (error) {
      if (options.signal?.aborted) throw error;
    }
  }

  return emptyResult || { data: null, source: null, items: [] };
}
