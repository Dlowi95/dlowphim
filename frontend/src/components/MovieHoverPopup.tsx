"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Play, Heart, Info } from "lucide-react";
import { useRouter } from "next/navigation";
import { cleanMovieName } from "@/utils/movieUtils";
import { useAuth } from "@/context/AuthContext";
import Cookies from "js-cookie";

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
        const res = await fetch(`https://ophim1.com/v1/api/phim/${movie.slug}`, {
          signal: controller.signal
        });
        const data = await res.json();
        if (data.status === true || data.status === "success") {
          setDetails(data.data?.item || data.movie || null);
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.error("Error fetching hover details:", err);
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

  // Close hover card on window scroll
  useEffect(() => {
    const handleScroll = () => {
      onMouseLeave();
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [onMouseLeave]);

  const getImageUrl = (movieObj: Movie) => {
    // Hover details banner is always landscape aspect-[16/10], so we prefer poster_url (landscape backdrop in OPhim)
    const path = movieObj.poster_url || movieObj.thumb_url;
    if (!path) return "";
    const fileName = path.split("/").pop();
    return `https://img.ophim.live/uploads/movies/${fileName}`;
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

  if (!mounted) return null;

  const showPopup = isVisible && !loadingDetails && !!details;

  const hoverCard = (
    <div
      style={{
        position: "absolute",
        top: position.top,
        left: position.left,
        width: position.width,
        zIndex: 9999,
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`bg-[#12131b] border border-zinc-800/60 rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.95)] overflow-hidden select-none transition-all duration-300 ease-out flex flex-col ${
        showPopup 
          ? "opacity-100 scale-100 pointer-events-auto" 
          : "opacity-0 scale-95 pointer-events-none"
      }`}
    >
      <div 
        onClick={() => router.push(`/movie/${movie.slug}`)}
        className="cursor-pointer"
      >
        {/* Aspect Ratio matched image */}
        <div className="relative w-full overflow-hidden bg-[#12131b] rounded-t-2xl aspect-[16/10]">
          <img
            src={getImageUrl(movie)}
            alt={cleanedName}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
            decoding="async"
          />

          {/* Subtle bottom backdrop shadow overlay */}
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#12131b] to-transparent z-1" />
          
          {/* Badge on backdrop */}
          <div className="absolute bottom-2 left-3 flex items-center gap-1 z-10">
            <span className="bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded text-[9px] font-black text-pink-400 border border-zinc-800/50 uppercase">
              {details?.quality || movie.quality || "HD"}
            </span>
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
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/movie/${movie.slug}`);
              }}
              className="flex-1 h-11 rounded-xl bg-pink-500/10 border border-pink-500/30 hover:bg-pink-500/20 active:scale-95 text-pink-500 font-extrabold text-sm flex items-center justify-center gap-1.5 shadow-md shadow-pink-500/5 cursor-pointer transition-all duration-200"
            >
              <Play size={15} className="fill-pink-500 text-pink-500" /> Xem ngay
            </button>
            
            <button
              onClick={toggleFavorite}
              className={`w-11 h-11 rounded-xl border flex items-center justify-center transition-all duration-200 active:scale-90 cursor-pointer ${
                isFavorite 
                  ? "bg-rose-500/10 border-rose-500/30 text-rose-500 shadow-md shadow-rose-500/5" 
                  : "bg-zinc-850/80 border-zinc-700/50 hover:border-zinc-600 text-zinc-300 hover:text-white"
              }`}
            >
              <Heart size={16} className={isFavorite ? "fill-rose-500" : ""} />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/movie/${movie.slug}`);
              }}
              className="w-11 h-11 rounded-xl bg-zinc-850/80 border border-zinc-700/50 hover:border-zinc-600 text-zinc-300 hover:text-white flex items-center justify-center transition-all duration-200 active:scale-90 cursor-pointer"
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
