const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const DISCOVERY_CACHE_TTL_MS = 2 * 60 * 1000;
const DISCOVERY_CACHE_MAX_ENTRIES = 60;
const discoveryCache = new Map<string, { value: MovieDiscoveryResult; expiresAt: number }>();
const discoveryInflight = new Map<string, Promise<MovieDiscoveryResult>>();

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
  const params = new URLSearchParams({
    kind: input.kind,
    page: String(input.page || 1),
    limit: String(input.limit || 24),
  });
  if (input.slug) params.set("slug", input.slug);
  if (input.keyword) params.set("keyword", input.keyword);
  const requestUrl = `${API_URL}/movies/discovery?${params.toString()}`;
  const cached = discoveryCache.get(requestUrl);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  if (cached) discoveryCache.delete(requestUrl);

  let sharedRequest = discoveryInflight.get(requestUrl);
  if (!sharedRequest) {
    sharedRequest = (async () => {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 12_000);
      try {
        const response = await fetch(requestUrl, { signal: controller.signal });
        const payload = await response.json().catch(() => null);
        if (!response.ok || payload?.status === false) {
          const message = Array.isArray(payload?.message) ? payload.message[0] : payload?.message;
          throw new Error(message || "Kho phim đang tạm gián đoạn");
        }
        const value = payload as MovieDiscoveryResult;
        discoveryCache.set(requestUrl, {
          value,
          expiresAt: Date.now() + DISCOVERY_CACHE_TTL_MS,
        });
        while (discoveryCache.size > DISCOVERY_CACHE_MAX_ENTRIES) {
          const oldestKey = discoveryCache.keys().next().value;
          if (!oldestKey) break;
          discoveryCache.delete(oldestKey);
        }
        return value;
      } finally {
        window.clearTimeout(timeoutId);
        discoveryInflight.delete(requestUrl);
      }
    })();
    discoveryInflight.set(requestUrl, sharedRequest);
  }

  if (!options.signal && !options.timeoutMs) return sharedRequest;

  return new Promise<MovieDiscoveryResult>((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      options.signal?.removeEventListener("abort", handleAbort);
      callback();
    };
    const handleAbort = () => finish(() => reject(new DOMException("Request aborted", "AbortError")));
    const timeoutId = window.setTimeout(handleAbort, options.timeoutMs || 12_000);

    if (options.signal?.aborted) {
      handleAbort();
      return;
    }
    options.signal?.addEventListener("abort", handleAbort, { once: true });
    sharedRequest.then(
      (value) => finish(() => resolve(value)),
      (error) => finish(() => reject(error)),
    );
  });
}
