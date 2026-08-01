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

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const token = admin ? Cookies.get("token") : undefined;
      const response = await fetch(
        `${apiUrl}/banners/hero${admin ? "/admin" : ""}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: controller.signal,
        },
      );
      if (!response.ok) {
        throw new Error(`Hero API phản hồi lỗi ${response.status}`);
      }

      const data: ResolvedHeroResponse = await response.json();
      if (requestId !== requestIdRef.current) return;
      setSlots(data.slots || []);
      setRawBanners(data.rawBanners || []);
      setLatestMovies(data.latestMovies || []);
      setSourceId(data.sourceId || "");
    } catch (loadError) {
      if (requestId !== requestIdRef.current) return;
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Không thể tải Hero Banner",
      );
      setSlots([]);
    } finally {
      clearTimeout(timeoutId);
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [admin, apiUrl]);

  useEffect(() => {
    refresh();
    return () => {
      requestIdRef.current += 1;
    };
  }, [refresh]);

  return { slots, rawBanners, latestMovies, sourceId, loading, error, refresh };
}
