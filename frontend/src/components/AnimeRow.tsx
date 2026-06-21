"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Play, Heart, Info, ChevronRight } from "lucide-react";
import { cleanMovieName, cleanSlug } from "@/utils/movieUtils";
import HalftoneOverlay from "@/components/HalftoneOverlay";
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
  time?: string;
  category?: any[];
}

const FALLBACK_ANIME: Movie[] = [
  {
    _id: "anime-1",
    name: "Vào Ma Giới Rồi Đấy! Iruma-kun (Phần 4)",
    slug: "vao-ma-gioi-roi-day-iruma-kun-phan-4",
    origin_name: "Welcome to Demon School! Iruma-kun (Season 4)",
    poster_url: "vao-ma-gioi-roi-day-iruma-kun-phan-4-poster.jpg",
    thumb_url: "vao-ma-gioi-roi-day-iruma-kun-phan-4-thumb.jpg",
    year: 2026,
    quality: "HD",
    lang: "Vietsub",
    time: "25 phút/tập"
  },
  {
    _id: "anime-2",
    name: "Vô Thượng Thần Đế",
    slug: "vo-thuong-than-de",
    origin_name: "Supreme God Emperor",
    poster_url: "vo-thuong-than-de-poster.jpg",
    thumb_url: "vo-thuong-than-de-thumb.jpg",
    year: 2020,
    quality: "HD",
    lang: "Vietsub",
    time: "8 phút/tập"
  },
  {
    _id: "anime-3",
    name: "Luyện Khí Mười Vạn Năm",
    slug: "luyen-khi-muoi-van-nam",
    origin_name: "One Hundred Thousand Years of Qi Refining",
    poster_url: "luyen-khi-muoi-van-nam-poster.jpg",
    thumb_url: "luyen-khi-muoi-van-nam-thumb.jpg",
    year: 2023,
    quality: "HD",
    lang: "Vietsub",
    time: "7 phút/tập"
  },
  {
    _id: "anime-4",
    name: "Tiên Nghịch",
    slug: "tien-nghich",
    origin_name: "Renegade Immortal",
    poster_url: "tien-nghich-poster.jpg",
    thumb_url: "tien-nghich-thumb.jpg",
    year: 2023,
    quality: "HD",
    lang: "Vietsub + Thuyết Minh",
    time: "20phút/Tập"
  },
  {
    _id: "anime-5",
    name: "Người Trên Vạn Người (Phần 6)",
    slug: "nguoi-tren-van-nguoi-phan-6",
    origin_name: "Hitori No Shita - The Outcast (Season 6)",
    poster_url: "nguoi-tren-van-nguoi-phan-6-poster.jpg",
    thumb_url: "nguoi-tren-van-nguoi-phan-6-thumb.jpg",
    year: 2026,
    quality: "HD",
    lang: "Vietsub",
    time: "? phút/tập"
  },
  {
    _id: "anime-6",
    name: "Trạch Thiên Ký",
    slug: "trach-thien-ky-2026",
    origin_name: "Fighter of the Destiny 3D",
    poster_url: "trach-thien-ky-2026-poster.jpg",
    thumb_url: "trach-thien-ky-2026-thumb.jpg",
    year: 2026,
    quality: "HD",
    lang: "Vietsub",
    time: "26 phút/tập"
  },
  {
    _id: "anime-7",
    name: "Trái Đất Đóng Băng",
    slug: "trai-dat-dong-bang",
    origin_name: "SNOWBALL EARTH",
    poster_url: "trai-dat-dong-bang-poster.jpg",
    thumb_url: "trai-dat-dong-bang-thumb.jpg",
    year: 2026,
    quality: "HD",
    lang: "Vietsub",
    time: "23 phút/tập"
  },
  {
    _id: "anime-8",
    name: "Dáng Say Tựa Đoá Bách Hợp",
    slug: "dang-say-tua-doa-bach-hop",
    origin_name: "Botan Kamiina Fully Blossoms When Drunk",
    poster_url: "dang-say-tua-doa-bach-hop-poster.jpg",
    thumb_url: "dang-say-tua-doa-bach-hop-thumb.jpg",
    year: 2026,
    quality: "HD",
    lang: "Vietsub",
    time: "24 phút/tập"
  },
  {
    _id: "anime-9",
    name: "Lúc Đó Tôi Đã Chuyển Sinh Thành Slime (Phần 4)",
    slug: "luc-do-toi-da-chuyen-sinh-thanh-slime-phan-4",
    origin_name: "That Time I Got Reincarnated as a Slime (Season 4)",
    poster_url: "luc-do-toi-da-chuyen-sinh-thanh-slime-phan-4-poster.jpg",
    thumb_url: "luc-do-toi-da-chuyen-sinh-thanh-slime-phan-4-thumb.jpg",
    year: 2026,
    quality: "HD",
    lang: "Vietsub",
    time: "24 phút/tập"
  },
  {
    _id: "anime-10",
    name: "Tôi là Frankelda",
    slug: "toi-la-frankelda",
    origin_name: "I Am Frankelda",
    poster_url: "toi-la-frankelda-poster.jpg",
    thumb_url: "toi-la-frankelda-thumb.jpg",
    year: 2025,
    quality: "HD",
    lang: "Vietsub",
    time: "104 Phút"
  },
  {
    _id: "anime-11",
    name: "Linh Vũ Đại Lục",
    slug: "linh-vu-dai-luc",
    origin_name: "Legend of Lingwu Continent",
    poster_url: "linh-vu-dai-luc-poster.jpg",
    thumb_url: "linh-vu-dai-luc-thumb.jpg",
    year: 2024,
    quality: "HD",
    lang: "Vietsub",
    time: "15 phút/tập"
  },
  {
    _id: "anime-12",
    name: "Lại Bị Giết Nữa À, Thưa Thám Tử?",
    slug: "lai-co-an-mang-nua-roi-thua-tham-tu",
    origin_name: "Killed Again, Mr. Detective.",
    poster_url: "lai-co-an-mang-nua-roi-thua-tham-tu-poster.jpg",
    thumb_url: "lai-co-an-mang-nua-roi-thua-tham-tu-thumb.jpg",
    year: 2026,
    quality: "HD",
    lang: "Vietsub",
    time: "24 phút/tập"
  },
  {
    _id: "anime-13",
    name: "Bức Tường Băng",
    slug: "buc-tuong-bang",
    origin_name: "The Ramparts of Ice",
    poster_url: "buc-tuong-bang-poster.jpg",
    thumb_url: "buc-tuong-bang-thumb.jpg",
    year: 2026,
    quality: "HD",
    lang: "Vietsub",
    time: "24 phút/tập"
  },
  {
    _id: "anime-14",
    name: "Tiên Sĩ Đá: Hồi Sinh Thế Giới (Phần 4)",
    slug: "tien-si-da-hoi-sinh-the-gioi-phan-4",
    origin_name: "Dr. STONE (Season 4)",
    poster_url: "tien-si-da-hoi-sinh-the-gioi-phan-4-poster.jpg",
    thumb_url: "tien-si-da-hoi-sinh-the-gioi-phan-4-thumb.jpg",
    year: 2025,
    quality: "HD",
    lang: "Vietsub",
    time: "24 phút/tập"
  },
  {
    _id: "anime-15",
    name: "Rick và Morty (Phần 9)",
    slug: "rick-va-morty-phan-9",
    origin_name: "Rick and Morty (Season 9)",
    poster_url: "rick-va-morty-phan-9-poster.jpg",
    thumb_url: "rick-va-morty-phan-9-thumb.jpg",
    year: 2026,
    quality: "HD",
    lang: "Vietsub",
    time: "? phút/tập"
  }
];

const stripHtmlTags = (html?: string) => {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, "");
};

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

export default function AnimeRow() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [activeMovie, setActiveMovie] = useState<Movie | null>(null);
  const [details, setDetails] = useState<any | null>(null);
  
  // Details cache to prevent delay on repeated clicks
  const [detailsCache, setDetailsCache] = useState<Record<string, any>>({});
  
  // Transition state to handle smooth fade-out and fade-in
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const router = useRouter();
  const { user, toggleFavorite: toggleFavoriteCtx } = useAuth();

  const isFavorite = user?.favorites?.includes(activeMovie?.slug || "") || false;

  // Drag-to-scroll state refs for thumbnails row
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const wasDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);

  // Fetch lists
  useEffect(() => {
    async function fetchAnime() {
      try {
        setLoadingList(true);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout

        const res = await fetch("https://ophim1.com/v1/api/danh-sach/hoat-hinh?page=1", {
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

            const top15 = uniqueItems.slice(0, 15);
            setMovies(top15);
            if (top15.length > 0) {
              setActiveMovie(top15[0]);
            }
          } else {
            setMovies(FALLBACK_ANIME);
            setActiveMovie(FALLBACK_ANIME[0]);
          }
        } else {
          setMovies(FALLBACK_ANIME);
          setActiveMovie(FALLBACK_ANIME[0]);
        }
      } catch (err) {
        console.error("Lỗi lấy danh sách anime, chuyển sang dự phòng:", err);
        setMovies(FALLBACK_ANIME);
        setActiveMovie(FALLBACK_ANIME[0]);
      } finally {
        setLoadingList(false);
      }
    }

    fetchAnime();
  }, []);

  // Fetch details when activeMovie changes
  useEffect(() => {
    if (!activeMovie) return;

    if (detailsCache[activeMovie.slug]) {
      setDetails(detailsCache[activeMovie.slug]);
      return;
    }

    setDetails(null); // Clear details instantly to show skeleton loading block during network fetch

    const controller = new AbortController();
    async function fetchActiveDetails() {
      try {
        setLoadingDetails(true);
        const res = await fetch(`https://ophim1.com/v1/api/phim/${activeMovie!.slug}`, {
          signal: controller.signal
        });
        const data = await res.json();
        if (data.status === true || data.status === "success") {
          const item = data.data?.item || data.movie || null;
          if (item) {
            setDetailsCache(prev => ({ ...prev, [activeMovie!.slug]: item }));
            setDetails(item);
          }
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.error("Lỗi tải chi tiết anime active:", err);
        }
      } finally {
        setLoadingDetails(false);
      }
    }

    fetchActiveDetails();

    return () => {
      controller.abort();
    };
  }, [activeMovie]);

  // Favorite toggle handler
  const toggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeMovie) return;
    await toggleFavoriteCtx(activeMovie.slug);
  };

  // Drag-to-scroll Handlers for thumbnails row
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

  const handleThumbnailClick = (movie: Movie) => {
    if (wasDraggingRef.current) return;
    if (movie.slug === activeMovie?.slug) return;
    
    setIsTransitioning(true);
    setTimeout(() => {
      setActiveMovie(movie);
      setIsTransitioning(false);
    }, 150); // 150ms fade-out, then swap and fade-in
  };

  const getImageUrl = (path?: string) => {
    if (!path) return "";
    if (path.startsWith("http")) return path;
    const fileName = path.split("/").pop();
    return `https://img.ophim.live/uploads/movies/${fileName}`;
  };

  if (loadingList) {
    return (
      <div className="container mx-auto px-4 mt-12 max-w-[1400px] select-none text-left">
        <div className="h-6 w-56 bg-zinc-800 rounded animate-pulse mb-6" />
        <div className="w-full h-[480px] bg-zinc-900 border border-zinc-800 rounded-3xl animate-pulse" />
      </div>
    );
  }

  if (movies.length === 0 || !activeMovie) return null;

  const cleanedName = cleanMovieName(activeMovie.name);
  const cleanedOriginName = cleanMovieName(activeMovie.origin_name);
  
  // Instantly use details from listing object if details is loading
  const ageRating = getAgeRating(activeMovie.name, details?.category || activeMovie.category);
  const durationText = activeMovie.time || details?.time || "24 phút/tập";
  const movieYear = activeMovie.year || details?.year || 2026;
  const movieQuality = activeMovie.quality || details?.quality || "HD";
  const movieLang = activeMovie.lang || details?.lang || "Vietsub";
  
  const movieDescription = stripHtmlTags(details?.content || "");
  const genres = activeMovie.category?.map((c: any) => c.name).join(" • ") || details?.category?.map((c: any) => c.name).join(" • ") || "Hoạt hình";
  const imdbScore = details?.imdb?.vote_average || ((cleanedName.length % 3) * 0.4 + 7.2).toFixed(1);

  return (
    <div className="container mx-auto px-4 mt-12 max-w-[1400px] select-none text-left">
      {/* Tiêu đề & Nút Xem thêm */}
      <div className="flex items-center gap-2 mb-6">
        <h3 className="text-xl md:text-2xl font-black text-zinc-100 uppercase tracking-tight">
          Kho Tàng Anime Mới Nhất
        </h3>
        
        <div className="relative group/tooltip">
          <Link
            href="/search?genre=hoat-hinh"
            className="w-8 h-8 rounded-full border border-zinc-850 bg-zinc-900/60 hover:border-pink-500 hover:text-pink-500 flex items-center justify-center transition-all duration-300 active:scale-95 cursor-pointer"
          >
            <ChevronRight size={16} className="ml-0.5" />
          </Link>
          <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 px-2.5 py-1 bg-zinc-900 border border-zinc-800 text-zinc-100 text-[10px] font-bold rounded-lg opacity-0 pointer-events-none group-hover/tooltip:opacity-100 transition-opacity duration-200 z-30 shadow-xl whitespace-nowrap">
            Xem thêm
          </div>
        </div>
      </div>

      {/* Main Unified Box */}
      <div className="relative w-full rounded-3xl border border-zinc-800/40 bg-[#111219] overflow-hidden flex flex-col p-6 md:p-10 shadow-2xl">
        
        {/* Top Section: Active Movie Banner Details with Transition opacity & blur */}
        <div className={`relative w-full min-h-[320px] md:min-h-[380px] flex items-center mb-8 md:mb-10 z-10 transition-all duration-300 ease-in-out ${
          isTransitioning ? "opacity-0 scale-[0.98] blur-[2px]" : "opacity-100 scale-100 blur-0"
        }`}>
          
          {/* Right-aligned Backdrop Image (No mask inside to avoid sub-pixel bleed) */}
          <div className="absolute right-0 top-0 bottom-0 w-full md:w-[65%] h-full z-0 pointer-events-none select-none overflow-hidden rounded-r-3xl">
            <img
              src={getImageUrl(activeMovie.poster_url || activeMovie.thumb_url)}
              alt={cleanedName}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
            {/* Halftone dot grid pattern overlay to make the image look crisp and textured */}
            <HalftoneOverlay />
          </div>

          {/* Smooth mask on parent: starts at left-0 to cover any sub-pixel gap at the image left edge */}
          <div className="absolute inset-y-0 left-0 w-full md:w-[72%] z-[1] pointer-events-none select-none bg-gradient-to-r from-[#111219] via-[#111219] via-55% to-transparent" />
          
          {/* Bottom fade mask to blend with thumbnails */}
          <div className="absolute inset-x-0 bottom-0 h-1/4 z-[2] pointer-events-none select-none bg-gradient-to-t from-[#111219] to-transparent" />

          {/* Left-aligned Details Content */}
          <div className="relative z-10 w-full md:w-[52%] flex flex-col text-left pr-4">
            <h4 className="text-xl md:text-3xl font-black text-zinc-100 tracking-tight leading-tight line-clamp-2">
              {cleanedName}
            </h4>
            <p className="text-[11px] md:text-[13px] text-pink-500 font-bold mt-1.5 line-clamp-1">
              {cleanedOriginName}
            </p>

            {/* Metadata Badges */}
            <div className="flex flex-wrap items-center gap-2.5 mt-3.5 text-[10px] md:text-xs text-zinc-400 font-bold">
              <span className="border border-amber-500/50 bg-amber-500/10 text-amber-500 text-[10px] font-black px-1.5 py-0.5 rounded shadow-sm">
                IMDb {imdbScore}
              </span>
              <span className="border border-zinc-700 bg-zinc-800/40 text-zinc-300 text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm">
                {ageRating}
              </span>
              <span>•</span>
              <span className="text-zinc-350">{movieYear}</span>
              <span>•</span>
              <span className="text-zinc-350">{durationText}</span>
              <span>•</span>
              <span className="text-pink-400 uppercase tracking-wider">{movieQuality}</span>
              <span>•</span>
              <span className="text-zinc-350">{movieLang}</span>
            </div>

            {/* Genre list below metadata */}
            <div className="text-[10px] md:text-[11px] text-zinc-500 font-bold mt-2.5 uppercase tracking-wide">
              {genres}
            </div>

            {/* Description Paragraph with loading skeleton state */}
            {loadingDetails && !details ? (
              <div className="space-y-2.5 mt-4 max-w-[92%] animate-pulse">
                <div className="h-4 bg-zinc-800/60 rounded w-full"></div>
                <div className="h-4 bg-zinc-800/60 rounded w-[90%]"></div>
                <div className="h-4 bg-zinc-800/60 rounded w-[75%]"></div>
              </div>
            ) : (
              <p className="text-xs md:text-sm text-zinc-400 leading-relaxed mt-4 line-clamp-3 md:line-clamp-4 font-medium max-w-[92%]">
                {movieDescription || "Không có mô tả chi tiết cho phim này."}
              </p>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-4 mt-6">
              {/* Pink Play Button */}
              <button
                onClick={() => router.push(`/movie/${activeMovie.slug}`)}
                className="bg-pink-500 hover:bg-pink-600 text-white rounded-full w-12 h-12 md:w-14 md:h-14 flex items-center justify-center transition-all duration-300 shadow-[0_4px_20px_rgba(236,72,153,0.45)] hover:scale-105 active:scale-95 cursor-pointer shrink-0"
              >
                <Play size={20} className="fill-white ml-0.5" />
              </button>

              {/* Heart Button */}
              <button
                onClick={toggleFavorite}
                className={`w-10 h-10 md:w-12 md:h-12 rounded-full border flex items-center justify-center transition-all duration-300 cursor-pointer ${
                  isFavorite
                    ? "border-pink-500/40 bg-pink-500/10 text-pink-500 hover:bg-pink-500/20"
                    : "border-zinc-800/60 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                }`}
              >
                <Heart size={16} className={isFavorite ? "fill-pink-500" : ""} />
              </button>

              {/* Info Button */}
              <button
                onClick={() => router.push(`/movie/${activeMovie.slug}`)}
                className="w-10 h-10 md:w-12 md:h-12 rounded-full border border-zinc-800/60 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200 flex items-center justify-center transition-all duration-300 cursor-pointer"
              >
                <Info size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Section: Scrollable strip of 15 thumbnails (Grid on desktop to fit all 15) */}
        <div className="relative w-full z-10 border-t border-zinc-800/40 pt-6">
          <div
            ref={scrollContainerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUpOrLeave}
            onMouseLeave={handleMouseUpOrLeave}
            className={`flex overflow-x-auto md:overflow-x-visible no-scrollbar w-full gap-4 md:gap-2.5 select-none pb-2 md:pb-0 md:grid md:grid-cols-[repeat(15,minmax(0,1fr))] md:w-full ${
              isDragging ? "cursor-grabbing" : "cursor-grab"
            }`}
            style={{
              msOverflowStyle: "none",
              scrollbarWidth: "none"
            }}
          >
            {movies.map((movie) => {
              const isActive = movie.slug === activeMovie.slug;
              const title = cleanMovieName(movie.name);
              return (
                <div
                  key={movie._id || movie.slug}
                  onClick={() => handleThumbnailClick(movie)}
                  className={`w-[70px] shrink-0 md:w-auto md:shrink aspect-[2/3] rounded-xl overflow-hidden cursor-pointer transition-all duration-300 relative select-none ${
                    isActive
                      ? "border-2 border-pink-500 scale-105 shadow-[0_0_15px_rgba(236,72,153,0.5)]"
                      : "border border-zinc-800/60 hover:border-pink-500/50"
                  }`}
                  style={{
                    WebkitMaskImage: "-webkit-radial-gradient(white, black)",
                    maskImage: "radial-gradient(white, black)"
                  }}
                >
                  <img
                    src={getImageUrl(movie.thumb_url || movie.poster_url)}
                    alt={title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                  {/* Subtle hover overlay */}
                  <div className="absolute inset-0 bg-black/10 hover:bg-black/0 transition-colors" />
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
