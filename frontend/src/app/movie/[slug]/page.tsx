"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Play, Heart, Share2, Film, Star, Loader2, ArrowLeft, Sparkles, Tv, HelpCircle, Send, Plus, MessageSquare, Image, Users, Flame, ExternalLink, Compass } from "lucide-react";
import CommentRatingSection from "@/components/CommentRatingSection";
import { cleanMovieName } from "@/utils/movieUtils";
import MovieCard from "@/components/MovieCard";
import HalftoneOverlay from "@/components/HalftoneOverlay";
import { useAuth } from "@/context/AuthContext";
import Cookies from "js-cookie";

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
  trailer_url?: string;
}



export default function MovieDetail({ params }: { params: { slug: string } }) {
  const slug = params.slug;
  const router = useRouter();
  const { user, toggleFavorite: toggleFavoriteCtx } = useAuth();

  const [movie, setMovie] = useState<MovieDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // States tương tác
  const isFavorite = user?.favorites?.includes(movie?.slug || "") || false;
  const [shareCopied, setShareCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"episodes" | "gallery" | "actors" | "recommendations">("episodes");
  const [selectedEpisodeBatch, setSelectedEpisodeBatch] = useState<number>(0);

  // States bình luận

  // Phim liên quan
  const [relatedMovies, setRelatedMovies] = useState<any[]>([]);
  const [loadingRelated, setLoadingRelated] = useState(false);

  // 1. Fetch thông tin phim từ OPhim API hoặc Custom API
  useEffect(() => {
    async function fetchMovieDetail() {
      try {
        setLoading(true);
        setError(null);
        setSelectedEpisodeBatch(0); // Reset episode batch on movie change

        const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

        // a. Kiểm tra xem phim có bị Block (Ẩn) hay không
        try {
          const blockRes = await fetch(`${API_URL}/movies/check-blocked/${slug}`);
          if (blockRes.ok) {
            const blockData = await blockRes.json();
            if (blockData.isBlocked) {
              throw new Error("Phim này hiện không khả dụng do bản quyền hoặc yêu cầu gỡ bỏ.");
            }
          }
        } catch (blockErr: any) {
          if (blockErr.message.includes("bản quyền")) {
            throw blockErr;
          }
          // Lỗi mạng hoặc server chặn không cản trở việc load tiếp
          console.error("Lỗi kiểm tra chặn phim:", blockErr);
        }

        // b. Tải phim từ OPhim API
        let ophimDetail: any = null;
        try {
          const res = await fetch(`https://ophim1.com/v1/api/phim/${slug}`);
          if (res.ok) {
            const data = await res.json();
            if (data.status === true || data.status === "success") {
              ophimDetail = data.data?.item || data.movie;
            }
          }
        } catch (e) {
          console.warn("Không tìm thấy trên OPhim hoặc lỗi API, thử tìm phim Custom...");
        }

        if (ophimDetail) {
          setMovie(ophimDetail);
        } else {
          // c. Nếu OPhim không có, thử tìm trong Custom Movies
          const customRes = await fetch(`${API_URL}/movies/custom/${slug}`);
          if (!customRes.ok) {
            throw new Error("Không tìm thấy thông tin phim.");
          }
          const customData = await customRes.json();
          // Convert custom data to MovieDetail format
          const adaptedMovie: MovieDetail = {
            _id: customData._id,
            name: customData.name,
            slug: customData.slug,
            origin_name: customData.origin_name,
            content: customData.content || "",
            type: "single",
            status: "completed",
            thumb_url: customData.thumb_url,
            poster_url: customData.poster_url,
            time: customData.time || "120 phút",
            episode_current: customData.quality || "FHD",
            episode_total: "1",
            year: customData.year || 2026,
            actor: [],
            director: [],
            category: customData.category || [],
            country: customData.country || [],
            episodes: [
              {
                server_name: "DlowServer",
                server_data: [
                  {
                    name: "Full",
                    slug: "full",
                    filename: customData.name,
                    link_embed: "",
                    link_m3u8: customData.link_m3u8,
                  }
                ]
              }
            ]
          };
          setMovie(adaptedMovie);
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
        const genreSlug = movie!.category[0].slug;
        const res = await fetch(`https://ophim1.com/v1/api/the-loai/${genreSlug}?page=1`);
        const data = await res.json();
        
        if (data.status === true || data.status === "success") {
          const items = data.data?.items || data.items || [];
          // Lọc bỏ phim hiện tại
          const filtered = items.filter((item: any) => item.slug !== movie!.slug).slice(0, 6);
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

  // Chuyển đổi YouTube URL thành định dạng nhúng
  const getYoutubeEmbedUrl = (url?: string) => {
    if (!url) return "";
    let videoId = "";
    if (url.includes("v=")) {
      videoId = url.split("v=")[1]?.split("&")[0];
    } else if (url.includes("youtu.be/")) {
      videoId = url.split("youtu.be/")[1]?.split("?")[0];
    } else if (url.includes("embed/")) {
      return url;
    }
    return videoId ? `https://www.youtube.com/embed/${videoId}` : "";
  };

  // Chọn màu gradient cho chữ cái avatar
  const getInitialsGradient = (name: string) => {
    const charCode = name.charCodeAt(0) || 0;
    const gradients = [
      "from-pink-500 to-rose-500 text-white",
      "from-amber-400 to-orange-500 text-white",
      "from-emerald-400 to-teal-500 text-white",
      "from-blue-500 to-indigo-600 text-white",
      "from-violet-500 to-purple-600 text-white",
      "from-cyan-400 to-blue-500 text-white",
    ];
    return gradients[charCode % gradients.length];
  };

  // Toggle Yêu thích
  const handleToggleFavorite = async () => {
    if (!movie) return;
    await toggleFavoriteCtx(movie.slug);
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

  // Nhận diện trạng thái phim chưa ra mắt (Trailer Only)
  const hasNoEpisodes = !movie.episodes || movie.episodes.length === 0 || movie.episodes[0]?.server_data?.length === 0;
  const isTrailerOnly = movie.status === "trailer" || movie.episode_current?.toLowerCase().includes("trailer") || hasNoEpisodes;

  return (
    <div className="min-h-screen bg-[#07070a] text-white pb-20 relative overflow-hidden">
      
      {/* 1. CINEMATIC LARGE BANNER AT TOP - BRIGHTER AND TALLER */}
      <div className="relative w-full h-[400px] lg:h-[480px] bg-zinc-950 overflow-hidden flex items-end pt-24 select-none">
        {/* Background Backdrop image */}
        <div className="absolute inset-0 z-0">
          <img
            src={getImageUrl(movie.poster_url || movie.thumb_url)}
            alt={cleanedName}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover opacity-70 md:opacity-85"
          />
          <HalftoneOverlay />
          {/* Bottom vignette gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#07070a] via-[#07070a]/20 to-black/5 z-10" />
        </div>

        {/* Buttons and Tab selector at the bottom of the banner */}
        <div className="container mx-auto px-4 md:px-6 max-w-7xl relative z-20 pb-4 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-8 md:gap-10 items-end">
            {/* Left column placeholder (leaves space for overlap poster) */}
            <div className="hidden lg:block h-[1px]" />
            
            {/* Right column: Buttons, Tabs */}
            <div className="text-left space-y-5">
              {/* Row of interaction buttons - vertical icon layout like cobephim */}
              <div className="flex items-center gap-6 select-none flex-wrap">
                {isTrailerOnly ? (
                  <button
                    onClick={() => {
                      setActiveTab("episodes");
                      document.getElementById("right-tabs-area")?.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="flex items-center gap-2 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-extrabold text-xs md:text-sm px-6 py-3 rounded-full transition-all duration-300 hover:scale-105 hover:shadow-[0_0_25px_rgba(236,72,153,0.7)] active:scale-95 cursor-pointer shadow-lg shadow-pink-500/25"
                  >
                    <Play size={14} className="fill-white" /> Xem Trailer
                  </button>
                ) : (
                  <button
                    onClick={handleWatchNow}
                    className="flex items-center gap-2 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-extrabold text-xs md:text-sm px-6 py-3 rounded-full transition-all duration-300 hover:scale-105 hover:shadow-[0_0_25px_rgba(236,72,153,0.7)] active:scale-95 cursor-pointer shadow-lg shadow-pink-500/25"
                  >
                    <Play size={14} className="fill-white" /> Xem Ngay
                  </button>
                )}

                {/* Vertical interactive buttons */}
                <button
                  onClick={handleToggleFavorite}
                  className="flex flex-col items-center gap-1 text-[10px] md:text-[11px] font-bold text-zinc-400 hover:text-white transition-colors cursor-pointer select-none"
                >
                  <Heart size={18} className={isFavorite ? "fill-pink-500 text-pink-500 drop-shadow-[0_0_8px_rgba(236,72,153,0.9)]" : ""} />
                  <span>Yêu thích</span>
                </button>

                <button
                  className="flex flex-col items-center gap-1 text-[10px] md:text-[11px] font-bold text-zinc-400 hover:text-white transition-colors cursor-pointer select-none"
                >
                  <Plus size={18} />
                  <span>Thêm vào</span>
                </button>

                <button
                  onClick={handleShare}
                  className="flex flex-col items-center gap-1 text-[10px] md:text-[11px] font-bold text-zinc-400 hover:text-white transition-colors cursor-pointer select-none"
                >
                  <Share2 size={18} className={shareCopied ? "text-emerald-400" : ""} />
                  <span>{shareCopied ? "Đã copy!" : "Chia sẻ"}</span>
                </button>

                <button
                  onClick={() => {
                    document.getElementById("movie-comments")?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="flex flex-col items-center gap-1 text-[10px] md:text-[11px] font-bold text-zinc-400 hover:text-white transition-colors cursor-pointer select-none"
                >
                  <MessageSquare size={18} />
                  <span>Bình luận</span>
                </button>

                {/* Rating button - blue background pill on the right side */}
                <div className="ml-auto flex items-center gap-1 bg-blue-600/90 hover:bg-blue-700 text-white text-[11px] font-extrabold px-3.5 py-1.5 rounded-full shadow-md select-none transition-all cursor-pointer">
                  <Star size={12} className="fill-white" />
                  <span>0 Đánh giá</span>
                </div>
              </div>

              {/* Tab menu selector - smaller text and cleaner style */}
              <div className="flex border-b border-zinc-900/40 gap-6 text-[11px] md:text-xs select-none pt-2">
                {[
                  { id: "episodes", label: isTrailerOnly ? "Trailer Phim" : "Tập phim" },
                  { id: "gallery", label: "Gallery" },
                  { id: "actors", label: "Diễn viên" },
                  { id: "recommendations", label: "Đề xuất" }
                ].map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`pb-2.5 font-extrabold uppercase tracking-wider relative transition-all cursor-pointer ${
                        isActive
                          ? "text-pink-500"
                          : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      {tab.label}
                      {isActive && (
                        <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-pink-500 rounded-full" />
                      )}
                    </button>
                  );
                })}
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* 2. MAIN CONTENT AREA: TWO COLUMNS (LEFT COLUMN 320PX WITH RIGHT PADDING FOR BETTER BALANCE) */}
      <div className="container mx-auto px-4 md:px-6 max-w-7xl grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-8 md:gap-10 pb-20 relative z-20">
        
        {/* CỘT TRÁI: Poster nổi đè banner, TIÊU ĐỀ DƯỚI POSTER, badges, chi tiết phụ */}
        <div className="-mt-[120px] md:-mt-[150px] lg:-mt-[180px] relative z-30 flex flex-col gap-5 text-left px-4 lg:px-0 lg:pr-12">
          
          {/* Poster chính thu nhỏ tỷ lệ */}
          <div className="w-[110px] md:w-[130px] lg:w-[150px] mx-auto lg:mx-0 relative aspect-[2/3] rounded-2xl overflow-hidden shadow-[0_15px_40px_rgba(0,0,0,0.85)] bg-zinc-950 select-none">
            <img
              src={getImageUrl(movie.thumb_url || movie.poster_url)}
              alt={cleanedName}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>

          {/* TIÊU ĐỀ PHIM DƯỚI POSTER THU NHỎ SIZE */}
          <div className="space-y-1 text-center lg:text-left">
            <h1 className="text-sm md:text-base lg:text-[17px] font-black tracking-tight leading-tight text-zinc-100">
              {cleanedName}
            </h1>
            <h2 className="text-[10px] font-bold text-zinc-550 uppercase tracking-wider">
              {cleanedOrigin}
            </h2>
          </div>

          {/* Badges thông số bên dưới Tiêu đề */}
          <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-zinc-400 font-extrabold select-none justify-center lg:justify-start">
            <span className="bg-amber-400 text-black border border-amber-400 font-black px-2 py-0.5 rounded flex items-center gap-0.5 shadow-sm">
              IMDb {getImdbScore()}
            </span>
            <span className="border border-zinc-800 bg-zinc-950/60 px-2 py-0.5 rounded">
              T16
            </span>
            <span className="border border-zinc-800 bg-zinc-950/60 px-2 py-0.5 rounded">
              {movie.year}
            </span>
            {movie.time && (
              <span className="border border-zinc-800 bg-zinc-950/60 px-2 py-0.5 rounded">
                {movie.time}
              </span>
            )}
          </div>

          {/* Danh sách Thể loại */}
          {movie.category && movie.category.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 justify-center lg:justify-start">
              {movie.category.map((cat) => (
                <button
                  key={cat.slug}
                  onClick={() => router.push(`/search?genre=${cat.slug}`)}
                  className="bg-zinc-900/40 border border-zinc-800 hover:border-pink-500 hover:text-pink-400 text-zinc-400 text-[10px] font-bold px-2.5 py-0.5 rounded-full transition-all duration-200 cursor-pointer"
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}

          {/* Phần giới thiệu cốt truyện - Chảy tự nhiên */}
          <div className="space-y-1.5 border-t border-zinc-900 pt-4 text-xs">
            <h3 className="text-[11px] font-black text-zinc-500 uppercase tracking-wider">Giới thiệu:</h3>
            <p className="text-zinc-400 leading-relaxed font-semibold">
              {movie.content ? movie.content.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim() : "Chưa có thông tin giới thiệu cho bộ phim này."}
            </p>
          </div>

          {/* Dòng thông tin metadata */}
          <div className="space-y-1.5 border-t border-zinc-900 pt-4 text-[11px] text-zinc-400">
            <p className="font-semibold">
              <span className="text-zinc-500 font-bold mr-1">Thời lượng:</span>
              {movie.time || "Đang cập nhật"}
            </p>
            {movie.country && movie.country.length > 0 && (
              <p className="font-semibold">
                <span className="text-zinc-500 font-bold mr-1">Quốc gia:</span>
                {movie.country.map(c => c.name).join(", ")}
              </p>
            )}
            <p className="font-semibold leading-relaxed">
              <span className="text-zinc-500 font-bold mr-1">Đạo diễn:</span>
              {movie.director?.filter(d => d).join(", ") || "Đang cập nhật"}
            </p>
            <p className="font-semibold leading-relaxed">
              <span className="text-zinc-500 font-bold mr-1">Diễn viên:</span>
              {movie.actor?.filter(a => a && a.trim() && a !== "Đang cập nhật").slice(0, 5).join(", ") || "Đang cập nhật"}
            </p>
          </div>

          {/* Discord cộng đồng */}
          <div className="p-4 rounded-xl bg-gradient-to-tr from-pink-500/10 via-rose-500/5 to-transparent border border-pink-500/20 text-left space-y-2 shadow-lg select-none">
            <div className="flex items-center gap-1.5">
              <Flame size={14} className="text-pink-500 animate-pulse" />
              <span className="text-[10px] font-black text-white tracking-wider uppercase">Cộng đồng DlowPhim</span>
            </div>
            <p className="text-[10px] text-zinc-400 font-semibold leading-relaxed">
              Gia nhập Discord bàn luận phim và cập nhật tin tức nhanh nhất!
            </p>
            <a
              href="https://discord.gg/dlowphim"
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center w-full bg-pink-500 hover:bg-pink-600 text-white font-extrabold text-[10px] py-2 rounded-xl transition-all cursor-pointer shadow-md shadow-pink-500/10"
            >
              THAM GIA NGAY
            </a>
          </div>

        </div>

        {/* CỘT PHẢI: Tab Content & Bình luận dưới cùng */}
        <div id="right-tabs-area" className="space-y-6 text-left mt-6 lg:mt-0">
          
          {/* TAB 1: TẬP PHIM / TRAILER */}
          {activeTab === "episodes" && (
            <div className="space-y-5">
              {isTrailerOnly ? (
                <div className="space-y-4">
                  <h3 className="text-base font-bold uppercase tracking-tight flex items-center gap-2">
                    <Film size={16} className="text-pink-500" /> Trailer phim chính thức
                  </h3>
                  {movie.trailer_url ? (
                    <div className="w-full aspect-video rounded-2xl overflow-hidden shadow-2xl bg-black">
                      <iframe
                        src={getYoutubeEmbedUrl(movie.trailer_url)}
                        frameBorder="0"
                        allowFullScreen
                        className="w-full h-full"
                        title={`${cleanedName} - Trailer`}
                      />
                    </div>
                  ) : (
                    <div className="p-8 rounded-xl border border-zinc-800 bg-zinc-950/40 text-center flex flex-col items-center justify-center gap-2.5">
                      <HelpCircle size={36} className="text-zinc-650 animate-pulse" />
                      <h4 className="font-extrabold text-xs text-zinc-300">Trailer đang được cập nhật</h4>
                      <p className="text-[11px] text-zinc-500 max-w-sm">
                        Hiện phim này chưa có video trailer từ máy chủ. Bồ có thể tự tìm kiếm trên YouTube nhé!
                      </p>
                      <a
                        href={`https://www.youtube.com/results?search_query=${encodeURIComponent(cleanedName + " trailer")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 text-xs font-black text-pink-500 hover:underline flex items-center gap-1"
                      >
                        Tìm kiếm trên YouTube <ExternalLink size={12} />
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <h3 className="text-base font-bold uppercase tracking-tight flex items-center gap-2">
                    <Tv size={16} className="text-pink-500" /> Các bản chiếu
                  </h3>
                  
                  {movie.episodes?.map((server, sIdx) => {
                    const epList = server.server_data || [];
                    return (
                      <div key={`server-${sIdx}`} className="p-4 rounded-xl bg-[#0d0e13]/40 space-y-4 shadow-sm border border-transparent">
                        <div className={`flex items-center justify-between gap-4 flex-wrap pb-2.5 ${epList.length > 1 ? "border-b border-zinc-900/40" : ""}`}>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-12 rounded-lg overflow-hidden shrink-0 shadow-md">
                              <img src={getImageUrl(movie.thumb_url || movie.poster_url)} className="w-full h-full object-cover" />
                            </div>
                            <div className="text-left">
                              <span className="text-[9px] text-zinc-550 font-extrabold uppercase bg-zinc-900 px-2 py-0.5 rounded border border-transparent">
                                {server.server_name || `Server #${sIdx + 1}`}
                              </span>
                              <h4 className="font-extrabold text-xs text-white mt-1">{cleanedName}</h4>
                            </div>
                          </div>
                          
                          <button
                            onClick={handleWatchNow}
                            className="px-3.5 py-2 bg-pink-500 hover:bg-pink-600 text-white text-[11px] font-black rounded-lg transition-all hover:scale-103 active:scale-97 uppercase tracking-wider shadow shadow-pink-500/10 cursor-pointer"
                          >
                            Xem bản này
                          </button>
                        </div>

                        {/* Danh sách tập */}
                        {epList.length > 1 && (
                          <div className="space-y-3">
                            <span className="block text-[9px] font-black text-zinc-550 uppercase tracking-widest">Chọn tập phim:</span>
                            
                            {/* Phân nhóm tập phim nếu số lượng tập > 100 y hệt cobephim */}
                            {epList.length > 100 && (
                              <div className="flex flex-wrap gap-1.5 pb-2.5 border-b border-zinc-900/30">
                                {Array.from({ length: Math.ceil(epList.length / 100) }).map((_, bIdx) => {
                                  const start = bIdx * 100 + 1;
                                  const end = Math.min((bIdx + 1) * 100, epList.length);
                                  const isActive = selectedEpisodeBatch === bIdx;
                                  return (
                                    <button
                                      key={`batch-${bIdx}`}
                                      onClick={() => setSelectedEpisodeBatch(bIdx)}
                                      className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer border-none ${
                                        isActive
                                          ? "bg-pink-500 text-white shadow-sm shadow-pink-500/15"
                                          : "bg-[#1b1d2a] text-zinc-400 hover:text-white hover:bg-[#23263a]"
                                      }`}
                                    >
                                      Tập {start} - {end}
                                    </button>
                                  );
                                })}
                              </div>
                            )}

                            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
                              {epList
                                .slice(selectedEpisodeBatch * 100, (selectedEpisodeBatch + 1) * 100)
                                .map((ep, eIdx) => (
                                  <button
                                    key={`ep-${eIdx}`}
                                    onClick={() => handleWatchEpisode(ep.name)}
                                    className="h-9 rounded-lg font-extrabold text-[11px] flex items-center justify-center bg-[#1b1d2a] text-zinc-300 hover:bg-pink-500 hover:text-white transition-all cursor-pointer border-none group"
                                  >
                                    <Play size={10} className="fill-zinc-300 stroke-none mr-1.5 shrink-0 group-hover:fill-white" />
                                    {ep.name.toLowerCase().includes("tập") ? ep.name : `Tập ${ep.name}`}
                                  </button>
                                ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: GALLERY */}
          {activeTab === "gallery" && (
            <div className="space-y-4">
              <h3 className="text-base font-bold uppercase tracking-tight flex items-center gap-2">
                <Image size={16} className="text-pink-500" /> Thư viện ảnh phim
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="relative aspect-[16/10] bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow group">
                  <img src={getImageUrl(movie.poster_url || movie.thumb_url)} className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-500" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent flex items-end p-4">
                    <span className="text-[11px] font-bold text-zinc-300">Phông nền phim Cinematic</span>
                  </div>
                </div>
                <div className="relative aspect-[16/10] bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow group">
                  <img src={getImageUrl(movie.thumb_url || movie.poster_url)} className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-500" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent flex items-end p-4">
                    <span className="text-[11px] font-bold text-zinc-300">Hình ảnh Thumbnail chính thức</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: DIỄN VIÊN */}
          {activeTab === "actors" && (
            <div className="space-y-4">
              <h3 className="text-base font-bold uppercase tracking-tight flex items-center gap-2">
                <Users size={16} className="text-pink-500" /> Dàn diễn viên tham gia ({movie.actor?.length || 0})
              </h3>
              {movie.actor && movie.actor.filter(a => a && a.trim() && a !== "Đang cập nhật").length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {movie.actor.filter(a => a && a.trim() && a !== "Đang cập nhật").map((actor, idx) => (
                    <div key={`actor-list-${idx}`} className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-900/60 flex flex-col items-center text-center gap-2.5 shadow-sm hover:border-zinc-800 transition-all hover:-translate-y-0.5 duration-200">
                      <div className={`w-12 h-12 rounded-full font-black text-sm flex items-center justify-center bg-gradient-to-tr ${getInitialsGradient(actor)} shadow`}>
                        {actor && actor[0] ? actor[0].toUpperCase() : "?"}
                      </div>
                      <span className="text-[11px] font-extrabold text-zinc-200 leading-snug truncate w-full">{actor}</span>
                      <span className="text-[8px] text-zinc-650 font-black uppercase tracking-wider">Diễn viên</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs font-bold text-zinc-500">Thông tin diễn viên đang được cập nhật.</p>
              )}
            </div>
          )}

          {/* TAB 4: ĐỀ XUẤT */}
          {activeTab === "recommendations" && (
            <div className="space-y-4">
              <h3 className="text-base font-bold uppercase tracking-tight flex items-center gap-2">
                <Compass size={16} className="text-pink-500" /> Phim cùng thể loại (Đề xuất)
              </h3>
              {loadingRelated ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="animate-spin text-pink-500" size={20} />
                </div>
              ) : relatedMovies.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
                  {relatedMovies.map((m) => (
                    <MovieCard key={m._id || m.slug} movie={m} aspect="portrait" />
                  ))}
                </div>
              ) : (
                <p className="text-xs font-bold text-zinc-500">Chưa tìm thấy phim đề xuất phù hợp.</p>
              )}
            </div>
          )}

          {/* 4. BÌNH LUẬN & ĐÁNH GIÁ - Component dùng chung */}
          <CommentRatingSection slug={slug} />
        </div>
      </div>
    </div>
  );
}
