"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { cleanMovieName, cleanSlug } from "@/utils/movieUtils";

interface Movie {
  _id: string;
  name: string;
  slug: string;
  origin_name: string;
  poster_url?: string;
  thumb_url?: string;
}

const FALLBACK_UPCOMING: Movie[] = [
  {
    _id: "upcoming-1",
    name: "Chuyện Chăn Gối",
    slug: "chuyen-chan-goi",
    origin_name: "Bedways",
    poster_url: "chuyen-chan-goi-poster.jpg",
    thumb_url: "chuyen-chan-goi-thumb.jpg",
  },
  {
    _id: "upcoming-2",
    name: "Siêu Quậy Marsupilami",
    slug: "sieu-quay-marsupilami",
    origin_name: "Marsupilami",
    poster_url: "sieu-quay-marsupilami-poster.jpg",
    thumb_url: "sieu-quay-marsupilami-thumb.jpg",
  },
  {
    _id: "upcoming-3",
    name: "Yêu Nữ Thích Hàng Hiệu 2",
    slug: "yeu-nu-thich-hang-hieu-2",
    origin_name: "The Devil Wears Prada 2",
    poster_url: "yeu-nu-thich-hang-hieu-2-poster.jpg",
    thumb_url: "yeu-nu-thich-hang-hieu-2-thumb.jpg",
  },
  {
    _id: "upcoming-4",
    name: "Avatar 3: Lửa và Tro Tàn",
    slug: "avatar-3-lua-va-tro-tan",
    origin_name: "Avatar: Fire and Ash",
    poster_url: "avatar-3-poster.jpg",
    thumb_url: "avatar-3-thumb.jpg",
  },
  {
    _id: "upcoming-5",
    name: "Vây Hãm: Kẻ Trừng Phạt",
    slug: "vay-ham-ke-trung-phat",
    origin_name: "The Roundup: Punishment",
    poster_url: "vay-ham-4-poster.jpg",
    thumb_url: "vay-ham-4-thumb.jpg",
  },
  {
    _id: "upcoming-6",
    name: "Kẻ Săn Tin Đen",
    slug: "ke-san-tin-den",
    origin_name: "Nightcrawler",
    poster_url: "ke-san-tin-den-poster.jpg",
    thumb_url: "ke-san-tin-den-thumb.jpg",
  }
];

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
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout

        const res = await fetch("https://ophim1.com/v1/api/danh-sach/phim-sap-chieu?page=1", {
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        const data = await res.json();
        if (data.status === "success" || data.status === true) {
          const items = data.data?.items || data.items || [];
          if (items.length > 0) {
            // Deduplicate based on clean base slug to prevent multiple seasons/parts from repeating
            const seen = new Set<string>();
            const uniqueItems = items.filter((item: any) => {
              const baseSlug = cleanSlug(item.slug);
              if (seen.has(baseSlug)) return false;
              seen.add(baseSlug);
              return true;
            });
            // Fetch up to 10 upcoming movies for scrolling
            setMovies(uniqueItems.slice(0, 10));
          } else {
            setMovies(FALLBACK_UPCOMING);
          }
        } else {
          setMovies(FALLBACK_UPCOMING);
        }
      } catch (err) {
        console.error("Lỗi lấy danh sách phim sắp tới, chuyển sang dự phòng:", err);
        setMovies(FALLBACK_UPCOMING);
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

  const getImageUrl = (movieObj: Movie) => {
    // Landscape preferred (poster_url is landscape backdrop in OPhim API)
    const path = movieObj.poster_url || movieObj.thumb_url;
    if (!path) return "";
    const fileName = path.split("/").pop();
    return `https://img.ophim.live/uploads/movies/${fileName}`;
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
          Phim hay sắp tới
        </h3>
        
        {/* Custom tooltip arrow */}
        <div className="relative group/tooltip">
          <Link
            href="/search?type=phim-sap-chieu"
            className="w-8 h-8 rounded-full border border-zinc-850 bg-zinc-900/60 hover:border-pink-500 hover:text-pink-500 flex items-center justify-center transition-all duration-300 active:scale-95 cursor-pointer"
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
        {movies.map((movie) => {
          const cleanedName = cleanMovieName(movie.name);
          const cleanedOrigin = cleanMovieName(movie.origin_name);
          const cardWidthClass = "w-[280px] sm:w-[320px] md:w-[360px] shrink-0";
          return (
            <div
              key={movie._id || movie.slug}
              onClick={() => handleCardClick(movie.slug)}
              className={`${cardWidthClass} group/upcoming flex flex-col gap-3 cursor-pointer`}
            >
              {/* Khung ảnh aspect-[16/10] */}
              <div 
                className="relative overflow-hidden w-full aspect-[16/10] bg-zinc-900 border border-zinc-800/60 rounded-2xl transition-all duration-300 ease-out"
                style={{
                  WebkitMaskImage: "-webkit-radial-gradient(white, black)",
                  maskImage: "radial-gradient(white, black)"
                }}
              >
                <img
                  src={getImageUrl(movie)}
                  alt={cleanedName}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover rounded-2xl transition-transform duration-500 group-hover/upcoming:scale-105"
                  loading="lazy"
                  decoding="async"
                />

                
                {/* Badge Sắp chiếu bottom-left */}
                <div className="absolute bottom-3 left-3 bg-white text-zinc-900 text-[10px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wider shadow-md">
                  Sắp chiếu
                </div>
              </div>

              {/* Tên phim dưới card */}
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
        })}
      </div>
    </div>
  );
}
