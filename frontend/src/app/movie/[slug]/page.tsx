"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Play, Heart, Share2, Film, Star, Loader2, ArrowLeft, Sparkles, Tv, HelpCircle, Send, Plus, MessageSquare, Image, Users, Flame, ExternalLink, Compass } from "lucide-react";
import { cleanMovieName } from "@/utils/movieUtils";
import MovieCard from "@/components/MovieCard";
import { useAuth } from "@/context/AuthContext";

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

interface Comment {
  id: string;
  avatar: string;
  name: string;
  role: "member" | "vip" | "admin";
  content: string;
  time: string;
  likes: number;
  liked?: boolean;
}

export default function MovieDetailPage({ params }: { params: { slug: string } }) {
  const { slug } = params;
  const router = useRouter();
  const { user } = useAuth();

  const [movie, setMovie] = useState<MovieDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // States tương tác
  const [isFavorite, setIsFavorite] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"episodes" | "gallery" | "actors" | "recommendations">("episodes");

  // States bình luận
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<Comment[]>([]);
  const [isSpoiler, setIsSpoiler] = useState(false);

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
          const filtered = items.filter((item: any) => item.slug !== movie.slug).slice(0, 6);
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

  // 3. Đồng bộ bình luận theo phim qua LocalStorage (hoặc nạp bình luận mẫu riêng cho phim)
  useEffect(() => {
    if (!movie) return;
    const nameClean = cleanMovieName(movie.name);
    const localComments = localStorage.getItem(`dlowphim_comments_${slug}`);
    if (localComments) {
      setComments(JSON.parse(localComments));
    } else {
      const defaultComments: Comment[] = [
        {
          id: "c-1",
          avatar: "H",
          name: "Hoàng Long",
          role: "vip",
          content: `Phim ${nameClean} xem mượt cực kỳ, âm thanh sống động ghê. Thích giao diện rạp chiếu phim (Cinema Mode) quá đi mất!`,
          time: "2 giờ trước",
          likes: 42,
        },
        {
          id: "c-2",
          avatar: "A",
          name: "Ánh Dương",
          role: "member",
          content: `Tốc độ tải phim ${nameClean} nhanh kinh khủng. Mình dùng mạng 4G xem HD vẫn không hề giật lag tí nào luôn. Đỉnh!`,
          time: "5 giờ trước",
          likes: 18,
        },
        {
          id: "c-3",
          avatar: "D",
          name: "Duy Mạnh",
          role: "member",
          content: `Vừa mới chiếu rạp mà trên này đã có bản nét Vietsub của ${nameClean} rồi, DlowPhim cập nhật nhanh thật sự.`,
          time: "1 ngày trước",
          likes: 27,
        },
        {
          id: "c-4",
          avatar: "A",
          name: "Admin Dlow",
          role: "admin",
          content: `Chào các bồ! Chúc các bồ xem phim ${nameClean} vui vẻ nhé. Sắp tới tụi mình sẽ nâng cấp tính năng phòng chiếu chung nữa nha!`,
          time: "2 ngày trước",
          likes: 109,
        }
      ];
      setComments(defaultComments);
      localStorage.setItem(`dlowphim_comments_${slug}`, JSON.stringify(defaultComments));
    }
  }, [movie, slug]);

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

  // Gửi bình luận
  const handleSubmitComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !user) return;

    const newComment: Comment = {
      id: `c-custom-${Date.now()}`,
      avatar: user.displayName ? user.displayName[0].toUpperCase() : "K",
      name: user.displayName || "Thành viên",
      role: "member",
      content: commentText.trim(),
      time: "Vừa xong",
      likes: 0,
    };

    const updatedComments = [newComment, ...comments];
    setComments(updatedComments);
    localStorage.setItem(`dlowphim_comments_${slug}`, JSON.stringify(updatedComments));
    setCommentText("");
    setIsSpoiler(false);
  };

  // Thích bình luận
  const handleLikeComment = (commentId: string) => {
    const updated = comments.map(c => {
      if (c.id === commentId) {
        return {
          ...c,
          liked: !c.liked,
          likes: c.liked ? c.likes - 1 : c.likes + 1
        };
      }
      return c;
    });
    setComments(updated);
    localStorage.setItem(`dlowphim_comments_${slug}`, JSON.stringify(updated));
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
                  <Heart size={18} className={isFavorite ? "fill-rose-500 text-rose-500" : ""} />
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
          <div className="w-[110px] md:w-[130px] lg:w-[150px] mx-auto lg:mx-0 relative aspect-[2/3] rounded-2xl overflow-hidden border border-zinc-800 shadow-[0_15px_40px_rgba(0,0,0,0.85)] bg-zinc-950 group select-none">
            <img
              src={getImageUrl(movie.thumb_url || movie.poster_url)}
              alt={cleanedName}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:4px_4px] opacity-100 pointer-events-none" />
            
            <div className="absolute top-2.5 left-2.5 flex flex-col gap-1">
              <span className="bg-pink-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded shadow uppercase tracking-wider">
                {movie.quality || "HD"}
              </span>
              <span className="bg-zinc-950/80 backdrop-blur text-white text-[8px] font-black px-1.5 py-0.5 rounded shadow border border-zinc-800 uppercase tracking-wider">
                {movie.lang || "Vietsub"}
              </span>
            </div>
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
            <span className="border border-zinc-850 bg-zinc-950/60 px-2 py-0.5 rounded">
              T16
            </span>
            <span className="border border-zinc-850 bg-zinc-950/60 px-2 py-0.5 rounded">
              {movie.year}
            </span>
            {movie.time && (
              <span className="border border-zinc-850 bg-zinc-950/60 px-2 py-0.5 rounded">
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
                  className="bg-zinc-900/40 border border-zinc-850 hover:border-pink-500 hover:text-pink-400 text-zinc-400 text-[10px] font-bold px-2.5 py-0.5 rounded-full transition-all duration-200 cursor-pointer"
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
              {movie.actor?.filter(a => a).slice(0, 5).join(", ") || "Đang cập nhật"}
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
                    <div className="w-full aspect-video rounded-2xl overflow-hidden border border-zinc-850 shadow-2xl bg-black">
                      <iframe
                        src={getYoutubeEmbedUrl(movie.trailer_url)}
                        frameBorder="0"
                        allowFullScreen
                        className="w-full h-full"
                        title={`${cleanedName} - Trailer`}
                      />
                    </div>
                  ) : (
                    <div className="p-8 rounded-xl border border-zinc-850 bg-zinc-950/40 text-center flex flex-col items-center justify-center gap-2.5">
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
                      <div key={`server-${sIdx}`} className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-900/60 space-y-4 shadow-sm">
                        <div className="flex items-center justify-between gap-4 flex-wrap border-b border-zinc-900/40 pb-2.5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-12 rounded-lg overflow-hidden shrink-0 border border-zinc-850 shadow-md">
                              <img src={getImageUrl(movie.thumb_url || movie.poster_url)} className="w-full h-full object-cover" />
                            </div>
                            <div className="text-left">
                              <span className="text-[9px] text-zinc-550 font-extrabold uppercase bg-zinc-900 border border-zinc-850 px-2 py-0.5 rounded">
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
                        {epList.length > 0 && (
                          <div className="space-y-1.5">
                            <span className="block text-[9px] font-black text-zinc-500 uppercase tracking-widest">Chọn tập phim:</span>
                            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
                              {epList.map((ep, eIdx) => (
                                <button
                                  key={`ep-${eIdx}`}
                                  onClick={() => handleWatchEpisode(ep.name)}
                                  className="h-9 rounded-lg font-extrabold text-[11px] flex items-center justify-center border border-zinc-850 bg-zinc-950/40 text-zinc-400 hover:text-white hover:border-zinc-700 hover:bg-zinc-900 transition-all cursor-pointer"
                                >
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
                <div className="relative aspect-[16/10] bg-zinc-900 border border-zinc-850 rounded-2xl overflow-hidden shadow group">
                  <img src={getImageUrl(movie.poster_url || movie.thumb_url)} className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-500" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent flex items-end p-4">
                    <span className="text-[11px] font-bold text-zinc-300">Phông nền phim Cinematic</span>
                  </div>
                </div>
                <div className="relative aspect-[16/10] bg-zinc-900 border border-zinc-850 rounded-2xl overflow-hidden shadow group">
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
              {movie.actor && movie.actor.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {movie.actor.map((actor, idx) => (
                    <div key={`actor-list-${idx}`} className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-900/60 flex flex-col items-center text-center gap-2.5 shadow-sm hover:border-zinc-800 transition-all hover:-translate-y-0.5 duration-200">
                      <div className={`w-12 h-12 rounded-full font-black text-sm flex items-center justify-center bg-gradient-to-tr ${getInitialsGradient(actor)} shadow`}>
                        {actor[0].toUpperCase()}
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

          {/* 4. KHU VỰC BÌNH LUẬN - KHÔI PHỤC DÃN RỘNG TOÀN BỘ CỘT PHẢI Y HỆT COBEPHIM */}
          <div id="movie-comments" className="border-t border-zinc-900/80 pt-6 space-y-5 w-full">
            
            {/* Header: Bình luận (N) & Switcher */}
            <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
              <div className="flex items-center gap-2">
                <MessageSquare size={18} className="text-zinc-100" />
                <h3 className="text-base md:text-lg font-bold text-white select-none">
                  Bình luận ({comments.length})
                </h3>
              </div>
              
              {/* Tab Switcher: Bình luận / Đánh giá */}
              <div className="flex bg-zinc-900/60 p-0.5 rounded-lg border border-zinc-800/80 text-[10px] font-extrabold select-none">
                <button type="button" className="px-3 py-1.5 bg-white text-zinc-950 rounded-md font-black shadow-sm cursor-pointer">
                  Bình luận
                </button>
                <button type="button" className="px-3 py-1.5 text-zinc-400 hover:text-white rounded-md cursor-pointer transition-colors">
                  Đánh giá
                </button>
              </div>
            </div>

            {/* User row: Avatar, Bình luận với tên */}
            {user && (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full overflow-hidden border border-zinc-850 shrink-0 bg-gradient-to-tr from-pink-500 to-rose-500 flex items-center justify-center font-black text-white text-sm shadow-sm select-none">
                  {user.displayName ? user.displayName[0].toUpperCase() : "U"}
                </div>
                <div className="text-left flex flex-col select-none">
                  <span className="text-[10px] text-zinc-500 font-semibold leading-none">Bình luận với tên</span>
                  <span className="text-xs font-black text-zinc-250 mt-1">{user.displayName || "Thành viên"}</span>
                </div>
              </div>
            )}

            {/* Comment Textarea Box */}
            <div className="rounded-xl border border-zinc-800 bg-[#161722] overflow-hidden flex flex-col">
              <textarea
                value={commentText}
                onChange={(e) => {
                  if (e.target.value.length <= 1000) {
                    setCommentText(e.target.value);
                  }
                }}
                placeholder="Viết bình luận"
                disabled={!user}
                className="w-full bg-transparent border-none text-zinc-200 placeholder-zinc-550 text-xs px-4 py-3 focus:outline-none focus:ring-0 min-h-[90px] resize-none font-semibold"
              />
              
              {/* Box Footer bar */}
              <div className="flex items-center justify-between px-4 py-2.5 border-t border-zinc-900/60 bg-[#12131b]">
                {/* Spoilers toggle */}
                <div className="flex items-center gap-2 select-none">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={isSpoiler} 
                      onChange={(e) => setIsSpoiler(e.target.checked)}
                      disabled={!user}
                    />
                    <div className="w-8 h-4 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-500 after:border-zinc-400 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-pink-500 peer-checked:after:bg-white" />
                    <span className="ml-2 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Tiết lộ?</span>
                  </label>
                </div>
                
                {/* Counter and Send button */}
                <div className="flex items-center gap-3.5 select-none">
                  <span className="text-[10px] font-black text-zinc-650">{commentText.length} / 1000</span>
                  <button
                    onClick={handleSubmitComment}
                    disabled={!commentText.trim() || !user}
                    className="flex items-center gap-1.5 text-[11px] font-black text-amber-400 hover:text-amber-300 transition-colors bg-transparent border-none p-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <span>Gửi</span>
                    <Send size={12} className="fill-amber-400 stroke-none" />
                  </button>
                </div>
              </div>
            </div>

            {/* Login Prompt for guest users */}
            {!user && (
              <div className="p-3.5 rounded-xl border border-zinc-850 bg-zinc-950/40 text-[11px] text-zinc-500 leading-relaxed font-bold text-center">
                Vui lòng{" "}
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new Event("dlowphim_open_auth"))}
                  className="text-pink-500 font-extrabold hover:underline cursor-pointer bg-transparent border-none inline p-0"
                >
                  đăng nhập
                </button>{" "}
                để tham gia bình luận.
              </div>
            )}

            {/* List of comments or Placeholder when empty */}
            <div className="pt-2 text-left">
              {comments.length > 0 ? (
                <div className="space-y-4 divide-y divide-zinc-900/60 pr-1 max-h-[350px] overflow-y-auto no-scrollbar">
                  {comments.map((comment, index) => {
                    const isVip = comment.role === "vip";
                    const isAdmin = comment.role === "admin";
                    
                    return (
                      <div key={comment.id} className={`flex gap-3 pt-3.5 ${index === 0 ? "pt-0" : ""}`}>
                        <div className={`w-8 h-8 rounded-full font-black text-xs flex items-center justify-center shrink-0 shadow-sm ${
                          isAdmin 
                            ? "bg-gradient-to-tr from-pink-500 to-rose-500 text-white" 
                            : isVip 
                              ? "bg-amber-400 text-black" 
                              : "bg-zinc-800 text-zinc-300"
                        }`}>
                          {comment.avatar}
                        </div>

                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-extrabold text-xs text-zinc-200">{comment.name}</span>
                            {isAdmin && (
                              <span className="bg-pink-500 text-white text-[7px] font-black px-1.5 py-0.2 rounded uppercase tracking-wider">
                                Quản trị
                              </span>
                            )}
                            {isVip && (
                              <span className="bg-amber-400 text-black text-[7px] font-black px-1.5 py-0.2 rounded uppercase tracking-wider">
                                VIP
                              </span>
                            )}
                            <span className="text-[9px] text-zinc-550 font-semibold">{comment.time}</span>
                          </div>
                          
                          <p className="text-zinc-300 text-xs leading-relaxed font-semibold">
                            {comment.content}
                          </p>
                          
                          <button
                            onClick={() => handleLikeComment(comment.id)}
                            className="flex items-center gap-1 text-[9px] font-black transition-colors select-none pt-0.5 cursor-pointer text-zinc-550 hover:text-zinc-300"
                          >
                            THÍCH ({comment.likes})
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-12 text-center flex flex-col items-center justify-center gap-3 bg-zinc-950/40 rounded-2xl border border-zinc-900/40 mt-4 select-none">
                  <MessageSquare size={36} className="text-zinc-700 stroke-[1.5]" />
                  <span className="text-xs font-bold text-zinc-550">Chưa có bình luận nào</span>
                </div>
              )}
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}
