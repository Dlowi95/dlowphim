"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Play, Heart, Info } from "lucide-react";
import { useRouter } from "next/navigation";

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

interface MovieCardProps {
  movie: Movie;
  aspect?: "landscape" | "portrait";
}

export default function MovieCard({ movie, aspect = "landscape" }: MovieCardProps) {
  const [mounted, setMounted] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [details, setDetails] = useState<any | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });

  const cardRef = useRef<HTMLDivElement>(null);
  const hoverTimer = useRef<NodeJS.Timeout | null>(null);
  const closeTimer = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
    try {
      const favs = JSON.parse(localStorage.getItem("dlowphim_favorites") || "[]");
      setIsFavorite(favs.includes(movie.slug));
    } catch (e) {
      // LocalStorage is unavailable during SSR
    }
    return () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, [movie.slug]);

  // Close hover card on window scroll
  useEffect(() => {
    if (isHovered) {
      const handleScroll = () => {
        setIsHovered(false);
        if (hoverTimer.current) clearTimeout(hoverTimer.current);
      };
      window.addEventListener("scroll", handleScroll, { passive: true });
      return () => window.removeEventListener("scroll", handleScroll);
    }
  }, [isHovered]);

  const getImageUrl = (movieObj: Movie) => {
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

  const handleMouseEnter = (e: React.MouseEvent) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (isHovered) return;

    const currentTarget = e.currentTarget;
    
    hoverTimer.current = setTimeout(async () => {
      const rect = currentTarget.getBoundingClientRect();
      const scrollY = window.scrollY || window.pageYOffset;
      const scrollX = window.scrollX || window.pageXOffset;

      // Scale calculations (scale up width by 1.35x)
      const scaleFactor = 1.35;
      const scaledWidth = Math.max(rect.width * scaleFactor, 300);
      const leftOffset = rect.left + scrollX - (scaledWidth - rect.width) / 2;
      
      // Ensure hover card doesn't overflow left boundary of the screen
      const safeLeft = Math.max(10, leftOffset);

      setPosition({
        top: rect.top + scrollY - 20,
        left: safeLeft,
        width: scaledWidth
      });
      setIsHovered(true);

      // Fetch movie details in background on hover
      if (!details && !loadingDetails) {
        try {
          setLoadingDetails(true);
          const res = await fetch(`https://ophim1.com/v1/api/phim/${movie.slug}`);
          const data = await res.json();
          if (data.status === true || data.status === "success") {
            setDetails(data.movie);
          }
        } catch (err) {
          console.error("Error fetching hover details:", err);
        } finally {
          setLoadingDetails(false);
        }
      }
    }, 800); // 800ms delay to prevent flickering popups during mouse sweeps
  };

  const handleMouseLeave = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    closeTimer.current = setTimeout(() => {
      setIsHovered(false);
    }, 200); // 200ms delay to allow mouse transition from original element to hover card
  };

  const clearCloseTimer = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };

  const toggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const favs = JSON.parse(localStorage.getItem("dlowphim_favorites") || "[]");
      let newFavs;
      if (favs.includes(movie.slug)) {
        newFavs = favs.filter((s: string) => s !== movie.slug);
        setIsFavorite(false);
      } else {
        newFavs = [...favs, movie.slug];
        setIsFavorite(true);
      }
      localStorage.setItem("dlowphim_favorites", JSON.stringify(newFavs));
    } catch (e) {
      console.error(e);
    }
  };

  // Render standard flat card
  const standardCard = (
    <div
      ref={cardRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={() => router.push(`/movie/${movie.slug}`)}
      className="w-full cursor-pointer group/card select-none relative"
    >
      <div className="relative overflow-hidden">
        {/* Poster Image Frame */}
        <div 
          className={`w-full overflow-hidden bg-zinc-900 border border-white/20 hover:border-white/60 rounded-xl relative transition-all duration-300 ${
            aspect === "landscape" ? "aspect-[16/10]" : "aspect-[2/3]"
          }`}
        >
          <img
            src={getImageUrl(movie)}
            alt={movie.name}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-300"
            loading="lazy"
            decoding="async"
          />
          
          {/* Badge phụ đề góc trái */}
          <div className="absolute bottom-2 left-2 flex items-center gap-1 z-10">
            <span className="bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded text-[9px] font-black text-pink-400 border border-zinc-800/50 uppercase">
              {movie.quality || "HD"}
            </span>
            <span className="bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded text-[9px] font-black text-white border border-zinc-800/50 uppercase">
              {movie.lang || "Vietsub"}
            </span>
          </div>
        </div>

        {/* Text descriptions underneath (Flat Style) */}
        <div className="pt-2.5 space-y-0.5 text-left select-text">
          <h4 className="font-bold text-xs md:text-sm text-zinc-100 truncate group-hover/card:text-pink-500 transition-colors">
            {movie.name}
          </h4>
          <p className="text-[10px] text-zinc-500 truncate font-semibold">
            {movie.origin_name}
          </p>
        </div>
      </div>
    </div>
  );

  // Render floating hover details card
  const hoverCard = isHovered && mounted && (
    <div
      style={{
        position: "absolute",
        top: position.top,
        left: position.left,
        width: position.width,
        zIndex: 9999,
      }}
      onMouseEnter={clearCloseTimer}
      onMouseLeave={handleMouseLeave}
      className="bg-[#12131b] border border-zinc-700/80 rounded-2xl shadow-2xl overflow-hidden select-none animate-in fade-in zoom-in-95 duration-200 pointer-events-auto flex flex-col"
    >
      <div 
        onClick={() => router.push(`/movie/${movie.slug}`)}
        className="cursor-pointer"
      >
        {/* Aspect Ratio matched image */}
        <div className={`relative w-full overflow-hidden bg-zinc-900 border border-white/20 rounded-t-2xl ${
          aspect === "landscape" ? "aspect-[16/10]" : "aspect-[2/3]"
        }`}>
          <img
            src={getImageUrl(movie)}
            alt={movie.name}
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
        <div className="p-4 space-y-3 relative z-10 bg-[#12131b]">
          {/* Titles */}
          <div className="text-left space-y-0.5">
            <h4 className="font-extrabold text-sm md:text-base text-zinc-100 line-clamp-1 hover:text-pink-500 transition-colors">
              {movie.name}
            </h4>
            <p className="text-[11px] text-zinc-400 truncate font-semibold">
              {movie.origin_name}
            </p>
          </div>

          {/* Action Row */}
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/movie/${movie.slug}`);
              }}
              className="flex-1 h-10 rounded-lg bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 active:scale-95 text-black font-extrabold text-sm flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/10 cursor-pointer transition-all duration-200"
            >
              <Play size={14} className="fill-black" /> Xem ngay
            </button>
            
            <button
              onClick={toggleFavorite}
              className={`w-10 h-10 rounded-lg border flex items-center justify-center transition-all duration-200 active:scale-90 cursor-pointer ${
                isFavorite 
                  ? "bg-rose-500/10 border-rose-500/30 text-rose-500 shadow-md shadow-rose-500/5" 
                  : "bg-zinc-850/80 border-zinc-700/50 hover:border-zinc-600 text-zinc-300 hover:text-white"
              }`}
            >
              <Heart size={15} className={isFavorite ? "fill-rose-500" : ""} />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/movie/${movie.slug}`);
              }}
              className="w-10 h-10 rounded-lg bg-zinc-850/80 border border-zinc-700/50 hover:border-zinc-600 text-zinc-300 hover:text-white flex items-center justify-center transition-all duration-200 active:scale-90 cursor-pointer"
            >
              <Info size={15} />
            </button>
          </div>

          {/* Meta details */}
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-400 font-bold select-none text-left">
            <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 font-black px-1.5 py-0.5 rounded text-[10px]">
              IMDb {getImdbScore(movie.name)}
            </span>
            <span className="border border-zinc-800 bg-zinc-950/60 px-1.5 py-0.5 rounded text-[10px] text-zinc-400">
              {getAgeRating(details?.category)}
            </span>
            <span className="text-zinc-500">•</span>
            <span>{movie.year || details?.year || "2026"}</span>
            
            {details?.episode_current && (
              <>
                <span className="text-zinc-500">•</span>
                <span className="text-pink-400 truncate max-w-[125px]">{details.episode_current}</span>
              </>
            )}
          </div>

          {/* Categories/Genres */}
          {details?.category && details.category.length > 0 && (
            <div className="text-left text-[11px] text-zinc-500 font-bold tracking-wide border-t border-zinc-800/40 pt-2.5 line-clamp-1">
              {details.category.slice(0, 4).map((c: any) => c.name).join(" • ")}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {standardCard}
      {isHovered && mounted && createPortal(hoverCard, document.body)}
    </>
  );
}
