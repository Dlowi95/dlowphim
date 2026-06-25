"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Play, Heart, Share2, Film, Star, Loader2, ArrowLeft, Send, Sparkles, Tv, HelpCircle, Plus, Users, Flag, X, ArrowUp, ArrowDown, CornerDownLeft, MoreHorizontal } from "lucide-react";
import { cleanMovieName } from "@/utils/movieUtils";
import MovieCard from "@/components/MovieCard";
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
  userVote?: 'up' | 'down' | null;
  isSpoiler?: boolean;
  episodeLabel?: string;
  avatarUrl?: string;
}

function WatchContent({ slug }: { slug: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryEp = searchParams.get("ep") || "";
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

  const [movie, setMovie] = useState<MovieDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { user, toggleFavorite: toggleFavoriteCtx } = useAuth();

  // States phát phim
  const [activeServerIndex, setActiveServerIndex] = useState(0);
  const [activeEpisodeIndex, setActiveEpisodeIndex] = useState(0);
  const [cinemaMode, setCinemaMode] = useState(false);
  const isFavorite = user?.favorites?.includes(movie?.slug || "") || false;
  const [shareCopied, setShareCopied] = useState(false);
  const [playerType, setPlayerType] = useState<"embed" | "hls">("embed");
  const [selectedEpisodeBatch, setSelectedEpisodeBatch] = useState(0);
  const [autoplayNext, setAutoplayNext] = useState(false);
  const [skipIntro, setSkipIntro] = useState(false);
  const [isHlsPlaying, setIsHlsPlaying] = useState(false);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const hasSkippedIntro = React.useRef(false);
  const lastHistorySavedTime = React.useRef<number>(0);
  const [kkServers, setKkServers] = useState<Server[]>([]);

  // States bình luận
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<Comment[]>([]);
  const [isSpoiler, setIsSpoiler] = useState(false);
  const [revealedSpoilers, setRevealedSpoilers] = useState<Record<string, boolean>>({});
  const [showEpisodeDrawer, setShowEpisodeDrawer] = useState(false);

  // Phim liên quan
  const [relatedMovies, setRelatedMovies] = useState<any[]>([]);
  const [loadingRelated, setLoadingRelated] = useState(false);

  // Reset play states on source changes
  useEffect(() => {
    setIsHlsPlaying(false);
    hasSkippedIntro.current = false;
  }, [playerType, activeEpisodeIndex, activeServerIndex]);

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
        setSelectedEpisodeBatch(0);
      }
    }
    
    fetchMovieDetail();
  }, [slug]);

  // Fetch thêm nguồn từ KKPhim song song
  useEffect(() => {
    if (!slug) return;
    async function fetchKKPhimDetail() {
      try {
        const res = await fetch(`https://phimapi.com/phim/${slug}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === true || data.status === "success") {
            const episodes = data.episodes || [];
            const servers: Server[] = episodes.map((srv: any) => ({
              server_name: srv.server_name || "KKPhim",
              server_data: (srv.server_data || []).map((ep: any) => ({
                name: ep.name,
                slug: ep.slug,
                filename: ep.filename || "",
                link_embed: ep.link_embed,
                link_m3u8: ep.link_m3u8,
              })),
            }));
            setKkServers(servers);
          }
        }
      } catch (err) {
        console.error("Lỗi lấy chi tiết phim từ KKPhim:", err);
      }
    }
    setKkServers([]);
    fetchKKPhimDetail();
  }, [slug]);

  const cleanedName = movie ? cleanMovieName(movie.name) : "";

  // Merge servers từ OPhim và KKPhim
  const combinedServers: Server[] = [
    ...(movie?.episodes || []).map((srv) => ({
      server_name: srv.server_name.toLowerCase().includes("ophim") ? srv.server_name : `OPhim - ${srv.server_name}`,
      server_data: srv.server_data,
    })),
    ...kkServers.map((srv) => ({
      server_name: srv.server_name.toLowerCase().includes("kkphim") ? srv.server_name : `KKPhim - ${srv.server_name}`,
      server_data: srv.server_data,
    })),
  ];

  const servers = combinedServers;
  const currentServer = servers[activeServerIndex];
  const episodesData = currentServer?.server_data || [];

  // Helper to generate list of friendly labels for all combined servers
  const getFriendlyLabels = (serversList: Server[]) => {
    const counts: Record<string, number> = {};
    return serversList.map((srv) => {
      const nameLower = (srv.server_name || "").toLowerCase();
      let typeLabel = "Vietsub";
      if (nameLower.includes("thuyết minh") || nameLower.includes("thuyet minh")) {
        typeLabel = "Thuyết minh";
      } else if (nameLower.includes("lồng tiếng") || nameLower.includes("long tieng")) {
        typeLabel = "Lồng tiếng";
      }
      
      counts[typeLabel] = (counts[typeLabel] || 0) + 1;
      return `${typeLabel} #${counts[typeLabel]}`;
    });
  };

  const friendlyLabels = getFriendlyLabels(servers);

  // Natural sorting helper for episodes
  const getEpisodeNumber = (name: string): number => {
    const match = name.match(/\d+/);
    return match ? parseInt(match[0], 10) : 999999;
  };

  const sortedEpisodes = [...episodesData].sort((a, b) => {
    const numA = getEpisodeNumber(a.name);
    const numB = getEpisodeNumber(b.name);
    if (numA !== numB) {
      return numA - numB;
    }
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  });

  const activeEpisode = episodesData[activeEpisodeIndex];
  const activeEmbed = activeEpisode?.link_embed || null;

  // 1.7. Đồng bộ bình luận theo phim qua Backend
  useEffect(() => {
    if (!movie) return;
    
    async function fetchComments() {
      try {
        const token = Cookies.get("token");
        const headers: HeadersInit = {};
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }
        
        const res = await fetch(`${API_URL}/comments/${slug}`, { headers });
        if (res.ok) {
          const data = await res.json();
          setComments(data);
        }
      } catch (err) {
        console.error("Lỗi lấy bình luận:", err);
      }
    }
    
    fetchComments();
  }, [movie, slug]);

  // 2. Đồng bộ tập phim đang hoạt động dựa trên query queryEp
  useEffect(() => {
    if (servers.length === 0) return;
    const currentServer = servers[activeServerIndex];
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
  }, [movie, queryEp, activeServerIndex, kkServers]);

  // 2.2. Đồng bộ batch hiển thị tập phim
  useEffect(() => {
    if (activeEpisodeIndex >= 0) {
      setSelectedEpisodeBatch(Math.floor(activeEpisodeIndex / 100));
    }
  }, [activeEpisodeIndex]);

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
    
    const movieSlug = movie.slug;
    const genreSlug = movie.category[0].slug;

    async function fetchRelated() {
      try {
        setLoadingRelated(true);
        const res = await fetch(`https://ophim1.com/v1/api/the-loai/${genreSlug}?page=1`);
        const data = await res.json();
        
        if (data.status === true || data.status === "success") {
          const items = data.data?.items || data.items || [];
          const filtered = items.filter((item: any) => item.slug !== movieSlug).slice(0, 7);
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
  const handleToggleFavorite = async () => {
    if (!movie) return;
    await toggleFavoriteCtx(movie.slug);
  };

  // Cuộn mượt lên vị trí trình phát
  const scrollToPlayer = () => {
    if (typeof window !== "undefined") {
      document.getElementById("watch-player-section")?.scrollIntoView({ behavior: "smooth" });
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
  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !user) return;

    const userInitial = user.displayName ? user.displayName[0].toUpperCase() : (user.email ? user.email[0].toUpperCase() : "U");
    const displayName = user.displayName || user.email?.split("@")[0] || "Thành viên";

    let epLabel = "";
    if (activeEpisode && episodesData.length > 1) {
      epLabel = `P.1 - Tập ${activeEpisode.name}`;
    }

    try {
      const token = Cookies.get("token");
      const res = await fetch(`${API_URL}/comments/${slug}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          content: commentText.trim(),
          isSpoiler: isSpoiler,
          episodeLabel: epLabel || undefined,
        }),
      });

      if (res.ok) {
        const newComment = await res.json();
        setComments((prev) => [newComment, ...prev]);
        setCommentText("");
        setIsSpoiler(false);
      }
    } catch (err) {
      console.error("Lỗi gửi bình luận:", err);
    }
  };

  // Upvote/Downvote bình luận qua Backend
  const handleVote = async (commentId: string, type: "up" | "down") => {
    if (!user) {
      window.dispatchEvent(new Event("dlowphim_open_auth"));
      return;
    }

    try {
      const token = Cookies.get("token");
      const res = await fetch(`${API_URL}/comments/${commentId}/vote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ type }),
      });

      if (res.ok) {
        const data = await res.json();
        setComments((prev) =>
          prev.map((c) => {
            if (c.id === commentId) {
              return {
                ...c,
                likes: data.likes,
                liked: data.liked,
                userVote: data.userVote,
              };
            }
            return c;
          })
        );
      }
    } catch (err) {
      console.error("Lỗi vote bình luận:", err);
    }
  };

  // HLS Player event handlers for autoplayNext and skipIntro
  const handleHlsPlay = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    setIsHlsPlaying(true);
    const video = e.currentTarget;
    if (skipIntro && !hasSkippedIntro.current && video.currentTime < 90) {
      video.currentTime = 90;
      hasSkippedIntro.current = true;
    }
  };

  const saveWatchHistory = async (currentTime: number, duration: number) => {
    if (!movie || !activeEpisode) return;

    const historyItem = {
      movieSlug: movie.slug,
      movieName: cleanMovieName(movie.name),
      episodeName: activeEpisode.name,
      currentTime: Math.floor(currentTime),
      duration: Math.floor(duration),
      updatedAt: new Date().toISOString(),
    };

    // 1. Save to local storage first
    try {
      const localHist = JSON.parse(localStorage.getItem("dlowphim_history") || "[]");
      const filtered = localHist.filter((item: any) => item.movieSlug !== movie.slug);
      filtered.unshift(historyItem);
      localStorage.setItem("dlowphim_history", JSON.stringify(filtered.slice(0, 50)));
    } catch (e) {
      console.error(e);
    }

    // 2. Save to database if user is logged in
    if (user) {
      try {
        const token = Cookies.get("token");
        const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
        await fetch(`${API_URL}/auth/history/update`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(historyItem),
        });
      } catch (err) {
        console.error("Lỗi đồng bộ lịch sử xem:", err);
      }
    }
  };

  const handleHlsPause = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    setIsHlsPlaying(false);
    const video = e.currentTarget;
    saveWatchHistory(video.currentTime, video.duration);
  };

  const handleHlsTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    if (skipIntro && !hasSkippedIntro.current && video.currentTime < 90) {
      video.currentTime = 90;
      hasSkippedIntro.current = true;
    }

    // Save progress to watch history
    const now = Date.now();
    if (now - lastHistorySavedTime.current > 7000) { // save progress every 7 seconds
      saveWatchHistory(video.currentTime, video.duration);
      lastHistorySavedTime.current = now;
    }
  };

  const handleHlsVideoEnded = () => {
    setIsHlsPlaying(false);
    if (autoplayNext) {
      const currentEpName = activeEpisode?.name;
      const currentIndexInSorted = sortedEpisodes.findIndex(ep => ep.name === currentEpName);
      if (currentIndexInSorted !== -1 && currentIndexInSorted < sortedEpisodes.length - 1) {
        const nextEp = sortedEpisodes[currentIndexInSorted + 1];
        if (nextEp) {
          handleSelectEpisode(nextEp.name);
          scrollToPlayer();
        }
      }
    }
  };

  const handleHlsLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    try {
      const localHist = JSON.parse(localStorage.getItem("dlowphim_history") || "[]");
      const savedItem = localHist.find((item: any) => item.movieSlug === slug);
      if (savedItem && savedItem.currentTime > 5 && savedItem.currentTime < video.duration - 10) {
        video.currentTime = savedItem.currentTime;
        hasSkippedIntro.current = true; // Mark as skipped to prevent auto-skipping again on resume
        console.log(`Resuming playback from saved position: ${savedItem.currentTime}s`);
      }
    } catch (e) {
      console.error(e);
    }
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
          className="flex items-center gap-2 border border-zinc-850 bg-zinc-955 hover:bg-zinc-900 text-white text-sm font-extrabold px-6 py-2.5 rounded-xl transition-all"
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

      <div className={`container mx-auto px-4 md:px-6 relative z-10 space-y-8 transition-all duration-300 ${
        cinemaMode ? "max-w-none w-full" : "max-w-7xl"
      }`}>
        
        {/* Nút Quay lại trang Chi tiết */}
        <div className="flex items-center justify-between select-none">
          <button 
            onClick={() => router.push(`/movie/${movie.slug}`)}
            className="flex items-center gap-1.5 text-zinc-500 hover:text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer bg-transparent border-none"
          >
            <ArrowLeft size={14} /> Xem thông tin chi tiết phim
          </button>

          <span className="text-xs font-bold text-pink-400 select-none">
            Bạn đang xem: {cleanedName} {activeEpisode ? ` - Tập ${activeEpisode.name}` : ""}
          </span>
        </div>

        {/* 1. TRÌNH PHÁT VIDEO CHÍNH (VIDEO PLAYER SECTION) */}
        <div 
          id="watch-player-section"
          className={`space-y-4 transition-all duration-300 ${cinemaMode ? "relative z-50 w-full" : ""}`}
        >
          {cinemaMode && (
            <div 
              onClick={() => setCinemaMode(false)}
              className="fixed inset-0 bg-black/95 z-40 transition-all duration-300"
            />
          )}

          <div className={`flex items-center justify-between pb-2.5 ${cinemaMode ? "relative z-50" : ""}`}>
            <div className="flex items-center gap-2 text-left">
              <Film size={18} className="text-pink-500" />
              <h3 className="text-base md:text-lg font-bold uppercase tracking-tight">
                Đang phát: {cleanedName} {activeEpisode ? `(Tập ${activeEpisode.name})` : ""}
              </h3>
            </div>
            
            <button
              onClick={() => setCinemaMode(!cinemaMode)}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg border-none transition-all cursor-pointer flex items-center gap-1.5 ${
                cinemaMode
                  ? "bg-pink-500 text-white shadow-md shadow-pink-500/20 z-50"
                  : "bg-[#1b1d2a] text-zinc-400 hover:text-white"
              }`}
            >
              <span>Chế Độ Rạp Chiếu</span>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded leading-none transition-all ${
                cinemaMode 
                  ? "text-white bg-white/20" 
                  : "text-zinc-500 bg-[#252839]"
              }`}>
                {cinemaMode ? "ON" : "OFF"}
              </span>
            </button>
          </div>

          {/* Unified Movie Player Frame + Action Bar Container with soft shadow, no border */}
          <div 
            className={`w-full overflow-hidden bg-black rounded-2xl md:rounded-3xl shadow-[0_15px_45px_rgba(0,0,0,0.85)] transition-all duration-300 ${
              cinemaMode 
                ? "relative z-50 shadow-pink-500/10 w-full max-w-[92vw] mx-auto" 
                : "relative"
            }`}
          >
            {/* Player Container */}
            <div className="relative w-full aspect-video bg-black overflow-hidden group">
              {playerType === "embed" ? (
                activeEmbed ? (
                  <iframe
                    src={activeEmbed}
                    referrerPolicy="no-referrer"
                    allowFullScreen
                    frameBorder="0"
                    scrolling="no"
                    className="absolute -top-8 -left-4 w-[calc(100%+16px)] h-[calc(100%+32px)]"
                    title="DlowPhim Video Player"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-zinc-955">
                    <Tv size={44} className="text-zinc-650 animate-pulse" />
                    <p className="text-zinc-500 text-xs font-bold">Chưa chọn tập phim hoặc nguồn phát!</p>
                  </div>
                )
              ) : (
                activeEpisode?.link_m3u8 ? (
                  <>
                    <video
                      id="dlow-hls-video"
                      ref={videoRef}
                      controls
                      onPlay={handleHlsPlay}
                      onPause={handleHlsPause}
                      onEnded={handleHlsVideoEnded}
                      onTimeUpdate={handleHlsTimeUpdate}
                      onLoadedMetadata={handleHlsLoadedMetadata}
                      className="w-full h-full bg-black animate-fadeIn"
                      title="DlowPhim HLS Video Player"
                    />
                    
                    {/* Pulsing Play Overlay button when HLS is paused */}
                    <div 
                      onClick={() => {
                        if (videoRef.current) {
                          videoRef.current.play();
                          setIsHlsPlaying(true);
                        }
                      }}
                      className={`absolute inset-0 flex items-center justify-center bg-black/45 cursor-pointer z-10 transition-all duration-300 ease-in-out ${
                        isHlsPlaying ? "opacity-0 pointer-events-none scale-95" : "opacity-100 scale-100"
                      }`}
                    >
                      <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-pink-500 hover:bg-pink-600 text-white flex items-center justify-center shadow-lg shadow-pink-500/40 transition-all duration-300 hover:scale-110 active:scale-95">
                        <Play size={16} className="fill-current text-white translate-x-0.5" />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-zinc-955">
                    <Tv size={44} className="text-zinc-650 animate-pulse" />
                    <p className="text-zinc-500 text-xs font-bold">Nguồn HLS không khả dụng cho tập này!</p>
                  </div>
                )
              )}

              {/* Hover Overlay kiểu CobePhim */}
              <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-in-out p-4 flex items-center justify-between pointer-events-none z-30 select-none">
                {/* Cột trái: Tên phim, phần và tập */}
                <div className="flex flex-col text-left pointer-events-auto">
                  <h4 className="text-sm md:text-base font-extrabold text-white tracking-tight leading-tight">{cleanedName}</h4>
                  {episodesData.length > 1 && activeEpisode && (
                    <p className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider mt-0.5">
                      Tập {activeEpisode.name}
                    </p>
                  )}
                </div>

                {/* Cột phải: Danh sách tập (Chỉ hiện khi phim có nhiều tập) */}
                {episodesData.length > 1 && (
                  <button
                    onClick={() => setShowEpisodeDrawer(true)}
                    className="flex items-center gap-1.5 bg-black/60 hover:bg-black/85 border border-zinc-800 hover:border-zinc-700 hover:scale-105 active:scale-95 text-zinc-300 hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer pointer-events-auto shadow-md"
                  >
                    <Tv size={12} className="text-pink-500" />
                    <span>Danh sách tập</span>
                  </button>
                )}
              </div>

              {/* Episode Drawer Panel (Right Side Overlay) */}
              {episodesData.length > 1 && (
                <div 
                  className={`absolute top-0 right-0 bottom-0 w-80 bg-[#13141f]/95 border-l border-zinc-900 z-40 flex flex-col transition-transform duration-300 ease-in-out shadow-2xl select-none ${
                    showEpisodeDrawer ? "translate-x-0" : "translate-x-full"
                  }`}
                >
                  {/* Drawer Header */}
                  <div className="p-4 border-b border-zinc-900 flex items-center justify-between">
                    <h3 className="text-sm font-extrabold text-white truncate max-w-[200px]">{cleanedName}</h3>
                    <button
                      onClick={() => setShowEpisodeDrawer(false)}
                      className="w-7 h-7 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer transition-all border-none"
                      title="Đóng"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  {/* Dropdown / Status Selector Bar */}
                  <div className="px-4 py-2.5 bg-zinc-950/20 border-b border-zinc-900/60 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <select
                        value={activeServerIndex}
                        onChange={(e) => {
                          setActiveServerIndex(parseInt(e.target.value, 10));
                        }}
                        className="bg-[#1b1d2a] border border-zinc-800 text-zinc-200 text-xs rounded-lg px-2.5 py-1 focus:outline-none focus:border-pink-500 font-extrabold cursor-pointer"
                      >
                        {servers.map((s, idx) => (
                          <option key={`drawer-server-opt-${idx}`} value={idx}>
                            {friendlyLabels[idx] || s.server_name || `Server #${idx + 1}`}
                          </option>
                        ))}
                      </select>
                    </div>
                    {activeEpisode && (
                      <span className="text-xs text-zinc-500 font-semibold">Tập {activeEpisode.name}</span>
                    )}
                  </div>

                  {/* Scrollable list area (Infinite scroll feel, scrollbar hidden) */}
                  <div 
                    className="flex-1 overflow-y-auto space-y-3.5 p-4 scrollbar-none"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                  >
                    {sortedEpisodes.map((ep, idx) => {
                      // Find actual global index in original episodesData to preserve selection mapping
                      const originalIdx = episodesData.findIndex((originalEp) => originalEp.name === ep.name);
                      const isEpActive = originalIdx === activeEpisodeIndex;

                      return (
                        <div
                          key={`drawer-ep-${idx}`}
                          onClick={() => {
                            handleSelectEpisode(ep.name);
                          }}
                          className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer hover:bg-zinc-800/35 transition-colors border ${
                            isEpActive 
                              ? "bg-[#1b1d2a]/60 border-pink-500 shadow-md shadow-pink-500/5 text-pink-500" 
                              : "border-transparent text-zinc-300 hover:text-white"
                          }`}
                        >
                          {/* Thumbnail representation */}
                          <div className={`w-20 aspect-video rounded overflow-hidden bg-zinc-900 border shrink-0 relative transition-all ${
                            isEpActive ? "border-pink-500" : "border-zinc-800"
                          }`}>
                            <img 
                              src={getImageUrl(movie.thumb_url || movie.poster_url)} 
                              alt={ep.name}
                              className="w-full h-full object-cover opacity-70"
                              referrerPolicy="no-referrer"
                            />
                            {isEpActive && (
                              <div className="absolute inset-0 bg-pink-500/10 flex items-center justify-center">
                                <Play size={14} className="fill-pink-500 text-pink-500" />
                              </div>
                            )}
                          </div>

                          {/* Ep title */}
                          <span className="text-xs font-bold truncate">Tập {ep.name}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Drawer Footer (Báo lỗi button) */}
                  <div className="p-3 bg-[#0d0e13] border-t border-zinc-900 flex items-center justify-start">
                    <button
                      onClick={() => {
                        document.getElementById("watch-player-section")?.scrollIntoView({ behavior: "smooth" });
                      }}
                      className="flex items-center gap-1.5 text-zinc-500 hover:text-pink-500 transition-colors bg-transparent border-none cursor-pointer text-xs font-bold"
                    >
                      <Flag size={12} />
                      <span>Báo lỗi</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Actions Control Bar directly below the player */}
            {!cinemaMode && (
              <div className="w-full bg-[#0d0e13]/90 px-3 py-2 md:py-2.5 flex flex-wrap items-center justify-between gap-3 text-[11px] md:text-xs select-none border-b border-zinc-900/40">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={handleToggleFavorite}
                    className={`flex items-center gap-1 transition-all cursor-pointer bg-transparent border-none hover:bg-zinc-800/30 px-2 py-1 rounded-lg ${
                      isFavorite ? "text-pink-500" : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    <Heart size={14} className={isFavorite ? "fill-pink-500 text-pink-500" : ""} />
                    <span>Yêu thích</span>
                  </button>

                  <button
                    className="flex items-center gap-1 text-zinc-400 hover:text-white transition-all cursor-pointer bg-transparent border-none hover:bg-zinc-800/30 px-2 py-1 rounded-lg"
                  >
                    <Plus size={14} />
                    <span>Thêm vào</span>
                  </button>

                  <button
                    onClick={() => setAutoplayNext(!autoplayNext)}
                    className="flex items-center gap-1 text-zinc-400 hover:text-white transition-all cursor-pointer bg-transparent border-none hover:bg-zinc-800/30 px-2 py-1 rounded-lg"
                  >
                    <span>Chuyển tập</span>
                    <span className={`text-[8px] font-bold ml-1 px-1 py-0.2 rounded border leading-none transition-colors ${
                      autoplayNext 
                        ? "border-pink-500 text-pink-500 bg-pink-500/5 shadow-[0_0_8px_rgba(236,72,153,0.2)]" 
                        : "border-zinc-700 text-zinc-500 bg-transparent"
                    }`}>
                      {autoplayNext ? "ON" : "OFF"}
                    </span>
                  </button>

                  <button
                    onClick={() => setSkipIntro(!skipIntro)}
                    className="flex items-center gap-1 text-zinc-400 hover:text-white transition-all cursor-pointer bg-transparent border-none hover:bg-zinc-800/30 px-2 py-1 rounded-lg"
                  >
                    <span>Bỏ qua giới thiệu</span>
                    <span className={`text-[8px] font-bold ml-1 px-1 py-0.2 rounded border leading-none transition-colors ${
                      skipIntro 
                        ? "border-pink-500 text-pink-500 bg-pink-500/5 shadow-[0_0_8px_rgba(236,72,153,0.2)]" 
                        : "border-zinc-700 text-zinc-500 bg-transparent"
                    }`}>
                      {skipIntro ? "ON" : "OFF"}
                    </span>
                  </button>

                  <button
                    onClick={handleShare}
                    className="flex items-center gap-1 text-zinc-400 hover:text-white transition-all cursor-pointer bg-transparent border-none hover:bg-zinc-800/30 px-2 py-1 rounded-lg"
                  >
                    <Send size={14} className="rotate-45 -translate-y-0.5" />
                    <span>{shareCopied ? "Đã sao chép link" : "Chia sẻ"}</span>
                  </button>

                  <button
                    className="flex items-center gap-1 text-zinc-400 hover:text-white transition-all cursor-pointer bg-transparent border-none hover:bg-zinc-800/30 px-2 py-1 rounded-lg"
                  >
                    <Users size={14} />
                    <span>Xem chung</span>
                  </button>
                </div>

                <button
                  className="flex items-center gap-1 text-zinc-500 hover:text-pink-500 transition-all cursor-pointer ml-auto bg-transparent border-none hover:bg-zinc-800/30 px-2 py-1 rounded-lg"
                >
                  <Flag size={14} />
                  <span>Báo lỗi</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 2. THÔNG TIN CHI TIẾT PHIM, DIỄN VIÊN, NGUỒN PHÁT VÀ SERVER PHÂN TRANG */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start pt-6 border-t border-zinc-900/60 text-left">
          
          {/* CỘT TRÁI: THÔNG TIN PHIM, BẢN CHIẾU, DANH SÁCH TẬP */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Thẻ thông tin nhanh của phim */}
            <div className="flex flex-col sm:flex-row gap-5 bg-zinc-955/20 p-5 rounded-2xl">
              {/* Poster */}
              <div className="w-24 sm:w-28 aspect-[2/3] shrink-0 rounded-xl overflow-hidden shadow-md bg-zinc-900">
                <img 
                  src={getImageUrl(movie.poster_url || movie.thumb_url)} 
                  alt={cleanedName} 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              
              {/* Chi tiết */}
              <div className="flex-1 space-y-3">
                <div>
                  <h2 className="text-xl md:text-2xl font-black text-white leading-tight">
                    {cleanedName}
                  </h2>
                  {movie.origin_name && (
                    <h3 className="text-xs font-extrabold text-pink-500 uppercase tracking-wide mt-0.5">
                      {movie.origin_name}
                    </h3>
                  )}
                </div>
                
                {/* Badges thông số */}
                <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-extrabold select-none">
                  <span className="bg-amber-400 text-black border border-amber-400 font-black px-2 py-0.5 rounded flex items-center gap-0.5 shadow-sm">
                    IMDb 7.6
                  </span>
                  <span className="border border-zinc-800 bg-zinc-900 px-2 py-0.5 rounded text-zinc-400">
                    T16
                  </span>
                  <span className="border border-zinc-800 bg-zinc-900 px-2 py-0.5 rounded text-zinc-400">
                    {movie.year}
                  </span>
                  {movie.time && (
                    <span className="border border-zinc-800 bg-zinc-900 px-2 py-0.5 rounded text-zinc-400">
                      {movie.time}
                    </span>
                  )}
                </div>

                {/* Các thể loại */}
                {movie.category && movie.category.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1">
                    {movie.category.slice(0, 3).map((cat) => (
                      <span key={cat.slug} className="bg-[#1b1d2a] text-[#a0a5c0] text-[9px] font-black px-2 py-0.5 rounded uppercase">
                        {cat.name}
                      </span>
                    ))}
                  </div>
                )}
                
                {/* Đoạn mô tả tóm tắt */}
                <p className="text-zinc-400 text-xs leading-relaxed font-semibold">
                  {movie.content ? (() => {
                    const cleanDesc = movie.content.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
                    return cleanDesc.length > 160 ? cleanDesc.slice(0, 160) + "..." : cleanDesc;
                  })() : "Chưa có mô tả chi tiết của phim này."}
                </p>
                
                {/* Link xem thông tin phim quay về trang chi tiết */}
                <div>
                  <button
                    onClick={() => router.push(`/movie/${movie.slug}`)}
                    className="text-xs font-black text-pink-500 hover:text-pink-400 transition-colors bg-transparent border-none p-0 cursor-pointer flex items-center gap-1.5"
                  >
                    Thông tin phim <span className="text-[10px] font-bold">&gt;</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Unified Sources & Episodes Selection Panel */}
            <div className="bg-zinc-955/20 p-5 rounded-2xl border border-zinc-900/60 space-y-5">
              
              {/* Row 1: Chọn Nguồn Phát */}
              {servers.length > 0 && (
                <div className="space-y-3">
                  <span className="block text-xs font-black text-zinc-455 uppercase tracking-wider">
                    Chọn Nguồn Phát:
                  </span>
                  
                  <div className="flex flex-wrap gap-2.5">
                    {servers.map((server, sIdx) => {
                      const hasHls = server.server_data.some((ep) => ep.link_m3u8);
                      const isServerActive = sIdx === activeServerIndex;
                      const serverLabel = friendlyLabels[sIdx] || server.server_name;
                      
                      return (
                        <React.Fragment key={`combined-source-${sIdx}`}>
                          {/* VIP (Embed) Source Button */}
                          <button
                            onClick={() => {
                              setActiveServerIndex(sIdx);
                              setPlayerType("embed");
                              scrollToPlayer();
                            }}
                            className={`px-4 py-2 text-xs font-black rounded-lg transition-all border-none cursor-pointer uppercase ${
                              isServerActive && playerType === "embed"
                                ? "bg-pink-500 text-white font-extrabold shadow-md shadow-pink-500/20"
                                : "bg-[#1b1d2a] text-[#a0a5c0] hover:bg-zinc-800 hover:text-white"
                            }`}
                          >
                            {serverLabel} (Embed)
                          </button>
                          
                          {/* HLS (m3u8) Source Button */}
                          {hasHls && (
                            <button
                              onClick={() => {
                                setActiveServerIndex(sIdx);
                                setPlayerType("hls");
                                scrollToPlayer();
                              }}
                              className={`px-4 py-2 text-xs font-black rounded-lg transition-all border-none cursor-pointer uppercase ${
                                isServerActive && playerType === "hls"
                                  ? "bg-pink-500 text-white font-extrabold shadow-md shadow-pink-500/20"
                                  : "bg-[#1b1d2a] text-[#a0a5c0] hover:bg-zinc-800 hover:text-white"
                              }`}
                            >
                              {serverLabel} (HLS)
                            </button>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Row 2: Danh sách các tập phim (Bản phát sóng) */}
              {servers.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-zinc-900/60">
                  <span className="block text-xs font-black text-zinc-455 uppercase tracking-wider">
                    {episodesData.length <= 1 ? "Bản phát sóng:" : "Danh sách tập phim:"}
                  </span>
                  
                  {/* Phân nhóm tập phim nếu số lượng tập > 100 */}
                  {episodesData.length > 100 && (
                    <div className="flex flex-wrap gap-1.5 pb-2">
                      {Array.from({ length: Math.ceil(episodesData.length / 100) }).map((_, bIdx) => {
                        const start = bIdx * 100 + 1;
                        const end = Math.min((bIdx + 1) * 100, episodesData.length);
                        const isActive = selectedEpisodeBatch === bIdx;
                        return (
                          <button
                            key={`batch-${bIdx}`}
                            onClick={() => setSelectedEpisodeBatch(bIdx)}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer border-none ${
                              isActive
                                ? "bg-pink-500 text-white shadow-sm shadow-pink-500/15"
                                : "bg-[#1b1d2a] text-[#a0a5c0] hover:text-white hover:bg-[#23263a]"
                            }`}
                          >
                            Tập {start} - {end}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2 max-h-[220px] overflow-y-auto pr-1">
                    {(episodesData.length > 100
                      ? episodesData.slice(selectedEpisodeBatch * 100, (selectedEpisodeBatch + 1) * 100)
                      : episodesData
                    ).map((ep, eIdx) => {
                      const globalIdx = episodesData.length > 100 ? selectedEpisodeBatch * 100 + eIdx : eIdx;
                      const isEpActive = globalIdx === activeEpisodeIndex;
                      return (
                        <button
                          key={`ep-${globalIdx}`}
                          onClick={() => {
                            handleSelectEpisode(ep.name);
                            scrollToPlayer();
                          }}
                          className={`h-10 rounded-xl font-extrabold text-xs flex items-center justify-center transition-all cursor-pointer border-none ${
                            isEpActive
                              ? "bg-pink-500 text-white shadow-lg shadow-pink-500/25"
                              : "bg-[#1b1d2a] text-[#a0a5c0] hover:bg-pink-500 hover:text-white"
                          }`}
                        >
                          <Play size={10} className="fill-current mr-1.5 shrink-0" />
                          {ep.name.toLowerCase().includes("tập") ? ep.name : `Tập ${ep.name}`}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>

            {/* 4. KHU VỰC BÌNH LUẬN KIỂU COBEPHIM */}
            <div id="movie-comments" className="pt-6 border-t border-zinc-900/60 space-y-6">
              <h3 className="text-base md:text-lg font-bold uppercase tracking-tight flex items-center gap-2 select-none">
                <span>Thảo Luận ({comments.length})</span>
              </h3>

              {/* Dòng thông tin người dùng và Avatar */}
              <div className="flex items-center gap-3">
                {user ? (
                  <>
                    <div className="w-10 h-10 rounded-full font-black text-sm flex items-center justify-center shrink-0 shadow bg-gradient-to-tr from-pink-500 to-rose-500 text-white select-none">
                      {user.displayName ? user.displayName[0].toUpperCase() : (user.email ? user.email[0].toUpperCase() : "U")}
                    </div>
                    <div className="flex flex-col text-left">
                      <span className="text-[10px] text-zinc-500 font-semibold select-none leading-none">Bình luận với tên</span>
                      <span className="text-xs font-bold text-zinc-100 mt-1 select-none leading-none">
                        {user.displayName || user.email?.split("@")[0] || "Thành viên"}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-10 h-10 rounded-full font-black text-base flex items-center justify-center shrink-0 bg-zinc-850 text-zinc-500 select-none">
                      ?
                    </div>
                    <div className="flex flex-col text-left">
                      <span className="text-[10px] text-zinc-500 font-semibold select-none leading-none">Bạn chưa đăng nhập</span>
                      <button
                        type="button"
                        onClick={() => window.dispatchEvent(new Event("dlowphim_open_auth"))}
                        className="text-xs font-black text-pink-500 hover:text-pink-400 mt-1 transition-colors bg-transparent border-none p-0 cursor-pointer text-left leading-none"
                      >
                        Đăng nhập ngay
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Hộp soạn thảo văn bản */}
              {user ? (
                <form onSubmit={handleSubmitComment} className="space-y-4">
                  <div className="bg-[#13141d] border border-transparent focus-within:!border-pink-500 rounded-xl p-3.5 transition-all relative">
                    <div className="relative">
                      <textarea
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value.slice(0, 1000))}
                        placeholder="Viết bình luận"
                        className="w-full min-h-[90px] bg-transparent text-sm text-zinc-200 placeholder-zinc-550 focus:outline-none resize-none pr-16 font-medium leading-relaxed"
                      />
                      <span className="absolute top-0 right-0 text-[10px] font-bold text-zinc-650 select-none">
                        {commentText.length} / 1000
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-zinc-900/50">
                      {/* Nút gạt Tiết lộ? */}
                      <div 
                        onClick={() => setIsSpoiler(!isSpoiler)}
                        className="flex items-center gap-2 select-none cursor-pointer"
                      >
                        <div className={`w-8 h-4.5 rounded-full p-0.5 transition-colors duration-200 flex items-center ${isSpoiler ? "bg-pink-500" : "bg-zinc-850"}`}>
                          <div className={`w-3.5 h-3.5 rounded-full bg-white transition-transform duration-200 ${isSpoiler ? "translate-x-3.5" : "translate-x-0"}`} />
                        </div>
                        <span className="text-[11px] font-extrabold text-zinc-400">Tiết lộ?</span>
                      </div>

                      {/* Nút gửi */}
                      <button
                        type="submit"
                        className="flex items-center gap-1.5 bg-transparent border-none text-zinc-100 hover:text-yellow-400 font-extrabold text-xs cursor-pointer select-none transition-colors"
                      >
                        <span>Gửi</span>
                        <Send size={13} className="text-yellow-400 fill-yellow-400/10 rotate-45 -translate-y-0.5" />
                      </button>
                    </div>
                  </div>
                </form>
              ) : (
                <div 
                  onClick={() => window.dispatchEvent(new Event("dlowphim_open_auth"))}
                  className="bg-[#13141d]/45 rounded-xl p-6 text-center text-xs text-zinc-500 cursor-pointer hover:bg-[#13141d]/60 transition-all font-semibold"
                >
                  Vui lòng <span className="text-pink-500 font-bold hover:underline">đăng nhập</span> để tham gia thảo luận cùng mọi người.
                </div>
              )}

              {/* Danh sách bình luận */}
              <div className="space-y-4 pt-2">
                {comments.length === 0 ? (
                  <p className="text-xs text-zinc-500 font-semibold italic text-center py-4">Chưa có bình luận nào. Hãy là người đầu tiên chia sẻ cảm nghĩ!</p>
                ) : (
                  <div className="space-y-5 divide-y divide-zinc-900/60">
                    {comments.map((comment, index) => {
                      const isVip = comment.role === "vip";
                      const isAdmin = comment.role === "admin";
                      const hasSpoiler = comment.isSpoiler;
                      const isRevealed = revealedSpoilers[comment.id];

                      return (
                        <div key={comment.id} className={`flex gap-3.5 pt-4 ${index === 0 ? "pt-0" : ""}`}>
                          {/* Avatar */}
                          {comment.avatarUrl === "vietnam-flag" ? (
                            <div className="w-9 h-9 rounded-full bg-red-600 flex items-center justify-center shrink-0 border border-red-500 select-none">
                              <Star size={14} className="fill-yellow-400 text-yellow-400 stroke-none" />
                            </div>
                          ) : comment.avatarUrl ? (
                            <img 
                              src={comment.avatarUrl} 
                              alt={comment.name}
                              className="w-9 h-9 rounded-full object-cover shrink-0 shadow-sm border border-zinc-800"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className={`w-9 h-9 rounded-full font-black text-sm flex items-center justify-center shrink-0 shadow-sm ${
                              isAdmin 
                                ? "bg-gradient-to-tr from-pink-500 to-rose-500 text-white" 
                                : isVip 
                                  ? "bg-pink-500 text-white" 
                                  : "bg-zinc-800 text-zinc-300"
                            }`}>
                              {comment.avatar}
                            </div>
                          )}

                          {/* Content */}
                          <div className="flex-1 space-y-1">
                            <div className="flex flex-wrap items-center select-none gap-y-1">
                              {/* Author Name */}
                              <span className="font-extrabold text-xs text-zinc-200 mr-1.5">{comment.name}</span>
                              
                              {/* Gold/Amber Infinity symbol */}
                              <span className="text-pink-500 drop-shadow-[0_0_6px_rgba(236,72,153,0.85)] font-extrabold text-sm mr-2.5 select-none flex items-center" title="DlowPhim Member">
                                ∞
                              </span>

                              {/* Relative time */}
                              <span className="text-[10px] text-zinc-500 font-semibold mr-3">{comment.time}</span>

                              {/* Badges for roles */}
                              {isAdmin && (
                                <span className="bg-pink-500 text-white text-[8px] font-black px-1.5 py-0.2 rounded uppercase tracking-wider mr-2">
                                  Quản trị
                                </span>
                              )}
                              {hasSpoiler && (
                                <span className="bg-amber-500/10 text-amber-500 text-[8px] font-black px-1.5 py-0.2 rounded uppercase tracking-wider mr-2">
                                  Spoilers
                                </span>
                              )}

                              {/* Episode badge (if present) */}
                              {comment.episodeLabel && (
                                <span className="bg-[#1c2035]/40 text-zinc-400 border border-zinc-750/50 text-[9px] font-semibold px-1.5 py-0.2 rounded uppercase leading-none">
                                  {comment.episodeLabel}
                                </span>
                              )}
                            </div>

                            {hasSpoiler && !isRevealed ? (
                              <div 
                                onClick={() => setRevealedSpoilers(prev => ({ ...prev, [comment.id]: true }))}
                                className="bg-[#1b1d2a]/55 hover:bg-[#1b1d2a]/75 border border-zinc-850/45 rounded-lg px-3 py-2 text-[11px] text-zinc-400 font-semibold cursor-pointer transition-colors mt-1 select-none flex items-center gap-1.5 animate-fadeIn"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                                <span>Bình luận này có chứa tình tiết spoil phim. Bấm vào để xem.</span>
                              </div>
                            ) : (
                              <p className={`text-zinc-300 text-xs md:text-sm leading-relaxed font-medium transition-all ${hasSpoiler ? "bg-amber-500/5 p-2 rounded-lg border border-amber-500/10 animate-fadeIn" : ""}`}>
                                {comment.content}
                              </p>
                            )}

                            {/* Footer actions row */}
                            <div className="flex items-center gap-4 pt-1.5 select-none text-zinc-500 font-bold text-[10px]">
                              {/* Upvote Button */}
                              <div className="flex items-center">
                                <button
                                  onClick={() => handleVote(comment.id, 'up')}
                                  className={`w-6 h-6 rounded-full flex items-center justify-center transition-all border-none cursor-pointer ${
                                    comment.userVote === 'up'
                                      ? "bg-emerald-500/10 text-emerald-500"
                                      : "bg-[#1b1d2a]/60 text-zinc-500 hover:text-white"
                                  }`}
                                  title="Thích"
                                >
                                  <ArrowUp size={11} className={comment.userVote === 'up' ? "stroke-[2.5]" : ""} />
                                </button>
                                {comment.likes > 0 && (
                                  <span className={`text-[10px] font-extrabold ml-1.5 ${comment.userVote === 'up' ? "text-emerald-500" : "text-zinc-400"}`}>
                                    {comment.likes}
                                  </span>
                                )}
                              </div>

                              {/* Downvote Button */}
                              <button
                                onClick={() => handleVote(comment.id, 'down')}
                                className={`w-6 h-6 rounded-full flex items-center justify-center transition-all border-none cursor-pointer ${
                                  comment.userVote === 'down'
                                    ? "bg-[#ef4444]/10 text-red-500"
                                    : "bg-[#1b1d2a]/60 text-zinc-500 hover:text-white"
                                }`}
                                title="Không thích"
                              >
                                <ArrowDown size={11} className={comment.userVote === 'down' ? "stroke-[2.5]" : ""} />
                              </button>

                              {/* Reply Button */}
                              <button
                                className="flex items-center gap-1 hover:text-zinc-300 transition-colors cursor-pointer bg-transparent border-none text-[10px] font-bold text-zinc-500"
                              >
                                <CornerDownLeft size={11} />
                                <span>Trả lời</span>
                              </button>

                              {/* More Button */}
                              <button
                                className="flex items-center gap-1 hover:text-zinc-300 transition-colors cursor-pointer bg-transparent border-none text-[10px] font-bold text-zinc-500"
                              >
                                <MoreHorizontal size={11} />
                                <span>Thêm</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* CỘT PHẢI: INTERACTION, DISCORD BANNER, DIỄN VIÊN */}
          <div className="space-y-6">
            
            {/* Bộ tương tác nhanh */}
            <div className="flex items-center justify-between gap-4 bg-zinc-955/20 p-4 rounded-xl">
              <div className="flex gap-4">
                <button className="flex flex-col items-center gap-1 bg-transparent border-none text-zinc-400 hover:text-white cursor-pointer select-none">
                  <Star size={16} />
                  <span className="text-[10px] font-black uppercase">Đánh giá</span>
                </button>
                <button 
                  onClick={() => {
                    document.getElementById("movie-comments")?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="flex flex-col items-center gap-1 bg-transparent border-none text-zinc-400 hover:text-white cursor-pointer select-none"
                >
                  <Users size={16} />
                  <span className="text-[10px] font-black uppercase">Bình luận</span>
                </button>
              </div>
              <div className="bg-[#1b1d2a] px-3.5 py-1.5 rounded-lg flex items-center gap-1 text-xs font-black text-white select-none">
                <Star size={14} className="fill-pink-500 stroke-none" />
                <span>0 Đánh giá</span>
              </div>
            </div>

            {/* Discord banner */}
            <div className="p-4 rounded-xl bg-gradient-to-tr from-pink-500/10 via-rose-500/5 to-transparent border border-pink-500/20 text-left space-y-2 shadow-lg select-none">
              <div className="flex items-center gap-1.5">
                <Sparkles size={14} className="text-pink-500 animate-pulse" />
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

            {/* Diễn viên list */}
            {movie.actor && movie.actor.filter(a => a && a.trim() && a !== "Đang cập nhật").length > 0 && (
              <div className="space-y-4">
                <h3 className="text-sm font-black text-zinc-455 uppercase tracking-widest border-b border-zinc-900 pb-2.5">
                  Diễn viên
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  {movie.actor.filter(a => a && a.trim() && a !== "Đang cập nhật").slice(0, 6).map((actor, idx) => (
                    <div key={`actor-watch-${idx}`} className="flex flex-col items-center text-center gap-1">
                      <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 bg-zinc-800 flex items-center justify-center font-black text-xs text-white shadow bg-gradient-to-tr from-pink-500/20 to-rose-500/10">
                        {actor[0].toUpperCase()}
                      </div>
                      <span className="text-[10px] font-extrabold text-[#a0a5c0] truncate w-full">{actor}</span>
                    </div>
                  ))}
                </div>
              </div>
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
