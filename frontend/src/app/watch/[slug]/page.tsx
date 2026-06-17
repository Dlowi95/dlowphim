"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Play, Heart, Share2, Film, Star, Loader2, ArrowLeft, Send, Sparkles, Tv, HelpCircle } from "lucide-react";
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

const DEFAULT_COMMENTS: Comment[] = [
  {
    id: "c-1",
    avatar: "H",
    name: "Hoàng Long",
    role: "vip",
    content: "Phim xem mượt cực kỳ, âm thanh sống động ghê. Thích giao diện rạp chiếu phim (Cinema Mode) quá đi mất!",
    time: "2 giờ trước",
    likes: 42,
  },
  {
    id: "c-2",
    avatar: "A",
    name: "Ánh Dương",
    role: "member",
    content: "Tốc độ tải phim nhanh kinh khủng. Mình dùng mạng 4G xem HD vẫn không hề giật lag tí nào luôn. Đỉnh!",
    time: "5 giờ trước",
    likes: 18,
  },
  {
    id: "c-3",
    avatar: "D",
    name: "Duy Mạnh",
    role: "member",
    content: "Vừa mới chiếu rạp mà trên này đã có bản nét Vietsub rồi, DlowPhim cập nhật nhanh thật sự.",
    time: "1 ngày trước",
    likes: 27,
  },
  {
    id: "c-4",
    avatar: "A",
    name: "Admin Dlow",
    role: "admin",
    content: "Chào các bồ! Chúc các bồ xem phim vui vẻ nhé. Sắp tới tụi mình sẽ nâng cấp tính năng phòng chiếu chung nữa nha!",
    time: "2 ngày trước",
    likes: 109,
  }
];

function WatchContent({ slug }: { slug: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryEp = searchParams.get("ep") || "";

  const [movie, setMovie] = useState<MovieDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { user } = useAuth();

  // States phát phim
  const [activeServerIndex, setActiveServerIndex] = useState(0);
  const [activeEpisodeIndex, setActiveEpisodeIndex] = useState(0);
  const [cinemaMode, setCinemaMode] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [playerType, setPlayerType] = useState<"embed" | "hls">("embed");

  // States bình luận
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<Comment[]>([]);

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

  const cleanedName = movie ? cleanMovieName(movie.name) : "";
  const servers = movie?.episodes || [];
  const currentServer = servers[activeServerIndex];
  const episodesData = currentServer?.server_data || [];
  const activeEpisode = episodesData[activeEpisodeIndex];
  const activeEmbed = activeEpisode?.link_embed || null;

  // 1.7. Đồng bộ bình luận theo phim qua LocalStorage (hoặc nạp bình luận mẫu riêng cho phim)
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

  // 2. Đồng bộ tập phim đang hoạt động dựa trên query queryEp
  useEffect(() => {
    if (!movie || !movie.episodes || movie.episodes.length === 0) return;
    const currentServer = movie.episodes[activeServerIndex];
    if (!currentServer || !currentServer.server_data || currentServer.server_data.length === 0) return;

    if (!queryEp) {
      // Nếu không có query ep, mặc định chọn tập đầu tiên
      setActiveEpisodeIndex(0);
      return;
    }

    // Tìm tập có tên khớp với queryEp
    const foundIdx = currentServer.server_data.findIndex(
      (ep) => ep.name.toLowerCase() === queryEp.toLowerCase()
    );

    if (foundIdx !== -1) {
      setActiveEpisodeIndex(foundIdx);
    } else {
      setActiveEpisodeIndex(0);
    }
  }, [movie, queryEp, activeServerIndex]);

  // 2.5. HLS Player dynamic initialization
  useEffect(() => {
    if (playerType === "hls" && activeEpisode?.link_m3u8) {
      const scriptId = "dlowphim-hls-script";
      let script = document.getElementById(scriptId) as HTMLScriptElement;

      const initPlayer = () => {
        const Hls = (window as any).Hls;
        const video = document.getElementById("dlow-hls-video") as HTMLVideoElement;
        if (video && Hls && Hls.isSupported()) {
          const hls = new Hls();
          hls.loadSource(activeEpisode.link_m3u8);
          hls.attachMedia(video);
        }
      };

      if (script) {
        initPlayer();
      } else {
        script = document.createElement("script");
        script.id = scriptId;
        script.src = "https://cdn.jsdelivr.net/npm/hls.js@1.4.12/dist/hls.min.js";
        script.async = true;
        script.onload = initPlayer;
        document.body.appendChild(script);
      }
    }
  }, [playerType, activeEpisode]);

  // 3. Fetch phim liên quan
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

  // Chia sẻ
  const handleShare = () => {
    if (typeof window === "undefined") return;
    navigator.clipboard.writeText(window.location.href);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
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

  // Thay đổi tập phim khi click -> push query mới lên url
  const handleSelectEpisode = (episodeName: string) => {
    router.push(`/watch/${slug}?ep=${encodeURIComponent(episodeName)}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-3">
        <Loader2 className="animate-spin text-pink-500" size={48} />
        <p className="text-sm font-semibold text-zinc-400 animate-pulse">Đang nạp nguồn chiếu phim...</p>
      </div>
    );
  }

  if (error || !movie) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-4 px-6">
        <HelpCircle size={60} className="text-zinc-650 animate-bounce" />
        <h2 className="text-xl md:text-2xl font-black text-zinc-300">Không tìm thấy thông tin phim!</h2>
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-2 border border-zinc-800 bg-zinc-950 hover:bg-zinc-900 text-white text-sm font-extrabold px-6 py-2.5 rounded-xl transition-all"
        >
          <ArrowLeft size={16} /> Quay về Trang chủ
        </button>
      </div>
    );
  }



  return (
    <div className="min-h-screen bg-[#07070a] text-white pb-20 relative overflow-hidden pt-24">
      {/* BACKGROUND BLURRED */}
      <div className="absolute top-0 left-0 right-0 h-[60vh] overflow-hidden pointer-events-none select-none z-0">
        <img
          src={getImageUrl(movie.poster_url || movie.thumb_url)}
          alt={cleanedName}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover opacity-15 blur-[60px] scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#07070a]/60 to-[#07070a] z-10" />
      </div>



      <div className="container mx-auto px-4 md:px-6 max-w-7xl relative z-10 space-y-8">
        
        {/* Nút Quay lại trang Chi tiết */}
        <div className="flex items-center justify-between select-none">
          <button 
            onClick={() => router.push(`/movie/${movie.slug}`)}
            className="flex items-center gap-1.5 text-zinc-500 hover:text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
          >
            <ArrowLeft size={14} /> Xem thông tin chi tiết phim
          </button>

          <span className="text-xs font-bold text-pink-400 select-none">
            Bạn đang xem: {cleanedName} {activeEpisode ? ` - Tập ${activeEpisode.name}` : ""}
          </span>
        </div>

        {/* 1. TRÌNH PHÁT VIDEO CHÍNH (VIDEO PLAYER SECTION) */}
        <div 
          className={`space-y-4 transition-all duration-300 ${cinemaMode ? "relative z-50 w-full" : ""}`}
        >
          {cinemaMode && (
            <div 
              onClick={() => setCinemaMode(false)}
              className="fixed inset-0 bg-black/95 z-40 transition-all duration-300"
            />
          )}

          <div className={`flex items-center justify-between border-b border-zinc-900 pb-3 ${cinemaMode ? "relative z-50" : ""}`}>
            <div className="flex items-center gap-2 text-left">
              <Film size={20} className="text-pink-500" />
              <h3 className="text-lg md:text-xl font-bold uppercase tracking-tight">
                Đang phát: {cleanedName} {activeEpisode ? `(Tập ${activeEpisode.name})` : ""}
              </h3>
            </div>
            
            <button
              onClick={() => setCinemaMode(!cinemaMode)}
              className={`text-xs font-bold px-3.5 py-1.5 rounded-lg border transition-all cursor-pointer ${
                cinemaMode
                  ? "bg-pink-500 border-pink-500 text-white shadow-md shadow-pink-500/20 z-50"
                  : "bg-zinc-955 border-zinc-850 text-zinc-400 hover:text-white hover:border-zinc-700"
              }`}
            >
              {cinemaMode ? "Tắt Rạp Chiếu" : "Chế Độ Rạp Chiếu"}
            </button>
          </div>

          {/* Player container (Iframe or dynamic HLS player) */}
          <div 
            className={`relative w-full aspect-video bg-black rounded-2xl md:rounded-3xl border border-zinc-850 overflow-hidden shadow-2xl transition-all duration-300 ${
              cinemaMode 
                ? "shadow-pink-500/10 border-pink-500/30 w-full max-w-6xl mx-auto z-50" 
                : "shadow-black/70"
            }`}
          >
            {playerType === "embed" ? (
              activeEmbed ? (
                <iframe
                  src={activeEmbed}
                  referrerPolicy="no-referrer"
                  allowFullScreen
                  frameBorder="0"
                  scrolling="no"
                  className="w-full h-full"
                  title={`${cleanedName} - Tập ${activeEpisode?.name}`}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-zinc-955">
                  <Tv size={44} className="text-zinc-650 animate-pulse" />
                  <p className="text-zinc-500 text-xs font-bold">Chưa chọn tập phim hoặc nguồn phát!</p>
                </div>
              )
            ) : (
              activeEpisode?.link_m3u8 ? (
                <video
                  id="dlow-hls-video"
                  controls
                  className="w-full h-full rounded-2xl md:rounded-3xl bg-black"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-zinc-955">
                  <Tv size={44} className="text-zinc-650 animate-pulse" />
                  <p className="text-zinc-500 text-xs font-bold">Nguồn HLS không khả dụng cho tập này!</p>
                </div>
              )
            )}
          </div>

          {/* Bộ chọn nguồn phát (Player type / backup link) */}
          <div className={`flex flex-wrap items-center justify-between gap-3 ${cinemaMode ? "relative z-50" : ""}`}>
            <div className="flex items-center gap-2 select-none">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Nguồn Phát:</span>
              <button
                onClick={() => setPlayerType("embed")}
                className={`text-[10px] font-black px-3.5 py-1.5 rounded-lg border transition-all cursor-pointer uppercase ${
                  playerType === "embed"
                    ? "bg-pink-500/10 border-pink-500 text-pink-400 font-extrabold"
                    : "bg-zinc-950 border-zinc-850 text-zinc-400 hover:text-white"
                }`}
              >
                Nguồn VIP #1 (Mặc định)
              </button>
              {activeEpisode?.link_m3u8 && (
                <button
                  onClick={() => setPlayerType("hls")}
                  className={`text-[10px] font-black px-3.5 py-1.5 rounded-lg border transition-all cursor-pointer uppercase ${
                    playerType === "hls"
                      ? "bg-pink-500/10 border-pink-500 text-pink-400 font-extrabold"
                      : "bg-zinc-950 border-zinc-850 text-zinc-400 hover:text-white"
                  }`}
                >
                  Nguồn HLS #2 (Dự phòng)
                </button>
              )}
            </div>

            {/* Dòng tương tác chia sẻ và yêu thích bên dưới Player */}
            <div className="flex items-center gap-3 select-none">
            <button
              onClick={handleToggleFavorite}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border text-xs font-bold transition-all duration-300 active:scale-95 cursor-pointer ${
                isFavorite
                  ? "bg-rose-500/20 border-rose-500 text-rose-500 shadow-md shadow-rose-500/10"
                  : "bg-zinc-950 border-zinc-850 text-zinc-400 hover:border-zinc-700 hover:text-white"
              }`}
            >
              <Heart size={13} className={isFavorite ? "fill-rose-500 scale-105" : ""} />
              {isFavorite ? "ĐÃ THÊM YÊU THÍCH" : "THÊM YÊU THÍCH"}
            </button>

            <button
              onClick={handleShare}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border text-xs font-bold transition-all duration-250 active:scale-95 cursor-pointer ${
                shareCopied
                  ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                  : "bg-zinc-950 border-zinc-850 text-zinc-400 hover:border-zinc-700 hover:text-white"
              }`}
            >
              <Share2 size={13} />
              {shareCopied ? "ĐÃ SAO CHÉP LINK!" : "CHIA SẺ"}
            </button>
          </div>
        </div>
      </div>

        {/* 2. CHỌN MÁY CHỦ VÀ TẬP PHIM */}
        {servers.length > 0 && (
          <div className="p-5 md:p-6 rounded-2xl bg-zinc-950/70 border border-zinc-900/60 space-y-5 select-none text-left">
            {/* Chọn Server */}
            {servers.length > 1 && (
              <div className="space-y-2">
                <span className="block text-xs font-bold text-zinc-500 uppercase tracking-wider">Chọn nguồn phát (Server):</span>
                <div className="flex flex-wrap gap-2">
                  {servers.map((server, sIdx) => {
                    const isServerActive = sIdx === activeServerIndex;
                    return (
                      <button
                        key={`server-${sIdx}`}
                        onClick={() => {
                          setActiveServerIndex(sIdx);
                        }}
                        className={`text-xs font-black px-4 py-2 rounded-xl border transition-all cursor-pointer ${
                          isServerActive
                            ? "bg-pink-500/10 border-pink-500 text-pink-400"
                            : "bg-zinc-950 border-zinc-850 text-zinc-400 hover:text-white hover:border-zinc-700"
                        }`}
                      >
                        {server.server_name || `Server ${sIdx + 1}`}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Chọn Tập */}
            <div className="space-y-2">
              <span className="block text-xs font-bold text-zinc-500 uppercase tracking-wider">
                {episodesData.length <= 1 ? "Bản phát sóng:" : "Danh sách tập phim:"}
              </span>
              
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-10 lg:grid-cols-12 gap-2.5 max-h-[220px] overflow-y-auto pr-1">
                {episodesData.map((ep, eIdx) => {
                  const isEpActive = eIdx === activeEpisodeIndex;
                  return (
                    <button
                      key={`ep-${eIdx}`}
                      onClick={() => handleSelectEpisode(ep.name)}
                      className={`h-10 rounded-xl font-extrabold text-xs flex items-center justify-center transition-all cursor-pointer ${
                        isEpActive
                          ? "bg-pink-500 text-white shadow-lg shadow-pink-500/25 border-none"
                          : "border border-zinc-850 bg-zinc-950/40 text-zinc-400 hover:text-white hover:border-zinc-700"
                      }`}
                    >
                      {ep.name.toLowerCase().includes("tập") ? ep.name : `Tập ${ep.name}`}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* 3. NỘI DUNG TÓM TẮT (DESCRIPTION SECTION) */}
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

        {/* 4. KHU VỰC BÌNH LUẬN */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 border-t border-zinc-900 pt-8 items-start">
          
          {/* Cột trái: Nhập bình luận */}
          <div className="lg:col-span-1 text-left space-y-4">
            <h3 className="text-lg md:text-xl font-bold uppercase tracking-tight">Ý kiến người xem</h3>
            <p className="text-xs text-zinc-500 font-semibold">
              Ý kiến của bạn giúp cải thiện nội dung website tốt hơn. Hãy để lại nhận xét đóng góp nhé!
            </p>
            
            {user ? (
              <form onSubmit={handleSubmitComment} className="space-y-3">
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Nhập cảm nghĩ của bạn về bộ phim này..."
                  className="w-full min-h-[100px] bg-zinc-950/80 border border-zinc-850 rounded-xl focus:border-pink-500 focus:outline-none focus:ring-1 focus:ring-pink-500 text-sm px-4 py-3 text-white placeholder-zinc-650 transition-all font-medium"
                />
                <button
                  type="submit"
                  className="flex items-center gap-2 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-extrabold text-xs px-5 py-3 rounded-xl transition-all shadow-md shadow-pink-500/10 cursor-pointer active:scale-95"
                >
                  GỬI BÌNH LUẬN <Send size={12} />
                </button>
              </form>
            ) : (
              <div className="p-6 rounded-2xl border border-zinc-850 bg-zinc-950/40 text-sm text-zinc-400 leading-relaxed font-semibold">
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
          </div>

          {/* Cột phải: Danh sách bình luận */}
          <div className="lg:col-span-2 text-left space-y-5">
            <h4 className="text-sm font-black text-zinc-400 uppercase tracking-widest border-b border-zinc-900 pb-2.5">
              Tất cả thảo luận ({comments.length})
            </h4>
            
            <div className="space-y-5 divide-y divide-zinc-900/60">
              {comments.map((comment, index) => {
                const isVip = comment.role === "vip";
                const isAdmin = comment.role === "admin";
                
                return (
                  <div key={comment.id} className={`flex gap-3.5 pt-4 ${index === 0 ? "pt-0" : ""}`}>
                    <div className={`w-9 h-9 rounded-full font-black text-sm flex items-center justify-center shrink-0 shadow-sm ${
                      isAdmin 
                        ? "bg-gradient-to-tr from-pink-500 to-rose-500 text-white" 
                        : isVip 
                          ? "bg-amber-400 text-black" 
                          : "bg-zinc-800 text-zinc-300"
                    }`}>
                      {comment.avatar}
                    </div>

                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2 select-none">
                        <span className="font-extrabold text-sm text-zinc-100">{comment.name}</span>
                        {isAdmin && (
                          <span className="bg-pink-500 text-white text-[8px] font-black px-1.5 py-0.2 rounded uppercase tracking-wider">
                            Quản trị
                          </span>
                        )}
                        {isVip && (
                          <span className="bg-amber-400 text-black text-[8px] font-black px-1.5 py-0.2 rounded uppercase tracking-wider">
                            VIP
                          </span>
                        )}
                        <span className="text-[10px] text-zinc-500 font-semibold">{comment.time}</span>
                      </div>
                      
                      <p className="text-zinc-300 text-xs md:text-sm leading-relaxed font-medium">
                        {comment.content}
                      </p>
                      
                      <button
                        onClick={() => handleLikeComment(comment.id)}
                        className={`flex items-center gap-1 text-[10px] font-black transition-colors select-none pt-1 cursor-pointer ${
                          comment.liked ? "text-pink-500" : "text-zinc-500 hover:text-zinc-300"
                        }`}
                      >
                        THÍCH ({comment.likes})
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
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

export default function WatchPage({ params }: { params: { slug: string } }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <Loader2 className="animate-spin text-pink-500" size={40} />
      </div>
    }>
      <WatchContent slug={params.slug} />
    </Suspense>
  );
}
