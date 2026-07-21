"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Play, Heart, Monitor, Flame, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
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
  _gallery?: {
    name: string;
    color: string;
    imageUrl: string;
    symbol?: string;
    weapon?: string;
    power?: number;
    actor?: string;
    description?: string;
  }[];
}

// 6 Featured Super Sentai / Siêu Nhân Tuổi Thơ
const TARGET_RIDERS: { slug: string; fallback: Movie }[] = [
  {
    slug: "sieu-nhan-gao-2011",
    fallback: {
      _id: "sentai-gao",
      name: "Siêu Nhân Gao",
      slug: "sieu-nhan-gao-2011",
      origin_name: "Hyakujuu Sentai Gaoranger",
      year: 2001,
      quality: "HD",
      lang: "Vietsub",
      time: "51 tập",
      poster_url: "https://image.tmdb.org/t/p/w500/yrErA1GiQcZikGG3c0bITFlCO6f.jpg",
      thumb_url: "https://image.tmdb.org/t/p/w1280/hmhSP3LnFkuhfMmXTLzo5kV23Oz.jpg"
    }
  },
  {
    slug: "sieu-nhan-cuong-phong",
    fallback: {
      _id: "sentai-cuong-phong",
      name: "Siêu Nhân Cuồng Phong",
      slug: "sieu-nhan-cuong-phong",
      origin_name: "Power Rangers Ninja Storm",
      year: 2003,
      quality: "HD",
      lang: "Vietsub",
      time: "38 tập",
      poster_url: "https://image.tmdb.org/t/p/w500/qx3SJlAp2RK656TusqKx1qEqVMW.jpg",
      thumb_url: "https://image.tmdb.org/t/p/w1280/i01wnWz0Z3rMATqbkAVLHEaGbNP.jpg"
    }
  },
  {
    slug: "chien-doi-than-kiem-shinkenger",
    fallback: {
      _id: "sentai-shinkenger",
      name: "Chiến Đội Thần Kiếm Shinkenger",
      slug: "chien-doi-than-kiem-shinkenger",
      origin_name: "Samurai Sentai Shinkenger",
      year: 2009,
      quality: "HD",
      lang: "Vietsub",
      time: "49 tập",
      poster_url: "https://image.tmdb.org/t/p/w500/tMAqqOU2Tz5F6uDpJuqAlRhyvhP.jpg",
      thumb_url: "https://image.tmdb.org/t/p/w1280/2PE9z3QAmjoMUvsKcJ0lzEwLFOc.jpg"
    }
  },
  {
    slug: "chien-doi-dac-nhiem-dekaranger",
    fallback: {
      _id: "sentai-dekaranger",
      name: "Chiến Đội Đặc Nhiệm Dekaranger",
      slug: "chien-doi-dac-nhiem-dekaranger",
      origin_name: "Tokusou Sentai Dekaranger",
      year: 2004,
      quality: "HD",
      lang: "Vietsub",
      time: "50 tập",
      poster_url: "https://image.tmdb.org/t/p/w500/vupRI1U1wFMF6hDBXRkx93A6xGE.jpg",
      thumb_url: "https://image.tmdb.org/t/p/w1280/hM4CnVs5wW9SI1TQkMTljsHhUE5.jpg"
    }
  },
  {
    slug: "chien-doi-phieu-luu-boukenger",
    fallback: {
      _id: "sentai-boukenger",
      name: "Chiến Đội Phiêu Lưu Boukenger",
      slug: "chien-doi-phieu-luu-boukenger",
      origin_name: "GoGo Sentai Boukenger",
      year: 2006,
      quality: "HD",
      lang: "Vietsub",
      time: "49 tập",
      poster_url: "https://image.tmdb.org/t/p/w500/eUUZcEvQS03DZHaOw9vBusemlBN.jpg",
      thumb_url: "https://image.tmdb.org/t/p/w1280/v2wiAoSf3b0t0UmonVSYJI3yWXH.jpg"
    }
  },
  {
    slug: "chien-doi-boc-long-abaranger",
    fallback: {
      _id: "sentai-abaranger",
      name: "Chiến Đội Bộc Long Abaranger",
      slug: "chien-doi-boc-long-abaranger",
      origin_name: "Bakuryu Sentai Abaranger",
      year: 2003,
      quality: "HD",
      lang: "Vietsub",
      time: "50 tập",
      poster_url: "https://image.tmdb.org/t/p/w500/bDoHBImQZI7ruSkxWtnkxDLra58.jpg",
      thumb_url: "https://image.tmdb.org/t/p/w1280/gbY5crvWFNCRgME9fu05kddHhXH.jpg"
    }
  }
];

// Helper to determine neon glow & custom UI theme color based on the Sentai slug or admin DB theme color
const getRiderTheme = (slug: string, movie?: Movie) => {
  if (movie?._themeColor) {
    const hex = movie._themeColor;
    return {
      glowClass: `shadow-[0_0_25px_rgba(255,255,255,0.2)] border-[${hex}]`,
      textClass: `drop-shadow-[0_2px_8px_${hex}]`,
      gradient: `from-[${hex}] via-zinc-800 to-black`,
      buttonBg: `from-zinc-900 to-zinc-950 text-white border-[${hex}]`,
      accent: hex,
      badgeText: "SUPER SENTAI",
      customStyle: {
        borderColor: hex,
        color: hex,
      }
    };
  }

  const s = slug.toLowerCase();

  // 1. Siêu Nhân Gao (Đỏ Rực)
  if (s.includes("gao")) {
    return {
      glowClass: "shadow-[0_0_25px_rgba(239,68,68,0.6)] border-[#EF4444]",
      textClass: "text-[#EF4444] drop-shadow-[0_2px_8px_rgba(239,68,68,0.6)]",
      gradient: "from-[#EF4444] via-[#DC2626] to-[#991B1B]",
      buttonBg: "from-[#EF4444] to-[#DC2626] text-white font-black hover:from-[#F87171]",
      accent: "#EF4444",
      badgeText: "BÁCH THÚ GAORANGER"
    };
  }

  // 2. Cuồng Phong (Xanh Dương)
  if (s.includes("cuong-phong") || s.includes("ninja-storm")) {
    return {
      glowClass: "shadow-[0_0_25px_rgba(59,130,246,0.6)] border-[#3B82F6]",
      textClass: "text-[#3B82F6] drop-shadow-[0_2px_8px_rgba(59,130,246,0.6)]",
      gradient: "from-[#3B82F6] via-[#2563EB] to-[#1D4ED8]",
      buttonBg: "from-[#3B82F6] to-[#2563EB] text-white hover:from-[#60A5FA]",
      accent: "#3B82F6",
      badgeText: "PHONG NHẪN NINJA STORM"
    };
  }

  // 3. Shinkenger (Vàng Samurai)
  if (s.includes("shinkenger") || s.includes("than-kiem")) {
    return {
      glowClass: "shadow-[0_0_25px_rgba(234,179,8,0.6)] border-[#EAB308]",
      textClass: "text-[#EAB308] drop-shadow-[0_2px_8px_rgba(234,179,8,0.6)]",
      gradient: "from-[#EAB308] via-[#CA8A04] to-[#854D0E]",
      buttonBg: "from-[#EAB308] to-[#CA8A04] text-black font-black hover:from-[#FACC15]",
      accent: "#EAB308",
      badgeText: "SAMURAI SHINKENGER"
    };
  }

  // 4. Dekaranger (Xanh Lục Emerald / Cảnh sát S.P.D)
  if (s.includes("dekaranger") || s.includes("dac-nhiem")) {
    return {
      glowClass: "shadow-[0_0_25px_rgba(16,185,129,0.6)] border-[#10B981]",
      textClass: "text-[#10B981] drop-shadow-[0_2px_8px_rgba(16,185,129,0.6)]",
      gradient: "from-[#10B981] via-[#059669] to-[#047857]",
      buttonBg: "from-[#10B981] to-[#059669] text-white hover:from-[#34D399]",
      accent: "#10B981",
      badgeText: "CẢNH SÁT SPD DEKARANGER"
    };
  }

  // 5. Boukenger (Cam Phiêu Lưu)
  if (s.includes("boukenger") || s.includes("phieu-luu")) {
    return {
      glowClass: "shadow-[0_0_25px_rgba(249,115,22,0.6)] border-[#F97316]",
      textClass: "text-[#F97316] drop-shadow-[0_2px_8px_rgba(249,115,22,0.6)]",
      gradient: "from-[#F97316] via-[#EA580C] to-[#C2410C]",
      buttonBg: "from-[#F97316] to-[#EA580C] text-white hover:from-[#FB923C]",
      accent: "#F97316",
      badgeText: "PHIÊU LƯU BOUKENGER"
    };
  }

  // 6. Abaranger (Tím Bộc Long)
  if (s.includes("abaranger") || s.includes("boc-long")) {
    return {
      glowClass: "shadow-[0_0_25px_rgba(139,92,246,0.6)] border-[#8B5CF6]",
      textClass: "text-[#8B5CF6] drop-shadow-[0_2px_8px_rgba(139,92,246,0.6)]",
      gradient: "from-[#8B5CF6] via-[#7C3AED] to-[#5B21B6]",
      buttonBg: "from-[#8B5CF6] to-[#7C3AED] text-white hover:from-[#A78BFA]",
      accent: "#8B5CF6",
      badgeText: "BỘC LONG ABARANGER"
    };
  }

  // Default Fallback
  return {
    glowClass: "shadow-[0_0_25px_rgba(236,72,153,0.55)] border-pink-500",
    textClass: "text-pink-500 drop-shadow-[0_2px_8px_rgba(236,72,153,0.6)]",
    gradient: "from-pink-500 via-purple-600 to-indigo-500",
    buttonBg: "from-pink-500 to-rose-500 text-white hover:from-pink-600 hover:to-rose-600",
    accent: "#ec4899",
    badgeText: "SUPER SENTAI"
  };
};

export default function KamenRiderRow() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [activeMovie, setActiveMovie] = useState<Movie | null>(null);
  const [details, setDetails] = useState<any | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [backdropUrl, setBackdropUrl] = useState<string | null>(null);
  const [tmdbPosterUrl, setTmdbPosterUrl] = useState<string | null>(null);
  const [tmdbCardData, setTmdbCardData] = useState<Record<string, { backdrop: string; poster: string }>>({});

  const [activeGalleryIndex, setActiveGalleryIndex] = useState<number>(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [tilt, setTilt] = useState<{ rx: number; ry: number; gx: number; gy: number }>({ rx: 0, ry: 0, gx: 50, gy: 50 });
  const [isHovered, setIsHovered] = useState(false);
  const [showRangerModal, setShowRangerModal] = useState(false);

  const handleMouseMove3D = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsHovered(true);
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rx = ((y - centerY) / centerY) * -14;
    const ry = ((x - centerX) / centerX) * 14;
    const gx = (x / rect.width) * 100;
    const gy = (y / rect.height) * 100;
    setTilt({ rx, ry, gx, gy });
  };

  const handleMouseLeave3D = () => {
    setIsHovered(false);
    setTilt({ rx: 0, ry: 0, gx: 50, gy: 50 });
  };

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
              // Attach custom images & gallery 5 Super Sentai vào đối tượng
              _customPoster: r.posterUrl || "",
              _customBanner: r.bannerUrl || "",
              _themeColor: r.themeColor || "",
              _description: r.description || "",
              _gallery: Array.isArray(r.gallery) ? r.gallery : [],
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
            } catch { }
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
    setActiveGalleryIndex(0);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX - touchEndX;
    const gallery = activeMovie?._gallery || [];
    if (gallery.length > 0) {
      if (diff > 30) {
        // Lướt sang trái -> chuyển Ranger tiếp theo
        setActiveGalleryIndex((prev) => (prev + 1) % gallery.length);
      } else if (diff < -30) {
        // Lướt sang phải -> quay lại Ranger trước
        setActiveGalleryIndex((prev) => (prev - 1 + gallery.length) % gallery.length);
      }
    }
    setTouchStartX(null);
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
          <p className="text-zinc-500 font-bold text-xs">Đang nạp 6 Siêu Nhân Tuổi Thơ Super Sentai...</p>
        </div>
      </div>
    );
  }

  const theme = getRiderTheme(activeMovie.slug, activeMovie);
  const gallery = activeMovie._gallery || [];
  const currentRanger = gallery[activeGalleryIndex];

  // Ưu tiên: Ranger được chọn từ Gallery → Custom Poster (Admin DB) → TMDB poster → OPhim poster
  const activePoster = currentRanger?.imageUrl || activeMovie._customPoster || tmdbPosterUrl || activeMovie.poster_url || details?.poster_url;
  const activeAccentColor = currentRanger?.color || theme.accent;

  return (
    <div className="container mx-auto px-4 md:px-6 mt-16 max-w-7xl select-none relative z-10 space-y-6">

      {/* Title block kiểu High-tech HUD năng động */}
      <div className="flex items-center justify-between border-b border-zinc-800/40 pb-4">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-500 border"
            style={{ backgroundColor: `${activeAccentColor}15`, borderColor: `${activeAccentColor}40` }}
          >
            <Flame size={16} style={{ color: activeAccentColor }} className="animate-pulse" />
          </div>
          <h2
            className="text-xl md:text-2xl font-black tracking-tight uppercase transition-all duration-500"
            style={{ color: activeAccentColor }}
          >
            Đại Lộ Siêu Nhân Tuổi Thơ
          </h2>
        </div>

        <span
          className="text-[10px] font-black tracking-widest px-3 py-1 rounded-md border transition-all duration-500 hidden sm:inline-block"
          style={{
            backgroundColor: "#090a0f",
            borderColor: `${activeAccentColor}40`,
            color: activeAccentColor
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
          style={{ backgroundColor: activeAccentColor }}
        />
        <div
          className="absolute -bottom-24 -right-24 w-96 h-96 blur-3xl opacity-15 rounded-full transition-all duration-700 pointer-events-none"
          style={{ backgroundColor: activeAccentColor }}
        />

        {/* Backdrop Background Sáng Rực Rỡ phía sau */}
        {backdropUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={backdropUrl}
            alt="backdrop"
            className="absolute inset-0 w-full h-full object-cover opacity-60 filter blur-[1px] scale-105 transition-all duration-700 pointer-events-none"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0c0d14] via-[#0c0d14]/70 to-[#0c0d14]/40 z-0" />

        <div className="relative z-10 p-6 md:p-8 grid grid-cols-1 md:grid-cols-12 gap-8 items-center">

          {/* POSTER ĐỨNG VỚI 3D PARALLAX TILT & MULTI-RANGER CAROUSEL SWIPER */}
          <div className="md:col-span-4 lg:col-span-3 flex flex-col items-center">
            <div
              onMouseMove={handleMouseMove3D}
              onMouseLeave={handleMouseLeave3D}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              className={`group/poster relative aspect-[2/3] w-full max-w-[240px] rounded-2xl overflow-hidden border-2 shadow-2xl cursor-grab active:cursor-grabbing select-none ${isTransitioning ? "opacity-0 scale-95 blur-[2px]" : "opacity-100 scale-100 blur-0"
                }`}
              style={{
                transform: isHovered
                  ? `perspective(1000px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) scale3d(1.05, 1.05, 1.05)`
                  : "none",
                transition: isHovered
                  ? "transform 0.1s ease-out"
                  : "transform 0.5s ease-out, border-color 0.5s, box-shadow 0.5s",
                borderColor: activeAccentColor,
                boxShadow: isHovered
                  ? `0 20px 45px ${activeAccentColor}aa`
                  : `0 0 25px ${activeAccentColor}88`,
              }}
            >
              {activePoster ? (
                <Image
                  src={getImageUrl(activePoster)}
                  alt={activeMovie.name}
                  fill
                  className="object-cover transition-all duration-500"
                  sizes="240px"
                  unoptimized
                />
              ) : (
                <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
                  <Monitor size={36} className="text-zinc-700" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />

              {/* 3D Holographic Light Glare Sheen khi hover */}
              {isHovered && (
                <div
                  className="absolute inset-0 z-20 pointer-events-none opacity-40 mix-blend-overlay transition-opacity duration-300"
                  style={{
                    background: `radial-gradient(circle at ${tilt.gx}% ${tilt.gy}%, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0) 60%)`
                  }}
                />
              )}

              {/* Tên Ranger đang chọn hiển thị trên Poster */}
              {currentRanger && (
                <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5">
                  <span
                    className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border shadow-lg backdrop-blur-md"
                    style={{
                      backgroundColor: "rgba(9, 10, 15, 0.85)",
                      borderColor: activeAccentColor,
                      color: activeAccentColor,
                      boxShadow: `0 0 12px ${activeAccentColor}66`
                    }}
                  >
                    {currentRanger.name}
                  </span>
                </div>
              )}

              {/* Mũi tên chuyển ảnh Left / Right (Desktop) */}
              {gallery.length > 1 && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveGalleryIndex((prev) => (prev - 1 + gallery.length) % gallery.length);
                    }}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 hover:bg-black/90 border border-white/20 text-white flex items-center justify-center opacity-0 group-hover/poster:opacity-100 transition-opacity z-30 cursor-pointer"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveGalleryIndex((prev) => (prev + 1) % gallery.length);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 hover:bg-black/90 border border-white/20 text-white flex items-center justify-center opacity-0 group-hover/poster:opacity-100 transition-opacity z-30 cursor-pointer"
                  >
                    <ChevronRight size={16} />
                  </button>
                </>
              )}
            </div>

            {/* BAR NÚT CHỌN MÀU SIÊU NHÂN (Ranger Color Pills Selector) */}
            {gallery.length > 0 && (
              <div className="flex flex-wrap items-center justify-center gap-1.5 mt-3.5 z-20 max-w-[250px]">
                {gallery.map((ranger, idx) => {
                  const isRangerActive = idx === activeGalleryIndex;
                  return (
                    <button
                      key={idx}
                      onClick={() => setActiveGalleryIndex(idx)}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black tracking-wider transition-all duration-300 border cursor-pointer ${isRangerActive ? "scale-105 shadow-md" : "opacity-60 hover:opacity-100"
                        }`}
                      style={{
                        borderColor: ranger.color,
                        backgroundColor: isRangerActive ? `${ranger.color}33` : "rgba(12, 13, 20, 0.8)",
                        color: isRangerActive ? ranger.color : "#a1a1aa",
                        boxShadow: isRangerActive ? `0 0 10px ${ranger.color}66` : undefined,
                      }}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ranger.color }} />
                      <span>{ranger.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* CHI TIẾT VÀ NÚT XEM NGAY BÊN PHẢI HERO */}
          <div className="md:col-span-8 lg:col-span-9 space-y-4 text-left">
            <div className={`space-y-2 transition-all duration-300 ${isTransitioning ? "opacity-0 -translate-y-2" : "opacity-100 translate-y-0"
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
                  className="px-2.5 py-0.5 rounded shadow-md text-black font-black transition-colors duration-300"
                  style={{ backgroundColor: activeAccentColor }}
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
                    className="bg-zinc-900/90 border border-zinc-800 px-2.5 py-0.5 rounded font-bold transition-colors duration-300"
                    style={{ color: activeAccentColor }}
                  >
                    {activeMovie.quality}
                  </span>
                )}
                {/* Nút xem ngay, Hồ Sơ Siêu Nhân 3D & yêu thích */}
                <div className="flex flex-wrap items-center gap-3 pt-4">
                  <button
                    onClick={() => router.push(`/movie/${activeMovie.slug}`)}
                    className={`px-7 h-12 rounded-xl text-xs md:text-sm font-black uppercase tracking-widest transition-all active:scale-95 cursor-pointer relative overflow-hidden flex items-center justify-center gap-2 group/btn border border-white/20 bg-gradient-to-r ${theme.buttonBg} shadow-lg shadow-black/40`}
                  >
                    <Play size={16} className="fill-current" />
                    <span>Xem Ngay</span>
                  </button>

                  <button
                    onClick={() => setShowRangerModal(true)}
                    className="px-5 h-12 rounded-xl text-xs md:text-sm font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer relative overflow-hidden flex items-center justify-center gap-2 border border-amber-400/40 bg-gradient-to-r from-amber-500/20 via-amber-400/10 to-amber-500/20 text-amber-300 hover:text-white hover:border-amber-400 shadow-lg shadow-amber-500/10"
                  >
                    <Sparkles size={16} className="text-amber-400 animate-spin" style={{ animationDuration: "6s" }} />
                    <span>Hồ Sơ Siêu Nhân 3D</span>
                  </button>

                  <button
                    onClick={handleFavoriteToggle}
                    className={`w-12 h-12 rounded-xl border flex items-center justify-center transition-all duration-300 active:scale-95 cursor-pointer ${isFavorite
                      ? "bg-rose-500/10 border-rose-500 text-rose-500 shadow-md shadow-rose-500/15"
                      : "bg-zinc-950/40 border-zinc-800 text-zinc-400 hover:text-white"
                      }`}
                  >
                    <Heart size={18} className={isFavorite ? "fill-rose-500" : ""} />
                  </button>
                </div>
              </div>

              {/* Mô tả ngắn */}
              <p className="text-xs md:text-sm text-zinc-300 leading-relaxed line-clamp-3 pt-2 max-w-3xl">
                {activeMovie._description || (details?.content ? stripHtmlTags(details.content) : "Đang nạp tóm tắt của huyền thoại Kamen Rider...")}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── 6 CARDS ĐỒNG NHẤT TỈ LỆ PORTRAIT 2:3 (HÌNH CHÍNH DIỆN RIDER) ─── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-black uppercase tracking-widest text-zinc-400">
            Chọn Siêu Nhân Tuổi Thơ (6 Huyền Thoại)
          </span>
          <span className="text-[10px] text-zinc-500">
            Click vào thẻ để chuyển đổi giao diện & màu sắc
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 md:gap-4">
          {movies.map((movie) => {
            const isSelected = movie.slug === activeMovie.slug;
            const rTheme = getRiderTheme(movie.slug, movie);

            // Ưu tiên Poster Dọc chuẩn 2:3 chính diện (đồng bộ 100% với Poster trên Hero)
            const cardPoster = movie._customPoster || tmdbCardData[movie.slug]?.poster || movie.poster_url || movie.thumb_url || movie._customBanner;

            return (
              <div
                key={movie._id || movie.slug}
                onClick={() => handleSelectRider(movie)}
                className={`group/card relative aspect-[2/3] rounded-2xl overflow-hidden cursor-pointer border-2 transition-all duration-500 transform active:scale-95 ${isSelected
                  ? `${rTheme.glowClass} scale-[1.03] z-20`
                  : "border-zinc-800/80 hover:border-zinc-600 hover:scale-[1.02] opacity-80 hover:opacity-100"
                  }`}
              >
                {/* Image background */}
                {cardPoster ? (
                  <Image
                    src={getImageUrl(cardPoster)}
                    alt={movie.name}
                    fill
                    className="object-cover transition-transform duration-700 group-hover/card:scale-110"
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
                    unoptimized
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
                  className={`absolute bottom-0 left-0 right-0 h-1.5 transition-all duration-300 z-20 ${isSelected ? "scale-x-100" : "scale-x-0 group-hover/card:scale-x-100"
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

      {/* ─── 3D CHARACTER PROFILE MODAL ─── */}
      {showRangerModal && activeMovie && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="relative w-full max-w-3xl rounded-3xl bg-[#0e1017]/95 border border-zinc-700/80 p-6 md:p-8 shadow-2xl overflow-hidden space-y-6">

            {/* Close button */}
            <button
              onClick={() => setShowRangerModal(false)}
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center transition-all cursor-pointer z-20"
            >
              ✕
            </button>

            {/* Header */}
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center border"
                style={{ backgroundColor: `${activeAccentColor}20`, borderColor: activeAccentColor }}
              >
                <Sparkles size={20} style={{ color: activeAccentColor }} />
              </div>
              <div>
                <h3 className="text-xl md:text-2xl font-black uppercase tracking-tight text-white">
                  Hồ Sơ 3D {activeMovie.name}
                </h3>
                <p className="text-xs text-zinc-400 font-bold uppercase tracking-wider">
                  Chỉ số sức mạnh & Vũ khí truyền kỳ từng chiến sĩ
                </p>
              </div>
            </div>

            {/* Member selector tabs */}
            {gallery.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 pb-3">
                {gallery.map((m, idx) => {
                  const isSel = idx === activeGalleryIndex;
                  return (
                    <button
                      key={idx}
                      onClick={() => setActiveGalleryIndex(idx)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer border flex items-center gap-2 ${isSel ? "scale-105 shadow-lg" : "opacity-60 hover:opacity-100"
                        }`}
                      style={{
                        borderColor: m.color,
                        backgroundColor: isSel ? `${m.color}33` : "rgba(18, 20, 29, 0.6)",
                        color: isSel ? m.color : "#d4d4d8",
                        boxShadow: isSel ? `0 0 14px ${m.color}66` : undefined,
                      }}
                    >
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: m.color }} />
                      <span>{m.name}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Character detail 3D card */}
            {currentRanger && (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">

                {/* 3D Poster / Avatar */}
                <div className="md:col-span-5 flex justify-center">
                  <div
                    className="relative aspect-[2/3] w-full max-w-[210px] rounded-2xl overflow-hidden border-2 shadow-2xl transition-all duration-500"
                    style={{
                      borderColor: activeAccentColor,
                      boxShadow: `0 0 30px ${activeAccentColor}88`
                    }}
                  >
                    <Image
                      src={getImageUrl(activePoster)}
                      alt={currentRanger.name}
                      fill
                      className="object-cover"
                      sizes="210px"
                      unoptimized
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    <div className="absolute bottom-3 left-3 right-3 text-center">
                      <span
                        className="text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full border shadow-md inline-block"
                        style={{
                          backgroundColor: "rgba(10, 10, 15, 0.9)",
                          borderColor: activeAccentColor,
                          color: activeAccentColor,
                        }}
                      >
                        {currentRanger.name}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Character Stats & Info */}
                <div className="md:col-span-7 space-y-4 text-left">
                  {currentRanger.symbol && (
                    <div className="inline-block px-3 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-bold text-amber-400">
                      Linh Thú: {currentRanger.symbol}
                    </div>
                  )}

                  {currentRanger.actor && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-zinc-500 block">Diễn viên / Biến hình</span>
                      <p className="text-sm font-bold text-zinc-200">{currentRanger.actor}</p>
                    </div>
                  )}

                  {currentRanger.weapon && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-zinc-500 block">Vũ khí huyền thoại</span>
                      <p className="text-sm font-bold text-amber-300">{currentRanger.weapon}</p>
                    </div>
                  )}

                  {/* Power Bar */}
                  <div>
                    <div className="flex justify-between items-center text-xs font-bold text-zinc-400 mb-1">
                      <span>Chỉ số sức mạnh chiến đấu</span>
                      <span style={{ color: activeAccentColor }}>{currentRanger.power || 95} / 100</span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-zinc-900 overflow-hidden p-0.5 border border-zinc-800">
                      <div
                        className="h-full rounded-full transition-all duration-700 shadow-md"
                        style={{
                          width: `${currentRanger.power || 95}%`,
                          backgroundColor: activeAccentColor,
                          boxShadow: `0 0 10px ${activeAccentColor}`
                        }}
                      />
                    </div>
                  </div>

                  {currentRanger.description && (
                    <p className="text-xs text-zinc-400 leading-relaxed pt-1 border-t border-zinc-800">
                      {currentRanger.description}
                    </p>
                  )}
                </div>

              </div>
            )}

            <div className="pt-2 border-t border-zinc-800 flex justify-end">
              <button
                onClick={() => setShowRangerModal(false)}
                className="px-5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold transition-all cursor-pointer"
              >
                Đóng
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

const stripHtmlTags = (html?: string) => {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, "");
};
