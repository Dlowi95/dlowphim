const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export type MovieDiscoveryKind = "search" | "genre" | "country" | "list";

export interface MovieDiscoveryResult {
  status: boolean;
  availability: "ready" | "empty";
  source?: "phimapi" | "ophim" | string;
  items: any[];
  pagination: {
    currentPage: number;
    totalItems: number;
    totalItemsPerPage: number;
    totalPages: number;
  };
  fallback?: { used: boolean; reason?: "source-error" | "empty-result" | null };
  stale?: { used: boolean; savedAt?: string | null };
}

export async function fetchMovieDiscovery(
  input: {
    kind: MovieDiscoveryKind;
    slug?: string;
    keyword?: string;
    page?: number;
    limit?: number;
  },
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<MovieDiscoveryResult> {
  const controller = new AbortController();
  const abortRequest = () => controller.abort();
  options.signal?.addEventListener("abort", abortRequest, { once: true });
  const timeoutId = window.setTimeout(abortRequest, options.timeoutMs || 8000);
  const params = new URLSearchParams({
    kind: input.kind,
    page: String(input.page || 1),
    limit: String(input.limit || 24),
  });
  if (input.slug) params.set("slug", input.slug);
  if (input.keyword) params.set("keyword", input.keyword);

  try {
    const response = await fetch(`${API_URL}/movies/discovery?${params.toString()}`, {
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.status === false) {
      const message = Array.isArray(payload?.message) ? payload.message[0] : payload?.message;
      throw new Error(message || "Kho phim đang tạm gián đoạn");
    }
    return payload as MovieDiscoveryResult;
  } finally {
    window.clearTimeout(timeoutId);
    options.signal?.removeEventListener("abort", abortRequest);
  }
}
