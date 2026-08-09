"use client";

import React, { useEffect, useState, useRef } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

import Link from "next/link";
import MovieCard from "@/components/MovieCard";
import { cleanSlug } from "@/utils/movieUtils";
import { fetchMovieDiscovery } from "@/utils/movieDiscovery";

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

const MOVIE_ROW_PAGE_SIZE = 8;

export default function MovieRow({ title, accentText, countrySlug }: MovieRowProps) {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [sourceMode, setSourceMode] = useState<"fallback" | "stale" | null>(null);
  
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

  const getUniqueMovies = (items: Movie[]) => {
    const seen = new Set<string>();
    return items.filter((item) => {
      const baseSlug = cleanSlug(item.slug);
      if (seen.has(baseSlug)) {
        return false;
      }
      seen.add(baseSlug);
      return true;
    });
  };

  // 1. Initial fetch
  useEffect(() => {
    async function fetchMovies() {
      try {
        setLoading(true);
        const data = await fetchMovieDiscovery({ kind: "country", slug: countrySlug, page: 1, limit: MOVIE_ROW_PAGE_SIZE });
        if (data.status === true) {
          const items = data.items || [];
          setMovies(getUniqueMovies(items));
          setHasMore(items.length >= MOVIE_ROW_PAGE_SIZE);
          setSourceMode(data.stale?.used ? "stale" : data.fallback?.used ? "fallback" : null);
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
      const data = await fetchMovieDiscovery({ kind: "country", slug: countrySlug, page: nextPage, limit: MOVIE_ROW_PAGE_SIZE });
      if (data.status === true) {
        const items = data.items || [];
        if (items.length > 0) {
          setMovies((prev) => getUniqueMovies([...prev, ...items]));
          setPage(nextPage);
          setHasMore(items.length >= MOVIE_ROW_PAGE_SIZE);
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
      <div className="flex min-h-[170px] w-full flex-col items-start gap-3 border-t border-zinc-800/40 py-5 first:mt-0 first:border-t-0 first:pt-1 md:min-h-[200px] md:flex-row md:items-center md:gap-6 md:py-6">
        <div className="w-full md:w-[180px] shrink-0 text-left space-y-2">
          <div className="h-6 w-28 bg-zinc-800 rounded animate-pulse" />
          <div className="h-4 w-20 bg-zinc-800/60 rounded animate-pulse" />
        </div>
        <div className="flex w-full flex-grow gap-3 overflow-hidden sm:gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="aspect-[16/10] w-[calc((100vw-100px)/2)] min-w-[138px] max-w-[190px] shrink-0 animate-pulse rounded-xl border border-zinc-800/80 bg-zinc-900 md:w-[220px] md:max-w-none" />
          ))}
        </div>
      </div>
    );
  }

  if (movies.length === 0) return null;

  return (
    <div className="relative flex w-full select-none flex-col items-start gap-3 border-t border-zinc-800/40 py-5 first:mt-0 first:border-t-0 first:pt-1 md:flex-row md:gap-6 md:py-6">
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
      <div className="flex w-full shrink-0 items-center justify-between md:w-[180px] md:flex-col md:items-start md:justify-start md:gap-3 md:pt-2">
        <div className="text-left select-none">
          <h3 className="flex flex-wrap gap-x-1.5 text-[21px] font-black uppercase leading-none tracking-[-0.035em] text-zinc-100 sm:text-[22px] md:flex-col md:gap-x-0 md:text-2xl">
            <span>{prefix}</span>
            <span className={getGradientStyle(countrySlug)}>{accentText}</span>
            <span>{suffix}</span>
          </h3>
          {sourceMode && <span className={`mt-2 inline-flex rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-wider ${sourceMode === "stale" ? "border-sky-500/20 bg-sky-500/10 text-sky-400" : "border-amber-500/20 bg-amber-500/10 text-amber-400"}`}>{sourceMode === "stale" ? "Dữ liệu gần nhất" : "Máy chủ dự phòng"}</span>}
        </div>
        <Link 
          href={`/quoc-gia/${countrySlug}`}
          className="shrink-0 text-[11px] font-black uppercase tracking-[0.04em] text-zinc-500 transition-colors duration-200 hover:text-pink-500 sm:text-xs md:mt-2"
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
            className="absolute left-2 top-[35%] z-20 hidden h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white/95 text-black shadow-lg transition-all duration-200 hover:scale-110 active:scale-95 md:flex"
            aria-label={`Cuộn ${title} sang trái`}
          >
            <ChevronLeft size={18} className="stroke-[2.5]" />
          </button>
        )}

        {/* Nút cuộn phải */}
        {movies.length > 3 && (
          <button
            onClick={() => scroll("right")}
            className="absolute right-2 top-[35%] z-20 hidden h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white/95 text-black shadow-lg transition-all duration-200 hover:scale-110 active:scale-95 md:flex"
            aria-label={`Cuộn ${title} sang phải`}
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
          className="no-scrollbar flex w-full snap-x snap-mandatory gap-3 overflow-x-auto pb-1 scroll-smooth sm:gap-4 sm:pb-2 md:snap-none"
        >
          {movies.map((movie) => (
            <div
              key={movie._id}
              className="w-[calc((100vw-100px)/2)] min-w-[138px] max-w-[190px] shrink-0 snap-start md:w-[220px] md:max-w-none"
            >
              <MovieCard movie={movie} aspect="landscape" variant="country-row" />
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
