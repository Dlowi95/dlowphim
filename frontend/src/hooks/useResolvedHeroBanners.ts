"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Cookies from "js-cookie";
import { cleanMovieName } from "@/utils/movieUtils";
import { getProxyUrl, MOVIE_API_DOMAIN } from "@/utils/api";

const HERO_SLOT_COUNT = 5;
const HERO_CANDIDATE_LIMIT = 18;
const HERO_DETAIL_CONCURRENCY = 4;

export interface HeroBannerRecord {
  _id?: string;
  title: string;
  originName?: string;
  movieSlug: string;
  imageUrl: string;
  description?: string;
  order: number;
  isActive: boolean;
}

export interface HeroTmdbData {
  logoUrl: string | null;
  backdropUrl: string | null;
  posterUrl: string | null;
  tmdbTitle: string;
  tmdbOriginalTitle: string;
  tmdbId?: string;
  tmdbType?: string;
}

export interface ResolvedHeroSlot {
  order: number;
  movie: any;
  detail: any;
  tmdbData: HeroTmdbData | null;
  isCustomBanner: boolean;
  bannerRecord?: HeroBannerRecord;
}

interface ProcessedMovie {
  movie: any;
  detail: any;
  tmdbData: HeroTmdbData | null;
}

interface UseResolvedHeroBannersOptions {
  apiUrl: string;
  admin?: boolean;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const currentIndex = nextIndex++;
      if (currentIndex >= items.length) return;
      results[currentIndex] = await mapper(items[currentIndex]);
    }
  }

  const workerCount = Math.min(Math.max(concurrency, 1), items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

function isAnimeOrAnimation(movie: any, detail: any): boolean {
  const categories = detail?.category || movie?.category || [];
  const categorySlugs = categories.map((category: any) =>
    (category?.slug || category?.name || category || "").toString().toLowerCase()
  );
  const movieType = (detail?.type || movie?.type || "").toString().toLowerCase();
  return (
    movieType === "hoathinh" ||
    categorySlugs.some(
      (category: string) => category.includes("hoat-hinh") || category.includes("anime")
    )
  );
}

function buildResolvedSlots(
  banners: HeroBannerRecord[],
  processedMovies: ProcessedMovie[]
): ResolvedHeroSlot[] {
  const seenSlugs = new Set<string>();
  const seenNames = new Set<string>();

  const candidates = processedMovies
    .filter(({ movie, detail, tmdbData }) => {
      if (!movie?.slug || !detail || !tmdbData?.backdropUrl || !tmdbData.tmdbTitle) return false;
      const currentEpisode = (detail.episode_current || "").toLowerCase();
      return !currentEpisode.includes("trailer") && !isAnimeOrAnimation(movie, detail);
    })
    .sort((left, right) => Number(Boolean(right.tmdbData?.logoUrl)) - Number(Boolean(left.tmdbData?.logoUrl)));

  const slots: ResolvedHeroSlot[] = [];
  for (let order = 1; order <= HERO_SLOT_COUNT; order++) {
    const custom = banners.find((banner) => banner.order === order && banner.isActive);
    if (custom) {
      const customNameKey = cleanMovieName(custom.title).toLowerCase().trim();
      const customOriginalNameKey = cleanMovieName(custom.originName || "").toLowerCase().trim();
      seenSlugs.add(custom.movieSlug);
      if (customNameKey) seenNames.add(customNameKey);
      if (customOriginalNameKey) seenNames.add(customOriginalNameKey);
      slots.push({
        order,
        movie: {
          _id: custom._id,
          name: custom.title,
          origin_name: custom.originName || "",
          slug: custom.movieSlug,
          thumb_url: custom.imageUrl,
          poster_url: custom.imageUrl,
          content: custom.description || "",
          isCustomBanner: true,
        },
        detail: null,
        tmdbData: null,
        isCustomBanner: true,
        bannerRecord: custom,
      });
      continue;
    }

    const candidate = candidates.find(({ movie, tmdbData }) => {
      const tmdbNameKey = cleanMovieName(tmdbData?.tmdbTitle || "").toLowerCase().trim();
      const tmdbOriginalNameKey = cleanMovieName(
        tmdbData?.tmdbOriginalTitle || ""
      ).toLowerCase().trim();
      return (
        !seenSlugs.has(movie.slug) &&
        Boolean(tmdbNameKey) &&
        !seenNames.has(tmdbNameKey) &&
        (!tmdbOriginalNameKey || !seenNames.has(tmdbOriginalNameKey))
      );
    });
    if (!candidate || !candidate.tmdbData) continue;

    const { movie, detail, tmdbData } = candidate;
    const resolvedName = tmdbData.tmdbTitle;
    const resolvedOriginalName = tmdbData.tmdbOriginalTitle || detail.origin_name || movie.origin_name;
    seenSlugs.add(movie.slug);
    seenNames.add(cleanMovieName(resolvedName).toLowerCase().trim());
    if (resolvedOriginalName) {
      seenNames.add(cleanMovieName(resolvedOriginalName).toLowerCase().trim());
    }
    slots.push({
      order,
      movie: {
        ...movie,
        name: resolvedName,
        origin_name: resolvedOriginalName,
        thumb_url: tmdbData.backdropUrl,
        poster_url: tmdbData.backdropUrl,
        isCustomBanner: false,
      },
      detail: {
        ...detail,
        name: resolvedName,
        origin_name: resolvedOriginalName,
        thumb_url: tmdbData.backdropUrl,
        poster_url: tmdbData.backdropUrl,
      },
      tmdbData,
      isCustomBanner: false,
    });
  }
  return slots;
}

export function useResolvedHeroBanners({
  apiUrl,
  admin = false,
}: UseResolvedHeroBannersOptions) {
  const [slots, setSlots] = useState<ResolvedHeroSlot[]>([]);
  const [rawBanners, setRawBanners] = useState<HeroBannerRecord[]>([]);
  const [latestMovies, setLatestMovies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);

    try {
      const listController = new AbortController();
      const timeoutId = setTimeout(() => listController.abort(), 12000);
      const token = admin ? Cookies.get("token") : undefined;
      const bannerHeaders: HeadersInit = token
        ? { Authorization: `Bearer ${token}` }
        : {};

      let bannerResponse: Response;
      let latestResponse: Response;
      try {
        [bannerResponse, latestResponse] = await Promise.all([
          fetch(`${apiUrl}/banners${admin ? "/admin" : ""}`, {
            headers: bannerHeaders,
            signal: listController.signal,
          }),
          fetch(
            getProxyUrl(`${MOVIE_API_DOMAIN}/danh-sach/phim-moi-cap-nhat?page=1`),
            { signal: listController.signal }
          ),
        ]);
      } finally {
        clearTimeout(timeoutId);
      }

      const banners: HeroBannerRecord[] = bannerResponse.ok
        ? await bannerResponse.json()
        : [];
      const latestData = latestResponse.ok ? await latestResponse.json() : null;
      const movies: any[] = (latestData?.status && latestData?.items ? latestData.items : []).slice(
        0,
        HERO_CANDIDATE_LIMIT
      );

      const processedMovies = await mapWithConcurrency(
        movies,
        HERO_DETAIL_CONCURRENCY,
        async (movie): Promise<ProcessedMovie> => {
          try {
            const detailResponse = await fetch(
              getProxyUrl(`${MOVIE_API_DOMAIN}/v1/api/phim/${movie.slug}`)
            );
            if (!detailResponse.ok) return { movie, detail: null, tmdbData: null };
            const detailData = await detailResponse.json();
            const detail = detailData.data?.item || detailData.movie || null;
            if (!detail) return { movie, detail: null, tmdbData: null };

            const tmdbResponse = await fetch(
              `${apiUrl}/movies/logo/${movie.slug}?title=${encodeURIComponent(detail.name || movie.name)}&originTitle=${encodeURIComponent(detail.origin_name || movie.origin_name || "")}&tmdbId=${detail.tmdb?.id || ""}&tmdbType=${detail.tmdb?.type || "movie"}`
            );
            const tmdbData = tmdbResponse.ok ? await tmdbResponse.json() : null;
            return { movie, detail, tmdbData };
          } catch {
            return { movie, detail: null, tmdbData: null };
          }
        }
      );

      if (requestId !== requestIdRef.current) return;
      setRawBanners(banners);
      setLatestMovies(movies);
      setSlots(buildResolvedSlots(banners, processedMovies));
    } catch (loadError) {
      if (requestId !== requestIdRef.current) return;
      setError(loadError instanceof Error ? loadError.message : "Không thể tải Hero Banner");
      setSlots([]);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [admin, apiUrl]);

  useEffect(() => {
    refresh();
    return () => {
      requestIdRef.current += 1;
    };
  }, [refresh]);

  return { slots, rawBanners, latestMovies, loading, error, refresh };
}
