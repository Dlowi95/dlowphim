"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronRight, RefreshCw } from "lucide-react";
import { cleanMovieName, cleanSlug, getImageUrl } from "@/utils/movieUtils";
import ProgressiveImage from "@/components/ProgressiveImage";

interface Movie {
  _id: string;
  name: string;
  slug: string;
  origin_name: string;
  poster_url?: string;
  thumb_url?: string;
  release_date?: string;
  year?: number;
  availability?: {
    status: "available" | "unavailable";
    label: string;
    source?: "phimapi" | "ophim";
    resolvedSlug?: string;
  };
}

export default function UpcomingRow() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const router = useRouter();

  // Drag-to-scroll state refs
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const wasDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);

  useEffect(() => {
    let disposed = false;
    let activeController: AbortController | null = null;
    const cacheKey = "dlowphim_upcoming_v1";
    let hasCachedMovies = false;

    try {
      const cached = JSON.parse(sessionStorage.getItem(cacheKey) || "null");
      if (cached?.savedAt > Date.now() - 6 * 60 * 60 * 1000 && Array.isArray(cached.items) && cached.items.length > 0) {
        hasCachedMovies = true;
        setMovies(cached.items);
        setLoading(false);
      }
    } catch {
      sessionStorage.removeItem(cacheKey);
    }

    async function fetchUpcoming() {
      if (!hasCachedMovies) setLoading(true);
      setLoadError(false);
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
      let lastError: unknown = null;

      for (let attempt = 0; attempt < 3 && !disposed; attempt += 1) {
        activeController = new AbortController();
        const timeout = window.setTimeout(() => activeController?.abort(), 8000 + attempt * 2000);
        try {
          const res = await fetch(`${API_URL}/movies/upcoming?page=1`, { signal: activeController.signal });
          if (!res.ok) throw new Error(`Upcoming API ${res.status}`);
          const data = await res.json();
          const seen = new Set<string>();
          const uniqueItems = (data.items || []).filter((item: any) => {
            const baseSlug = cleanSlug(item.slug);
            if (seen.has(baseSlug)) return false;
            seen.add(baseSlug);
            return true;
          }).slice(0, 10);
          if (uniqueItems.length === 0) throw new Error("Upcoming API không có dữ liệu");
          if (!disposed) {
            setMovies(uniqueItems);
            sessionStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), items: uniqueItems }));
            setLoadError(false);
          }
          return;
        } catch (error: any) {
          lastError = error;
          if (disposed) return;
          if (attempt < 2) await new Promise((resolve) => window.setTimeout(resolve, 700 * (attempt + 1)));
        } finally {
          window.clearTimeout(timeout);
        }
      }

      if (!disposed && !hasCachedMovies) {
        console.error("Lỗi lấy danh sách phim sắp chiếu:", lastError);
        setMovies([]);
        setLoadError(true);
      }
    }

    void fetchUpcoming().finally(() => {
      if (!disposed) setLoading(false);
    });
    return () => {
      disposed = true;
      activeController?.abort();
    };
  }, [reloadKey]);

  // Mouse Drag-to-scroll Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    isDraggingRef.current = true;
    wasDraggingRef.current = false;
    setIsDragging(true);
    startXRef.current = e.pageX - container.offsetLeft;
    scrollLeftRef.current = container.scrollLeft;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    e.preventDefault();
    const container = scrollContainerRef.current;
    if (!container) return;
    const x = e.pageX - container.offsetLeft;
    const walk = (x - startXRef.current) * 1.5; // scrolling multiplier speed
    if (Math.abs(walk) > 5) {
      wasDraggingRef.current = true;
    }
    container.scrollLeft = scrollLeftRef.current - walk;
  };

  const handleMouseUpOrLeave = () => {
    isDraggingRef.current = false;
    setIsDragging(false);
    // Delay resetting wasDragging to prevent immediate click navigation trigger
    setTimeout(() => {
      wasDraggingRef.current = false;
    }, 50);
  };

  if (loading) {
    return (
      <div className="container mx-auto mt-10 max-w-7xl select-none px-4 text-left sm:mt-12 sm:px-6">
        <div className="mb-4 h-6 w-48 animate-pulse rounded bg-zinc-800 sm:mb-6 sm:w-52" />
        <div className="flex gap-3 overflow-hidden pb-4 sm:gap-6 sm:pb-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="aspect-[16/10] w-[calc((100%_-_0.75rem)/2)] shrink-0 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900 sm:w-[280px] sm:rounded-2xl md:w-[360px]"
            />
          ))}
        </div>
      </div>
    );
  }

  if (movies.length === 0 && !loadError) return null;

  return (
    <section className="container mx-auto mt-10 max-w-7xl select-none px-4 text-left sm:mt-12 sm:px-6" aria-labelledby="upcoming-title">
      {/* Tiêu đề & Nút Xem thêm */}
      <div className="mb-4 flex items-center gap-2 sm:mb-6">
        <h3 id="upcoming-title" className="text-[22px] font-black uppercase tracking-tight text-zinc-100 md:text-2xl">
          Phim Sắp Chiếu
        </h3>
        
        {/* Custom tooltip arrow */}
        <div className="relative group/tooltip">
          <Link
            href="/search?type=phim-sap-chieu"
            aria-label="Xem tất cả phim sắp chiếu"
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-zinc-800 bg-zinc-900/60 transition-all duration-300 hover:border-pink-500 hover:text-pink-500 active:scale-95 sm:h-8 sm:w-8"
          >
            <ChevronRight size={16} className="ml-0.5" />
          </Link>
          <div className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-[10px] font-bold text-zinc-100 opacity-0 shadow-xl transition-opacity duration-200 group-hover/tooltip:opacity-100 sm:block">
            Xem thêm
          </div>
        </div>
      </div>

      {loadError ? (
        <div className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-2xl border border-zinc-800/70 bg-zinc-950/60 text-center">
          <p className="text-sm font-bold text-zinc-400">Chưa tải được lịch phim sắp chiếu</p>
          <button
            onClick={() => setReloadKey((value) => value + 1)}
            className="flex items-center gap-2 rounded-xl border border-pink-500/30 bg-pink-500/10 px-4 py-2 text-xs font-black text-pink-400 hover:bg-pink-500/20"
          >
            <RefreshCw size={14} /> Thử lại
          </button>
        </div>
      ) : (
      <div
        ref={scrollContainerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
        className={`no-scrollbar flex w-full snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto pb-4 select-none sm:gap-6 sm:pb-6 md:snap-none md:scroll-px-0 ${
          isDragging ? "cursor-grabbing" : "cursor-grab"
        }`}
        style={{
          msOverflowStyle: "none",
          scrollbarWidth: "none"
        }}
      >
        {movies.map((movie) => (
          <UpcomingMovieCard
            key={movie._id || movie.slug}
            movie={movie}
            wasDraggingRef={wasDraggingRef}
            router={router}
          />
        ))}
      </div>
      )}
    </section>
  );
}

function UpcomingMovieCard({ movie, wasDraggingRef, router }: { movie: Movie; wasDraggingRef: React.MutableRefObject<boolean>; router: any }) {
  const cleanedName = cleanMovieName(movie.name);
  const cleanedOrigin = cleanMovieName(movie.origin_name);
  const cardWidthClass = "w-[calc((100%_-_0.75rem)/2)] sm:w-[280px] md:w-[360px] shrink-0";

  const getUpcomingImageUrl = (movieObj: Movie) => {
    const path = movieObj.poster_url || movieObj.thumb_url;
    return getImageUrl(path);
  };

  const [imgSrc, setImgSrc] = useState<string>(() => getUpcomingImageUrl(movie));
  const [attemptCount, setAttemptCount] = useState(0);

  useEffect(() => {
    setImgSrc(getUpcomingImageUrl(movie));
    setAttemptCount(0);
  }, [movie.slug, movie.poster_url, movie.thumb_url]);

  const handleImgError = () => {
    if (attemptCount === 0 && movie.thumb_url && movie.poster_url && movie.thumb_url !== movie.poster_url) {
      setAttemptCount(1);
      setImgSrc(getImageUrl(movie.thumb_url));
      return;
    }

    if (attemptCount < 2) {
      setAttemptCount(2);
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
      fetch(`${API_URL}/movies/logo/${movie.slug}?title=${encodeURIComponent(movie.origin_name || movie.name)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && (data.backdropUrl || data.posterUrl)) {
            setImgSrc(data.backdropUrl || data.posterUrl);
          } else {
            setImgSrc("https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&q=80");
          }
        })
        .catch(() => {
          setImgSrc("https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&q=80");
        });
    }
  };

  const handleCardClick = () => {
    if (wasDraggingRef.current) return;
    router.push(`/movie/${movie.availability?.resolvedSlug || movie.slug}`);
  };

  const releaseDate = movie.release_date ? new Date(`${movie.release_date}T00:00:00+07:00`) : null;
  const releaseDays = releaseDate ? Math.ceil((releaseDate.getTime() - Date.now()) / 86_400_000) : null;
  const formattedReleaseDate = releaseDate
    ? releaseDate.toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "";
  const releaseLabel = releaseDays === 0
    ? "Khởi chiếu hôm nay"
    : releaseDays !== null && releaseDays > 0
      ? `Còn ${releaseDays} ngày • ${formattedReleaseDate}`
      : formattedReleaseDate || (movie.year ? `Dự kiến ${movie.year}` : "Đang cập nhật");
  const isAvailable = movie.availability?.status === "available";

  return (
    <div
      onClick={handleCardClick}
      className={`${cardWidthClass} group/upcoming flex snap-start cursor-pointer flex-col gap-2.5 sm:gap-3`}
    >
      <div 
        className="relative aspect-[16/10] w-full overflow-hidden rounded-xl border border-zinc-800/60 bg-zinc-900 transition-all duration-300 ease-out sm:rounded-2xl"
        style={{
          WebkitMaskImage: "-webkit-radial-gradient(white, black)",
          maskImage: "radial-gradient(white, black)"
        }}
      >
        <ProgressiveImage
          src={imgSrc}
          alt={cleanedName}
          onError={handleImgError}
          referrerPolicy="no-referrer"
          className="h-full w-full rounded-xl object-cover transition-transform duration-500 group-hover/upcoming:scale-105 sm:rounded-2xl"
        />
        {!isAvailable && (
          <div className="absolute right-1.5 top-1.5 max-w-[78%] truncate rounded-full border border-white/10 bg-black/65 px-1.5 py-0.5 text-[7px] font-black uppercase tracking-wide text-zinc-200 backdrop-blur-md min-[390px]:right-2 min-[390px]:top-2 min-[390px]:px-2 min-[390px]:py-1 min-[390px]:text-[8px] sm:right-3 sm:top-3 sm:px-2.5 sm:text-[9px]">
            Chưa có bản xem
          </div>
        )}
        <div className={`absolute bottom-1.5 left-1.5 flex max-w-[calc(100%_-_0.75rem)] items-center gap-1 overflow-hidden whitespace-nowrap rounded px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-normal text-zinc-950 shadow-md min-[390px]:bottom-2 min-[390px]:left-2 min-[390px]:max-w-[calc(100%_-_1rem)] min-[390px]:px-2 min-[390px]:py-1 min-[390px]:text-[9px] sm:bottom-3 sm:left-3 sm:max-w-[calc(100%_-_1.5rem)] sm:gap-1.5 sm:text-[10px] sm:tracking-wide ${isAvailable ? "bg-emerald-400" : "bg-amber-400"}`}>
          <CalendarDays size={10} className="shrink-0 sm:h-[11px] sm:w-[11px]" />
          <span className="truncate sm:hidden">
            {isAvailable ? "Đã có bản" : formattedReleaseDate || (movie.year ? `Dự kiến ${movie.year}` : "Sắp chiếu")}
          </span>
          <span className="hidden truncate sm:inline">
            {isAvailable ? "Đã có bản phát" : releaseLabel}
          </span>
        </div>
      </div>
      <div className="px-1 text-left">
        <h4 className="truncate text-[13px] font-extrabold leading-5 text-zinc-100 transition-colors group-hover/upcoming:text-pink-500 min-[375px]:text-sm md:text-base">
          {cleanedName}
        </h4>
        <p className="mt-0.5 truncate text-[11px] font-bold leading-4 text-zinc-500 min-[375px]:text-xs">
          {cleanedOrigin}
        </p>
      </div>
    </div>
  );
}
