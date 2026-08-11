"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Cookies from "js-cookie";

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

interface ResolvedHeroResponse {
  sourceId: string;
  generatedAt: string;
  slots: ResolvedHeroSlot[];
  rawBanners: HeroBannerRecord[];
  latestMovies: any[];
}

interface UseResolvedHeroBannersOptions {
  apiUrl: string;
  admin?: boolean;
}

const PUBLIC_HERO_CACHE_KEY = "dlowphim:home-hero:v1";
const PUBLIC_HERO_CACHE_TTL = 30 * 60 * 1000;
const publicHeroInflight = new Map<string, Promise<ResolvedHeroResponse>>();

function fetchPublicHero(apiUrl: string) {
  const requestUrl = `${apiUrl}/banners/hero`;
  const existing = publicHeroInflight.get(requestUrl);
  if (existing) return existing;

  const request = (async () => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(requestUrl, { signal: controller.signal });
      if (!response.ok) throw new Error(`Hero API phản hồi lỗi ${response.status}`);
      return await response.json() as ResolvedHeroResponse;
    } finally {
      window.clearTimeout(timeoutId);
      publicHeroInflight.delete(requestUrl);
    }
  })();
  publicHeroInflight.set(requestUrl, request);
  return request;
}

export function useResolvedHeroBanners({
  apiUrl,
  admin = false,
}: UseResolvedHeroBannersOptions) {
  const [slots, setSlots] = useState<ResolvedHeroSlot[]>([]);
  const [rawBanners, setRawBanners] = useState<HeroBannerRecord[]>([]);
  const [latestMovies, setLatestMovies] = useState<any[]>([]);
  const [sourceId, setSourceId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const hasUsableCacheRef = useRef(false);

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(!hasUsableCacheRef.current);
    setError(null);

    try {
      let data: ResolvedHeroResponse;
      if (admin) {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), 15_000);
        try {
          const token = Cookies.get("token");
          const response = await fetch(`${apiUrl}/banners/hero/admin`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            signal: controller.signal,
          });
          if (!response.ok) throw new Error(`Hero API phản hồi lỗi ${response.status}`);
          data = await response.json();
        } finally {
          window.clearTimeout(timeoutId);
        }
      } else {
        data = await fetchPublicHero(apiUrl);
      }
      if (requestId !== requestIdRef.current) return;
      setSlots(data.slots || []);
      setRawBanners(data.rawBanners || []);
      setLatestMovies(data.latestMovies || []);
      setSourceId(data.sourceId || "");
      if (!admin) {
        try {
          localStorage.setItem(
            PUBLIC_HERO_CACHE_KEY,
            JSON.stringify({ savedAt: Date.now(), data }),
          );
          hasUsableCacheRef.current = true;
        } catch {
          // Trình duyệt có thể chặn storage; dữ liệu mạng vẫn hoạt động bình thường.
        }
      }
    } catch (loadError) {
      if (requestId !== requestIdRef.current) return;
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Không thể tải Hero Banner",
      );
      if (!hasUsableCacheRef.current) setSlots([]);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [admin, apiUrl]);

  useEffect(() => {
    if (!admin) {
      try {
        const cachedValue = localStorage.getItem(PUBLIC_HERO_CACHE_KEY);
        if (cachedValue) {
          const cached = JSON.parse(cachedValue) as {
            savedAt?: number;
            data?: ResolvedHeroResponse;
          };
          const cachedData = cached.data;
          if (
            cached.savedAt &&
            Date.now() - cached.savedAt <= PUBLIC_HERO_CACHE_TTL &&
            cachedData?.slots?.length
          ) {
            hasUsableCacheRef.current = true;
            setSlots(cachedData.slots);
            setRawBanners(cachedData.rawBanners || []);
            setLatestMovies(cachedData.latestMovies || []);
            setSourceId(cachedData.sourceId || "");
            setLoading(false);
          }
        }
      } catch {
        // Storage không khả dụng hoặc cache hỏng: bỏ qua và dùng dữ liệu mạng.
      }
    }
    void refresh();
    return () => {
      requestIdRef.current += 1;
    };
  }, [refresh]);

  return { slots, rawBanners, latestMovies, sourceId, loading, error, refresh };
}
