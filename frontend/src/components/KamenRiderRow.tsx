"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Play, Heart, Monitor, Flame } from "lucide-react";
import { cleanMovieName } from "@/utils/movieUtils";
import { useAuth } from "@/context/AuthContext";
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

// 6 Featured Kamen Riders — slug chính xác để fetch trực tiếp từ OPhim API
// Thứ tự hiển thị: Zi-O → Decade → Build → Zero-One → Blade → Genm/Ex-Aid
const TARGET_RIDERS: { slug: string; fallback: Movie }[] = [
  {
    slug: "kamen-rider-zi-o",
    fallback: {
      _id: "rider-zi-o",
      name: "Kamen Rider Zi-O",
      slug: "kamen-rider-zi-o",
      origin_name: "Kamen Rider Zi-O (Over Quartzer)",
      year: 2018,
      quality: "HD",
      lang: "Vietsub",
      time: "49 tập"
    }
  },
  {
    slug: "kamen-rider-decade",
    fallback: {
      _id: "rider-decade",
      name: "Kamen Rider Decade",
      slug: "kamen-rider-decade",
      origin_name: "Kamen Rider Decade (All Riders)",
      year: 2009,
      quality: "HD",
      lang: "Vietsub",
      time: "31 tập"
    }
  },
  {
    slug: "kamen-rider-build",
    fallback: {
      _id: "rider-build",
      name: "Kamen Rider Build",
      slug: "kamen-rider-build",
      origin_name: "Kamen Rider Build (Be The One)",
      year: 2017,
      quality: "HD",
      lang: "Vietsub",
      time: "49 tập"
    }
  },
  {
    slug: "kamen-rider-zero-one",
    fallback: {
      _id: "rider-zero-one",
      name: "Kamen Rider Zero-One",
      slug: "kamen-rider-zero-one",
      origin_name: "Kamen Rider Zero-One (REAL×TIME)",
      year: 2019,
      quality: "HD",
      lang: "Vietsub",
      time: "45 tập"
    }
  },
  {
    slug: "kamen-rider-blade",
    fallback: {
      _id: "rider-blade",
      name: "Kamen Rider Blade",
      slug: "kamen-rider-blade",
      origin_name: "Kamen Rider Blade (Missing Ace)",
      year: 2004,
      quality: "HD",
      lang: "Vietsub",
      time: "49 tập"
    }
  },
  {
    slug: "kamen-rider-ex-aid",
    fallback: {
      _id: "rider-genm",
      name: "Kamen Rider Ex-Aid",
      slug: "kamen-rider-ex-aid",
      origin_name: "Kamen Rider Ex-Aid / Genm Versus",
      year: 2016,
      quality: "HD",
      lang: "Vietsub",
      time: "45 tập"
    }
  }
];

// Helper to determine neon glow & custom UI theme color based on the Kamen Rider slug
const getRiderTheme = (slug: string) => {
  const s = slug.toLowerCase();
  
  // 1. Ohma Zi-O / Zi-O (Gold - Sang trọng, Uy nghiêm)
  if (s.includes("zi-o") || s.includes("ohma")) {
    return {
      glowClass: "shadow-[0_0_25px_rgba(255,215,0,0.6)] border-[#FFD700]",
      textClass: "text-[#FFD700] drop-shadow-[0_2px_8px_rgba(255,215,0,0.6)]",
      gradient: "from-[#FFD700] via-[#D4AF37] to-[#B8860B]",
      buttonBg: "from-[#FFD700] to-[#D4AF37] text-black font-black hover:from-[#FFE44D] hover:to-[#E5BE39]",
      accent: "#FFD700",
      badgeText: "VÀNG GOLD (UY NGHIÊM)"
    };
  }

  // 2. Decade (Hồng Magenta - Bất ngờ, Kết nối)
  if (s.includes("decade")) {
    return {
      glowClass: "shadow-[0_0_25px_rgba(255,0,127,0.6)] border-[#FF007F]",
      textClass: "text-[#FF007F] drop-shadow-[0_2px_8px_rgba(255,0,127,0.6)]",
      gradient: "from-[#FF007F] via-[#E4007F] to-[#C7006E]",
      buttonBg: "from-[#FF007F] to-[#E4007F] text-white hover:from-[#FF3399] hover:to-[#F5008B]",
      accent: "#FF007F",
      badgeText: "HỒNG MAGENTA (NỔI BẬT)"
    };
  }

  // 3. Build (Đỏ Crimson - Nhiệt huyết, Khoa học)
  if (s.includes("build")) {
    return {
      glowClass: "shadow-[0_0_25px_rgba(230,0,18,0.6)] border-[#E60012]",
      textClass: "text-[#E60012] drop-shadow-[0_2px_8px_rgba(230,0,18,0.6)]",
      gradient: "from-[#E60012] via-[#C8102E] to-[#A0000D]",
      buttonBg: "from-[#E60012] to-[#C8102E] text-white hover:from-[#FF1A2B] hover:to-[#DC143C]",
      accent: "#E60012",
      badgeText: "ĐỎ CRIMSON (NHIỆT HUYẾT)"
    };
  }

  // 4. Zero-One (Xanh Neon / Vàng Chanh - Công nghệ AI)
  if (s.includes("zero-one") || s.includes("zeroone")) {
    return {
      glowClass: "shadow-[0_0_25px_rgba(204,255,0,0.6)] border-[#CCFF00]",
      textClass: "text-[#CCFF00] drop-shadow-[0_2px_8px_rgba(204,255,0,0.6)]",
      gradient: "from-[#CCFF00] via-[#DFFF00] to-[#AACC00]",
      buttonBg: "from-[#CCFF00] to-[#B3E600] text-black font-black hover:from-[#D8FF33] hover:to-[#C2F000]",
      accent: "#CCFF00",
      badgeText: "XANH NEON (CÔNG NGHỆ)"
    };
  }

  // 5. Blade (Xanh Dương Cobalt - Sắc bén, Thẻ bài)
  if (s.includes("blade")) {
    return {
      glowClass: "shadow-[0_0_25px_rgba(0,85,165,0.6)] border-[#0055A5]",
      textClass: "text-[#0072CE] drop-shadow-[0_2px_8px_rgba(0,114,206,0.6)]",
      gradient: "from-[#0055A5] via-[#0072CE] to-[#003B73]",
      buttonBg: "from-[#0055A5] to-[#0072CE] text-white hover:from-[#0066CC] hover:to-[#1A8CFF]",
      accent: "#0072CE",
      badgeText: "XANH COBALT (SẮC BÉN)"
    };
  }

  // 6. Genm / Ex-Aid (Tím Violet - Gaming Huyền bí)
  if (s.includes("genm") || s.includes("ex-aid") || s.includes("exaid")) {
    return {
      glowClass: "shadow-[0_0_25px_rgba(138,43,226,0.6)] border-[#8A2BE2]",
      textClass: "text-[#8A2BE2] drop-shadow-[0_2px_8px_rgba(138,43,226,0.6)]",
      gradient: "from-[#6A0DAD] via-[#8A2BE2] to-[#4B0082]",
      buttonBg: "from-[#6A0DAD] to-[#8A2BE2] text-white hover:from-[#7B1FA2] hover:to-[#9C27B0]",
      accent: "#8A2BE2",
      badgeText: "TÍM VIOLET (GAMING)"
    };
  }

  // Default Fallback
  return {
    glowClass: "shadow-[0_0_25px_rgba(236,72,153,0.55)] border-pink-500",
    textClass: "text-pink-500 drop-shadow-[0_2px_8px_rgba(236,72,153,0.6)]",
    gradient: "from-pink-500 via-purple-600 to-indigo-500",
    buttonBg: "from-pink-500 to-rose-500 text-white hover:from-pink-600 hover:to-rose-600",
    accent: "#ec4899",
    badgeText: "SPECIAL THEME"
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

  // 1. Fetch trực tiếp từng slug của 6 Kamen Rider được chỉ định
  // Không dùng search chung để tránh API trả về phim không mong muốn
  useEffect(() => {
    async function fetchRiders() {
      try {
        setLoadingList(true);

        // Fetch song song từng slug cụ thể
        const results = await Promise.allSettled(
          TARGET_RIDERS.map(async ({ slug, fallback }) => {
            try {
              const res = await fetch(getProxyUrl(`https://ophim1.com/v1/api/phim/${slug}`));
              const data = await res.json();
              if (data.status === true || data.status === "success") {
                const item = data.data?.item || data.movie;
                if (item) {
                  return {
                    _id: item._id || fallback._id,
                    name: item.name || fallback.name,
                    slug: item.slug || slug,
                    origin_name: item.origin_name || fallback.origin_name,
                    poster_url: item.poster_url || "",
                    thumb_url: item.thumb_url || "",
                    year: item.year || fallback.year,
                    quality: item.quality || fallback.quality,
                    lang: item.lang || fallback.lang,
                    time: item.time || fallback.time,
                  } as Movie;
                }
              }
              return fallback;
            } catch {
              return fallback;
            }
          })
        );

        const riders: Movie[] = results.map((result, i) =>
          result.status === "fulfilled" ? result.value : TARGET_RIDERS[i].fallback
        );

        setMovies(riders);
        setActiveMovie(riders[0]);
      } catch (err) {
        console.error("Lỗi lấy danh sách Kamen Rider:", err);
        const fallbacks = TARGET_RIDERS.map(r => r.fallback);
        setMovies(fallbacks);
        setActiveMovie(fallbacks[0]);
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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400" />
          <p className="text-zinc-500 font-bold text-xs">Đang nạp 6 Huyền Thoại Kamen Rider...</p>
        </div>
      </div>
    );
  }

  const theme = getRiderTheme(activeMovie.slug);
  const activePoster = activeMovie.poster_url || details?.poster_url;

  return (
    <div className="container mx-auto px-6 mt-16 max-w-7xl select-none relative z-10">
      
      {/* Title block kiểu High-tech HUD năng động */}
      <div className="flex items-center justify-between border-b border-zinc-800/40 pb-4 mb-8">
        <div className="flex items-center gap-2.5">
          <div 
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-500 border"
            style={{ backgroundColor: `${theme.accent}15`, borderColor: `${theme.accent}40` }}
          >
            <Flame size={16} style={{ color: theme.accent }} className="animate-pulse" />
          </div>
          <h2 
            className="text-xl md:text-2xl font-black tracking-tight uppercase transition-all duration-500"
            style={{ color: theme.accent }}
          >
            Đại Lộ Siêu Nhân Tokusatsu
          </h2>
        </div>
        
        <span 
          className="text-[10px] font-black tracking-widest px-3 py-1 rounded-md border transition-all duration-500"
          style={{ 
            backgroundColor: "#090a0f", 
            borderColor: `${theme.accent}40`,
            color: theme.accent 
          }}
        >
          {theme.badgeText}
        </span>
      </div>

      {/* Main Console Box */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        
        {/* CỘT TRÁI (40%): TRÌNH ĐIỀU KHIỂN HENSHIN CONSOLE */}
        <div className="lg:col-span-5 bg-[#0e0f17]/95 border border-zinc-800/60 rounded-[2rem] p-6.5 flex flex-col justify-between shadow-2xl relative overflow-hidden group">
          <HalftoneOverlay />
          
          {/* Dynamic Neon Glow Ambient ở góc bối cảnh */}
          <div 
            className="absolute -top-12 -left-12 w-36 h-36 blur-3xl opacity-25 rounded-full transition-all duration-500" 
            style={{ backgroundColor: theme.accent }}
          />

          <div className="space-y-6 flex-grow flex flex-col">
            
            {/* Visual Screen Area (mechanical gear rotating in bg) */}
            <div className="relative aspect-[3/4] max-w-[280px] mx-auto w-full rounded-2xl overflow-hidden shadow-2xl z-10 flex items-center justify-center">
              
              {/* Vòng quay biến hình phía sau đổi màu theo Rider */}
              <div 
                className="absolute inset-0 z-0 opacity-30 border-[6px] border-dashed rounded-full animate-[spin_35s_linear_infinite] transition-colors duration-500"
                style={{ borderColor: theme.accent }}
              />

              {/* Poster đứng chính */}
              <div className={`w-[90%] h-[90%] relative rounded-xl overflow-hidden border-2 z-10 transition-all duration-500 ${theme.glowClass} ${
                isTransitioning ? "opacity-0 scale-98 blur-[2px]" : "opacity-100 scale-100 blur-0"
              }`}>
                {activePoster ? (
                  <Image
                    src={getImageUrl(activePoster)}
                    alt={activeMovie.name}
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
                      alt={activeMovie.name}
                      className="max-h-full max-w-full object-contain filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ) : (
                  <h3 className="text-xl md:text-2xl font-black uppercase tracking-tight leading-tight text-white">
                    {cleanMovieName(activeMovie.name)}
                  </h3>
                )}
                
                <h4 className="text-xs font-extrabold text-zinc-400 mt-1 uppercase tracking-wide">
                  {details?.origin_name || activeMovie.origin_name}
                </h4>
              </div>

              {/* Badges thông số */}
              <div className="flex flex-wrap items-center gap-2 text-[10px] font-black tracking-wider uppercase select-none">
                <span 
                  className="px-2 py-0.5 rounded shadow-sm text-black font-black transition-colors duration-500"
                  style={{ backgroundColor: theme.accent }}
                >
                  IMDb 8.0
                </span>
                <span className="bg-zinc-900/90 border border-zinc-800 text-zinc-400 px-2 py-0.5 rounded">
                  T13
                </span>
                <span className="bg-zinc-900/90 border border-zinc-800 text-zinc-300 px-2 py-0.5 rounded">
                  {activeMovie.year}
                </span>
                {activeMovie.quality && (
                  <span 
                    className="bg-zinc-900/90 border border-zinc-800 px-2 py-0.5 rounded font-bold"
                    style={{ color: theme.accent }}
                  >
                    {activeMovie.quality}
                  </span>
                )}
              </div>

              {/* Tóm tắt */}
              <p className="text-xs md:text-[13px] text-zinc-400 leading-relaxed line-clamp-3">
                {details?.content ? stripHtmlTags(details.content) : "Đang nạp tóm tắt của huyền thoại Kamen Rider..."}
              </p>
            </div>
          </div>

          {/* Nút hành động xem ngay (Background đổi màu theo Rider) */}
          <div className="flex items-center gap-3 pt-6 border-t border-zinc-800/60 z-10">
            <button
              onClick={() => router.push(`/movie/${activeMovie.slug}`)}
              className={`flex-1 h-12 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 cursor-pointer relative overflow-hidden flex items-center justify-center gap-2 group/btn border border-white/20 bg-gradient-to-r ${theme.buttonBg} shadow-lg shadow-black/40`}
            >
              <Play size={13} className="fill-current" />
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

        {/* CỘT PHẢI (60%): BẢNG LƯỚI 6 RIDERS */}
        <div className="lg:col-span-7 flex flex-col justify-between">
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-2 gap-4">
            {movies.map((movie) => {
              const isSelected = movie.slug === activeMovie.slug;
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
                      className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-black/70 border mb-1.5 inline-block"
                      style={{ borderColor: `${rTheme.accent}44`, color: rTheme.accent }}
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
