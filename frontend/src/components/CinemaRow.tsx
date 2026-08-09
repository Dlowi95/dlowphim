"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { cleanMovieName, cleanSlug, getImageUrl } from "@/utils/movieUtils";
import MovieHoverPopup from "./MovieHoverPopup";
import MovieQualityBadge from "./MovieQualityBadge";
import { getProxyUrl, MOVIE_API_DOMAIN } from "@/utils/api";
import { fetchMovieDiscovery } from "@/utils/movieDiscovery";

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
  category?: any[];
  time?: string;
  tmdb?: {
    vote_count?: number;
    vote_average?: number;
  };
}

const FALLBACK_CINEMA: Movie[] = [
  {
    _id: "cinema-1",
    name: "Kẻ Cắp Mặt Trăng 4: Sự Trỗi Dậy Của Gru",
    slug: "ke-cap-mat-trang-4-su-troi-day-cua-gru",
    origin_name: "Minions: The Rise Of Gru",
    poster_url: "ke-cap-mat-trang-4-su-troi-day-cua-gru-poster.jpg",
    thumb_url: "ke-cap-mat-trang-4-su-troi-day-cua-gru-thumb.jpg",
    year: 2022,
    quality: "4K",
    lang: "Vietsub",
    time: "1h 28m",
  },
  {
    _id: "cinema-2",
    name: "Panor: Tà Thuật Huyết Ngải",
    slug: "panor-ta-thuat-huyet-ngai",
    origin_name: "Panor",
    poster_url: "panor-ta-thuat-huyet-ngai-poster.jpg",
    thumb_url: "panor-ta-thuat-huyet-ngai-thumb.jpg",
    year: 2025,
    quality: "HD",
    lang: "Vietsub",
    time: "2h 5m",
  },
  {
    _id: "cinema-3",
    name: "Ẩm Mưu Của Quỷ",
    slug: "am-muu-cua-quy",
    origin_name: "The Devil Conspiracy",
    poster_url: "am-muu-cua-quy-poster.jpg",
    thumb_url: "am-muu-cua-quy-thumb.jpg",
    year: 2023,
    quality: "FHD",
    lang: "Vietsub",
    time: "1h 51m",
  }
];

const getAgeRating = (name: string, categories: any[] = []) => {
  const slugs = categories.map((c: any) => c.slug);
  if (slugs.some(s => ["kinh-di", "toi-pham", "18"].includes(s))) return "T18";
  if (slugs.some(s => ["hanh-dong", "hinh-su", "giat-gan", "tam-ly"].includes(s))) return "T16";
  if (slugs.some(s => ["vien-tuong", "phieu-luu", "co-trang", "than-thoai"].includes(s))) return "T13";
  if (name.length % 5 === 0) return "T18";
  if (name.length % 3 === 0) return "T16";
  if (name.length % 2 === 0) return "T13";
  return "P";
};

export default function CinemaRow() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);

  // Drag-to-scroll state refs
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const wasDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);

  useEffect(() => {
    async function fetchCinema() {
      try {
        setLoading(true);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout
        const data = await fetchMovieDiscovery(
          { kind: "list", slug: "phim-chieu-rap", page: 1, limit: 12 },
          { signal: controller.signal, timeoutMs: 6000 },
        );
        clearTimeout(timeoutId);
        if (data.status === true) {
          const items = data.items || [];
          if (items.length > 0) {
            // Deduplicate base slug
            const seen = new Set<string>();
            const uniqueItems = items.filter((item: any) => {
              // 1. Loại bỏ phim sắp chiếu / chỉ có trailer
              const epCurrent = (item.episode_current || "").toLowerCase().trim();
              const isTrailerOnly = epCurrent.includes("trailer") || !item.last_episodes || item.last_episodes.length === 0;
              if (isTrailerOnly) return false;

              // 2. Deduplicate base slug
              const baseSlug = cleanSlug(item.slug);
              if (seen.has(baseSlug)) return false;
              seen.add(baseSlug);
              return true;
            });

            setMovies(uniqueItems.slice(0, 10));
          } else {
            setMovies(FALLBACK_CINEMA);
          }
        } else {
          setMovies(FALLBACK_CINEMA);
        }
      } catch (err) {
        console.error("Lỗi lấy danh sách phim chiếu rạp, chuyển sang dự phòng:", err);
        setMovies(FALLBACK_CINEMA);
      } finally {
        setLoading(false);
      }
    }

    fetchCinema();
  }, []);

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
    const walk = (x - startXRef.current) * 1.5; // scrolling speed
    if (Math.abs(walk) > 5) {
      wasDraggingRef.current = true;
    }
    container.scrollLeft = scrollLeftRef.current - walk;
  };

  const handleMouseUpOrLeave = () => {
    isDraggingRef.current = false;
    setIsDragging(false);
    setTimeout(() => {
      wasDraggingRef.current = false;
    }, 50);
  };

  if (loading) {
    return (
      <div className="container mx-auto mt-10 max-w-7xl select-none px-4 text-left sm:mt-12 sm:px-6">
        <div className="mb-4 h-6 w-56 animate-pulse rounded bg-zinc-800 sm:mb-6" />
        <div className="flex gap-3 overflow-hidden pb-5 sm:gap-6 sm:pb-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="aspect-[16/9] w-[calc((100%_-_0.75rem)/2)] shrink-0 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900 sm:w-[280px] sm:rounded-2xl md:w-[350px]"
            />
          ))}
        </div>
      </div>
    );
  }

  if (movies.length === 0) return null;

  return (
    <section className="container mx-auto mt-10 max-w-7xl select-none px-4 text-left sm:mt-12 sm:px-6">
      {/* Tiêu đề & Nút Xem thêm */}
      <div className="mb-4 flex items-center gap-2 sm:mb-6">
        <h3 className="text-[20px] font-black uppercase leading-tight tracking-tight text-zinc-100 min-[390px]:text-[22px] md:text-2xl">
          Mãn Nhãn với Phim Chiếu Rạp
        </h3>
        
        {/* Custom tooltip arrow */}
        <div className="relative group/tooltip">
          <Link
            href="/the-loai/phim-chieu-rap"
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-zinc-800 bg-zinc-900/60 transition-all duration-300 hover:border-pink-500 hover:text-pink-500 active:scale-95 sm:h-8 sm:w-8"
            aria-label="Xem tất cả phim chiếu rạp"
          >
            <ChevronRight size={16} className="ml-0.5" />
          </Link>
          <div className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-[10px] font-bold text-zinc-100 opacity-0 shadow-xl transition-opacity duration-200 group-hover/tooltip:opacity-100 sm:block">
            Xem thêm
          </div>
        </div>
      </div>

      {/* Drag-to-scroll Container */}
      <div
        ref={scrollContainerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
        className={`no-scrollbar flex w-full snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto pb-6 select-none sm:gap-6 sm:pb-8 ${
          isDragging ? "cursor-grabbing" : "cursor-grab"
        }`}
        style={{
          msOverflowStyle: "none",
          scrollbarWidth: "none"
        }}
      >
        {movies.map((movie) => (
          <CinemaMovieCard
            key={movie._id || movie.slug}
            movie={movie}
            wasDraggingRef={wasDraggingRef}
          />
        ))}
      </div>
    </section>
  );
}

interface CinemaMovieCardProps {
  movie: Movie;
  wasDraggingRef: React.MutableRefObject<boolean>;
}

function CinemaMovieCard({ movie, wasDraggingRef }: CinemaMovieCardProps) {
  const [mounted, setMounted] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });

  const cardRef = useRef<HTMLDivElement>(null);
  const hoverTimer = useRef<NodeJS.Timeout | null>(null);
  const closeTimer = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  const cleanedName = cleanMovieName(movie.name);
  const cleanedOriginName = cleanMovieName(movie.origin_name);
  const ageRating = getAgeRating(movie.name, movie.category);

  const initialBannerUrl = getImageUrl(movie.poster_url || movie.thumb_url);
  const initialThumbUrl = getImageUrl(movie.thumb_url || movie.poster_url);

  const [bannerImgSrc, setBannerImgSrc] = useState<string>(initialBannerUrl);
  const [thumbImgSrc, setThumbImgSrc] = useState<string>(initialThumbUrl);

  const [bannerAttempt, setBannerAttempt] = useState(0);
  const [thumbAttempt, setThumbAttempt] = useState(0);

  useEffect(() => {
    setBannerImgSrc(getImageUrl(movie.poster_url || movie.thumb_url));
    setThumbImgSrc(getImageUrl(movie.thumb_url || movie.poster_url));
    setBannerAttempt(0);
    setThumbAttempt(0);
  }, [movie.slug, movie.poster_url, movie.thumb_url]);

  const handleBannerImgError = () => {
    if (bannerAttempt === 0 && movie.thumb_url && movie.poster_url && movie.thumb_url !== movie.poster_url) {
      setBannerAttempt(1);
      setBannerImgSrc(getImageUrl(movie.thumb_url));
      return;
    }

    if (bannerAttempt < 2) {
      setBannerAttempt(2);
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
      fetch(`${API_URL}/movies/logo/${movie.slug}?title=${encodeURIComponent(movie.origin_name || movie.name)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && (data.backdropUrl || data.posterUrl)) {
            setBannerImgSrc(data.backdropUrl || data.posterUrl);
          } else {
            setBannerImgSrc("https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&q=80");
          }
        })
        .catch(() => {
          setBannerImgSrc("https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&q=80");
        });
    }
  };

  const handleThumbImgError = () => {
    if (thumbAttempt === 0 && movie.poster_url && movie.thumb_url && movie.poster_url !== movie.thumb_url) {
      setThumbAttempt(1);
      setThumbImgSrc(getImageUrl(movie.poster_url));
      return;
    }

    if (thumbAttempt < 2) {
      setThumbAttempt(2);
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
      fetch(`${API_URL}/movies/logo/${movie.slug}?title=${encodeURIComponent(movie.origin_name || movie.name)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && (data.posterUrl || data.backdropUrl)) {
            setThumbImgSrc(data.posterUrl || data.backdropUrl);
          } else {
            setThumbImgSrc("https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&q=80");
          }
        })
        .catch(() => {
          setThumbImgSrc("https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&q=80");
        });
    }
  };

  const handleMouseEnter = (e: React.MouseEvent) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    
    // Immediately mount the popup (so it pre-fetches API details)
    setShowPopup(true);

    if (isHovered) return;

    const currentTarget = e.currentTarget;
    
    // Standard 800ms hover delay
    hoverTimer.current = setTimeout(() => {
      const rect = currentTarget.getBoundingClientRect();
      const scrollY = window.scrollY || window.pageYOffset;
      const scrollX = window.scrollX || window.pageXOffset;

      const scaleFactor = 1.25;
      const scaledWidth = Math.min(Math.max(rect.width * scaleFactor, 300), 380);
      const leftOffset = rect.left + scrollX - (scaledWidth - rect.width) / 2;
      
      const windowWidth = typeof window !== "undefined" ? window.innerWidth : 1200;
      const rightEdge = leftOffset + scaledWidth;
      let finalLeft = Math.max(10, leftOffset);
      
      if (rightEdge > windowWidth - 15) {
        finalLeft = Math.max(10, windowWidth - scaledWidth - 15);
      }

      setPosition({
        top: rect.top + scrollY - 30,
        left: finalLeft,
        width: scaledWidth
      });
      setIsHovered(true);
    }, 800);
  };

  const handleMouseLeave = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    closeTimer.current = setTimeout(() => {
      setIsHovered(false);
      setShowPopup(false);
    }, 200);
  };

  const clearCloseTimer = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };

  const handleClick = () => {
    if (wasDraggingRef.current) return;
    router.push(`/movie/${movie.slug}`);
  };

  const cardWidthClass =
    "w-[calc((100%_-_0.75rem)/2)] min-w-0 shrink-0 sm:w-[280px] md:w-[350px]";
  const zIndexStyle = isHovered ? 999 : 10;

  // Custom movie length display or default
  const durationText = movie.time && !movie.time.includes("phút") ? movie.time : "1h 45m";

  return (
    <div
      ref={cardRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      className={`${cardWidthClass} group/cinema relative flex snap-start cursor-pointer select-none flex-col`}
      style={{ zIndex: zIndexStyle }}
    >
      <div className="relative flex flex-col w-full h-full">
        {/* Landscape backdrop banner (16:9 ratio) */}
        <div 
          className="relative aspect-[16/9] w-full origin-center overflow-hidden rounded-xl border border-zinc-800/40 bg-zinc-900 shadow-lg transition-all duration-300 ease-out group-hover/cinema:border-pink-500/40 sm:rounded-2xl"
          style={{
            WebkitMaskImage: "-webkit-radial-gradient(white, black)",
            maskImage: "radial-gradient(white, black)"
          }}
        >
          {/* OPhim poster_url is the horizontal landscape backdrop */}
          <img
            src={bannerImgSrc}
            alt={cleanedName}
            onError={handleBannerImgError}
            referrerPolicy="no-referrer"
            className="h-full w-full rounded-xl object-cover transition-transform duration-500 sm:rounded-2xl"
            loading="lazy"
            decoding="async"
          />


          {/* Shared HD/FHD/4K quality badge */}
          <MovieQualityBadge
            quality={movie.quality}
            className="absolute right-1.5 top-1.5 z-10 text-[8px] sm:right-2 sm:top-2 sm:px-2 sm:text-[9px]"
          />
        </div>

        {/* Info row underneath with small overlapping vertical poster */}
        <div className="relative flex w-full items-start gap-2 px-0.5 pt-2 sm:gap-3 sm:px-1.5 sm:pt-3">
          {/* Small vertical poster overlapping bottom-left of landscape banner */}
          <div 
            className="relative z-20 -mt-5 aspect-[2/3] w-10 shrink-0 overflow-hidden rounded-md border border-zinc-800 bg-zinc-900 shadow-lg transition-transform duration-300 min-[390px]:-mt-6 min-[390px]:w-11 sm:-mt-8 sm:w-14 sm:rounded-lg sm:border-2 md:-mt-10 md:w-16"
            style={{
              WebkitMaskImage: "-webkit-radial-gradient(white, black)",
              maskImage: "radial-gradient(white, black)"
            }}
          >
            {/* OPhim thumb_url is the vertical portrait poster */}
            <img
              src={thumbImgSrc}
              alt={cleanedName}
              onError={handleThumbImgError}
              referrerPolicy="no-referrer"
              className="h-full w-full rounded-md object-cover sm:rounded-lg"
              loading="lazy"
              decoding="async"
            />
            {/* Small badge inside vertical poster bottom */}
            <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded border border-zinc-800 bg-black/70 px-1 py-px text-[6px] font-bold text-zinc-300 shadow backdrop-blur sm:bottom-1 sm:px-1.5 sm:text-[7px]">
              P.Đề
            </div>
          </div>

          {/* Titles & metadata aligned next to the poster */}
          <div className="min-w-0 flex-1 pt-0 text-left sm:pt-0.5">
            <h4 className="truncate text-[10px] font-extrabold leading-tight text-zinc-100 transition-colors group-hover/cinema:text-pink-500 min-[390px]:text-[11px] sm:text-xs md:text-sm">
              {cleanedName}
            </h4>
            <p className="mt-0.5 truncate text-[8px] font-bold leading-tight text-zinc-500 min-[390px]:text-[9px] sm:text-[10px]">
              {cleanedOriginName}
            </p>
            <p className="mt-1 hidden truncate text-[8px] font-semibold leading-tight text-zinc-400 min-[390px]:block sm:text-[10px]">
              {ageRating} <span className="text-zinc-650">•</span> {movie.year || 2026} <span className="text-zinc-650">•</span> {durationText}
            </p>
          </div>
        </div>
      </div>

      {/* Hover Popup details card portal: aspect="landscape" to prevent height overflow */}
      {showPopup && mounted && (
        <MovieHoverPopup
          movie={movie}
          position={position}
          aspect="landscape"
          isVisible={isHovered}
          onMouseEnter={clearCloseTimer}
          onMouseLeave={handleMouseLeave}
        />
      )}
    </div>
  );
}
