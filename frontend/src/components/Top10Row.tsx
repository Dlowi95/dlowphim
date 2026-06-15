"use client";

import React, { useEffect, useState, useRef } from "react";
import { Loader2, Flame } from "lucide-react";
import { useRouter } from "next/navigation";
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
  episode_current?: string;
  time?: string;
  tmdb?: {
    vote_count?: number;
    vote_average?: number;
  };
  category?: any[];
}

const FALLBACK_TOP_10: Movie[] = [
  {
    "_id": "6a2283ae2c0a4eaf26572b57",
    "name": "Bài Học Đáng Đời",
    "slug": "bai-hoc-dang-doi",
    "origin_name": "Teach You a Lesson",
    "thumb_url": "bai-hoc-dang-doi-thumb.jpg",
    "poster_url": "bai-hoc-dang-doi-poster.jpg",
    "year": 2026,
    "quality": "HD",
    "lang": "Vietsub",
    "episode_current": "Hoàn tất (10/10)",
    "time": "? phút/tập"
  },
  {
    "_id": "6a1eb62ec52ec62c8b184344",
    "name": "Kiều Sở",
    "slug": "kieu-so",
    "origin_name": "Ashes to Crown",
    "thumb_url": "kieu-so-thumb.jpg",
    "poster_url": "kieu-so-poster.jpg",
    "year": 2026,
    "quality": "HD",
    "lang": "Vietsub",
    "episode_current": "Tập 17",
    "time": "? phút/tập"
  },
  {
    "_id": "6220e66e8481266c5b7f154f",
    "name": "Đảo Hải Tặc",
    "slug": "one-piece",
    "origin_name": "One Piece (Luffy)",
    "thumb_url": "one-piece-thumb.jpg",
    "poster_url": "one-piece-poster.jpg",
    "year": 1999,
    "quality": "FHD",
    "lang": "Vietsub",
    "episode_current": "Tập 1165",
    "time": "25 phút/tập"
  },
  {
    "_id": "6a06d46af616ee3807e3b727",
    "name": "Biệt Đội Siêu Khờ",
    "slug": "biet-doi-sieu-kho",
    "origin_name": "The WONDERfools",
    "thumb_url": "biet-doi-sieu-kho-thumb.jpg",
    "poster_url": "biet-doi-sieu-kho-poster.jpg",
    "year": 2026,
    "quality": "HD",
    "lang": "Vietsub",
    "episode_current": "Hoàn tất (8/8)",
    "time": "? phút/tập"
  },
  {
    "_id": "6a0341a9da7d89406867aaae",
    "name": "Vũ Lâm Linh",
    "slug": "vu-lam-linh",
    "origin_name": "Zhan Zhao Adventures",
    "thumb_url": "vu-lam-linh-thumb.jpg",
    "poster_url": "vu-lam-linh-poster.jpg",
    "year": 2026,
    "quality": "HD",
    "lang": "Vietsub",
    "episode_current": "Hoàn tất (37/37)",
    "time": "? phút/tập"
  },
  {
    "_id": "692eb0a3ca27378366af8263",
    "name": "Mạc Ly",
    "slug": "mac-ly",
    "origin_name": "The First Jasmine",
    "thumb_url": "mac-ly-thumb-1780987241567.jpg",
    "poster_url": "mac-ly-poster-1780987245674.jpg",
    "year": 2026,
    "quality": "HD",
    "lang": "Vietsub",
    "episode_current": "Tập 10",
    "time": "? phút/tập"
  },
  {
    "_id": "6a0b02307544913d492aafe1",
    "name": "Trang Trại Dutton",
    "slug": "trang-trai-dutton",
    "origin_name": "Dutton Ranch",
    "thumb_url": "trang-trai-dutton-thumb.jpg",
    "poster_url": "trang-trai-dutton-poster.jpg",
    "year": 2026,
    "quality": "HD",
    "lang": "Vietsub",
    "episode_current": "Tập 6",
    "time": "47 phút/tập"
  },
  {
    "_id": "6a1a94a81fea2c5da7a7e833",
    "name": "Tiêu Dao Tứ Công Tử",
    "slug": "tieu-dao-tu-cong-tu",
    "origin_name": "The Reborn Young Lord",
    "thumb_url": "tieu-dao-tu-cong-tu-thumb.jpg",
    "poster_url": "tieu-dao-tu-cong-tu-poster.jpg",
    "year": 2026,
    "quality": "HD",
    "lang": "Vietsub",
    "episode_current": "Tập 30",
    "time": "? phút/tập"
  },
  {
    "_id": "6a2ae808baf8dde7e3ce581c",
    "name": "Hồ Sơ Nam Bộ",
    "slug": "ho-so-nam-bo",
    "origin_name": "Archives: The Nanyang Mystery",
    "thumb_url": "ho-so-nam-bo-thumb.jpg",
    "poster_url": "ho-so-nam-bo-poster.jpg",
    "year": 2026,
    "quality": "HD",
    "lang": "Vietsub",
    "episode_current": "Tập 10",
    "time": "42 phút/tập"
  },
  {
    "_id": "6a263e35e14b2140fc6fec49",
    "name": "Bức Tường Mê Cung",
    "slug": "buc-tuong-me-cung",
    "origin_name": "Wonder Wall",
    "thumb_url": "buc-tuong-me-cung-thumb.jpg",
    "poster_url": "buc-tuong-me-cung-poster.jpg",
    "year": 2026,
    "quality": "HD",
    "lang": "Vietsub",
    "episode_current": "Tập 15",
    "time": "45 phút/tập"
  }
];

// Helper to extract season / part from the raw name
const extractPartText = (name: string) => {
  if (!name) return "Phần 1";
  const matchPhan = name.match(/Phần\s+(\d+|[IVXLCDM]+)/i);
  if (matchPhan) return matchPhan[0];
  const matchSeason = name.match(/Season\s+(\d+|[IVXLCDM]+)/i);
  if (matchSeason) return matchSeason[0].replace(/Season/i, "Phần");
  const matchSS = name.match(/SS\s*(\d+)/i);
  if (matchSS) return `Phần ${matchSS[1]}`;
  const matchP = name.match(/\s+P\s*(\d+)/i);
  if (matchP) return `Phần ${matchP[1]}`;
  return "Phần 1";
};

// Helper for IMDb simulated scores
const getImdbScore = (name: string) => {
  const base = (name.length % 3) * 0.4 + 8.2;
  return base.toFixed(1);
};

// Age Rating resolver
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

export default function Top10Row() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);

  // Drag-to-scroll states
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const wasDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);

  // Fetch TV series from pages 1 and 2, deduplicate, and sort by popularity
  useEffect(() => {
    async function fetchTop10() {
      try {
        setLoading(true);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout

        const [res1, res2] = await Promise.all([
          fetch("https://ophim1.com/v1/api/danh-sach/phim-bo?page=1", { signal: controller.signal }),
          fetch("https://ophim1.com/v1/api/danh-sach/phim-bo?page=2", { signal: controller.signal })
        ]);

        clearTimeout(timeoutId);
        
        const d1 = await res1.json();
        const d2 = await res2.json();

        const items = [...(d1.data?.items || d1.items || []), ...(d2.data?.items || d2.items || [])];

        if (items.length > 0) {
          // Deduplicate
          const seen = new Set<string>();
          const uniqueItems = items.filter((item) => {
            const baseSlug = cleanSlug(item.slug);
            if (seen.has(baseSlug)) return false;
            seen.add(baseSlug);
            return true;
          });

          // Sort by TMDB popularity (vote count) desc, then vote average desc, then year desc
          uniqueItems.sort((a, b) => {
            const votesA = a.tmdb?.vote_count || 0;
            const votesB = b.tmdb?.vote_count || 0;
            if (votesB !== votesA) return votesB - votesA;

            const ratingA = a.tmdb?.vote_average || 0;
            const ratingB = b.tmdb?.vote_average || 0;
            if (ratingB !== ratingA) return ratingB - ratingA;

            return b.year - a.year;
          });

          // Slice top 10
          setMovies(uniqueItems.slice(0, 10));
        } else {
          setMovies(FALLBACK_TOP_10);
        }
      } catch (err) {
        console.error("Lỗi lấy Top 10 Phim bộ, chuyển sang danh sách dự phòng:", err);
        setMovies(FALLBACK_TOP_10);
      } finally {
        setLoading(false);
      }
    }

    fetchTop10();
  }, []);

  // Click-and-drag mouse scroll handlers
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
    const walk = (x - startXRef.current) * 1.5; // multiplier for speed
    if (Math.abs(walk) > 5) {
      wasDraggingRef.current = true;
    }
    container.scrollLeft = scrollLeftRef.current - walk;
  };

  const handleMouseUpOrLeave = () => {
    isDraggingRef.current = false;
    setIsDragging(false);
    // Clear dragging flag after click event resolves
    setTimeout(() => {
      wasDraggingRef.current = false;
    }, 50);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-6 mt-10 max-w-7xl">
        <div className="h-6 w-56 bg-zinc-800 rounded animate-pulse mb-6" />
        <div className="flex gap-5 overflow-hidden py-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="w-[180px] sm:w-[210px] md:w-[220px] aspect-[2/3] shrink-0 bg-zinc-900 border border-zinc-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (movies.length === 0) return null;

  return (
    <div className="container mx-auto px-6 mt-12 max-w-7xl select-none text-left">
      <h3 className="text-xl md:text-2xl font-black text-zinc-100 uppercase tracking-tight mb-2 flex items-center gap-2">
        <Flame size={22} className="text-pink-500 fill-pink-500 animate-pulse" />
        <span>Top 10 phim bộ hôm nay</span>
      </h3>
      <p className="text-xs text-zinc-500 font-bold uppercase tracking-wider mb-6">
        Thịnh hành nhất trên hệ thống cập nhật trực tiếp mỗi ngày (Nhấn kéo chuột sang trái/phải để trượt)
      </p>

      {/* Drag-to-scroll Container */}
      <div
        ref={scrollContainerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
        className={`flex overflow-x-auto no-scrollbar w-full pt-6 pb-12 gap-5 select-none ${
          isDragging ? "cursor-grabbing" : "cursor-grab"
        }`}
        style={{
          msOverflowStyle: "none",
          scrollbarWidth: "none"
        }}
      >
        {movies.map((movie, index) => (
          <Top10MovieCard
            key={movie._id || movie.slug}
            movie={movie}
            index={index}
            wasDraggingRef={wasDraggingRef}
          />
        ))}
      </div>
    </div>
  );
}

interface Top10MovieCardProps {
  movie: Movie;
  index: number;
  wasDraggingRef: React.MutableRefObject<boolean>;
}

function Top10MovieCard({ movie, index, wasDraggingRef }: Top10MovieCardProps) {
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
  const partText = extractPartText(movie.name);
  const ageRating = getAgeRating(movie.name, movie.category);
  const imdbScore = getImdbScore(movie.name);

  useEffect(() => {
    setMounted(true);
    return () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  const getImageUrl = (movieObj: Movie) => {
    // Top 10 card is aspect-[2/3] (portrait), so we prefer thumb_url (vertical poster in OPhim)
    const path = movieObj.thumb_url || movieObj.poster_url;
    if (!path) return "";
    const fileName = path.split("/").pop();
    return `https://img.ophim.live/uploads/movies/${fileName}`;
  };

  const handleMouseEnter = (e: React.MouseEvent) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    
    // Immediately mount the popup component (so it starts fetching details)
    setShowPopup(true);

    if (isHovered) return;

    const currentTarget = e.currentTarget;
    
    // Restore 800ms hover delay
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
    if (wasDraggingRef.current) {
      return; // Do not navigate if dragging
    }
    router.push(`/movie/${movie.slug}`);
  };

  // Badge rendering logic for episodes
  const renderEpisodeBadge = () => {
    if (!movie.episode_current) return null;
    const ep = movie.episode_current.toLowerCase();
    
    if (ep.includes("hoàn tất") || ep.includes("trọn bộ") || ep.includes("full")) {
      const matchNums = movie.episode_current.match(/\d+/g);
      const epNum = matchNums ? matchNums[0] : "10";
      return (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/75 backdrop-blur-md px-2 py-0.5 rounded-full text-[9px] font-black flex items-center gap-1 border border-zinc-800/60 shadow-md">
          <span className="text-zinc-400">PĐ. {epNum}</span>
          <span className="w-1 h-1 rounded-full bg-zinc-650" />
          <span className="text-emerald-400 font-extrabold">TM. {epNum}</span>
        </div>
      );
    }

    const matchNum = movie.episode_current.match(/\d+/);
    const num = matchNum ? matchNum[0] : "1";
    return (
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/75 backdrop-blur-md px-2 py-0.5 rounded-full text-[9px] font-black flex items-center gap-1 border border-zinc-800/60 shadow-md">
        <span className="text-zinc-400">PĐ. {num}</span>
        <span className="w-1 h-1 rounded-full bg-zinc-650" />
        <span className="text-emerald-400 font-extrabold">TM. {num}</span>
      </div>
    );
  };

  // Sizing of cards: slightly wider and prominent so 1 to 5 fits nicely
  const cardWidthClass = "w-[200px] sm:w-[220px] md:w-[236px] shrink-0";
  const zIndexStyle = isHovered ? 999 : 10;

  // Odd ranks tilt right (rotateY negative), Even ranks tilt left (rotateY positive)
  // Perspective restored to 1000px and rotateY reduced to 15deg (gentler, premium 3D wave accordion look)
  const isOdd = (index + 1) % 2 !== 0;
  const defaultTransform = isOdd
    ? "perspective(1000px) rotateY(-15deg) rotateX(2deg) rotateZ(-1.5deg) scale(0.97)"
    : "perspective(1000px) rotateY(15deg) rotateX(2deg) rotateZ(1.5deg) scale(0.97)";

  return (
    <div
      ref={cardRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      className={`${cardWidthClass} cursor-pointer select-none relative group/top10`}
      style={{ zIndex: zIndexStyle }}
    >
      <div className="relative flex flex-col h-full">
        
        {/* Tilted Poster Frame (Odd -> Right, Even -> Left), straightens & scale-up + thick pink neon shadow on hover */}
        <div
          className="relative overflow-hidden w-full aspect-[2/3] bg-zinc-900 border-[3px] border-zinc-800/60 rounded-2xl transition-all duration-300 ease-out origin-center group-hover/top10:rotate-0 group-hover/top10:skew-y-0 group-hover/top10:scale-105 group-hover/top10:border-pink-500"
          style={{
            transform: isHovered
              ? "perspective(1000px) rotateY(0deg) rotateX(0deg) rotateZ(0deg) scale(1.05)"
              : defaultTransform,
            boxShadow: isHovered 
              ? "0 0 35px 8px rgba(236, 72, 153, 0.85), 0 0 15px 3px rgba(236, 72, 153, 0.45)" 
              : "0 4px 12px rgba(0,0,0,0.5)",
            WebkitMaskImage: "-webkit-radial-gradient(white, black)",
            maskImage: "radial-gradient(white, black)"
          }}
        >
          <img
            src={getImageUrl(movie)}
            alt={cleanedName}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover rounded-2xl transition-transform duration-300 group-hover/top10:scale-105"
            loading="lazy"
            decoding="async"
          />
          {/* Halftone dot grid pattern overlay to make the image look crisp and textured */}
          <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:4px_4px] opacity-100 z-10 pointer-events-none rounded-2xl" />
          
          {/* Badge at bottom of poster */}
          {renderEpisodeBadge()}
        </div>

        {/* Text descriptions underneath (Flat Style) */}
        <div className="flex items-start gap-2.5 mt-3.5 px-1">
          <span className="text-5xl md:text-6xl font-black italic text-amber-400/90 leading-none select-none tracking-tighter shrink-0 font-sans">
            {index + 1}
          </span>
          <div className="flex-1 min-w-0 text-left pt-0.5">
            <h4 className="font-extrabold text-xs md:text-sm text-zinc-100 truncate group-hover/top10:text-pink-500 transition-colors">
              {cleanedName}
            </h4>
            <p className="text-[10px] text-zinc-500 truncate font-bold mt-0.5">
              {cleanedOriginName}
            </p>
            <p className="text-[10px] text-zinc-400 font-semibold mt-1 truncate">
              {ageRating} <span className="text-zinc-650">•</span> {partText} <span className="text-zinc-650">•</span> IMDb {imdbScore}
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
