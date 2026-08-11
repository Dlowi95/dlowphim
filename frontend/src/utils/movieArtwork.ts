export interface MovieArtwork {
  logoUrl?: string | null;
  backdropUrl?: string | null;
  posterUrl?: string | null;
}

interface MovieArtworkInput {
  slug: string;
  title?: string;
  tmdbId?: string | number;
  tmdbType?: string;
}

export const LOCAL_MOVIE_IMAGE_FALLBACK = "/images/movie-placeholder.svg";

const ARTWORK_CACHE_TTL_MS = 15 * 60 * 1000;
const ARTWORK_FAILURE_TTL_MS = 60 * 1000;
const ARTWORK_CACHE_MAX_ENTRIES = 150;
const artworkCache = new Map<string, { value: MovieArtwork | null; expiresAt: number }>();
const artworkInflight = new Map<string, Promise<MovieArtwork | null>>();

export function fetchMovieArtwork(input: MovieArtworkInput): Promise<MovieArtwork | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
  const params = new URLSearchParams();
  if (input.title) params.set("title", input.title);
  if (input.tmdbId) params.set("tmdbId", String(input.tmdbId));
  if (input.tmdbType) params.set("tmdbType", input.tmdbType);
  const requestUrl = `${apiUrl}/movies/logo/${encodeURIComponent(input.slug)}?${params.toString()}`;
  const cached = artworkCache.get(requestUrl);
  if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.value);
  if (cached) artworkCache.delete(requestUrl);

  const existing = artworkInflight.get(requestUrl);
  if (existing) return existing;

  const request = fetch(requestUrl)
    .then(async (response) => {
      if (!response.ok) return null;
      const data = await response.json().catch(() => null);
      return data && (data.logoUrl || data.backdropUrl || data.posterUrl)
        ? data as MovieArtwork
        : null;
    })
    .catch(() => null)
    .then((value) => {
      artworkCache.set(requestUrl, {
        value,
        expiresAt: Date.now() + (value ? ARTWORK_CACHE_TTL_MS : ARTWORK_FAILURE_TTL_MS),
      });
      while (artworkCache.size > ARTWORK_CACHE_MAX_ENTRIES) {
        const oldestKey = artworkCache.keys().next().value;
        if (!oldestKey) break;
        artworkCache.delete(oldestKey);
      }
      return value;
    })
    .finally(() => artworkInflight.delete(requestUrl));

  artworkInflight.set(requestUrl, request);
  return request;
}
