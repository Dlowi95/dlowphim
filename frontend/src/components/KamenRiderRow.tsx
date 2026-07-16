"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Play, Heart, Info, Monitor, Flame } from "lucide-react";
import { cleanMovieName, cleanSlug } from "@/utils/movieUtils";
import { useAuth } from "@/context/AuthContext";
import Cookies from "js-cookie";
import Image from "next/image";
import { getProxyUrl } from "@/utils/api";
import HalftoneOverlay from "@/components/HalftoneOverlay";

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

const FALLBACK_RIDERS: Movie[] = [
  {
    _id: "rider-1",
    name: "Shin Kamen Rider",
    slug: "shin-kamen-rider",
    origin_name: "Shin Kamen Rider (2023)",
    poster_url: "shin-kamen-rider-poster.jpg",
    thumb_url: "shin-kamen-rider-thumb.jpg",
    year: 2023,
    quality: "HD",
    lang: "Vietsub",
    time: "121 phút"
  },
  {
    _id: "rider-2",
    name: "Kamen Rider Black Sun",
    slug: "kamen-rider-black-sun",
    origin_name: "Kamen Rider Black Sun (Season 1)",
    poster_url: "kamen-rider-black-sun-poster.jpg",
    thumb_url: "kamen-rider-black-sun-thumb.jpg",
    year: 2022,
    quality: "HD",
    lang: "Vietsub",
    time: "44 phút/tập"
  },
  {
    _id: "rider-3",
    name: "Kamen Rider Gotchard",
    slug: "kamen-rider-gotchard",
    origin_name: "Kamen Rider Gotchard",
    poster_url: "kamen-rider-gotchard-poster.jpg",
    thumb_url: "kamen-rider-gotchard-thumb.jpg",
    year: 2023,
    quality: "HD",
    lang: "Vietsub",
    time: "24 phút/tập"
  },
  {
    _id: "rider-4",
    name: "Kamen Rider Gavv",
    slug: "kamen-rider-gavv",
    origin_name: "Kamen Rider Gavv",
    poster_url: "kamen-rider-gavv-poster.jpg",
    thumb_url: "kamen-rider-gavv-thumb.jpg",
    year: 2024,
    quality: "HD",
    lang: "Vietsub",
    time: "24 phút/tập"
  }
];

// Helper to determine neon glow color based on the Kamen Rider slug
const getRiderTheme = (slug: string) => {
  const s = slug.toLowerCase();
  if (s.includes("gavv")) {
    return {
      glowClass: "shadow-[0_0_20px_rgba(236,72,153,0.55)] border-pink-500",
      textClass: "text-pink-500 drop-shadow-[0_2px_8px_rgba(236,72,153,0.6)]",
      gradient: "from-pink-500 via-purple-600 to-indigo-500",
      accent: "#ec4899"
    };
  }
  if (s.includes("gotchard") || s.includes("w") || s.includes("double")) {
    return {
      glowClass: "shadow-[0_0_20px_rgba(6,182,212,0.55)] border-cyan-500",
      textClass: "text-cyan-400 drop-shadow-[0_2px_8px_rgba(6,182,212,0.6)]",
      gradient: "from-cyan-400 via-teal-500 to-emerald-500",
      accent: "#06b6d4"
    };
  }
  if (s.includes("black-sun") || s.includes("kuuga") || s.includes("agito")) {
    return {
      glowClass: "shadow-[0_0_20px_rgba(245,158,11,0.55)] border-amber-500",
      textClass: "text-amber-500 drop-shadow-[0_2px_8px_rgba(245,158,11,0.6)]",
      gradient: "from-amber-500 via-orange-600 to-red-600",
      accent: "#f59e0b"
    };
  }
  if (s.includes("saber") || s.includes("geats") || s.includes("kabuto") || s.includes("shin")) {
    return {
      glowClass: "shadow-[0_0_20px_rgba(239,68,68,0.55)] border-red-500",
      textClass: "text-red-500 drop-shadow-[0_2px_8px_rgba(239,68,68,0.6)]",
      gradient: "from-red-500 via-rose-600 to-red-500",
      accent: "#ef4444"
    };
  }
  // Default Cyberpunk Green
  return {
    glowClass: "shadow-[0_0_20px_rgba(34,197,94,0.55)] border-green-500",
    textClass: "text-green-400 drop-shadow-[0_2px_8px_rgba(34,197,94,0.6)]",
    gradient: "from-green-400 via-emerald-500 to-teal-500",
    accent: "#22c55e"
  };
};

export default function KamenRiderRow() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [activeMovie, setActiveMovie] = useState<Movie | null>(null);
  const [details, setDetails] = useState<any | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [backdropUrl, setBackdropUrl] = useState<string | null>(null);
  
  const [detailsCache, setDetailsCache] = useState<Record<string, any>>({});
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const router = useRouter();
  const { user, toggleFavorite: toggleFavoriteCtx } = useAuth();
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

  const isFavorite = user?.favorites?.includes(activeMovie?.slug || "") || false;

  // 1. Fetch danh sách phim Kamen Rider từ API tim-kiem
  useEffect(() => {
    async function fetchRiders() {
      try {
        setLoadingList(true);
        const res = await fetch(getProxyUrl("https://ophim1.com/v1/api/tim-kiem?keyword=kamen+rider&limit=12"));
        const data = await res.json();
        
        if (data.status === "success" || data.status === true) {
          const items = data.data?.items || data.items || [];
          if (items.length > 0) {
            // Loại trùng lặp slug
            const seen = new Set<string>();
            const uniqueItems = items.filter((item: any) => {
              const baseSlug = cleanSlug(item.slug);
              if (seen.has(baseSlug)) return false;
              seen.add(baseSlug);
              return true;
            });
            const top8 = uniqueItems.slice(0, 8);
            setMovies(top8);
            setActiveMovie(top8[0]);
          } else {
            setMovies(FALLBACK_RIDERS);
            setActiveMovie(FALLBACK_RIDERS[0]);
          }
        } else {
          setMovies(FALLBACK_RIDERS);
          setActiveMovie(FALLBACK_RIDERS[0]);
        }
      } catch (err) {
        console.error("Lỗi lấy danh sách Kamen Rider:", err);
        setMovies(FALLBACK_RIDERS);
        setActiveMovie(FALLBACK_RIDERS[0]);
      } finally {
        setLoadingList(false);
      }
    }
    fetchRiders();
  }, []);

  // 2. Fetch chi tiết và Logo của Rider đang được chọn
  useEffect(() => {
    const currentMovie = activeMovie;
    if (!currentMovie) return;

    let active = true;
    async function fetchActiveDetails() {
      if (!currentMovie) return;
      try {
        setLoadingDetails(true);
        setIsTransitioning(true);
        setLogoUrl(null);
        setBackdropUrl(null);

        // a. Lấy chi tiết OPhim
        let detailData = detailsCache[currentMovie.slug];
        if (!detailData) {
          const res = await fetch(getProxyUrl(`https://ophim1.com/v1/api/phim/${currentMovie.slug}`));
          const data = await res.json();
          if (data.status === true || data.status === "success") {
            detailData = data.data?.item || data.movie;
            if (active) {
              setDetailsCache(prev => ({ ...prev, [currentMovie.slug]: detailData }));
            }
          }
        }

        if (!active) return;
        setDetails(detailData || null);

        // b. Lấy Logo và Backdrop nét từ TMDB
        const titleQuery = detailData?.origin_name || currentMovie.name;
        const tmdbId = detailData?.tmdb?.id || "";
        const tmdbType = detailData?.tmdb?.type || "tv";

        const logoRes = await fetch(
          `${API_URL}/movies/logo/${currentMovie.slug}?title=${encodeURIComponent(titleQuery)}&tmdbId=${tmdbId}&tmdbType=${tmdbType}`
        );
        if (logoRes.ok && active) {
          const logoData = await logoRes.json();
          setLogoUrl(logoData.logoUrl || null);
          setBackdropUrl(logoData.backdropUrl || null);
        }
      } catch (err) {
        console.error("Lỗi lấy chi tiết Rider:", err);
      } finally {
        if (active) {
          setLoadingDetails(false);
          // Cho transition kết thúc sau 300ms
          setTimeout(() => setIsTransitioning(false), 300);
        }
      }
    }

    fetchActiveDetails();

    return () => {
      active = false;
    };
  }, [activeMovie]);

  const handleSelectRider = (movie: Movie) => {
    if (activeMovie?.slug === movie.slug) return;
    setActiveMovie(movie);
  };

  const getImageUrl = (path: string) => {
    if (!path) return "";
    if (path.startsWith("http")) return path;
    const fileName = path.split("/").pop();
    return `https://img.ophim.live/uploads/movies/${fileName}`;
  };

  const handleFavoriteToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!activeMovie) return;
    await toggleFavoriteCtx(activeMovie.slug);
  };

  if (loadingList || !activeMovie) {
    return (
      <div className="container mx-auto px-6 mt-16 max-w-7xl">
        <div className="h-[450px] bg-zinc-950/20 border border-zinc-900/60 rounded-[2rem] flex flex-col items-center justify-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500" />
          <p className="text-zinc-500 font-bold text-xs">Đang nạp dữ liệu siêu nhân...</p>
        </div>
      </div>
    );
  }

  const theme = getRiderTheme(activeMovie?.slug || "");
  const activePoster = activeMovie?.poster_url || details?.poster_url;

  return (
    <div className="container mx-auto px-6 mt-16 max-w-7xl select-none relative z-10">
      
      {/* Title block kiểu High-tech HUD */}
      <div className="flex items-center justify-between border-b border-zinc-800/40 pb-4 mb-8">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-pink-500/10 border border-pink-500/30 flex items-center justify-center">
            <Flame size={16} className="text-pink-500 animate-pulse" />
          </div>
          <h2 className="text-xl md:text-2xl font-black tracking-tight uppercase bg-gradient-to-r from-pink-500 to-rose-500 bg-clip-text text-transparent">
            Đại Lộ Siêu Nhân Tokusatsu
          </h2>
        </div>
        
        <span className="text-[10px] font-black text-zinc-550 tracking-widest bg-zinc-950/80 px-3 py-1 rounded-md border border-zinc-900/50">
          Kamen Rider Special
        </span>
      </div>

      {/* Main Console Box */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        
        {/* CỘT TRÁI (40%): TRÌNH ĐIỀU KHIỂN HENSHIN CONSOLE */}
        <div className="lg:col-span-5 bg-[#0e0f17]/95 border border-zinc-800/60 rounded-[2rem] p-6.5 flex flex-col justify-between shadow-2xl relative overflow-hidden group">
          <HalftoneOverlay />
          
          {/* Neon Glow Ambient ở góc */}
          <div 
            className="absolute -top-12 -left-12 w-32 h-32 blur-3xl opacity-20 rounded-full transition-all duration-500" 
            style={{ backgroundColor: theme.accent }}
          />

          <div className="space-y-6 flex-grow flex flex-col">
            
            {/* Visual Screen Area (mechanical gear rotating in bg) */}
            <div className="relative aspect-[3/4] max-w-[280px] mx-auto w-full rounded-2xl overflow-hidden shadow-2xl z-10 flex items-center justify-center">
              
              {/* Vòng quay biến hình phía sau */}
              <div 
                className="absolute inset-0 z-0 opacity-20 border-[6px] border-dashed rounded-full animate-[spin_35s_linear_infinite]"
                style={{ borderColor: theme.accent }}
              />

              {/* Poster đứng chính */}
              <div className={`w-[90%] h-[90%] relative rounded-xl overflow-hidden border-2 z-10 transition-all duration-500 ${theme.glowClass} ${
                isTransitioning ? "opacity-0 scale-98 blur-[2px]" : "opacity-100 scale-100 blur-0"
              }`}>
                {activePoster ? (
                  <Image
                    src={getImageUrl(activePoster)}
                    alt={activeMovie?.name || ""}
                    fill
                    className="object-cover"
                    sizes="280px"
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
                    <Monitor size={36} className="text-zinc-700" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              </div>
            </div>

            {/* Cụm thông tin phim */}
            <div className={`space-y-3.5 text-left transition-all duration-300 ${
              isTransitioning ? "opacity-0 -translate-y-2" : "opacity-100 translate-y-0"
            }`}>
              <div>
                {logoUrl ? (
                  <div className="h-14 flex items-center mb-1">
                    <img
                      src={logoUrl}
                      alt={activeMovie?.name}
                      className="max-h-full max-w-full object-contain filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ) : (
                  <h3 className="text-xl md:text-2xl font-black uppercase tracking-tight leading-tight bg-gradient-to-r from-white to-zinc-300 bg-clip-text text-transparent">
                    {activeMovie ? cleanMovieName(activeMovie.name) : ""}
                  </h3>
                )}
                
                <h4 className="text-xs font-extrabold text-zinc-400 mt-1 uppercase tracking-wide">
                  {details?.origin_name || activeMovie?.origin_name}
                </h4>
              </div>

              {/* Badges thông số */}
              <div className="flex flex-wrap items-center gap-2 text-[10px] font-black tracking-wider uppercase select-none">
                <span className="bg-amber-400 text-black px-2 py-0.5 rounded shadow-sm">
                  IMDb 7.5
                </span>
                <span className="bg-zinc-900/90 border border-zinc-800 text-zinc-400 px-2 py-0.5 rounded">
                  T13
                </span>
                <span className="bg-zinc-900/90 border border-zinc-800 text-zinc-300 px-2 py-0.5 rounded">
                  {activeMovie?.year}
                </span>
                {activeMovie?.quality && (
                  <span className="bg-zinc-900/90 border border-zinc-800 text-pink-400 px-2 py-0.5 rounded">
                    {activeMovie.quality}
                  </span>
                )}
              </div>

              {/* Tóm tắt */}
              <p className="text-xs md:text-[13px] text-zinc-400 leading-relaxed line-clamp-3">
                {details?.content ? stripHtmlTags(details.content) : "Đang nạp tóm tắt của phim siêu nhân..."}
              </p>
            </div>
          </div>

          {/* Nút hành động */}
          <div className="flex items-center gap-3 pt-6 border-t border-zinc-800/60 z-10">
            <button
              onClick={() => activeMovie && router.push(`/movie/${activeMovie.slug}`)}
              className="flex-1 h-12 rounded-xl text-xs font-black uppercase tracking-widest text-white transition-all active:scale-95 cursor-pointer relative overflow-hidden flex items-center justify-center gap-2 group/btn border border-pink-500/20 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 shadow-lg shadow-pink-500/20 hover:shadow-pink-500/35"
            >
              <Play size={13} className="fill-white text-white" />
              <span>Xem ngay</span>
            </button>

            <button
              onClick={handleFavoriteToggle}
              className={`w-12 h-12 rounded-xl border flex items-center justify-center transition-all duration-300 active:scale-95 cursor-pointer ${
                isFavorite
                  ? "bg-rose-500/10 border-rose-500 text-rose-500 shadow-md shadow-rose-500/15"
                  : "bg-zinc-950/40 border-zinc-800 text-zinc-400 hover:text-white"
              }`}
            >
              <Heart size={16} className={isFavorite ? "fill-rose-500" : ""} />
            </button>
          </div>
        </div>

        {/* CỘT PHẢI (60%): BẢNG LƯỚI RIDER MATRIX GRID */}
        <div className="lg:col-span-7 flex flex-col justify-between">
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-2 gap-4">
            {movies.map((movie) => {
              const isSelected = movie.slug === activeMovie?.slug;
              const rTheme = getRiderTheme(movie.slug);
              
              return (
                <div
                  key={movie._id}
                  onClick={() => handleSelectRider(movie)}
                  className={`group/card relative aspect-[16/10] rounded-[1.5rem] overflow-hidden bg-zinc-950 border-2 cursor-pointer transition-all duration-300 hover:scale-[1.02] ${
                    isSelected
                      ? `${rTheme.glowClass} scale-[1.01]`
                      : "border-zinc-900 hover:border-zinc-800"
                  }`}
                >
                  {/* Backdrop Background */}
                  {movie.thumb_url || movie.poster_url ? (
                    <Image
                      src={getImageUrl(movie.thumb_url || movie.poster_url || "")}
                      alt={movie.name}
                      fill
                      className="object-cover opacity-60 group-hover/card:opacity-85 transition-opacity duration-300"
                      sizes="(max-width: 768px) 50vw, 240px"
                      unoptimized
                    />
                  ) : null}
                  
                  {/* Technology Tech Overlay pattern */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent z-10" />
                  
                  {/* Hover indicator lines (glow) */}
                  <div 
                    className="absolute bottom-0 left-0 right-0 h-1 transition-all duration-300 scale-x-0 group-hover/card:scale-x-100 z-20"
                    style={{ backgroundColor: rTheme.accent }}
                  />

                  {/* Text Details */}
                  <div className="absolute bottom-4 left-4 right-4 z-20 text-left">
                    <span 
                      className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-black/60 border mb-1.5 inline-block"
                      style={{ borderColor: `${rTheme.accent}33`, color: rTheme.accent }}
                    >
                      {movie.year || "RIDER"}
                    </span>
                    <h3 className="text-xs md:text-sm font-extrabold uppercase tracking-tight text-white group-hover/card:text-zinc-100 transition-colors line-clamp-1">
                      {cleanMovieName(movie.name)}
                    </h3>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

    </div>
  );
}

const stripHtmlTags = (html?: string) => {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, "");
};
