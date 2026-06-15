"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { cleanMovieName, cleanSlug } from "@/utils/movieUtils";
import MovieHoverPopup from "./MovieHoverPopup";

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

        const res = await fetch("https://ophim1.com/v1/api/danh-sach/phim-chieu-rap?page=1", {
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        const data = await res.json();
        if (data.status === "success" || data.status === true) {
          const items = data.data?.items || data.items || [];
          if (items.length > 0) {
            // Deduplicate base slug
            const seen = new Set<string>();
            const uniqueItems = items.filter((item: any) => {
              const baseSlug = cleanSlug(item.slug);
              if (seen.has(baseSlug)) return false;
              seen.add(baseSlug);
              return true;
            });

            // Sort by TMDB popularity (vote count) or year descending
            uniqueItems.sort((a: Movie, b: Movie) => {
              const votesA = a.tmdb?.vote_count || 0;
              const votesB = b.tmdb?.vote_count || 0;
              if (votesB !== votesA) return votesB - votesA;
              return (b.year || 2026) - (a.year || 2026);
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
      <div className="container mx-auto px-6 mt-12 max-w-7xl select-none text-left">
        <div className="h-6 w-56 bg-zinc-800 rounded animate-pulse mb-6" />
        <div className="flex gap-6 overflow-hidden pb-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-[280px] sm:w-[320px] md:w-[360px] aspect-[16/9] shrink-0 bg-zinc-900 border border-zinc-800 rounded-2xl animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (movies.length === 0) return null;

  return (
    <div className="container mx-auto px-6 mt-12 max-w-7xl select-none text-left">
      {/* Tiêu đề & Nút Xem thêm */}
      <div className="flex items-center gap-2 mb-6">
        <h3 className="text-xl md:text-2xl font-black text-zinc-100 uppercase tracking-tight">
          Mãn Nhãn với Phim Chiếu Rạp
        </h3>
        
        {/* Custom tooltip arrow */}
        <div className="relative group/tooltip">
          <Link
            href="/search?genre=phim-chieu-rap"
            className="w-8 h-8 rounded-full border border-zinc-850 bg-zinc-900/60 hover:border-pink-500 hover:text-pink-500 flex items-center justify-center transition-all duration-300 active:scale-95 cursor-pointer"
          >
            <ChevronRight size={16} className="ml-0.5" />
          </Link>
          <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 px-2.5 py-1 bg-zinc-900 border border-zinc-800 text-zinc-100 text-[10px] font-bold rounded-lg opacity-0 pointer-events-none group-hover/tooltip:opacity-100 transition-opacity duration-200 z-30 shadow-xl whitespace-nowrap">
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
        className={`flex overflow-x-auto no-scrollbar w-full pb-8 gap-6 select-none ${
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
    </div>
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

  const cleanedName = cleanMovieName(movie.name);
  const cleanedOriginName = cleanMovieName(movie.origin_name);
  const ageRating = getAgeRating(movie.name, movie.category);

  useEffect(() => {
    setMounted(true);
    return () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  const getImageUrl = (path?: string) => {
    if (!path) return "";
    const fileName = path.split("/").pop();
    return `https://img.ophim.live/uploads/movies/${fileName}`;
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

  const cardWidthClass = "w-[280px] sm:w-[320px] md:w-[350px] shrink-0";
  const zIndexStyle = isHovered ? 999 : 10;

  // Custom movie length display or default
  const durationText = movie.time && !movie.time.includes("phút") ? movie.time : "1h 45m";

  return (
    <div
      ref={cardRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      className={`${cardWidthClass} cursor-pointer select-none relative group/cinema flex flex-col`}
      style={{ zIndex: zIndexStyle }}
    >
      <div className="relative flex flex-col w-full h-full">
        {/* Landscape backdrop banner (16:9 ratio) */}
        <div 
          className="relative overflow-hidden w-full aspect-[16/9] bg-zinc-900 border border-zinc-800/40 rounded-2xl transition-all duration-300 ease-out origin-center group-hover/cinema:border-pink-500/40 shadow-lg"
          style={{
            WebkitMaskImage: "-webkit-radial-gradient(white, black)",
            maskImage: "radial-gradient(white, black)"
          }}
        >
          {/* OPhim poster_url is the horizontal landscape backdrop */}
          <img
            src={getImageUrl(movie.poster_url || movie.thumb_url)}
            alt={cleanedName}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover rounded-2xl transition-transform duration-500"
            loading="lazy"
            decoding="async"
          />
          {/* Halftone dot grid pattern overlay to make the image look crisp and textured */}
          <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:4px_4px] opacity-100 z-10 pointer-events-none rounded-2xl" />

          {/* 4K badge at top-right of landscape poster */}
          {movie.quality === "4K" && (
            <div className="absolute top-2 right-2 bg-pink-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow z-10">
              4K
            </div>
          )}
        </div>

        {/* Info row underneath with small overlapping vertical poster */}
        <div className="flex gap-3 px-1.5 pt-3 items-start w-full relative">
          {/* Small vertical poster overlapping bottom-left of landscape banner */}
          <div 
            className="relative w-14 md:w-16 aspect-[2/3] shrink-0 -mt-8 md:-mt-10 z-20 bg-zinc-900 border-2 border-zinc-850 rounded-lg overflow-hidden shadow-lg transition-transform duration-300"
            style={{
              WebkitMaskImage: "-webkit-radial-gradient(white, black)",
              maskImage: "radial-gradient(white, black)"
            }}
          >
            {/* OPhim thumb_url is the vertical portrait poster */}
            <img
              src={getImageUrl(movie.thumb_url || movie.poster_url)}
              alt={cleanedName}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover rounded-lg"
              loading="lazy"
              decoding="async"
            />
            {/* Small badge inside vertical poster bottom */}
            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur px-1.5 py-0.2 rounded text-[7px] font-bold text-zinc-300 border border-zinc-800 shadow">
              P.Đề
            </div>
          </div>

          {/* Titles & metadata aligned next to the poster */}
          <div className="flex-1 min-w-0 text-left pt-0.5">
            <h4 className="font-extrabold text-xs md:text-sm text-zinc-100 truncate group-hover/cinema:text-pink-500 transition-colors">
              {cleanedName}
            </h4>
            <p className="text-[10px] text-zinc-500 truncate font-bold mt-0.5">
              {cleanedOriginName}
            </p>
            <p className="text-[10px] text-zinc-400 font-semibold mt-1 truncate">
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
