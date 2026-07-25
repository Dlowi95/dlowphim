"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { cleanMovieName, cleanSlug, getImageUrl } from "@/utils/movieUtils";
import { getProxyUrl, MOVIE_API_DOMAIN } from "@/utils/api";

interface Movie {
  _id: string;
  name: string;
  slug: string;
  origin_name: string;
  poster_url?: string;
  thumb_url?: string;
}

export default function UpcomingRow() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Drag-to-scroll state refs
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const wasDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);

  useEffect(() => {
    async function fetchUpcoming() {
      try {
        setLoading(true);
        let items: any[] = [];
        
        try {
          // Luôn fetch từ OPhim đối với danh mục sắp chiếu vì PhimAPI không hỗ trợ danh mục này
          const res = await fetch(getProxyUrl(`https://ophim1.com/v1/api/danh-sach/phim-sap-chieu?page=1`));
          if (res.ok) {
            const data = await res.json();
            items = data.data?.items || data.items || [];
          }
        } catch (e) {}

        const seen = new Set<string>();
        const uniqueItems = items.filter((item: any) => {
          const baseSlug = cleanSlug(item.slug);
          if (seen.has(baseSlug)) return false;
          seen.add(baseSlug);
          return true;
        });
        setMovies(uniqueItems.slice(0, 10));
      } catch (err) {
        console.error("Lỗi lấy danh sách phim đề xuất:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchUpcoming();
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

  const handleCardClick = (slug: string) => {
    if (wasDraggingRef.current) {
      return; // Block click action if dragging occurred
    }
    router.push(`/movie/${slug}`);
  };

  const getUpcomingImageUrl = (movieObj: Movie) => {
    const path = movieObj.poster_url || movieObj.thumb_url;
    return getImageUrl(path);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-6 mt-12 max-w-7xl select-none text-left">
        <div className="h-6 w-52 bg-zinc-800 rounded animate-pulse mb-6" />
        <div className="flex gap-6 overflow-hidden pb-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-[280px] sm:w-[320px] md:w-[360px] aspect-[16/10] shrink-0 bg-zinc-900 border border-zinc-800 rounded-2xl animate-pulse"
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
          Phim Sắp Chiếu
        </h3>
        
        {/* Custom tooltip arrow */}
        <div className="relative group/tooltip">
          <Link
            href="/search?type=phim-sap-chieu"
            className="w-8 h-8 rounded-full border border-zinc-800 bg-zinc-900/60 hover:border-pink-500 hover:text-pink-500 flex items-center justify-center transition-all duration-300 active:scale-95 cursor-pointer"
          >
            <ChevronRight size={16} className="ml-0.5" />
          </Link>
          <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 px-2.5 py-1 bg-zinc-900 border border-zinc-800 text-zinc-100 text-[10px] font-bold rounded-lg opacity-0 pointer-events-none group-hover/tooltip:opacity-100 transition-opacity duration-200 z-30 shadow-xl whitespace-nowrap">
            Xem thêm
          </div>
        </div>
      </div>

      {/* Drag-to-scroll Horizontal Row container */}
      <div
        ref={scrollContainerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
        className={`flex overflow-x-auto no-scrollbar w-full pb-6 gap-6 select-none ${
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
    </div>
  );
}

function UpcomingMovieCard({ movie, wasDraggingRef, router }: { movie: Movie; wasDraggingRef: React.MutableRefObject<boolean>; router: any }) {
  const cleanedName = cleanMovieName(movie.name);
  const cleanedOrigin = cleanMovieName(movie.origin_name);
  const cardWidthClass = "w-[280px] sm:w-[320px] md:w-[360px] shrink-0";

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
    router.push(`/movie/${movie.slug}`);
  };

  return (
    <div
      onClick={handleCardClick}
      className={`${cardWidthClass} group/upcoming flex flex-col gap-3 cursor-pointer`}
    >
      <div 
        className="relative overflow-hidden w-full aspect-[16/10] bg-zinc-900 border border-zinc-800/60 rounded-2xl transition-all duration-300 ease-out"
        style={{
          WebkitMaskImage: "-webkit-radial-gradient(white, black)",
          maskImage: "radial-gradient(white, black)"
        }}
      >
        <img
          src={imgSrc}
          alt={cleanedName}
          onError={handleImgError}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover rounded-2xl transition-transform duration-500 group-hover/upcoming:scale-105"
          loading="lazy"
          decoding="async"
        />
        <div className="absolute bottom-3 left-3 bg-white text-zinc-900 text-[10px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wider shadow-md">
          Sắp Chiếu
        </div>
      </div>
      <div className="px-1 text-left">
        <h4 className="font-extrabold text-sm md:text-base text-zinc-100 truncate group-hover/upcoming:text-pink-500 transition-colors">
          {cleanedName}
        </h4>
        <p className="text-xs text-zinc-500 truncate font-bold mt-0.5">
          {cleanedOrigin}
        </p>
      </div>
    </div>
  );
}
