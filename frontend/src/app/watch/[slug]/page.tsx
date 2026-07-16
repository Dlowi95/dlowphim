"use client";

import React, { useEffect, useState, Suspense } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { Play, Heart, Share2, Film, Star, Loader2, ArrowLeft, Send, Sparkles, Tv, HelpCircle, Plus, Users, Flag, X, Check } from "lucide-react";
import CommentRatingSection from "@/components/CommentRatingSection";
import EpisodeSelector from "@/components/EpisodeSelector";
import { cleanMovieName } from "@/utils/movieUtils";
import MovieCard from "@/components/MovieCard";
import { useAuth } from "@/context/AuthContext";
import Cookies from "js-cookie";
import { getTmdbApiKey } from "@/utils/tmdb";
import { getProxyUrl } from "@/utils/api";
import "plyr/dist/plyr.css";

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
  isCustom?: boolean;
}


interface RatingData {
  average: number;
  count: number;
  userRating: number | null;
}

function WatchContent({ slug }: { slug: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryEp = searchParams.get("ep") || "";
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

  const [movie, setMovie] = useState<MovieDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tmdbBackdrop, setTmdbBackdrop] = useState<string | null>(null);

  const { user, toggleFavorite: toggleFavoriteCtx, showToast, createPlaylist, toggleMovieInPlaylist, updateWatchHistory } = useAuth();

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

  // Custom playlists states
  const [showPlaylistDropdown, setShowPlaylistDropdown] = useState(false);
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");

  const handleQuickCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;
    const success = await createPlaylist(newPlaylistName.trim());
    if (success) {
      setNewPlaylistName("");
      setIsCreatingPlaylist(false);
    }
  };
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const plyrRef = React.useRef<any>(null);
  const hlsRef = React.useRef<any>(null);
  const hasSkippedIntro = React.useRef(false);
  const lastHistorySavedTime = React.useRef<number>(0);
  const [kkServers, setKkServers] = useState<Server[]>([]);

  const [showEpisodeDrawer, setShowEpisodeDrawer] = useState(false);

  // States đánh giá
  const [ratingData, setRatingData] = useState<RatingData>({ average: 0, count: 0, userRating: null });
  const [hoverStar, setHoverStar] = useState(0);
  const [submittingRating, setSubmittingRating] = useState(false);

  // Phim liên quan
  const [relatedMovies, setRelatedMovies] = useState<any[]>([]);
  const [loadingRelated, setLoadingRelated] = useState(false);

  // States báo lỗi phim
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const [showReportModal, setShowReportModal] = useState(false);
  const [reportErrorType, setReportErrorType] = useState("video_broken");
  const [reportDescription, setReportDescription] = useState("");
  const [submittingReport, setSubmittingReport] = useState(false);

  const handleSendReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!movie) return;

    let episodeName = "Tập 1";
    try {
      const server = movie.episodes?.[activeServerIndex] || kkServers?.[activeServerIndex];
      const ep = server?.server_data?.[activeEpisodeIndex];
      if (ep) {
        episodeName = ep.name;
      }
    } catch (err) {
      console.error("Lỗi lấy tập phim:", err);
    }

    setSubmittingReport(true);
    try {
      const token = Cookies.get("token");
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch(`${API_URL}/movie-reports`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          movieSlug: movie.slug,
          movieName: movie.name,
          episodeName,
          errorType: reportErrorType,
          description: reportDescription.trim() || undefined,
        }),
      });

      if (res.ok) {
        showToast("Gửi báo cáo lỗi thành công! Admin sẽ sớm khắc phục.", "success");
        setShowReportModal(false);
        setReportDescription("");
      } else {
        showToast("Gửi báo cáo thất bại, vui lòng thử lại.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Lỗi kết nối máy chủ", "error");
    } finally {
      setSubmittingReport(false);
    }
  };

  // Reset play states on source changes
  useEffect(() => {
    setIsHlsPlaying(false);
    hasSkippedIntro.current = false;
  }, [playerType, activeEpisodeIndex, activeServerIndex]);

  // 1. Fetch thông tin phim từ OPhim API hoặc Custom API
  useEffect(() => {
    async function fetchMovieDetail() {
      try {
        setLoading(true);
        setError(null);

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
          console.error("Lỗi kiểm tra chặn phim:", blockErr);
        }

        // b. Tải phim từ OPhim API
        let ophimDetail: any = null;
        try {
          const res = await fetch(getProxyUrl(`https://ophim1.com/v1/api/phim/${slug}`));
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

          // Cào thêm ảnh nét từ TMDB cho watch page
          const tmdbId = ophimDetail.tmdb?.id;
          const tmdbType = ophimDetail.tmdb?.type || "movie";
          if (tmdbId || ophimDetail.name) {
            (async () => {
              try {
                const proxyRes = await fetch(
                  `${API_URL}/movies/logo/${slug}?title=${encodeURIComponent(ophimDetail.origin_name || ophimDetail.name)}&tmdbId=${tmdbId || ""}&tmdbType=${tmdbType}`
                );
                if (proxyRes.ok) {
                  const proxyData = await proxyRes.json();
                  if (proxyData.backdropUrl) {
                    setTmdbBackdrop(proxyData.backdropUrl);
                  } else if (proxyData.posterUrl) {
                    setTmdbBackdrop(proxyData.posterUrl);
                  }
                }
              } catch (e) {
                console.error("Lỗi cào TMDB ảnh cho WatchPage qua proxy:", e);
              }
            })();
          }
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
            ],
            isCustom: true,
          };
          setMovie(adaptedMovie);
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

  // Tự động cuộn xuống khu vực bình luận nếu URL chứa hash #movie-comments
  useEffect(() => {
    if (!loading && movie) {
      const handleScrollToComments = () => {
        if (window.location.hash === "#movie-comments") {
          setTimeout(() => {
            const el = document.getElementById("movie-comments");
            if (el) {
              el.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          }, 300);
        }
      };

      handleScrollToComments();
      // Lắng nghe sự kiện đổi hash
      window.addEventListener("hashchange", handleScrollToComments);
      return () => window.removeEventListener("hashchange", handleScrollToComments);
    }
  }, [loading, movie]);

  // Fetch thêm nguồn từ KKPhim song song
  useEffect(() => {
    if (!slug || movie?.isCustom) return;
    async function fetchKKPhimDetail() {
      try {
        const res = await fetch(getProxyUrl(`https://phimapi.com/phim/${slug}`));
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
  }, [slug, movie?.isCustom]);


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

  // Tự động chuyển kiểu player sang HLS nếu tập phim có link m3u8 (ưu tiên HLS Player xịn)
  useEffect(() => {
    if (activeEpisode) {
      if (activeEpisode.link_m3u8) {
        setPlayerType("hls");
      } else {
        setPlayerType("embed");
      }
    }
  }, [activeEpisode]);

  // 1.7. Đồng bộ đánh giá theo phim qua Backend
  useEffect(() => {
    if (!movie) return;

    async function fetchRating() {
      try {
        const token = Cookies.get("token");
        const headers: HeadersInit = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await fetch(`${API_URL}/ratings/${slug}`, { headers });
        if (res.ok) {
          const data = await res.json();
          setRatingData(data);
        }
      } catch (err) {
        console.error("Lỗi lấy đánh giá:", err);
      }
    }

    fetchRating();
  }, [movie, slug, API_URL]);


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

  // 2.5. HLS + Plyr.io dynamic initialization
  useEffect(() => {
    let active = true;

    if (playerType === "hls" && activeEpisode?.link_m3u8) {
      const scriptId = "dlowphim-hls-script";
      let script = document.getElementById(scriptId) as HTMLScriptElement;

      const initPlayer = async () => {
        if (!active) return;
        const Hls = (window as any).Hls;
        const video = document.getElementById("dlow-hls-video") as HTMLVideoElement;
        if (!video) return;

        // Cleanup previous instances before creating new ones
        if (plyrRef.current) {
          try { plyrRef.current.destroy(); } catch (e) { }
          plyrRef.current = null;
        }
        if (hlsRef.current) {
          try { hlsRef.current.destroy(); } catch (e) { }
          hlsRef.current = null;
        }

        // Import động Plyr ở Client-side để tránh lỗi SSR "document is not defined"
        const PlyrClass = (await import("plyr")).default;

        if (Hls && Hls.isSupported()) {
          const hls = new Hls();
          hls.loadSource(activeEpisode.link_m3u8);
          hls.attachMedia(video);
          hlsRef.current = hls;

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (!active) return;

            // Đọc vị trí xem trước đó
            let savedTime = 0;
            try {
              let savedItem = null;
              if (user && user.watchHistory) {
                savedItem = user.watchHistory.find((item: any) => item.movieSlug === slug);
              } else {
                const localHist = JSON.parse(localStorage.getItem("dlowphim_history") || "[]");
                savedItem = localHist.find((item: any) => item.movieSlug === slug);
              }
              if (savedItem && savedItem.currentTime > 5) {
                savedTime = savedItem.currentTime;
              }
            } catch (e) {
              console.error(e);
            }

            // Định nghĩa hàm setup event dùng chung
            const setupEvents = (plyrInstance: any, oldTime: number) => {
              if (oldTime > 0) {
                // Sự kiện "canplay" đảm bảo metadata đã sẵn sàng để tua chính xác
                plyrInstance.once("canplay", () => {
                  const duration = plyrInstance.duration || video.duration || 0;
                  if (duration === 0 || oldTime < duration - 10) {
                    plyrInstance.currentTime = oldTime;
                    console.log(`[Plyr] Resumed watch progress from ${oldTime}s`);
                  }
                });
              }

              plyrInstance.on("timeupdate", () => {
                const now = Date.now();
                if (now - lastHistorySavedTime.current > 7000) {
                  saveWatchHistory(plyrInstance.currentTime, plyrInstance.duration);
                  lastHistorySavedTime.current = now;
                }
              });

              plyrInstance.on("pause", () => {
                saveWatchHistory(plyrInstance.currentTime, plyrInstance.duration);
              });
            };

            // Khởi tạo trình phát Plyr
            const player = new PlyrClass(video, {
              controls: [
                "play-large", "play", "progress", "current-time",
                "duration", "mute", "volume", "settings", "pip", "fullscreen"
              ],
              settings: ["quality", "speed"],
              speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 2] },
              quality: { default: 1080, options: [1080, 720, 480, 360] },
              i18n: {
                play: "Phát",
                pause: "Tạm dừng",
                mute: "Tắt tiếng",
                unmute: "Bật tiếng",
                settings: "Cài đặt",
                speed: "Tốc độ",
                normal: "Bình thường",
                quality: "Chất lượng"
              }
            });

            plyrRef.current = player;
            setupEvents(player, savedTime);
          });
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
          // Dành cho Safari gốc
          video.src = activeEpisode.link_m3u8;

          let savedTime = 0;
          try {
            let savedItem = null;
            if (user && user.watchHistory) {
              savedItem = user.watchHistory.find((item: any) => item.movieSlug === slug);
            } else {
              const localHist = JSON.parse(localStorage.getItem("dlowphim_history") || "[]");
              savedItem = localHist.find((item: any) => item.movieSlug === slug);
            }
            if (savedItem && savedItem.currentTime > 5) {
              savedTime = savedItem.currentTime;
            }
          } catch (e) { }

          const player = new PlyrClass(video, {
            controls: [
              "play-large", "play", "progress", "current-time",
              "duration", "mute", "volume", "settings", "pip", "fullscreen"
            ]
          });
          plyrRef.current = player;

          // Lắng nghe sự kiện để lưu lịch sử cho Safari
          if (savedTime > 0) {
            player.once("canplay", () => {
              player.currentTime = savedTime;
            });
          }
          player.on("timeupdate", () => {
            const now = Date.now();
            if (now - lastHistorySavedTime.current > 7000) {
              saveWatchHistory(player.currentTime, player.duration);
              lastHistorySavedTime.current = now;
            }
          });
          player.on("pause", () => {
            saveWatchHistory(player.currentTime, player.duration);
          });
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

    return () => {
      active = false;
      if (plyrRef.current) {
        try { plyrRef.current.destroy(); } catch (e) { }
        plyrRef.current = null;
      }
      if (hlsRef.current) {
        try { hlsRef.current.destroy(); } catch (e) { }
        hlsRef.current = null;
      }
    };
  }, [playerType, activeEpisode?.name, movie?.slug]);

  // 3. Fetch phim liên quan
  useEffect(() => {
    if (!movie || !movie.category || movie.category.length === 0) return;

    const movieSlug = movie.slug;
    const genreSlug = movie.category[0].slug;

    async function fetchRelated() {
      try {
        setLoadingRelated(true);
        const res = await fetch(getProxyUrl(`https://ophim1.com/v1/api/the-loai/${genreSlug}?page=1`));
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

  // Gửi đánh giá sao qua Backend
  const handleSubmitRating = async (score: number) => {
    if (!user) {
      window.dispatchEvent(new Event("dlowphim_open_auth"));
      return;
    }
    setSubmittingRating(true);
    try {
      const token = Cookies.get("token");
      const res = await fetch(`${API_URL}/ratings/${slug}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ score }),
      });
      if (res.ok) {
        const data = await res.json();
        setRatingData(data);
      }
    } catch (err) {
      console.error("Lỗi gửi đánh giá:", err);
    } finally {
      setSubmittingRating(false);
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

    // Cập nhật state runtime (cả user.watchHistory và localStorage) thông qua AuthContext
    updateWatchHistory(historyItem);

    // Gửi đồng bộ lên Database nếu người dùng đã đăng nhập
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

  // Giả lập lưu lịch sử xem cho các tập phim phát qua Embed Player (Iframe)
  const embedProgressRef = React.useRef<number>(0);
  useEffect(() => {
    if (playerType !== "embed" || !movie || !activeEpisode) return;

    // Đọc vị trí xem trước đó để làm điểm xuất phát đếm tiếp
    let savedTime = 0;
    try {
      let savedItem = null;
      if (user && user.watchHistory) {
        savedItem = user.watchHistory.find((item: any) => item.movieSlug === slug);
      } else {
        const localHist = JSON.parse(localStorage.getItem("dlowphim_history") || "[]");
        savedItem = localHist.find((item: any) => item.movieSlug === slug);
      }
      if (savedItem && savedItem.currentTime > 5) {
        savedTime = savedItem.currentTime;
      }
    } catch (e) {
      console.error("Lỗi đọc lịch sử cũ cho embed:", e);
    }

    embedProgressRef.current = savedTime;

    const interval = setInterval(() => {
      // Chỉ tăng tiến trình nếu tab đang active (để tránh người dùng bỏ tab đi chơi mà vẫn lưu)
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        embedProgressRef.current += 8;
        saveWatchHistory(embedProgressRef.current, 7200); // Giả định thời lượng phim lẻ là 120 phút
      }
    }, 8000);

    return () => clearInterval(interval);
  }, [playerType, activeEpisode?.name, movie?.slug, user?.watchHistory]);

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
      let savedItem = null;
      if (user && user.watchHistory) {
        savedItem = user.watchHistory.find((item: any) => item.movieSlug === slug);
      } else {
        const localHist = JSON.parse(localStorage.getItem("dlowphim_history") || "[]");
        savedItem = localHist.find((item: any) => item.movieSlug === slug);
      }

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
          className="flex items-center gap-2 border border-zinc-800 bg-zinc-900 hover:bg-[#1b1d2a] text-white text-sm font-extrabold px-6 py-2.5 rounded-xl transition-all"
        >
          <ArrowLeft size={16} /> Quay về Trang chủ
        </button>
      </div>
    );
  }

  return (
    <div className="w-full flex-grow flex flex-col bg-[#07070a] text-white pb-16 relative overflow-hidden pt-24">
      {/* BACKGROUND BLURRED */}
      <div className="absolute top-0 left-0 right-0 h-[60vh] overflow-hidden pointer-events-none select-none z-0">
        <img
          src={tmdbBackdrop || getImageUrl(movie.poster_url || movie.thumb_url)}
          alt={cleanedName}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover opacity-15 blur-[60px] scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#07070a]/60 to-[#07070a] z-10" />
      </div>

      <div className={`container mx-auto px-4 md:px-6 relative z-10 space-y-8 transition-all duration-300 ${cinemaMode ? "max-w-none w-full" : "max-w-7xl"
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
              className={`text-xs font-bold px-3 py-1.5 rounded-lg border-none transition-all cursor-pointer flex items-center gap-1.5 ${cinemaMode
                  ? "bg-pink-500 text-white shadow-md shadow-pink-500/20 z-50"
                  : "bg-[#1b1d2a] text-zinc-400 hover:text-white"
                }`}
            >
              <span>Chế Độ Rạp Chiếu</span>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded leading-none transition-all ${cinemaMode
                  ? "text-white bg-white/20"
                  : "text-zinc-500 bg-[#252839]"
                }`}>
                {cinemaMode ? "ON" : "OFF"}
              </span>
            </button>
          </div>

          {/* Ambient Glow Wrapper */}
          <div className="relative w-full z-10">
            {/* Ambient Image Glow (Philips Ambilight / Ambient Mode style) */}
            <div className="absolute -inset-4 z-0 pointer-events-none select-none overflow-hidden blur-[60px] opacity-40 scale-[1.04] rounded-[32px] transition-opacity duration-500">
              <img
                src={tmdbBackdrop || getImageUrl(movie.poster_url || movie.thumb_url)}
                alt=""
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>

            {/* Unified Movie Player Frame + Action Bar Container with soft shadow, no border */}
            <div
              className={`w-full overflow-hidden bg-black rounded-2xl md:rounded-3xl shadow-[0_15px_45px_rgba(0,0,0,0.85)] transition-all duration-300 relative z-10 ${cinemaMode
                  ? "shadow-pink-500/10 w-full max-w-[92vw] mx-auto"
                  : ""
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
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-zinc-900">
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
                      playsInline
                      controls
                      className="w-full h-full bg-black"
                      title="DlowPhim HLS Video Player"
                    />
                  </>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-zinc-900">
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
                  className={`absolute top-0 right-0 bottom-0 w-80 bg-[#13141f]/95 border-l border-zinc-900 z-40 flex flex-col transition-transform duration-300 ease-in-out shadow-2xl select-none ${showEpisodeDrawer ? "translate-x-0" : "translate-x-full"
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
                          className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer hover:bg-zinc-800/35 transition-colors border ${isEpActive
                              ? "bg-[#1b1d2a]/60 border-pink-500 shadow-md shadow-pink-500/5 text-pink-500"
                              : "border-transparent text-zinc-300 hover:text-white"
                            }`}
                        >
                          {/* Thumbnail representation */}
                          <div className={`w-20 aspect-video rounded overflow-hidden bg-zinc-900 border shrink-0 relative transition-all ${isEpActive ? "border-pink-500" : "border-zinc-800"
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
                        setShowReportModal(true);
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
                    className={`flex items-center gap-1 transition-all cursor-pointer bg-transparent border-none hover:bg-zinc-800/30 px-2 py-1 rounded-lg ${isFavorite ? "text-pink-500" : "text-zinc-400 hover:text-white"
                      }`}
                  >
                    <Heart size={14} className={isFavorite ? "fill-pink-500 text-pink-500" : ""} />
                    <span>Yêu thích</span>
                  </button>

                  <div className="relative">
                    <button
                      onClick={() => setShowPlaylistDropdown(!showPlaylistDropdown)}
                      className="flex items-center gap-1 text-zinc-400 hover:text-white transition-all cursor-pointer bg-transparent border-none hover:bg-zinc-800/30 px-2 py-1 rounded-lg"
                    >
                      <Plus size={14} />
                      <span>Thêm vào</span>
                    </button>

                    {/* Dropdown list các danh sách phát */}
                    {showPlaylistDropdown && (
                      <>
                        <div
                          className="fixed inset-0 z-40 bg-transparent cursor-default"
                          onClick={() => {
                            setShowPlaylistDropdown(false);
                            setIsCreatingPlaylist(false);
                            setNewPlaylistName("");
                          }}
                        />
                        <div className="absolute bottom-9 left-0 z-50 w-56 bg-[#12131b]/95 border border-zinc-800 rounded-2xl p-3 shadow-2xl space-y-2.5 text-left animate-in fade-in slide-in-from-bottom-2 duration-150">
                          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">Thêm vào danh sách</p>

                          <div className="max-h-40 overflow-y-auto no-scrollbar space-y-1">
                            {user?.playlists && user.playlists.length > 0 ? (
                              user.playlists.map((playlist) => {
                                const hasMovie = playlist.movies?.includes(movie?.slug || "");
                                return (
                                  <div
                                    key={playlist.id}
                                    onClick={() => toggleMovieInPlaylist(playlist.id, movie?.slug || "")}
                                    className="flex items-center justify-between p-2 rounded-xl hover:bg-zinc-900/60 cursor-pointer transition-colors"
                                  >
                                    <span className="text-xs font-bold text-zinc-300 truncate max-w-[150px]">{playlist.name}</span>
                                    {hasMovie ? (
                                      <Check size={13} className="text-pink-500 stroke-[3]" />
                                    ) : (
                                      <Plus size={13} className="text-zinc-650" />
                                    )}
                                  </div>
                                );
                              })
                            ) : (
                              <p className="text-[11px] text-zinc-550 px-1 py-2 font-medium">Chưa có danh sách phát nào</p>
                            )}
                          </div>

                          <div className="border-t border-zinc-850 pt-2.5">
                            {isCreatingPlaylist ? (
                              <form onSubmit={handleQuickCreatePlaylist} className="flex gap-1.5 w-full min-w-0 items-center">
                                <input
                                  type="text"
                                  required
                                  placeholder="Tên..."
                                  value={newPlaylistName}
                                  onChange={(e) => setNewPlaylistName(e.target.value)}
                                  className="flex-1 min-w-0 h-7.5 bg-zinc-900 border border-zinc-800 focus:border-pink-500 rounded-lg px-2 text-xs text-zinc-200 outline-none font-semibold"
                                  maxLength={30}
                                  autoFocus
                                />
                                <button
                                  type="submit"
                                  className="h-7.5 px-2.5 bg-pink-500 hover:bg-pink-600 text-white font-extrabold text-[10px] rounded-lg active:scale-95 transition-all shrink-0"
                                >
                                  Thêm
                                </button>
                              </form>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setIsCreatingPlaylist(true)}
                                className="w-full h-7.5 border border-zinc-800 hover:border-zinc-700 bg-zinc-900/30 hover:bg-zinc-900/60 text-zinc-400 hover:text-white font-extrabold text-[10px] rounded-lg flex items-center justify-center gap-1 transition-all"
                              >
                                <Plus size={10} className="stroke-[3]" />
                                <span>Tạo danh sách mới</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  <button
                    onClick={() => setAutoplayNext(!autoplayNext)}
                    className="flex items-center gap-1 text-zinc-400 hover:text-white transition-all cursor-pointer bg-transparent border-none hover:bg-zinc-800/30 px-2 py-1 rounded-lg"
                  >
                    <span>Chuyển tập</span>
                    <span className={`text-[8px] font-bold ml-1 px-1 py-0.2 rounded border leading-none transition-colors ${autoplayNext
                        ? "border-pink-500 text-pink-500 bg-pink-500/5 shadow-[0_0_8px_rgba(236,72,153,0.2)]"
                        : "border-zinc-700 text-zinc-500 bg-transparent"
                      }`}>
                      {autoplayNext ? "ON" : "OFF"}
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
                    onClick={() => {
                      if (!user) {
                        window.dispatchEvent(new Event("dlowphim_open_auth"));
                        return;
                      }
                      router.push(`/watch-together/create/${movie.slug}`);
                    }}
                    className="flex items-center gap-1 text-zinc-400 hover:text-white transition-all cursor-pointer bg-transparent border-none hover:bg-zinc-800/30 px-2 py-1 rounded-lg"
                  >
                    <Users size={14} />
                    <span>Xem chung</span>
                  </button>
                </div>

                <button
                  onClick={() => setShowReportModal(true)}
                  className="flex items-center gap-1 text-zinc-500 hover:text-pink-500 transition-all cursor-pointer ml-auto bg-transparent border-none hover:bg-zinc-800/30 px-2 py-1 rounded-lg"
                >
                  <Flag size={14} />
                  <span>Báo lỗi</span>
                </button>
              </div>
            )}
          </div>
          </div>
        </div>

        {/* 2. THÔNG TIN CHI TIẾT PHIM, DIỄN VIÊN, NGUỒN PHÁT VÀ SERVER PHÂN TRANG */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start pt-6 border-t border-zinc-900/60 text-left">

          {/* CỘT TRÁI: THÔNG TIN PHIM, BẢN CHIẾU, DANH SÁCH TẬP */}
          <div className="lg:col-span-2 space-y-6">

            {/* Thẻ thông tin nhanh của phim */}
            <div className="flex flex-col sm:flex-row gap-5 bg-[#0d0e13]/30 p-5 rounded-2xl">
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
            <div className="bg-[#0d0e13]/30 p-5 rounded-2xl border border-zinc-900/60 space-y-5">

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
                            className={`px-4 py-2 text-xs font-black rounded-lg transition-all border-none cursor-pointer uppercase ${isServerActive && playerType === "embed"
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
                              className={`px-4 py-2 text-xs font-black rounded-lg transition-all border-none cursor-pointer uppercase ${isServerActive && playerType === "hls"
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
              {servers.length > 0 && episodesData.length > 1 && (
                <div className="space-y-3 pt-4 border-t border-zinc-900/60">
                  <span className="block text-xs font-black text-zinc-455 uppercase tracking-wider">
                    {episodesData.length <= 1 ? "Bản phát sóng:" : "Danh sách tập phim:"}
                  </span>
                  <EpisodeSelector
                    episodes={episodesData}
                    activeEpisodeIndex={activeEpisodeIndex}
                    onSelectEpisode={(idx) => {
                      handleSelectEpisode(episodesData[idx].name);
                      scrollToPlayer();
                    }}
                    batchSize={40}
                  />
                </div>
              )}

            </div>

            {/* 4. KHU VỰC BÌNH LUẬN */}
            <CommentRatingSection
              slug={slug}
              title="Bình luận"
              episodeLabel={activeEpisode && episodesData.length > 1 ? `P.1 - Tập ${activeEpisode.name}` : undefined}
              showTabs={false}
            />
          </div>

          {/* CỘT PHẢI: INTERACTION, DISCORD BANNER, DIỄN VIÊN */}
          <div className="space-y-6">

            {/* Bộ tương tác nhanh + Rating */}
            <div className="bg-[#0d0e13]/30 p-4 rounded-xl space-y-4">
              {/* Action row */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById("movie-comments")?.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="flex flex-col items-center gap-1 bg-transparent border-none text-zinc-400 hover:text-white cursor-pointer select-none"
                  >
                    <Users size={16} />
                    <span className="text-[10px] font-black uppercase">Bình luận</span>
                  </button>
                </div>
                <div className="flex items-center gap-1.5 bg-[#1b1d2a] px-3.5 py-1.5 rounded-lg text-xs font-black text-white select-none">
                  <Star size={14} className="fill-pink-500 stroke-none" />
                  <span>{ratingData.average > 0 ? `${ratingData.average}/10` : 'Chưa có'}</span>
                  {ratingData.count > 0 && <span className="text-zinc-400 font-semibold text-[10px]">({ratingData.count})</span>}
                </div>
              </div>

              {/* Star rating widget */}
              <div className="space-y-2 border-t border-zinc-900/60 pt-3">
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">
                  {user ? (ratingData.userRating ? `Điểm của bạn: ${ratingData.userRating}/10` : 'Chấm điểm bộ phim:') : 'Đăng nhập để đánh giá'}
                </p>
                {user ? (
                  <div
                    className="flex flex-wrap gap-1"
                    onMouseLeave={() => setHoverStar(0)}
                  >
                    {Array.from({ length: 10 }).map((_, i) => {
                      const val = i + 1;
                      const isHighlighted = hoverStar > 0 ? val <= hoverStar : val <= (ratingData.userRating || 0);
                      return (
                        <button
                          key={val}
                          disabled={submittingRating}
                          onMouseEnter={() => setHoverStar(val)}
                          onClick={() => handleSubmitRating(val)}
                          className={`w-8 h-8 rounded-lg font-black text-xs transition-all border-none cursor-pointer select-none ${isHighlighted
                              ? 'bg-pink-500 text-white shadow-md shadow-pink-500/20'
                              : 'bg-[#1b1d2a] text-zinc-500 hover:bg-pink-500/20 hover:text-pink-400'
                            } ${submittingRating ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          {val}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <button
                    onClick={() => window.dispatchEvent(new Event("dlowphim_open_auth"))}
                    className="w-full flex items-center justify-center gap-1.5 bg-pink-500/10 hover:bg-pink-500/20 text-pink-400 font-extrabold text-[10px] py-2 rounded-xl transition-all cursor-pointer border border-pink-500/20"
                  >
                    <Star size={12} className="fill-pink-500" />
                    Đăng nhập để đánh giá
                  </button>
                )}
                {hoverStar > 0 && (
                  <p className="text-[10px] font-bold text-pink-400">
                    {hoverStar === 10 ? '🔥 Xuất sắc!' : hoverStar >= 8 ? '⭐ Rất hay!' : hoverStar >= 6 ? '👍 Khá hay' : hoverStar >= 4 ? '😐 Tạm được' : '👎 Không hay'} — {hoverStar}/10
                  </p>
                )}
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

        {/* Modal Báo Lỗi */}
        {showReportModal && mounted && createPortal(
          <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-md px-4 select-none">
            <div className="w-full max-w-md bg-[#0c0d12] border border-zinc-900 shadow-2xl flex flex-col rounded-2xl overflow-hidden animate-scaleUp text-left">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-zinc-900/60">
                <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <Flag size={15} className="text-pink-500" />
                  <span>Báo cáo lỗi phim</span>
                </h3>
                <button
                  onClick={() => setShowReportModal(false)}
                  className="p-1 hover:bg-zinc-900 text-zinc-400 hover:text-white rounded-lg transition-colors cursor-pointer border-none bg-transparent"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSendReport} className="p-5 space-y-4">
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-zinc-400 block">Bộ phim: <span className="text-zinc-200">{movie?.name}</span></span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 block">Loại lỗi gặp phải (Bắt buộc)</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: "video_broken", label: "Link hỏng / Không xem được" },
                      { value: "audio_issue", label: "Lỗi âm thanh (mất tiếng...)" },
                      { value: "subtitle_issue", label: "Lỗi phụ đề / Vietsub" },
                      { value: "other", label: "Lỗi khác" },
                    ].map((item) => (
                      <label
                        key={item.value}
                        className={`p-2.5 rounded-xl border text-[10px] font-bold flex items-center justify-center text-center cursor-pointer transition-all ${reportErrorType === item.value
                            ? "bg-pink-500/10 border-pink-500/50 text-pink-400"
                            : "bg-zinc-900/40 border-zinc-900 text-zinc-400 hover:border-zinc-800"
                          }`}
                      >
                        <input
                          type="radio"
                          name="errorType"
                          value={item.value}
                          checked={reportErrorType === item.value}
                          onChange={(e) => setReportErrorType(e.target.value)}
                          className="sr-only"
                        />
                        {item.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 block">Mô tả chi tiết lỗi (Không bắt buộc)</label>
                  <textarea
                    rows={3}
                    placeholder="Mô tả cụ thể lỗi gặp phải giúp Admin dễ sửa hơn nhé (Ví dụ: Tập 05 bị lệch sub từ phút 10...)"
                    value={reportDescription}
                    onChange={(e) => setReportDescription(e.target.value.slice(0, 250))}
                    className="w-full bg-zinc-950 border border-zinc-900 rounded-xl p-3 text-xs text-zinc-200 focus:outline-none focus:border-pink-500/50 placeholder-zinc-650 resize-none"
                  />
                  <div className="flex justify-end">
                    <span className="text-[8px] font-bold text-zinc-600">{reportDescription.length}/250 ký tự</span>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-zinc-900/60">
                  <button
                    type="button"
                    onClick={() => setShowReportModal(false)}
                    className="h-8 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs font-black transition-colors cursor-pointer border-none"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={submittingReport}
                    className="h-8 px-4 rounded-xl bg-pink-500 hover:bg-pink-600 disabled:opacity-50 text-white text-xs font-black transition-colors flex items-center justify-center gap-1.5 cursor-pointer border-none shadow-md shadow-pink-500/20"
                  >
                    {submittingReport ? (
                      <>
                        <Loader2 size={12} className="animate-spin" />
                        Đang gửi...
                      </>
                    ) : (
                      "Gửi báo cáo"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
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
