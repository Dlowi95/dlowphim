export interface PersonResult {
  id: string;
  name: string;
  originalName: string;
  profileUrl: string | null;
  department: string;
  knownFor: string[];
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const PEOPLE_CACHE_TTL_MS = 2 * 60 * 1000;
const PEOPLE_CACHE_MAX_ENTRIES = 40;

type PeopleSearchResult = {
  items: PersonResult[];
  page: number;
  totalPages: number;
  totalItems: number;
};

type PeopleSearchOptions = {
  signal?: AbortSignal;
  timeoutMs?: number;
};

const peopleCache = new Map<string, { value: PeopleSearchResult; expiresAt: number }>();
const peopleInflight = new Map<string, Promise<PeopleSearchResult>>();

export async function searchPeople(
  query: string,
  page = 1,
  options: PeopleSearchOptions = {},
) {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return { items: [], page: 1, totalPages: 1, totalItems: 0 };

  const requestUrl = `${API_URL}/movies/people/search?query=${encodeURIComponent(normalizedQuery)}&page=${page}`;
  const cached = peopleCache.get(requestUrl);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  if (cached) peopleCache.delete(requestUrl);

  let sharedRequest = peopleInflight.get(requestUrl);
  if (!sharedRequest) {
    sharedRequest = (async () => {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 8_000);
      try {
        const response = await fetch(requestUrl, { signal: controller.signal });
        if (!response.ok) throw new Error("Không thể tìm diễn viên lúc này");
        const value = await response.json() as PeopleSearchResult;
        peopleCache.set(requestUrl, { value, expiresAt: Date.now() + PEOPLE_CACHE_TTL_MS });
        while (peopleCache.size > PEOPLE_CACHE_MAX_ENTRIES) {
          const oldestKey = peopleCache.keys().next().value;
          if (!oldestKey) break;
          peopleCache.delete(oldestKey);
        }
        return value;
      } finally {
        window.clearTimeout(timeoutId);
        peopleInflight.delete(requestUrl);
      }
    })();
    peopleInflight.set(requestUrl, sharedRequest);
  }

  if (!options.signal && !options.timeoutMs) return sharedRequest;
  return new Promise<PeopleSearchResult>((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      options.signal?.removeEventListener("abort", handleAbort);
      callback();
    };
    const handleAbort = () => finish(() => reject(new DOMException("Request aborted", "AbortError")));
    const timeoutId = window.setTimeout(handleAbort, options.timeoutMs || 8_000);
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
