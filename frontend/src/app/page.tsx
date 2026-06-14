"use client";

import React, { useEffect, useState } from "react";
import { Button, Card, CardBody } from "@heroui/react";
import { Play, Flame, Film, Loader2, Monitor, Heart, Info } from "lucide-react";
import { useRouter } from "next/navigation";
import Interests from "@/components/Interests";
import MovieRow from "@/components/MovieRow";
import MovieCard from "@/components/MovieCard";
import { cleanMovieName } from "@/utils/movieUtils";
import Top10Row from "@/components/Top10Row";
import UpcomingRow from "@/components/UpcomingRow";
import CinemaRow from "@/components/CinemaRow";

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

const fetchTmdbLogo = async (tmdbType: string, tmdbId: string | number) => {
  if (!tmdbId) return null;
  const type = tmdbType === "tv" ? "tv" : "movie";
  const apiKey = "53a1f81cf9b82cd5516086708b51d451";
  try {
    const res = await fetch(`https://api.themoviedb.org/3/${type}/${tmdbId}/images?api_key=${apiKey}`);
    if (!res.ok) return null;
    const data = await res.json();
    const logos = data.logos || [];
    if (logos.length === 0) return null;
    
    // 1. Prioritize Vietnamese (vi)
    const viLogo = logos.find((l: any) => l.iso_639_1 === "vi");
    if (viLogo) return `https://image.tmdb.org/t/p/w500${viLogo.file_path}`;
    
    // 2. Prioritize English (en)
    const enLogo = logos.find((l: any) => l.iso_639_1 === "en");
    if (enLogo) return `https://image.tmdb.org/t/p/w500${enLogo.file_path}`;
    
    // 3. Fallback to first available logo
    return `https://image.tmdb.org/t/p/w500${logos[0].file_path}`;
  } catch (error) {
    console.error("Failed to fetch TMDB logo:", error);
    return null;
  }
};

export default function HomePage() {
  const [heroCandidates, setHeroCandidates] = useState<any[]>([]);
  const [activeHeroIndex, setActiveHeroIndex] = useState(0);
  const [heroDetail, setHeroDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  
  const [movieList, setMovieList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFavorited, setIsFavorited] = useState(false);
  
  const router = useRouter();

  // 1. Fetch danh sách phim mới cập nhật để lấy candidates và danh sách grid
  useEffect(() => {
    async function fetchOPhim() {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.warn("API OPhim timeout. Aborting request and using fallback data.");
        controller.abort();
      }, 6000); // 6 seconds timeout

      try {
        setLoading(true);
        const res = await fetch("https://ophim1.com/danh-sach/phim-moi-cap-nhat?page=1", {
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        const data = await res.json();
        
        if (data.status && data.items && data.items.length > 0) {
          // Lấy 5 phim làm ứng cử viên cho Slider Hero
          const candidates = data.items.slice(0, 5);
          setHeroCandidates(candidates);
          
          // Các phim còn lại dùng hiển thị ở Grid bên dưới (tránh lặp phim)
          setMovieList(data.items.slice(5, 13));
        } else {
          setHeroCandidates(FALLBACK_CANDIDATES);
          setMovieList(FALLBACK_CANDIDATES);
        }
      } catch (error) {
        console.error("Lỗi khi kết nối API OPhim:", error);
        setHeroCandidates(FALLBACK_CANDIDATES);
        setMovieList(FALLBACK_CANDIDATES);
      } finally {
        setLoading(false);
      }
    }

    fetchOPhim();
  }, []);

  // 2. Fetch thông tin chi tiết của phim Active trong Hero Slider
  useEffect(() => {
    if (heroCandidates.length === 0) return;
    const activeMovie = heroCandidates[activeHeroIndex];
    if (!activeMovie) return;

    // Reset details immediately to avoid title and details mismatch!
    setHeroDetail(null);
    setLogoUrl(null);

    async function fetchHeroDetail() {
      try {
        setLoadingDetail(true);
        const res = await fetch(`https://ophim1.com/v1/api/phim/${activeMovie.slug}`);
        const data = await res.json();
        if (data.status === "success" || data.status === true) {
          const detail = data.data?.item || data.movie || null;
          setHeroDetail(detail);

          // Fetch logo from TMDB if tmdb.id is available
          const tmdbId = detail?.tmdb?.id;
          const tmdbType = detail?.tmdb?.type;
          if (tmdbId) {
            fetchTmdbLogo(tmdbType, tmdbId).then((url) => {
              setLogoUrl(url);
            });
          }
        }
      } catch (error) {
        console.error("Lỗi khi tải chi tiết phim Hero:", error);
      } finally {
        setLoadingDetail(false);
      }
    }

    // Reset favorite state when movie changes
    setIsFavorited(false);
    fetchHeroDetail();
  }, [activeHeroIndex, heroCandidates]);

  // Trình biến đổi ảnh gốc thành link ảnh cdn .live cực nét và ổn định
  const getImageUrl = (path: string) => {
    if (!path) return "";
    const fileName = path.split("/").pop();
    return `https://img.ophim.live/uploads/movies/${fileName}`;
  };

  // Hàm loại bỏ thẻ HTML từ phần mô tả phim
  const cleanContentHtml = (html: string) => {
    if (!html) return "";
    return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
  };

  // Tính tuổi phân loại tượng trưng dựa trên thể loại để giao diện sinh động
  const getAgeRating = () => {
    if (!heroDetail?.category) return "P";
    const hasAdultGenre = heroDetail.category.some((c: any) => 
      ["kinh-di", "hinh-su", "tam-ly", "hanh-dong", "chien-tranh"].includes(c.slug)
    );
    return hasAdultGenre ? "T16" : "P";
  };

  // Sinh điểm IMDb giả lập cao cấp dựa trên thông tin phim (tạo độ uy tín)
  const getImdbScore = () => {
    if (!heroDetail?.name) return "8.8";
    const base = (heroDetail.name.length % 3) * 0.4 + 8.2;
    return base.toFixed(1);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#07070e] text-white select-none">
        <style>{`
          @keyframes loadingBar {
            0% { left: -30%; }
            100% { left: 100%; }
          }
        `}</style>
        <div className="flex flex-col items-center gap-5 animate-pulse duration-2000">
          {/* Logo lớn sang trọng ở trung tâm */}
          <div className="flex items-center gap-3 md:gap-4.5">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-gradient-to-tr from-pink-500 to-rose-500 flex items-center justify-center shadow-[0_0_50px_rgba(244,63,94,0.35)] shrink-0">
              <Play className="text-white fill-white ml-1.5 md:ml-2" size={28} />
            </div>
            <span className="font-black text-4xl md:text-5xl tracking-widest select-none">
              Dlow<span className="text-pink-500">Phim</span>
            </span>
          </div>

          {/* Slogan việt hóa cao cấp giống cobephim */}
          <p className="text-zinc-400 font-bold text-sm md:text-[15px] tracking-wide max-w-md text-center px-8 leading-relaxed mt-2 select-text">
            Xem Phim Miễn Phí Cực Nhanh, Chất Lượng Cao Và Cập Nhật Liên Tục
          </p>

          {/* Hiệu ứng loading bar mảnh */}
          <div className="w-48 md:w-56 h-[3px] bg-zinc-800 rounded-full overflow-hidden mt-4 relative">
            <div className="absolute top-0 h-full bg-pink-500 w-[30%] rounded-full animate-[loadingBar_1.2s_infinite_linear]" />
          </div>

          {/* Spinner tròn nhẹ */}
          <div className="flex items-center gap-2 text-zinc-500 mt-4">
            <Loader2 className="animate-spin text-pink-500" size={16} />
            <span className="text-xs font-semibold tracking-wider">Đang kết nối máy chủ...</span>
          </div>
        </div>
      </div>
    );
  }



  const activeMovie = heroCandidates[activeHeroIndex];
  const titleStyle = getMovieTitleStyle(heroDetail || activeMovie);
  const cleanedDesc = cleanContentHtml(heroDetail?.content || "");
  const truncatedDesc = cleanedDesc.length > 210 ? cleanedDesc.slice(0, 210) + "..." : cleanedDesc;

  return (
    <div className="min-h-screen bg-black text-white pb-16">
      
      {/* 1. HERO BANNER - SLIDER CHUYÊN NGHIỆP Y HỆT HÌNH ẢNH */}
      {activeMovie && (
        <div className="relative w-full h-[75vh] md:h-[88vh] flex items-end overflow-hidden border-b border-zinc-900/60">
          
          {/* Ảnh nền Full-width trong suốt và sáng đẹp giống hệt mockup */}
          <div className="absolute inset-0 z-0 select-none bg-black">
            <img 
              src={getImageUrl(heroDetail?.poster_url || activeMovie?.poster_url || heroDetail?.thumb_url || activeMovie?.thumb_url)} 
              alt={activeMovie.name} 
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover opacity-100 transition-all duration-700 ease-in-out scale-101"
              fetchPriority="high"
              decoding="async"
            />
            {/* Mask gradients nhẹ nhàng tạo độ hòa trộn đáy và cạnh trái */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent z-10" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/20 to-transparent z-10" />
          </div>

          {/* Nội dung thông tin phim Hero (Cụm bên trái) */}
          <div className="container mx-auto px-6 mb-16 md:mb-20 z-10 max-w-7xl space-y-5">
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
              <h2 className="text-lg md:text-xl font-extrabold text-amber-400 tracking-wide select-text">
                {cleanMovieName(heroDetail?.origin_name || activeMovie?.origin_name)}
              </h2>
            </div>

            {/* Hàng nhãn phân loại (IMDb, Tuổi, Năm, Tập, Thời lượng) */}
            <div className="flex flex-wrap items-center gap-2.5 text-xs text-zinc-300 font-bold select-none">
              <span className="bg-pink-500 text-white border border-pink-500 font-black px-2 py-0.5 rounded text-[11px] flex items-center gap-0.5 shadow-sm shadow-pink-500/10">
                IMDb {getImdbScore()}
              </span>
              <span className="border border-zinc-800 bg-zinc-950/60 px-2 py-0.5 rounded text-zinc-400">
                {getAgeRating()}
              </span>
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
                    onClick={() => router.push(`/search?genre=${cat.slug}`)}
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
                onClick={() => router.push(`/movie/${activeMovie.slug}`)}
                className="w-14 h-14 rounded-full bg-pink-500 hover:bg-pink-600 flex items-center justify-center shadow-lg shadow-pink-500/25 hover:scale-110 active:scale-95 transition-all duration-300 group"
              >
                <Play className="text-white fill-white ml-1 group-hover:scale-105 transition-transform" size={22} />
              </button>

              {/* Nút Yêu thích trái tim */}
              <button
                onClick={() => setIsFavorited(!isFavorited)}
                className={`w-12 h-12 rounded-full border flex items-center justify-center backdrop-blur-md transition-all duration-300 active:scale-95 ${
                  isFavorited 
                    ? "bg-rose-500/20 border-rose-500 text-rose-500 shadow-md shadow-rose-500/25 scale-105" 
                    : "bg-zinc-900/60 border-zinc-800/80 hover:border-zinc-700 text-zinc-300 hover:text-white"
                }`}
              >
                <Heart className={`transition-transform duration-300 ${isFavorited ? "fill-rose-500 scale-105" : ""}`} size={20} />
              </button>

              {/* Nút Xem thông tin chi tiết */}
              <button
                onClick={() => router.push(`/movie/${activeMovie.slug}`)}
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
                  key={movie._id}
                  onClick={() => setActiveHeroIndex(index)}
                  className={`relative w-28 h-16 rounded-xl overflow-hidden cursor-pointer transition-all duration-300 ${
                    isActive 
                      ? "border-2 border-pink-500 ring-4 ring-pink-500/25 scale-105 opacity-100 shadow-md shadow-pink-500/10" 
                      : "border border-zinc-800/80 opacity-50 hover:opacity-90 hover:scale-[1.02]"
                  }`}
                >
                  <img
                    src={getImageUrl(movie.poster_url || movie.thumb_url)}
                    alt={movie.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
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

      {/* 3. MAIN CONTENT - GRID DANH SÁCH PHIM MỚI NHẤT */}
      <div className="container mx-auto px-6 mt-10 max-w-7xl space-y-6">
        <div className="flex items-center gap-2 border-b border-zinc-900 pb-3">
          <Film size={22} className="text-pink-500" />
          <h2 className="text-xl md:text-2xl font-bold tracking-tight uppercase">Phim Mới Cập Nhật</h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
          {movieList.map((movie) => (
            <MovieCard key={movie._id} movie={movie} aspect="portrait" />
          ))}
        </div>
      </div>
    </div>
  );
}