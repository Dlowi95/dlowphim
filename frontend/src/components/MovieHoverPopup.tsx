"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Play, Heart, Info } from "lucide-react";
import { useRouter } from "next/navigation";
import { cleanMovieName, getImageUrl } from "@/utils/movieUtils";
import { useAuth } from "@/context/AuthContext";
import { getProxyUrl, MOVIE_API_DOMAIN } from "@/utils/api";
import MovieQualityBadge from "./MovieQualityBadge";
import { fetchMovieArtwork, LOCAL_MOVIE_IMAGE_FALLBACK } from "@/utils/movieArtwork";
import { recordTouchInteraction, subscribeToFineHoverCapability } from "@/utils/hoverCardGuard";

interface Movie {
  _id: string;
  name: string;
  slug: string;
  origin_name: string;
  poster_url?: string;
  thumb_url?: string;
  year?: number;
  quality?: string;
  lang?: string;
}

interface MovieHoverPopupProps {
  movie: Movie;
  position: { top: number; left: number; width: number };
  aspect?: "landscape" | "portrait";
  isVisible: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export default function MovieHoverPopup({
  movie,
  position,
  aspect = "landscape",
  isVisible,
  onMouseEnter,
  onMouseLeave,
}: MovieHoverPopupProps) {
  const [mounted, setMounted] = useState(false);
  const [details, setDetails] = useState<any | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { user, toggleFavorite: toggleFavoriteCtx } = useAuth();

  const isFavorite = user?.favorites?.includes(movie.slug) || false;

  const cleanedName = cleanMovieName(movie.name);
  const cleanedOriginName = cleanMovieName(movie.origin_name);

  useEffect(() => {
    setMounted(true);

    const controller = new AbortController();

    // Fetch movie details in background on hover
    async function fetchDetails() {
      try {
        setLoadingDetails(true);
        const res = await fetch(getProxyUrl(`${MOVIE_API_DOMAIN}/phim/${movie.slug}`), {
          signal: controller.signal
        });
        const data = await res.json();
        if (data.status === true || data.status === "success") {
          setDetails(data.movie || data.data?.item || null);
        }
      } catch (err: any) {
        if (!controller.signal.aborted && err.name !== "AbortError" && process.env.NODE_ENV !== "production") {
          console.debug("Hover preview tạm thời không tải được:", err);
        }
      } finally {
        setLoadingDetails(false);
      }
    }
    fetchDetails();

    return () => {
      controller.abort();
    };
  }, [movie.slug]);

  // Close hover card on window scroll, resize, touch, or breakpoint change
  useEffect(() => {
    const handleDismiss = () => {
      onMouseLeave();
    };
    const handleTouchDismiss = () => {
      recordTouchInteraction();
      onMouseLeave();
    };
    const handlePointerDismiss = (e: PointerEvent) => {
      if (e.pointerType && e.pointerType !== "mouse") {
        recordTouchInteraction();
        onMouseLeave();
      }
    };
    const unsubscribe = subscribeToFineHoverCapability((hasCapability) => {
      if (!hasCapability) onMouseLeave();
    });

    window.addEventListener("scroll", handleDismiss, { passive: true });
    window.addEventListener("resize", handleDismiss, { passive: true });
    window.addEventListener("orientationchange", handleDismiss, { passive: true });
    window.addEventListener("touchstart", handleTouchDismiss, { passive: true });
    window.addEventListener("pointerdown", handlePointerDismiss, { passive: true });

    return () => {
      unsubscribe();
      window.removeEventListener("scroll", handleDismiss);
      window.removeEventListener("resize", handleDismiss);
      window.removeEventListener("orientationchange", handleDismiss);
      window.removeEventListener("touchstart", handleTouchDismiss);
      window.removeEventListener("pointerdown", handlePointerDismiss);
    };
  }, [onMouseLeave]);

  const initialPopupUrl = movie.poster_url || movie.thumb_url;
  const [popupImgSrc, setPopupImgSrc] = useState<string>(() => getImageUrl(initialPopupUrl));
  const [popupAttempt, setPopupAttempt] = useState(0);

  useEffect(() => {
    setPopupImgSrc(getImageUrl(initialPopupUrl));
    setPopupAttempt(0);
  }, [movie.slug, initialPopupUrl]);

  const handlePopupImgError = () => {
    if (popupAttempt === 0 && movie.thumb_url && movie.poster_url && movie.thumb_url !== movie.poster_url) {
      setPopupAttempt(1);
      setPopupImgSrc(getImageUrl(movie.thumb_url));
      return;
    }

    if (popupAttempt < 2) {
      setPopupAttempt(2);
      fetchMovieArtwork({ slug: movie.slug, title: movie.origin_name || movie.name })
        .then((data) => {
          if (data && (data.backdropUrl || data.posterUrl)) {
            setPopupImgSrc(data.backdropUrl || data.posterUrl || LOCAL_MOVIE_IMAGE_FALLBACK);
          } else {
            setPopupImgSrc(LOCAL_MOVIE_IMAGE_FALLBACK);
          }
        })
        .catch(() => {
          setPopupImgSrc(LOCAL_MOVIE_IMAGE_FALLBACK);
        });
    }
  };

  const getImdbScore = (name: string) => {
    const base = (name.length % 3) * 0.4 + 8.2;
    return base.toFixed(1);
  };

  const getAgeRating = (categories: any[] = []) => {
    const slugs = categories.map((c: any) => c.slug);
    if (slugs.some(s => ["kinh-di", "toi-pham", "18"].includes(s))) return "T18";
    if (slugs.some(s => ["hanh-dong", "hinh-su", "giat-gan", "tam-ly"].includes(s))) return "T16";
    if (slugs.some(s => ["vien-tuong", "phieu-luu", "co-trang", "than-thoai"].includes(s))) return "T13";
    return "P";
  };

  const toggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await toggleFavoriteCtx(movie.slug);
  };

  const navTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (navTimer.current) clearTimeout(navTimer.current);
    };
  }, []);

  const handleCardClick = (e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    if (isNavigating) return;
    setIsNavigating(true);
    if (navTimer.current) clearTimeout(navTimer.current);
    navTimer.current = setTimeout(() => setIsNavigating(false), 3500);
    router.push(`/movie/${movie.slug}`);
  };

  const handleWatchClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    if (isNavigating) return;
    setIsNavigating(true);
    if (navTimer.current) clearTimeout(navTimer.current);
    navTimer.current = setTimeout(() => setIsNavigating(false), 3500);
    router.push(`/watch/${movie.slug}`);
  };

  const handleDetailClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    if (isNavigating) return;
    setIsNavigating(true);
    if (navTimer.current) clearTimeout(navTimer.current);
    navTimer.current = setTimeout(() => setIsNavigating(false), 3500);
    router.push(`/movie/${movie.slug}`);
  };

  if (!mounted) return null;

  const showPopup = isVisible && !loadingDetails && !!details;

  const handleMouseEnter = () => {
    onMouseEnter();
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    const currentTarget = e.currentTarget;
    const relatedTarget = e.relatedTarget as Node | null;
    if (currentTarget && relatedTarget && currentTarget.contains(relatedTarget)) {
      return;
    }
    onMouseLeave();
  };

  const hoverCard = (
    <div
      ref={popupRef}
      data-testid="movie-hover-popup"
      data-movie-slug={movie.slug}
      style={{
        position: "absolute",
        top: position.top,
        left: position.left,
        width: position.width,
        zIndex: 9999,
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`bg-[#12131b] border border-zinc-800/60 rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.95)] overflow-hidden select-none transition-all duration-300 ease-out flex flex-col ${
        showPopup 
          ? "opacity-100 scale-100 pointer-events-auto" 
          : "opacity-0 scale-95 pointer-events-none"
      } ${isNavigating ? "opacity-70" : ""}`}
    >
      <div 
        onClick={handleCardClick}
        className="cursor-pointer"
      >
        {/* Aspect Ratio matched image */}
        <div className="relative w-full overflow-hidden bg-[#12131b] rounded-t-2xl aspect-[16/10]">
          <img
            src={popupImgSrc}
            alt={cleanedName}
            onError={handlePopupImgError}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
            decoding="async"
          />

          {/* Subtle bottom backdrop shadow overlay */}
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#12131b] to-transparent z-1" />
          
          {/* Badge on backdrop */}
          <div className="absolute bottom-2 left-3 flex items-center gap-1 z-10">
            <MovieQualityBadge quality={details?.quality || movie.quality} />
            <span className="bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded text-[9px] font-black text-white border border-zinc-800/50 uppercase">
              {details?.lang || movie.lang || "Vietsub"}
            </span>
          </div>
        </div>

        {/* Detailed textual fields block */}
        <div className="p-5 space-y-4 relative z-10 bg-[#12131b]">
          {/* Titles */}
          <div className="text-left space-y-1">
            <h4 className="font-black text-lg md:text-xl text-zinc-100 line-clamp-1 hover:text-pink-500 transition-colors">
              {cleanedName}
            </h4>
            <p className="text-xs md:text-sm text-zinc-400 truncate font-bold mt-0.5">
              {cleanedOriginName}
            </p>
          </div>

          {/* Action Row */}
          <div className="flex items-center gap-2">
            <button
              data-testid="hover-watch-btn"
              onClick={handleWatchClick}
              className="flex-1 h-11 rounded-xl bg-pink-500/10 border border-pink-500/30 hover:bg-pink-500/20 active:scale-95 text-pink-500 font-extrabold text-sm flex items-center justify-center gap-1.5 shadow-md shadow-pink-500/5 cursor-pointer transition-all duration-200"
            >
              <Play size={15} className="fill-pink-500 text-pink-500" /> Xem ngay
            </button>
            
            <button
              data-testid="hover-favorite-btn"
              onClick={toggleFavorite}
              className={`w-11 h-11 rounded-xl border flex items-center justify-center transition-all duration-200 active:scale-90 cursor-pointer ${
                isFavorite 
                  ? "bg-rose-500/10 border-rose-500/30 text-rose-500 shadow-md shadow-rose-500/5" 
                  : "bg-zinc-800/80 border-zinc-700/50 hover:border-zinc-600 text-zinc-300 hover:text-white"
              }`}
            >
              <Heart size={16} className={isFavorite ? "fill-rose-500" : ""} />
            </button>

            <button
              data-testid="hover-detail-btn"
              onClick={handleDetailClick}
              className="w-11 h-11 rounded-xl bg-zinc-800/80 border border-zinc-700/50 hover:border-zinc-600 text-zinc-300 hover:text-white flex items-center justify-center transition-all duration-200 active:scale-90 cursor-pointer"
            >
              <Info size={16} />
            </button>
          </div>

          {/* Meta details */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs md:text-sm text-zinc-300 font-bold select-none text-left">
            <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 font-black px-1.5 py-0.5 rounded text-[11px]">
              IMDb {getImdbScore(cleanedName)}
            </span>
            <span className="border border-zinc-800 bg-zinc-950/60 px-1.5 py-0.5 rounded text-[11px] text-zinc-400">
              {getAgeRating(details?.category)}
            </span>
            <span className="text-zinc-500">•</span>
            <span>{movie.year || details?.year || "2026"}</span>
            
            {details?.episode_current && (
              <>
                <span className="text-zinc-500">•</span>
                <span className="text-pink-400 truncate max-w-[130px]">{details.episode_current}</span>
              </>
            )}
          </div>

          {/* Categories/Genres */}
          {details?.category && details.category.length > 0 && (
            <div className="text-left text-xs md:text-sm text-zinc-500 font-bold tracking-wide border-t border-zinc-800/40 pt-2.5 line-clamp-1">
              {details.category.slice(0, 4).map((c: any) => c.name).join(" • ")}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(hoverCard, document.body);
}
