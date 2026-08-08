"use client";

import React, { useEffect, useState } from "react";
import { Play, Flame, Film, Heart, Info, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import Interests from "@/components/Interests";
import MovieRow from "@/components/MovieRow";
import MovieCard from "@/components/MovieCard";
import { cleanMovieName, getImageUrl } from "@/utils/movieUtils";
import Top10Row from "@/components/Top10Row";
import UpcomingRow from "@/components/UpcomingRow";
import CinemaRow from "@/components/CinemaRow";
import AnimeRow from "@/components/AnimeRow";
import HalftoneOverlay from "@/components/HalftoneOverlay";
import ProgressiveImage from "@/components/ProgressiveImage";
import { useAuth } from "@/context/AuthContext";
import { useResolvedHeroBanners } from "@/hooks/useResolvedHeroBanners";

const FALLBACK_CANDIDATES = [
  {
    _id: "6a0b02307544913d492aafe1",
    name: "Tiêu Dao Tứ Công Tử",
    slug: "tieu-dao-tu-cong-tu",
    origin_name: "The Reborn Young Lord",
    thumb_url: "tieu-dao-tu-cong-tu-thumb.jpg",
    poster_url: "tieu-dao-tu-cong-tu-poster.jpg",
    year: 2026
  },
  {
    _id: "6a0b02307544913d492aafe2",
    name: "Kiều Sở",
    slug: "kieu-so",
    origin_name: "Ashes to Crown",
    thumb_url: "kieu-so-thumb.jpg",
    poster_url: "kieu-so-poster.jpg",
    year: 2026
  },
  {
    _id: "6a0b02307544913d492aafe3",
    name: "Trang Trại Dutton",
    slug: "trang-trai-dutton",
    origin_name: "Dutton Ranch",
    thumb_url: "trang-trai-dutton-thumb.jpg",
    poster_url: "trang-trai-dutton-poster.jpg",
    year: 2026
  }
];

const getMovieTitleStyle = (movie: any) => {
  if (!movie) return { fontClass: "", textStyle: "" };

  const name = movie.name || "";
  const slug = movie.slug || "";
  const categorySlugs = movie.category?.map((c: any) => c.slug) || [];

  // Spooky / Horror Font
  if (categorySlugs.some((s: string) => ["kinh-di"].includes(s))) {
    return {
      fontClass: "font-creepster",
      textStyle: "text-red-600 drop-shadow-[0_2px_8px_rgba(220,38,38,0.7)] text-3xl md:text-5xl lowercase first-letter:uppercase"
    };
  }

  // Classic Calligraphy / Historical Serif Font
  if (categorySlugs.some((s: string) => ["co-trang", "than-thoai", "chien-tranh", "lich-su"].includes(s))) {
    return {
      fontClass: "font-cinzel font-black tracking-widest",
      textStyle: "bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-300 bg-clip-text text-transparent drop-shadow-[0_4px_6px_rgba(0,0,0,0.9)] text-2xl md:text-4xl"
    };
  }

  // Playful Cartoon Font
  if (categorySlugs.some((s: string) => ["hoat-hinh", "hai-huoc", "gia-dinh"].includes(s))) {
    return {
      fontClass: "font-bungee",
      textStyle: "bg-gradient-to-r from-yellow-300 via-orange-400 to-red-500 bg-clip-text text-transparent drop-shadow-[0_4px_0px_rgba(0,0,0,1)] text-2xl md:text-4xl"
    };
  }

  // Action / Martial Arts Font
  if (categorySlugs.some((s: string) => ["hanh-dong", "vo-thuat", "hinh-su", "vien-tuong"].includes(s))) {
    return {
      fontClass: "font-marker",
      textStyle: "bg-gradient-to-r from-red-500 via-rose-600 to-red-500 bg-clip-text text-transparent drop-shadow-[0_4px_8px_rgba(0,0,0,0.95)] skew-x-3 text-2xl md:text-4xl"
    };
  }

  // Romantic Script Font
  if (categorySlugs.some((s: string) => ["tinh-cam", "ca-nhac"].includes(s))) {
    return {
      fontClass: "font-pacifico",
      textStyle: "bg-gradient-to-r from-pink-400 via-rose-500 to-pink-500 bg-clip-text text-transparent drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] text-2xl md:text-4xl"
    };
  }

  // Default Cinematic Gradient (Choose color based on slug hash)
  const colors = [
    "from-white via-zinc-200 to-zinc-400",
    "from-cyan-400 via-blue-500 to-indigo-500",
    "from-teal-400 to-emerald-500",
    "from-purple-400 via-pink-500 to-rose-500",
  ];
  const colorIndex = Math.abs(slug.split("").reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0)) % colors.length;

  return {
    fontClass: "font-black tracking-tight uppercase",
    textStyle: `bg-gradient-to-r ${colors[colorIndex]} bg-clip-text text-transparent drop-shadow-[0_3px_5px_rgba(0,0,0,0.85)] text-2xl md:text-4xl`
  };
};

export default function HomePage() {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
  const {
    slots: resolvedHeroSlots,
    latestMovies: resolvedLatestMovies,
    loading: resolvedHeroLoading,
    error: resolvedHeroError,
  } = useResolvedHeroBanners({ apiUrl: API_URL });

  const [heroCandidates, setHeroCandidates] = useState<any[]>([]);
  const [activeHeroIndex, setActiveHeroIndex] = useState(0);
  const [detailsCache, setDetailsCache] = useState<Record<string, any>>({});
  const [logoCache, setLogoCache] = useState<Record<string, string | null>>({});
  const [backdropCache, setBackdropCache] = useState<Record<string, string | null>>({});
  const [isTransitioning, setIsTransitioning] = useState(false);

  const [movieList, setMovieList] = useState<any[]>([]);
  const router = useRouter();
  const { user, toggleFavorite } = useAuth();

  const isFavorited = user?.favorites?.includes(heroCandidates[activeHeroIndex]?.slug || "") || false;

  const activeMovieCandidate = heroCandidates[activeHeroIndex];
  const heroDetailCandidate = detailsCache[activeMovieCandidate?.slug || ""];
  const initialHeroUrl = backdropCache[activeMovieCandidate?.slug || ""] || getImageUrl(heroDetailCandidate?.poster_url || activeMovieCandidate?.poster_url || heroDetailCandidate?.thumb_url || activeMovieCandidate?.thumb_url);
  const [heroBackdropSrc, setHeroBackdropSrc] = useState<string>(initialHeroUrl);

  useEffect(() => {
    if (activeMovieCandidate) {
      setHeroBackdropSrc(backdropCache[activeMovieCandidate.slug] || getImageUrl(heroDetailCandidate?.poster_url || activeMovieCandidate?.poster_url || heroDetailCandidate?.thumb_url || activeMovieCandidate?.thumb_url));
    }
  }, [activeMovieCandidate?.slug, heroDetailCandidate?.poster_url, heroDetailCandidate?.thumb_url, backdropCache]);

  const handleHeroBackdropError = () => {
    if (!activeMovieCandidate) return;
    fetch(`${API_URL}/movies/logo/${activeMovieCandidate.slug}?title=${encodeURIComponent(activeMovieCandidate.origin_name || activeMovieCandidate.name)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && (data.backdropUrl || data.posterUrl)) {
          setHeroBackdropSrc(data.backdropUrl || data.posterUrl);
        } else {
          setHeroBackdropSrc("https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&q=80");
        }
      })
      .catch(() => {
        setHeroBackdropSrc("https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&q=80");
      });
  };

  // Admin và trang chủ cùng dùng một bộ chọn Hero/TMDB.
  useEffect(() => {
    if (resolvedHeroLoading) return;

    if (resolvedHeroSlots.length > 0) {
      const preloadedDetails: Record<string, any> = {};
      const preloadedLogos: Record<string, string | null> = {};
      const preloadedBackdrops: Record<string, string | null> = {};

      for (const slot of resolvedHeroSlots) {
        const slug = slot.movie.slug;
        if (slot.detail) preloadedDetails[slug] = slot.detail;
        if (slot.tmdbData?.logoUrl) preloadedLogos[slug] = slot.tmdbData.logoUrl;
        if (slot.isCustomBanner) {
          preloadedBackdrops[slug] = slot.movie.poster_url || slot.movie.thumb_url;
        } else if (slot.tmdbData?.backdropUrl) {
          preloadedBackdrops[slug] = slot.tmdbData.backdropUrl;
        }
      }

      setDetailsCache((previous) => ({ ...previous, ...preloadedDetails }));
      setLogoCache((previous) => ({ ...previous, ...preloadedLogos }));
      setBackdropCache((previous) => ({ ...previous, ...preloadedBackdrops }));
      setHeroCandidates(resolvedHeroSlots.map((slot) => slot.movie));
      setActiveHeroIndex(0);
    } else {
      if (resolvedHeroError) console.error("Không thể đồng bộ Hero Banner:", resolvedHeroError);
      setHeroCandidates(FALLBACK_CANDIDATES);
    }

    const gridMovies = resolvedLatestMovies.length > 5
      ? resolvedLatestMovies.slice(5, 13)
      : resolvedLatestMovies.slice(0, 8);
    setMovieList(gridMovies.length > 0 ? gridMovies : FALLBACK_CANDIDATES);
  }, [resolvedHeroError, resolvedHeroLoading, resolvedHeroSlots, resolvedLatestMovies]);

  // Hàm click chọn thumbnail có hiệu ứng chuyển cảnh mượt mà
  const handleThumbnailClick = (index: number) => {
    if (index === activeHeroIndex || isTransitioning) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setActiveHeroIndex(index);
      setIsTransitioning(false);
    }, 150);
  };

  // Tự chuyển banner và chuẩn bị trước đúng một ảnh kế tiếp, không tải thừa cả slider.
  useEffect(() => {
    if (heroCandidates.length < 2 || isTransitioning) return;
    const timer = window.setTimeout(() => {
      handleThumbnailClick((activeHeroIndex + 1) % heroCandidates.length);
    }, 8_000);
    return () => window.clearTimeout(timer);
  }, [activeHeroIndex, heroCandidates.length, isTransitioning]);

  useEffect(() => {
    if (heroCandidates.length < 2) return;
    const nextMovie = heroCandidates[(activeHeroIndex + 1) % heroCandidates.length];
    const nextSrc = backdropCache[nextMovie.slug] || getImageUrl(nextMovie.thumb_url || nextMovie.poster_url);
    if (nextSrc) {
      const image = new Image();
      image.src = nextSrc;
    }
  }, [activeHeroIndex, backdropCache, heroCandidates]);



  // Chuyển đổi YouTube URL thành định dạng nhúng mô tả phim
  const cleanContentHtml = (html: string) => {
    if (!html) return "";
    return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
  };

  const handleHeroFavoriteToggle = async () => {
    const movieObj = heroCandidates[activeHeroIndex];
    if (!movieObj) return;
    await toggleFavorite(movieObj.slug);
  };

  const activeMovie = heroCandidates[activeHeroIndex];
  const heroDetail = activeMovie ? detailsCache[activeMovie.slug] : null;
  const heroScore = Number(heroDetail?.tmdb?.vote_average || heroDetail?.imdb?.vote_average || 0);
  const heroAgeRating = heroDetail?.age_rating || heroDetail?.rating || "";
  const logoUrl = activeMovie ? logoCache[activeMovie.slug] : null;
  const loadingDetail = activeMovie && !heroDetail;
  const titleStyle = getMovieTitleStyle(heroDetail || activeMovie);
  const cleanedDesc = cleanContentHtml(heroDetail?.content || "");
  const truncatedDesc = cleanedDesc.length > 210 ? cleanedDesc.slice(0, 210) + "..." : cleanedDesc;

  return (
    <div className="w-full flex-grow flex flex-col bg-black text-white pb-16">

      {/* 1. HERO BANNER - SLIDER CHUYÊN NGHIỆP Y HỆT HÌNH ẢNH */}
      {!activeMovie && resolvedHeroLoading && (
        <div className="relative w-full h-[75vh] md:h-[88vh] overflow-hidden bg-zinc-950 animate-pulse border-b border-zinc-900/60">
          <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black" />
          <div className="absolute left-[8%] bottom-20 space-y-4">
            <div className="h-7 w-56 rounded-lg bg-zinc-800/70" />
            <div className="h-4 w-80 max-w-[70vw] rounded bg-zinc-900" />
            <div className="h-12 w-12 rounded-full bg-pink-500/20" />
          </div>
        </div>
      )}
      {activeMovie && (
        <div className="relative w-full h-[75vh] md:h-[88vh] flex items-end overflow-hidden border-b border-zinc-900/60">

          {/* Ảnh nền Full-width trong suốt và sáng đẹp giống hệt mockup */}
          <div className="absolute inset-0 z-0 select-none bg-black">
            <ProgressiveImage
              src={heroBackdropSrc}
              alt={activeMovie.name}
              onError={handleHeroBackdropError}
              priority
              className={`w-full h-full object-cover transition-all duration-500 ease-in-out ${isTransitioning ? "opacity-0 scale-102 blur-[4px]" : "opacity-100 scale-100 blur-0"
                }`}
            />
            {/* Halftone dot grid pattern overlay to make the image look crisp and textured */}
            <HalftoneOverlay />
            {/* Mask gradients nhẹ nhàng tạo độ hòa trộn đáy và cạnh trái */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent z-10" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/20 to-transparent z-10" />
          </div>

          {/* Nội dung thông tin phim Hero (Cụm bên trái) */}
          <div className={`container mx-auto px-6 mb-16 md:mb-20 z-10 max-w-7xl space-y-5 transition-all duration-300 ease-out ${isTransitioning ? "opacity-0 -translate-x-4 blur-[2px]" : "opacity-100 translate-x-0 blur-0"
            }`}>
            <div className="inline-flex items-center gap-2 bg-pink-500/10 border border-pink-500/30 px-3 py-1 rounded-full text-[11px] text-pink-400 font-bold tracking-wider uppercase select-none">
              <Flame size={13} className="fill-pink-400 animate-pulse" /> PHIM MỚI CẬP BẾN RẠP
            </div>

            <div className="space-y-2.5">
              {logoUrl ? (
                <div className="relative h-20 md:h-28 flex items-center mb-1">
                  <img
                    src={logoUrl}
                    alt={cleanMovieName(heroDetail?.name || activeMovie?.name)}
                    referrerPolicy="no-referrer"
                    className="max-h-full max-w-[85%] md:max-w-[450px] object-contain select-none filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.85)]"
                  />
                </div>
              ) : (
                <h1 className={`${titleStyle.fontClass} ${titleStyle.textStyle} leading-tight drop-shadow-md pb-1`}>
                  {cleanMovieName(heroDetail?.name || activeMovie?.name)}
                </h1>
              )}
              <h2 className="text-lg md:text-xl font-extrabold text-pink-500 tracking-wide select-text">
                {cleanMovieName(heroDetail?.origin_name || activeMovie?.origin_name)}
              </h2>
            </div>

            {/* Hàng nhãn phân loại (IMDb, Tuổi, Năm, Tập, Thời lượng) */}
            <div className="flex flex-wrap items-center gap-2.5 text-xs text-zinc-300 font-bold select-none">
              {heroScore > 0 && (
                <span className="bg-amber-400 text-black border border-amber-400 font-black px-2 py-0.5 rounded text-[11px] flex items-center gap-0.5 shadow-sm">
                  TMDB {heroScore.toFixed(1)}
                </span>
              )}
              {heroAgeRating && (
                <span className="border border-zinc-800 bg-zinc-950/60 px-2 py-0.5 rounded text-zinc-400">
                  {heroAgeRating}
                </span>
              )}
              <span className="border border-zinc-800 bg-zinc-950/60 px-2 py-0.5 rounded">
                {activeMovie.year}
              </span>
              {heroDetail?.time && (
                <span className="border border-zinc-800 bg-zinc-950/60 px-2 py-0.5 rounded hidden sm:inline">
                  {heroDetail.time}
                </span>
              )}
              <span className="border border-zinc-800 bg-zinc-950/60 px-2 py-0.5 rounded text-pink-400">
                {heroDetail?.episode_current || "Hoàn tất"}
              </span>
            </div>

            {/* Các thể loại (Tags) */}
            {heroDetail?.category && (
              <div className="flex flex-wrap items-center gap-2">
                {heroDetail.category.slice(0, 3).map((cat: any) => (
                  <button
                    key={cat.slug}
                    onClick={() => router.push(`/the-loai/${cat.slug}`)}
                    className="bg-zinc-900/80 border border-zinc-800/80 hover:border-zinc-700 hover:text-pink-500 text-zinc-400 text-xs px-3 py-1 rounded-xl transition-all duration-200"
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            )}

            {/* Mô tả cốt truyện */}
            <div className="max-w-xl min-h-[60px]">
              {loadingDetail ? (
                <div className="flex items-center gap-2 text-zinc-500 py-2">
                  <Loader2 size={16} className="animate-spin text-zinc-500" />
                  <span className="text-xs font-semibold">Đang chuẩn bị nội dung...</span>
                </div>
              ) : (
                <p className="text-zinc-400 text-sm md:text-[14.5px] leading-relaxed drop-shadow">
                  {truncatedDesc || "Không có tóm tắt chi tiết cho phim này. Bấm nút Xem Chi Tiết để cập nhật danh sách tập phát sóng chất lượng cao."}
                </p>
              )}
            </div>

            {/* Nhóm nút tương tác chính */}
            <div className="flex items-center gap-3.5 pt-3">
              {/* Nút Play to lớn màu Hồng */}
              <button
                onClick={() => router.push(`/watch/${activeMovie.slug}`)}
                aria-label={`Xem ngay ${activeMovie.name}`}
                className="w-14 h-14 rounded-full bg-pink-500 hover:bg-pink-600 flex items-center justify-center shadow-lg shadow-pink-500/25 hover:scale-110 active:scale-95 transition-all duration-300 group"
              >
                <Play className="text-white fill-white ml-1 group-hover:scale-105 transition-transform" size={22} />
              </button>

              {/* Nút Yêu thích trái tim */}
              <button
                onClick={handleHeroFavoriteToggle}
                aria-label={isFavorited ? "Bỏ khỏi yêu thích" : "Thêm vào yêu thích"}
                className={`w-12 h-12 rounded-full border flex items-center justify-center backdrop-blur-md transition-all duration-300 active:scale-95 ${isFavorited
                  ? "bg-rose-500/20 border-rose-500 text-rose-500 shadow-md shadow-rose-500/25 scale-105"
                  : "bg-zinc-900/60 border-zinc-800/80 hover:border-zinc-700 text-zinc-300 hover:text-white"
                  }`}
              >
                <Heart className={`transition-transform duration-300 ${isFavorited ? "fill-rose-500 scale-105" : ""}`} size={20} />
              </button>

              {/* Nút Xem thông tin chi tiết */}
              <button
                onClick={() => router.push(`/movie/${activeMovie.slug}`)}
                aria-label={`Xem thông tin ${activeMovie.name}`}
                className="w-12 h-12 rounded-full border border-zinc-800/80 bg-zinc-900/60 hover:border-zinc-700 text-zinc-300 hover:text-white flex items-center justify-center backdrop-blur-md hover:scale-105 active:scale-95 transition-all duration-300"
              >
                <Info size={20} />
              </button>
            </div>
          </div>

          {/* Thanh Slider thumbnails (Cụm bên phải dưới đáy) */}
          <div className="absolute bottom-10 right-8 z-20 hidden md:flex items-center gap-3 bg-zinc-950/20 backdrop-blur-lg p-3 rounded-2xl border border-zinc-800/40">
            {heroCandidates.map((movie, index) => {
              const isActive = index === activeHeroIndex;
              return (
                <div
                  key={movie.slug}
                  onClick={() => handleThumbnailClick(index)}
                  className={`relative w-28 h-16 rounded-xl overflow-hidden cursor-pointer transition-all duration-300 ${isActive
                    ? "border-2 border-pink-500 ring-4 ring-pink-500/25 scale-105 opacity-100 shadow-md shadow-pink-500/10"
                    : "border border-zinc-800/80 opacity-50 hover:opacity-90 hover:scale-[1.02]"
                    }`}
                >
                  <ProgressiveImage
                    src={backdropCache[movie.slug] || getImageUrl(movie.thumb_url || movie.poster_url)}
                    alt={movie.name}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&q=80";
                    }}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/10 hover:bg-transparent transition-colors" />
                </div>
              );
            })}
          </div>

        </div>
      )}

      {/* 2. KHÚC ĐỆM BỔ SUNG: "BẠN ĐANG QUAN TÂM GÌ?" Y HỆT COBEPHIM */}
      <Interests />

      {/* 2.5. HÀNH LANG PHIM THEO QUỐC GIA (MỚI THEO COBEPHIM) */}
      <div className="container mx-auto px-6 mt-12 max-w-7xl">
        <div className="p-6 rounded-[1.25rem] bg-gradient-to-b from-[#282b3a]/28 to-[#282b3a] border border-[#282b3a]/60 flex flex-col">
          <MovieRow title="Phim Hàn Quốc mới" accentText="Hàn Quốc" countrySlug="han-quoc" />
          <MovieRow title="Phim Việt Nam mới" accentText="Việt Nam" countrySlug="viet-nam" />
          <MovieRow title="Phim US-UK mới" accentText="US-UK" countrySlug="au-my" />
        </div>
      </div>

      {/* 2.6. BẢNG XẾP HẠNG TOP 10 PHIM BỘ HÔM NAY (MỚI THEO COBEPHIM) */}
      <Top10Row />

      {/* 2.7. PHIM SẮP TỚI TRÊN RỔ (TRAILERS) */}
      <UpcomingRow />

      {/* 2.8. MÃN NHÃN VỚI PHIM CHIẾU RẠP */}
      <CinemaRow />

      {/* 2.9. KHO TÀNG ANIME MỚI NHẤT */}
      <AnimeRow />

      {/* 3. MAIN CONTENT - GRID DANH SÁCH PHIM MỚI NHẤT */}
      <div className="container mx-auto px-6 mt-10 max-w-7xl space-y-6">
        <div className="flex items-center gap-2 border-b border-zinc-900 pb-3">
          <Film size={22} className="text-pink-500" />
          <h2 className="text-xl md:text-2xl font-bold tracking-tight uppercase">Phim Mới Cập Nhật</h2>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-4">
          {movieList.map((movie) => (
            <MovieCard key={movie._id} movie={movie} aspect="portrait" />
          ))}
        </div>
      </div>
    </div>
  );
}
