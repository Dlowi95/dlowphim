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
  year?: number | string;
  quality?: string;
  lang?: string;
  time?: string;
  category?: any[];
  // Admin DB custom fields
  _customPoster?: string;
  _customBanner?: string;
  _themeColor?: string;
  _description?: string;
}

// 6 Featured Kamen Riders — slug chính xác theo OPhim API (tìm kiếm thực tế)
// Thứ tự hiển thị: Zi-O → Decade → Build → Zero-One → Blade → Genm/Ex-Aid
const TARGET_RIDERS: { slug: string; fallback: Movie }[] = [
  {
    slug: "hiep-si-mat-na-zi-o",
    fallback: {
      _id: "rider-zi-o",
      name: "Hiệp Sĩ Mặt Nạ Zi-O",
      slug: "hiep-si-mat-na-zi-o",
      origin_name: "Kamen Rider Zi-O (Over Quartzer)",
      year: 2018,
      quality: "HD",
      lang: "Vietsub",
      time: "49 tập"
    }
  },
  {
    slug: "kamen-rider-decade-all-riders-super-spin-off",
    fallback: {
      _id: "rider-decade",
      name: "Kamen Rider Decade",
      slug: "kamen-rider-decade-all-riders-super-spin-off",
      origin_name: "Kamen Rider Decade (All Riders)",
      year: 2009,
      quality: "HD",
      lang: "Vietsub",
      time: "31 tập"
    }
  },
  {
    slug: "hiep-si-mat-na-build",
    fallback: {
      _id: "rider-build",
      name: "Hiệp Sĩ Mặt Nạ Build",
      slug: "hiep-si-mat-na-build",
      origin_name: "Kamen Rider Build (Be The One)",
      year: 2017,
      quality: "HD",
      lang: "Vietsub",
      time: "49 tập"
    }
  },
  {
    slug: "hiep-sy-mat-na-hiem-hoa-tri-tue-nhan-tao",
    fallback: {
      _id: "rider-zero-one",
      name: "Hiệp Sỹ Mặt Nạ: Hiểm Hoạ Trí Tuệ Nhân Tạo",
      slug: "hiep-sy-mat-na-hiem-hoa-tri-tue-nhan-tao",
      origin_name: "Kamen Rider Zero-One (REAL×TIME)",
      year: 2019,
      quality: "HD",
      lang: "Vietsub",
      time: "45 tập"
    }
  },
  {
    slug: "sieu-nhan-the-bai",
    fallback: {
      _id: "rider-blade",
      name: "Siêu Nhân Thẻ Bài",
      slug: "sieu-nhan-the-bai",
      origin_name: "Kamen Rider Blade (Missing Ace)",
      year: 2004,
      quality: "HD",
      lang: "Vietsub",
      time: "49 tập"
    }
  },
  {
    slug: "sieu-nhan-ex-aid",
    fallback: {
      _id: "rider-genm",
      name: "Siêu Nhân Ex-Aid",
      slug: "sieu-nhan-ex-aid",
      origin_name: "Kamen Rider Ex-Aid / Genm Versus",
      year: 2016,
      quality: "HD",
      lang: "Vietsub",
      time: "45 tập"
    }
  }
];

// Helper to determine neon glow & custom UI theme color based on the Kamen Rider slug or admin DB theme color
const getRiderTheme = (slug: string, movie?: Movie) => {
  if (movie?._themeColor) {
    const hex = movie._themeColor;
    return {
      glowClass: `shadow-[0_0_25px_rgba(255,255,255,0.2)] border-[${hex}]`,
      textClass: `drop-shadow-[0_2px_8px_${hex}]`,
      gradient: `from-[${hex}] via-zinc-800 to-black`,
      buttonBg: `from-zinc-900 to-zinc-950 text-white border-[${hex}]`,
      accent: hex,
      badgeText: "CUSTOM THEME",
      customStyle: {
        borderColor: hex,
        color: hex,
      }
    };
  }

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
  // slug OPhim: hiep-sy-mat-na-hiem-hoa-tri-tue-nhan-tao
  if (s.includes("zero-one") || s.includes("zeroone") || s.includes("hiem-hoa") || s.includes("nhan-tao")) {
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
  // slug OPhim: sieu-nhan-the-bai
  if (s.includes("blade") || s.includes("the-bai")) {
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
  const [tmdbPosterUrl, setTmdbPosterUrl] = useState<string | null>(null);
  const [tmdbCardData, setTmdbCardData] = useState<Record<string, {backdrop: string; poster: string}>>({});
  
  const [detailsCache, setDetailsCache] = useState<Record<string, any>>({});
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const router = useRouter();
  const { user, toggleFavorite: toggleFavoriteCtx } = useAuth();
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

  const isFavorite = user?.favorites?.includes(activeMovie?.slug || "") || false;

  // 1. Fetch Riders: DB (admin) ưu tiên → OPhim + TMDB fallback
  useEffect(() => {
    async function fetchRiders() {
      try {
        setLoadingList(true);
        const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

        // ── Thử lấy từ DB admin trước ──
        const dbRes = await fetch(`${api}/featured-riders`);
        if (dbRes.ok) {
          const dbRiders = await dbRes.json();
          if (Array.isArray(dbRiders) && dbRiders.length > 0) {
            // Có dữ liệu trong DB → dùng luôn, kèm ảnh custom
            const riders: Movie[] = dbRiders.map((r: any) => ({
              _id: r._id,
              name: r.name,
              slug: r.slug,
              origin_name: r.originName || r.name,
              poster_url: r.posterUrl || "",
              thumb_url: r.bannerUrl || r.posterUrl || "", // bannerUrl làm thumb cho card grid
              year: r.year || "",
              quality: r.quality || "HD",
              lang: "Vietsub",
              time: "",
              // Attach custom images vào đối tượng để component con dùng
              _customPoster: r.posterUrl || "",
              _customBanner: r.bannerUrl || "",
              _themeColor: r.themeColor || "",
              _description: r.description || "",
            }));

            setMovies(riders);
            setActiveMovie(riders[0]);

            // Build tmdbCardData từ DB (bannerUrl làm backdrop, posterUrl làm poster)
            const tmdbMap: Record<string, { backdrop: string; poster: string }> = {};
            dbRiders.forEach((r: any) => {
              tmdbMap[r.slug] = {
                backdrop: r.bannerUrl || "",
                poster: r.posterUrl || "",
              };
            });
            setTmdbCardData(tmdbMap);

            // tmdbPosterUrl cho active rider (để panel trái cũng dùng ảnh DB)
            // Sẽ được set trong useEffect [activeMovie] bên dưới
            return; // Không fetch thêm OPhim nữa
          }
        }

        // ── Fallback: Fetch từng slug OPhim ──
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

        // Batch-fetch TMDB backdrops cho tất cả 6 cards
        const tmdbBatch = await Promise.allSettled(
          TARGET_RIDERS.map(async ({ slug, fallback }) => {
            try {
              const q = encodeURIComponent(fallback.origin_name);
              const res = await fetch(`${api}/movies/logo/${slug}?title=${q}&tmdbType=tv`);
              if (res.ok) {
                const d = await res.json();
                return { slug, backdrop: d.backdropUrl || "", poster: d.posterUrl || "" };
              }
            } catch {}
            return { slug, backdrop: "", poster: "" };
          })
        );
        const tmdbMap: Record<string, { backdrop: string; poster: string }> = {};
        tmdbBatch.forEach(r => {
          if (r.status === "fulfilled" && r.value) {
            tmdbMap[r.value.slug] = { backdrop: r.value.backdrop, poster: r.value.poster };
          }
        });
        setTmdbCardData(tmdbMap);

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
        setTmdbPosterUrl(null);

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

        // b. Lấy Logo, Backdrop và Poster chất lượng cao từ TMDB
        // Ưu tiên dùng origin_name tiếng Anh để TMDB tìm chính xác hơn
        const riderTarget = TARGET_RIDERS.find(r => r.slug === currentMovie.slug);
        const titleQuery = detailData?.origin_name
          || riderTarget?.fallback.origin_name
          || currentMovie.origin_name
          || currentMovie.name;
        const tmdbId = detailData?.tmdb?.id || "";
        const tmdbType = detailData?.tmdb?.type || "tv";

        const logoRes = await fetch(
          `${API_URL}/movies/logo/${currentMovie.slug}?title=${encodeURIComponent(titleQuery)}&tmdbId=${tmdbId}&tmdbType=${tmdbType}`
        );
        if (logoRes.ok && active) {
          const logoData = await logoRes.json();
          setLogoUrl(logoData.logoUrl || null);
          setBackdropUrl(logoData.backdropUrl || null);
          setTmdbPosterUrl(logoData.posterUrl || null);
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

  const theme = getRiderTheme(activeMovie.slug, activeMovie);
  // Ưu tiên: Custom Poster (Admin DB) → TMDB poster → OPhim poster → OPhim thumb
  const activePoster = activeMovie._customPoster || tmdbPosterUrl || activeMovie.poster_url || details?.poster_url;

  return (
    <div className="container mx-auto px-4 md:px-6 mt-16 max-w-7xl select-none relative z-10 space-y-6">
      
      {/* Title block kiểu High-tech HUD năng động */}
      <div className="flex items-center justify-between border-b border-zinc-800/40 pb-4">
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
          className="text-[10px] font-black tracking-widest px-3 py-1 rounded-md border transition-all duration-500 hidden sm:inline-block"
          style={{ 
            backgroundColor: "#090a0f", 
            borderColor: `${theme.accent}40`,
            color: theme.accent 
          }}
        >
          {theme.badgeText}
        </span>
      </div>

      {/* ─── HERO STAGE (PANEL HIỂN THỊ CHÍNH DẠNG CINEMATIC STAGE) ─── */}
      <div className="relative rounded-[2rem] overflow-hidden border border-zinc-800/80 bg-[#0c0d14] shadow-2xl transition-all duration-500 group">
        <HalftoneOverlay />

        {/* Ambient Blur Glow ở góc màn hình */}
        <div 
          className="absolute -top-24 -left-24 w-96 h-96 blur-3xl opacity-20 rounded-full transition-all duration-700 pointer-events-none" 
          style={{ backgroundColor: theme.accent }}
        />
        <div 
          className="absolute -bottom-24 -right-24 w-96 h-96 blur-3xl opacity-15 rounded-full transition-all duration-700 pointer-events-none" 
          style={{ backgroundColor: theme.accent }}
        />

        {/* Backdrop Background Mờ phía sau */}
        {backdropUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={backdropUrl}
            alt="backdrop"
            className="absolute inset-0 w-full h-full object-cover opacity-20 filter blur-sm scale-105 transition-all duration-700 pointer-events-none"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0c0d14] via-[#0c0d14]/90 to-[#0c0d14]/70 z-0" />

        <div className="relative z-10 p-6 md:p-8 grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
          
          {/* POSTER ĐỨNG NẾT CĂNG (PORTRAIT 2:3) BÊN TRÁI HERO */}
          <div className="md:col-span-4 lg:col-span-3 flex justify-center">
            <div className={`relative aspect-[2/3] w-full max-w-[240px] rounded-2xl overflow-hidden border-2 transition-all duration-500 shadow-2xl ${theme.glowClass} ${
              isTransitioning ? "opacity-0 scale-95 blur-[2px]" : "opacity-100 scale-100 blur-0"
            }`}>
              {activePoster ? (
                <Image
                  src={getImageUrl(activePoster)}
                  alt={activeMovie.name}
                  fill
                  className="object-cover"
                  sizes="240px"
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

          {/* CHI TIẾT VÀ NÚT XEM NGAY BÊN PHẢI HERO */}
          <div className="md:col-span-8 lg:col-span-9 space-y-4 text-left">
            <div className={`space-y-2 transition-all duration-300 ${
              isTransitioning ? "opacity-0 -translate-y-2" : "opacity-100 translate-y-0"
            }`}>
              {/* Logo phim hoặc Tên lớn */}
              {logoUrl ? (
                <div className="h-16 md:h-20 flex items-center">
                  <img
                    src={logoUrl}
                    alt={activeMovie.name}
                    className="max-h-full max-w-[320px] object-contain filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)]"
                    referrerPolicy="no-referrer"
                  />
                </div>
              ) : (
                <h3 className="text-2xl md:text-4xl font-black uppercase tracking-tight text-white drop-shadow-md">
                  {cleanMovieName(activeMovie.name)}
                </h3>
              )}

              <h4 className="text-xs md:text-sm font-bold text-zinc-400 uppercase tracking-widest">
                {details?.origin_name || activeMovie.origin_name}
              </h4>

              {/* Thông số Badges */}
              <div className="flex flex-wrap items-center gap-2 pt-1 text-[10px] md:text-xs font-black tracking-wider uppercase select-none">
                <span 
                  className="px-2.5 py-0.5 rounded shadow-md text-black font-black"
                  style={{ backgroundColor: theme.accent }}
                >
                  IMDb 8.0
                </span>
                <span className="bg-zinc-900/90 border border-zinc-800 text-zinc-400 px-2.5 py-0.5 rounded">
                  T13
                </span>
                <span className="bg-zinc-900/90 border border-zinc-800 text-zinc-300 px-2.5 py-0.5 rounded">
                  {activeMovie.year}
                </span>
                {activeMovie.quality && (
                  <span 
                    className="bg-zinc-900/90 border border-zinc-800 px-2.5 py-0.5 rounded font-bold"
                    style={{ color: theme.accent }}
                  >
                    {activeMovie.quality}
                  </span>
                )}
              </div>

              {/* Mô tả ngắn */}
              <p className="text-xs md:text-sm text-zinc-300 leading-relaxed line-clamp-3 pt-2 max-w-3xl">
                {activeMovie._description || (details?.content ? stripHtmlTags(details.content) : "Đang nạp tóm tắt của huyền thoại Kamen Rider...")}
              </p>
            </div>

            {/* Nút xem ngay & yêu thích */}
            <div className="flex items-center gap-3 pt-4">
              <button
                onClick={() => router.push(`/movie/${activeMovie.slug}`)}
                className={`px-8 h-12 rounded-xl text-xs md:text-sm font-black uppercase tracking-widest transition-all active:scale-95 cursor-pointer relative overflow-hidden flex items-center justify-center gap-2 group/btn border border-white/20 bg-gradient-to-r ${theme.buttonBg} shadow-lg shadow-black/40`}
              >
                <Play size={16} className="fill-current" />
                <span>Xem Ngay Ngay Bằng HD</span>
              </button>

              <button
                onClick={handleFavoriteToggle}
                className={`w-12 h-12 rounded-xl border flex items-center justify-center transition-all duration-300 active:scale-95 cursor-pointer ${
                  isFavorite
                    ? "bg-rose-500/10 border-rose-500 text-rose-500 shadow-md shadow-rose-500/15"
                    : "bg-zinc-950/40 border-zinc-800 text-zinc-400 hover:text-white"
                }`}
              >
                <Heart size={18} className={isFavorite ? "fill-rose-500" : ""} />
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* ─── 6 CARDS ĐỒNG NHẤT TỈ LỆ PORTRAIT 2:3 (HÌNH CHÍNH DIỆN RIDER) ─── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-black uppercase tracking-widest text-zinc-400">
            Chọn Kamen Rider (6 Huyền Thoại)
          </span>
          <span className="text-[10px] text-zinc-500">
            Click vào thẻ để chuyển đổi giao diện & màu sắc
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 md:gap-4">
          {movies.map((movie) => {
            const isSelected = movie.slug === activeMovie.slug;
            const rTheme = getRiderTheme(movie.slug, movie);

            // Ưu tiên Poster Dọc chuẩn 2:3 chính diện
            const cardPoster = movie._customPoster 
              || tmdbCardData[movie.slug]?.poster
              || getImageUrl(movie.poster_url || movie.thumb_url || "");

            return (
              <div
                key={movie._id}
                onClick={() => handleSelectRider(movie)}
                className={`group/card relative aspect-[2/3] rounded-2xl overflow-hidden bg-zinc-950 border-2 cursor-pointer transition-all duration-300 ${
                  isSelected
                    ? "scale-[1.04] z-20 shadow-xl"
                    : "border-zinc-800/80 hover:border-zinc-700 opacity-75 hover:opacity-100 hover:scale-[1.02]"
                }`}
                style={{
                  borderColor: isSelected ? rTheme.accent : undefined,
                  boxShadow: isSelected ? `0 0 20px ${rTheme.accent}66` : undefined,
                }}
              >
                {/* Poster chính diện đứng */}
                {cardPoster ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={cardPoster}
                    alt={movie.name}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover/card:scale-105"
                  />
                ) : (
                  <div
                    className="absolute inset-0 opacity-20"
                    style={{ background: `linear-gradient(135deg, ${rTheme.accent}44, transparent)` }}
                  />
                )}

                {/* Dark Gradient Overlay ở dưới */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent z-10 opacity-90 group-hover/card:opacity-75 transition-opacity" />

                {/* Badge Năm sản xuất ở góc trên */}
                <div className="absolute top-2.5 left-2.5 z-20">
                  <span 
                    className="text-[9px] font-black tracking-wider px-2 py-0.5 rounded bg-black/80 border border-white/10 text-white"
                    style={{ borderColor: isSelected ? `${rTheme.accent}66` : undefined }}
                  >
                    {movie.year || "RIDER"}
                  </span>
                </div>

                {/* Indicator Glow Line khi được chọn */}
                <div 
                  className={`absolute bottom-0 left-0 right-0 h-1.5 transition-all duration-300 z-20 ${
                    isSelected ? "scale-x-100" : "scale-x-0 group-hover/card:scale-x-100"
                  }`}
                  style={{ backgroundColor: rTheme.accent }}
                />

                {/* Tên Rider */}
                <div className="absolute bottom-3 left-3 right-3 z-20 text-left">
                  <h3 
                    className="text-xs md:text-sm font-black uppercase tracking-tight text-white line-clamp-1 drop-shadow-md transition-colors"
                    style={{ color: isSelected ? rTheme.accent : undefined }}
                  >
                    {cleanMovieName(movie.name)}
                  </h3>
                  <p className="text-[10px] text-zinc-400 line-clamp-1 font-medium">
                    {movie.origin_name || movie.name}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}

const stripHtmlTags = (html?: string) => {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, "");
};
