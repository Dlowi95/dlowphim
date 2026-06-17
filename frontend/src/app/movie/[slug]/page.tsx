"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Play, Heart, Share2, Film, Star, Loader2, ArrowLeft, Sparkles, Tv, HelpCircle } from "lucide-react";
import { cleanMovieName } from "@/utils/movieUtils";
import MovieCard from "@/components/MovieCard";

interface Episode {
  name: string;
  slug: string;
  filename: string;
  link_embed: string;
  link_m3u8: string;
}

interface Server {
  server_name: string;
  server_data: Episode[];
}

interface MovieDetail {
  _id: string;
  name: string;
  slug: string;
  origin_name: string;
  content: string;
  type: string;
  status: string;
  thumb_url: string;
  poster_url: string;
  time: string;
  episode_current: string;
  episode_total: string;
  year: number;
  actor: string[];
  director: string[];
  category: { name: string; slug: string }[];
  country: { name: string; slug: string }[];
  episodes: Server[];
}

export default function MovieDetailPage({ params }: { params: { slug: string } }) {
  const { slug } = params;
  const router = useRouter();

  const [movie, setMovie] = useState<MovieDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // States tương tác nhanh
  const [isFavorite, setIsFavorite] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  // Phim liên quan
  const [relatedMovies, setRelatedMovies] = useState<any[]>([]);
  const [loadingRelated, setLoadingRelated] = useState(false);

  // 1. Fetch thông tin phim từ OPhim API
  useEffect(() => {
    async function fetchMovieDetail() {
      try {
        setLoading(true);
        setError(null);
        
        const res = await fetch(`https://ophim1.com/v1/api/phim/${slug}`);
        if (!res.ok) throw new Error("Không thể kết nối máy chủ phim.");
        
        const data = await res.json();
        if (data.status === true || data.status === "success") {
          const item = data.data?.item || data.movie;
          if (item) {
            setMovie(item);
            
            // Kiểm tra trạng thái yêu thích từ LocalStorage
            try {
              const favs = JSON.parse(localStorage.getItem("dlowphim_favorites") || "[]");
              setIsFavorite(favs.includes(item.slug));
            } catch (e) {
              console.error(e);
            }
          } else {
            throw new Error("Không tìm thấy thông tin phim.");
          }
        } else {
          throw new Error("Không tải được dữ liệu phim.");
        }
      } catch (err: any) {
        console.error("Lỗi lấy chi tiết phim:", err);
        setError(err.message || "Đã xảy ra lỗi ngoài ý muốn.");
      } finally {
        setLoading(false);
      }
    }
    
    fetchMovieDetail();
  }, [slug]);

  // 2. Fetch phim liên quan dựa trên thể loại đầu tiên của phim hiện tại
  useEffect(() => {
    if (!movie || !movie.category || movie.category.length === 0) return;
    
    async function fetchRelated() {
      try {
        setLoadingRelated(true);
        const genreSlug = movie.category[0].slug;
        const res = await fetch(`https://ophim1.com/v1/api/the-loai/${genreSlug}?page=1`);
        const data = await res.json();
        
        if (data.status === true || data.status === "success") {
          const items = data.data?.items || data.items || [];
          // Lọc bỏ phim hiện tại
          const filtered = items.filter((item: any) => item.slug !== movie.slug).slice(0, 7);
          setRelatedMovies(filtered);
        }
      } catch (err) {
        console.error("Lỗi lấy phim liên quan:", err);
      } finally {
        setLoadingRelated(false);
      }
    }
    
    fetchRelated();
  }, [movie]);

  // Sinh điểm IMDb giả lập
  const getImdbScore = () => {
    if (!movie?.name) return "8.5";
    const score = (movie.name.length % 3) * 0.4 + 8.1;
    return score.toFixed(1);
  };

  // Trình biến đổi ảnh gốc thành link ảnh cdn .live cực nét và ổn định
  const getImageUrl = (path: string) => {
    if (!path) return "";
    if (path.startsWith("http")) return path;
    const fileName = path.split("/").pop();
    return `https://img.ophim.live/uploads/movies/${fileName}`;
  };

  // Toggle Yêu thích
  const handleToggleFavorite = () => {
    if (!movie) return;
    try {
      const favs = JSON.parse(localStorage.getItem("dlowphim_favorites") || "[]");
      let newFavs;
      if (isFavorite) {
        newFavs = favs.filter((s: string) => s !== movie.slug);
        setIsFavorite(false);
      } else {
        newFavs = [...favs, movie.slug];
        setIsFavorite(true);
      }
      localStorage.setItem("dlowphim_favorites", JSON.stringify(newFavs));
    } catch (e) {
      console.error(e);
    }
  };

  // Chia sẻ liên kết phim
  const handleShare = () => {
    if (typeof window === "undefined") return;
    navigator.clipboard.writeText(window.location.href);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  };

  // Chuyển hướng đến trang Xem phim với tập đầu tiên
  const handleWatchNow = () => {
    if (!movie || !movie.episodes || movie.episodes.length === 0) return;
    const firstServer = movie.episodes[0];
    if (!firstServer || !firstServer.server_data || firstServer.server_data.length === 0) return;
    const firstEp = firstServer.server_data[0];
    
    router.push(`/watch/${movie.slug}?ep=${encodeURIComponent(firstEp.name)}`);
  };

  // Chuyển hướng khi click vào tập phim cụ thể
  const handleWatchEpisode = (episodeName: string) => {
    if (!movie) return;
    router.push(`/watch/${movie.slug}?ep=${encodeURIComponent(episodeName)}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-3">
        <Loader2 className="animate-spin text-pink-500" size={48} />
        <p className="text-sm font-semibold text-zinc-400 animate-pulse">Đang tải thông tin phim...</p>
      </div>
    );
  }

  if (error || !movie) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-4 px-6">
        <HelpCircle size={60} className="text-zinc-650 animate-bounce" />
        <h2 className="text-xl md:text-2xl font-black text-zinc-300">Không tìm thấy thông tin phim!</h2>
        <p className="text-sm text-zinc-500 text-center max-w-md">
          {error || "Đường dẫn phim không tồn tại hoặc đã bị xóa khỏi hệ thống."}
        </p>
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-2 border border-zinc-800 bg-zinc-950 hover:bg-zinc-900 text-white text-sm font-extrabold px-6 py-2.5 rounded-xl transition-all"
        >
          <ArrowLeft size={16} /> Quay về Trang chủ
        </button>
      </div>
    );
  }

  const cleanedName = cleanMovieName(movie.name);
  const cleanedOrigin = cleanMovieName(movie.origin_name);
  const firstServer = movie.episodes?.[0];
  const episodesData = firstServer?.server_data || [];

  return (
    <div className="min-h-screen bg-[#07070a] text-white pb-20 relative overflow-hidden pt-24">
      {/* 1. BLURRED CINEMATIC BACKDROP */}
      <div className="absolute top-0 left-0 right-0 h-[60vh] overflow-hidden pointer-events-none select-none z-0">
        <img
          src={getImageUrl(movie.poster_url || movie.thumb_url)}
          alt={cleanedName}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover opacity-15 blur-[60px] scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#07070a]/60 to-[#07070a] z-10" />
      </div>

      <div className="container mx-auto px-4 md:px-6 max-w-7xl relative z-10 space-y-10">
        
        {/* Nút Quay lại */}
        <div className="flex items-center select-none">
          <button 
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-zinc-500 hover:text-white text-xs font-bold uppercase tracking-wider transition-colors"
          >
            <ArrowLeft size={14} /> Quay lại
          </button>
        </div>

        {/* 2. KHỐI THÔNG TIN CHI TIẾT PHIM */}
        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-8 md:gap-10 items-start">
          
          {/* Cột trái: Poster đứng */}
          <div className="w-full max-w-[260px] mx-auto md:mx-0 relative aspect-[2/3] rounded-2xl overflow-hidden border border-zinc-800 shadow-[0_20px_50px_rgba(0,0,0,0.85)] group">
            <img
              src={getImageUrl(movie.thumb_url || movie.poster_url)}
              alt={cleanedName}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:4px_4px] opacity-100 pointer-events-none" />
            
            <div className="absolute top-3 left-3 flex flex-col gap-1">
              <span className="bg-pink-500 text-white text-[9px] font-black px-2 py-0.5 rounded shadow-md uppercase tracking-wider">
                {movie.quality || "HD"}
              </span>
              <span className="bg-zinc-950/80 backdrop-blur text-white text-[9px] font-black px-2 py-0.5 rounded shadow-md border border-zinc-800 uppercase tracking-wider">
                {movie.lang || "Vietsub"}
              </span>
            </div>
          </div>

          {/* Cột phải: Các chi tiết metadata */}
          <div className="text-left space-y-6">
            <div className="space-y-2">
              <h1 className="text-2xl md:text-4xl font-black tracking-tight leading-tight uppercase bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent drop-shadow-md">
                {cleanedName}
              </h1>
              <h2 className="text-base md:text-lg font-bold text-pink-400 tracking-wide">
                {cleanedOrigin}
              </h2>
            </div>

            {/* Badges thông số */}
            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-300 font-bold select-none">
              <span className="bg-amber-400 text-black border border-amber-400 font-black px-2.5 py-0.5 rounded flex items-center gap-0.5 shadow-sm">
                IMDb {getImdbScore()}
              </span>
              <span className="border border-zinc-800 bg-zinc-950/60 px-2 py-0.5 rounded">
                {movie.year}
              </span>
              {movie.time && (
                <span className="border border-zinc-800 bg-zinc-950/60 px-2 py-0.5 rounded">
                  {movie.time}
                </span>
              )}
              <span className="border border-zinc-800 bg-zinc-950/60 px-2 py-0.5 rounded text-pink-400 uppercase tracking-wider">
                {movie.status === "completed" ? "Hoàn tất" : "Đang chiếu"}
              </span>
            </div>

            {/* Danh sách thể loại */}
            {movie.category && movie.category.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 select-none">
                {movie.category.map((cat) => (
                  <button
                    key={cat.slug}
                    onClick={() => router.push(`/search?genre=${cat.slug}`)}
                    className="bg-zinc-900 border border-zinc-850 hover:border-pink-500 hover:text-pink-400 text-zinc-400 text-xs px-3 py-1 rounded-full transition-all duration-200 cursor-pointer"
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            )}

            {/* Thông tin metadata sản xuất */}
            <div className="space-y-2.5 border-t border-zinc-900 pt-5 text-sm">
              <p className="text-zinc-400 font-medium">
                <span className="text-zinc-500 font-bold mr-1">Đạo diễn:</span>
                {movie.director?.filter(d => d).join(", ") || "Đang cập nhật"}
              </p>
              <p className="text-zinc-400 font-medium leading-relaxed">
                <span className="text-zinc-500 font-bold mr-1">Diễn viên:</span>
                {movie.actor?.filter(a => a).join(", ") || "Đang cập nhật"}
              </p>
              {movie.country && movie.country.length > 0 && (
                <p className="text-zinc-400 font-medium">
                  <span className="text-zinc-500 font-bold mr-1">Quốc gia:</span>
                  {movie.country.map(c => c.name).join(", ")}
                </p>
              )}
            </div>

            {/* Khối nút bấm tương tác */}
            <div className="flex flex-wrap items-center gap-3.5 pt-2 select-none">
              {/* Nút Xem Phim Ngay -> chuyển hướng qua /watch */}
              <button
                onClick={handleWatchNow}
                className="flex items-center gap-2 bg-pink-500 hover:bg-pink-600 text-white font-extrabold text-sm px-7 py-3 rounded-xl transition-all duration-200 hover:scale-103 active:scale-97 shadow-lg shadow-pink-500/20 cursor-pointer"
              >
                <Play size={16} className="fill-white" /> XEM PHIM NGAY
              </button>

              {/* Nút thêm yêu thích */}
              <button
                onClick={handleToggleFavorite}
                className={`flex items-center gap-1.5 px-4 py-3 rounded-xl border text-xs font-bold transition-all duration-300 active:scale-95 cursor-pointer ${
                  isFavorite
                    ? "bg-rose-500/20 border-rose-500 text-rose-500 shadow-md shadow-rose-500/10"
                    : "bg-zinc-900/60 border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:text-white"
                }`}
              >
                <Heart size={14} className={isFavorite ? "fill-rose-500 scale-105" : ""} />
                {isFavorite ? "ĐÃ THÊM YÊU THÍCH" : "THÊM YÊU THÍCH"}
              </button>

              {/* Nút chia sẻ */}
              <button
                onClick={handleShare}
                className={`flex items-center gap-1.5 px-4 py-3 rounded-xl border text-xs font-bold transition-all duration-250 active:scale-95 cursor-pointer ${
                  shareCopied
                    ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                    : "bg-zinc-900/60 border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:text-white"
                }`}
              >
                <Share2 size={14} />
                {shareCopied ? "ĐÃ SAO CHÉP LINK!" : "CHIA SẺ"}
              </button>
            </div>
          </div>
        </div>

        {/* 3. CHỌN TẬP PHIM (Chuyển tiếp đến trang phát phim tương ứng) */}
        {episodesData.length > 0 && (
          <div className="p-5 md:p-6 rounded-2xl bg-zinc-950/70 border border-zinc-900/60 space-y-4 select-none text-left">
            <span className="block text-xs font-bold text-zinc-500 uppercase tracking-wider">
              {episodesData.length <= 1 ? "Bản phát sóng:" : "Danh sách tập phim (Nhấp chọn tập để xem phim):"}
            </span>
            
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-10 lg:grid-cols-12 gap-2.5 max-h-[220px] overflow-y-auto pr-1">
              {episodesData.map((ep, eIdx) => (
                <button
                  key={`ep-${eIdx}`}
                  onClick={() => handleWatchEpisode(ep.name)}
                  className="h-10 rounded-xl font-extrabold text-xs flex items-center justify-center transition-all cursor-pointer border border-zinc-850 bg-zinc-950/40 text-zinc-400 hover:text-white hover:border-zinc-700 hover:bg-zinc-900"
                >
                  {ep.name.toLowerCase().includes("tập") ? ep.name : `Tập ${ep.name}`}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 4. NỘI DUNG TÓM TẮT (DESCRIPTION SECTION) */}
        <div className="space-y-3.5 text-left border-t border-zinc-900 pt-8">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-pink-500" />
            <h3 className="text-lg md:text-xl font-bold uppercase tracking-tight">Nội dung cốt truyện</h3>
          </div>
          <div className="max-w-4xl text-zinc-400 text-sm md:text-[14.5px] leading-relaxed font-medium space-y-4">
            {movie.content ? (
              <p>{movie.content.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim()}</p>
            ) : (
              <p className="text-zinc-650">Chưa có thông tin mô tả chi tiết của phim này.</p>
            )}
          </div>
        </div>

        {/* 5. PHIM LIÊN QUAN ĐỀ XUẤT */}
        {relatedMovies.length > 0 && (
          <div className="space-y-6 pt-10 border-t border-zinc-900 select-none">
            <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles size={20} className="text-pink-500" />
                <h3 className="text-lg md:text-xl font-bold uppercase tracking-tight">Có thể bạn cũng thích</h3>
              </div>
            </div>

            {loadingRelated ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="animate-spin text-pink-500" size={24} />
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-4">
                {relatedMovies.map((m) => (
                  <MovieCard key={m._id || m.slug} movie={m} aspect="portrait" />
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
