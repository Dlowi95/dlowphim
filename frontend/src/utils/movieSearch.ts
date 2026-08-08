import { fetchMovieDiscovery } from "@/utils/movieDiscovery";

interface MovieSearchOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface MovieSearchResult {
  data: any | null;
  source: "phimapi" | "ophim" | null;
  items: any[];
}

/**
 * Tìm kiếm đi qua backend để dùng chung chuẩn dữ liệu, circuit breaker,
 * nguồn dự phòng và bản dữ liệu thành công gần nhất.
 */
export async function searchMovies(
  keyword: string,
  page = 1,
  options: MovieSearchOptions = {},
): Promise<MovieSearchResult> {
  const normalizedKeyword = keyword.trim();
  if (!normalizedKeyword) return { data: null, source: null, items: [] };

  const data = await fetchMovieDiscovery(
    { kind: "search", keyword: normalizedKeyword, page, limit: 24 },
    options,
  );
  return {
    data,
    source: data.source === "phimapi" || data.source === "ophim" ? data.source : null,
    items: data.items || [],
  };
}
