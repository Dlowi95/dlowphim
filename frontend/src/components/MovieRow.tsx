"use client";

import React, { useEffect, useState, useRef } from "react";
import { ChevronLeft, ChevronRight, Play, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

import Link from "next/link";
import MovieCard from "@/components/MovieCard";

interface Movie {
  _id: string;
  name: string;
  slug: string;
  origin_name: string;
  poster_url?: string;
  thumb_url?: string;
  year?: number;
}

interface MovieRowProps {
  title: string;
  accentText: string;
  countrySlug: string;
}

export default function MovieRow({ title, accentText, countrySlug }: MovieRowProps) {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Helper to format title (splitting into Prefix, Accent, Suffix)
  // e.g. "Phim Hàn Quốc mới" with accentText "Hàn Quốc"
  const getFormattedTitle = () => {
    const parts = title.split(accentText);
    const prefix = parts[0] || "";
    const suffix = parts[1] || "";
    return { prefix, suffix };
  };

  const { prefix, suffix } = getFormattedTitle();

  const getGradientStyle = (slug: string) => {
    switch (slug) {
      case "han-quoc":
        return "bg-gradient-to-r from-pink-400 via-rose-500 to-pink-500 bg-clip-text text-transparent";
      case "viet-nam":
        return "bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-500 bg-clip-text text-transparent";
      case "au-my":
        return "bg-gradient-to-r from-purple-400 via-indigo-500 to-blue-500 bg-clip-text text-transparent";
      default:
        return "bg-gradient-to-r from-pink-500 to-rose-500 bg-clip-text text-transparent";
    }
  };

  const getImageUrl = (movie: Movie) => {
    const path = movie.poster_url || movie.thumb_url;
    if (!path) return "";
    const fileName = path.split("/").pop();
    return `https://img.ophim.live/uploads/movies/${fileName}`;
  };

  // 1. Initial fetch
  useEffect(() => {
    async function fetchMovies() {
      try {
        setLoading(true);
        const res = await fetch(`https://ophim1.com/v1/api/quoc-gia/${countrySlug}?page=1`);
        const data = await res.json();
        if (data.status === "success" || data.status === true) {
          const items = data.data?.items || data.items || [];
          setMovies(items);
          setHasMore(items.length > 0);
        }
      } catch (err) {
        console.error(`Error fetching movies for country ${countrySlug}:`, err);
      } finally {
        setLoading(false);
      }
    }
    fetchMovies();
  }, [countrySlug]);

  // 2. Fetch more movies for infinite scroll
  const loadMoreMovies = async () => {
    if (loadingMore || !hasMore) return;
    try {
      setLoadingMore(true);
      const nextPage = page + 1;
      const res = await fetch(`https://ophim1.com/v1/api/quoc-gia/${countrySlug}?page=${nextPage}`);
      const data = await res.json();
      if (data.status === "success" || data.status === true) {
        const items = data.data?.items || data.items || [];
        if (items.length > 0) {
          setMovies((prev) => [...prev, ...items]);
          setPage(nextPage);
        } else {
          setHasMore(false);
        }
      }
    } catch (err) {
      console.error(`Error loading more movies for ${countrySlug}:`, err);
    } finally {
      setLoadingMore(false);
    }
  };

  // 3. Scroll handlers
  const scroll = (direction: "left" | "right") => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollAmount = container.clientWidth * 0.75;
    const newScrollLeft = direction === "left" 
      ? container.scrollLeft - scrollAmount 
      : container.scrollLeft + scrollAmount;

    container.scrollTo({
      left: newScrollLeft,
      behavior: "smooth"
    });
  };

  const handleScrollEvent = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    setShowLeftArrow(target.scrollLeft > 20);

    // Infinite scroll check: if user scrolls close to the end, load more
    const isNearEnd = target.scrollLeft + target.clientWidth >= target.scrollWidth - 600;
    if (isNearEnd && !loadingMore && hasMore) {
      loadMoreMovies();
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col md:flex-row gap-6 items-center py-6 border-t border-zinc-800/40 first:border-t-0 first:pt-2 first:mt-0 min-h-[200px] w-full">
        <div className="w-full md:w-[180px] shrink-0 text-left space-y-2">
          <div className="h-6 w-28 bg-zinc-800 rounded animate-pulse" />
          <div className="h-4 w-20 bg-zinc-800/60 rounded animate-pulse" />
        </div>
        <div className="flex-grow flex gap-4 overflow-hidden w-full">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="w-[220px] aspect-[16/10] shrink-0 bg-zinc-900 border border-zinc-800/80 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (movies.length === 0) return null;

  return (
    <div className="relative flex flex-col md:flex-row gap-6 py-6 border-t border-zinc-800/40 first:border-t-0 first:pt-2 first:mt-0 items-start select-none w-full">
      <style>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      {/* CỘT TRÁI: TIÊU ĐỀ HÀNH LANG (DỌC TRÊN PC, NGANG TRÊN MB) */}
      <div className="w-full md:w-[180px] shrink-0 flex md:flex-col justify-between md:justify-start items-center md:items-start md:gap-3 md:pt-2">
        <div className="text-left select-none">
          <h3 className="text-xl md:text-2xl font-black tracking-tight leading-tight uppercase flex flex-wrap gap-x-1.5 md:flex-col md:gap-x-0">
            <span>{prefix}</span>
            <span className={getGradientStyle(countrySlug)}>{accentText}</span>
            <span>{suffix}</span>
          </h3>
        </div>
        <Link 
          href={`/search?country=${countrySlug}`}
          className="text-xs font-bold text-zinc-500 hover:text-pink-500 transition-colors duration-200 uppercase tracking-wider md:mt-2"
        >
          Xem toàn bộ &gt;
        </Link>
      </div>

      {/* CỘT PHẢI: CAROUSEL CHUYÊN NGHIỆP CUỘN VÔ TẬN */}
      <div className="relative flex-grow w-full overflow-hidden group">
        
        {/* Nút cuộn trái */}
        {showLeftArrow && (
          <button
            onClick={() => scroll("left")}
            className="absolute left-2 top-[35%] -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white/95 text-black flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-all duration-200 cursor-pointer"
          >
            <ChevronLeft size={18} className="stroke-[2.5]" />
          </button>
        )}

        {/* Nút cuộn phải */}
        {movies.length > 3 && (
          <button
            onClick={() => scroll("right")}
            className="absolute right-2 top-[35%] -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white/95 text-black flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-all duration-200 cursor-pointer"
          >
            {loadingMore ? (
              <Loader2 className="animate-spin text-black" size={14} />
            ) : (
              <ChevronRight size={18} className="stroke-[2.5]" />
            )}
          </button>
        )}

        {/* Danh sách cuộn */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScrollEvent}
          className="flex gap-4 overflow-x-auto no-scrollbar scroll-smooth w-full pb-2"
        >
          {movies.map((movie) => (
            <div
              key={movie._id}
              className="w-[200px] md:w-[220px] shrink-0"
            >
              <MovieCard movie={movie} aspect="landscape" />
            </div>
          ))}
          
          {/* Spinner ở cuối khi đang tải thêm */}
          {loadingMore && (
            <div className="w-[100px] shrink-0 flex items-center justify-center aspect-[16/10] bg-zinc-900/20 rounded-xl border border-zinc-800/40">
              <Loader2 className="animate-spin text-pink-500" size={24} />
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
