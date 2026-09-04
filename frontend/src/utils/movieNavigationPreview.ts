const MOVIE_NAVIGATION_PREVIEW_KEY = "dlowphim_movie_navigation_preview";
const MOVIE_NAVIGATION_PREVIEW_TTL_MS = 2 * 60 * 1000;

type MovieNavigationPreviewEnvelope = {
  slug: string;
  savedAt: number;
  movie: unknown;
};

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function getSessionStorage(): StorageLike | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function primeMovieNavigationPreview(
  slug: string,
  movie: unknown,
  storage: StorageLike | null = getSessionStorage(),
  now = Date.now(),
) {
  if (!storage || !slug || !movie || typeof movie !== "object") return;

  try {
    const payload: MovieNavigationPreviewEnvelope = { slug, savedAt: now, movie };
    storage.setItem(MOVIE_NAVIGATION_PREVIEW_KEY, JSON.stringify(payload));
  } catch {
    // Navigation must remain functional when storage is unavailable or full.
  }
}

export function readMovieNavigationPreview<T>(
  slug: string,
  storage: StorageLike | null = getSessionStorage(),
  now = Date.now(),
): T | null {
  if (!storage || !slug) return null;

  try {
    const raw = storage.getItem(MOVIE_NAVIGATION_PREVIEW_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<MovieNavigationPreviewEnvelope>;
    const isFresh = typeof parsed.savedAt === "number"
      && now - parsed.savedAt >= 0
      && now - parsed.savedAt <= MOVIE_NAVIGATION_PREVIEW_TTL_MS;
    const movie = parsed.movie as Record<string, unknown> | undefined;
    const isMatchingMovie = parsed.slug === slug
      && movie !== null
      && typeof movie === "object"
      && movie.slug === slug
      && typeof movie.name === "string";

    if (!isFresh || !isMatchingMovie) {
      storage.removeItem(MOVIE_NAVIGATION_PREVIEW_KEY);
      return null;
    }

    return parsed.movie as T;
  } catch {
    try {
      storage.removeItem(MOVIE_NAVIGATION_PREVIEW_KEY);
    } catch {}
    return null;
  }
}

