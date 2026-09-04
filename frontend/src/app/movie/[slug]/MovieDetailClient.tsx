"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Play, Heart, Share2, Film, Star, Loader2, ArrowLeft, Sparkles, Tv, HelpCircle, Send, Plus, MessageSquare, Image, Users, Flame, ExternalLink, Compass, Check, BellRing } from "lucide-react";
import CommentRatingSection from "@/components/CommentRatingSection";
import { cleanMovieName, getImageUrl } from "@/utils/movieUtils";
import MovieCard from "@/components/MovieCard";
import HalftoneOverlay from "@/components/HalftoneOverlay";
import ProgressiveImage from "@/components/ProgressiveImage";
import { useAuth } from "@/context/AuthContext";
import Cookies from "js-cookie";
import { getProxyUrl, MOVIE_API_DOMAIN } from "@/utils/api";
import { normalizeEpisodeKey } from "@/utils/episodeUtils";
import { fetchMovieDiscovery } from "@/utils/movieDiscovery";
import { useIsMobileViewport } from "@/hooks/useIsMobileViewport";
import type { MobileMovieSection } from "./MobileMovieDetail";
import { primeMovieNavigationPreview, readMovieNavigationPreview } from "@/utils/movieNavigationPreview";

const MobileMovieDetail = dynamic(() => import("./MobileMovieDetail"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[60vh] items-center justify-center bg-black text-pink-500 md:hidden">
      <Loader2 className="animate-spin" size={28} />
    </div>
  ),
});

export interface Episode {
  name: string;
  slug: string;
  filename: string;
  link_embed: string;
  link_m3u8: string;
}

export interface Server {
  server_name: string;
  server_data: Episode[];
}

export interface MovieDetail {
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
  release_date?: string;
  actor: string[];
  director: string[];
  category: { name: string; slug: string }[];
  country: { name: string; slug: string }[];
  episodes: Server[];
  trailer_url?: string;
  tmdb?: { id?: string | number; type?: string; vote_average?: number };
  imdb?: { vote_average?: number };
  age_rating?: string;
  rating?: string;
  availability?: {
    status: "available" | "unavailable";
    label: string;
    source?: "phimapi" | "ophim";
    resolvedSlug?: string;
  };
}

export default function MovieDetailClient({ slug }: { slug: string }) {
  const router = useRouter();
  const { user, toggleFavorite: toggleFavoriteCtx, createPlaylist, toggleMovieInPlaylist, showAuthToast, showToast } = useAuth();

  const [movie, setMovie] = useState<MovieDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tmdbImages, setTmdbImages] = useState<{ backdrop?: string; poster?: string } | null>(null);
  const [tmdbCredits, setTmdbCredits] = useState<any[]>([]);
  const [creditsLoaded, setCreditsLoaded] = useState(false);
  const [loadingCredits, setLoadingCredits] = useState(false);
  const [averageRating, setAverageRating] = useState<number | null>(null);
  const isMobileViewport = useIsMobileViewport();
  const [reminderActive, setReminderActive] = useState(false);
  const [reminderLoading, setReminderLoading] = useState(false);
  const isUpcomingMovie = Boolean(movie && (
    movie.status === "trailer" ||
    movie.episode_current?.toLowerCase().includes("trailer") ||
    !movie.episodes?.some((server) => server.server_data?.length > 0)
  ));

  // States tương tác
  const isFavorite = user?.favorites?.includes(movie?.slug || "") || false;
  const [shareCopied, setShareCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"episodes" | "gallery" | "actors" | "recommendations">("episodes");
  const [mobileActiveSection, setMobileActiveSection] = useState<MobileMovieSection>("episodes");
  const [selectedEpisodeBatch, setSelectedEpisodeBatch] = useState<number>(0);
  const [localWatchHistory, setLocalWatchHistory] = useState<any[]>([]);

  useEffect(() => {
    try {
      const history = JSON.parse(localStorage.getItem("dlowphim_history") || "[]");
      setLocalWatchHistory(Array.isArray(history) ? history : []);
    } catch {
      setLocalWatchHistory([]);
    }
  }, [slug]);

  // Playlist dropdown states
  const [showPlaylistDropdown, setShowPlaylistDropdown] = useState(false);
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [playlistBusyId, setPlaylistBusyId] = useState<string | null>(null);

  const handleTogglePlaylist = async (playlistId: string) => {
    if (!movie?.slug || playlistBusyId) return;
    setPlaylistBusyId(playlistId);
    try {
      await toggleMovieInPlaylist(playlistId, movie.slug);
    } finally {
      setPlaylistBusyId(null);
    }
  };

  const handleQuickCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedName = newPlaylistName.trim();
    if (!normalizedName || playlistBusyId) return;
    if (user?.playlists?.some((playlist) => playlist.name.trim().toLocaleLowerCase("vi") === normalizedName.toLocaleLowerCase("vi"))) {
      showToast("Tên danh sách này đã tồn tại", "error");
      return;
    }
    setPlaylistBusyId("creating");
    const playlistId = await createPlaylist(normalizedName, { silent: true });
    if (playlistId) {
      if (movie?.slug) await toggleMovieInPlaylist(playlistId, movie.slug);
      setNewPlaylistName("");
      setIsCreatingPlaylist(false);
    }
    setPlaylistBusyId(null);
  };

  // States bình luận

  // Phim liên quan
  const [relatedMovies, setRelatedMovies] = useState<any[]>([]);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [relatedLoaded, setRelatedLoaded] = useState(false);

  // The mobile detail bundle used to start downloading only after every detail
  // request completed. Start it as soon as the viewport is known instead.
  useEffect(() => {
    if (isMobileViewport) void import("./MobileMovieDetail");
  }, [isMobileViewport]);

  // 1. Fetch thông tin phim từ OPhim API hoặc Custom API
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    async function fetchMovieDetail() {
      const navigationPreview = readMovieNavigationPreview<MovieDetail>(slug);
      try {
        setLoading(!navigationPreview);
        setError(null);
        setMovie(navigationPreview);
        setTmdbImages(null);
        setTmdbCredits([]);
        setCreditsLoaded(false);
        setLoadingCredits(false);
        setRelatedMovies([]);
        setRelatedLoaded(false);
        setLoadingRelated(false);
        setAverageRating(null);
        setActiveTab("episodes");
        setMobileActiveSection("episodes");
        setSelectedEpisodeBatch(0); // Reset episode batch on movie change

        const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

        // a. Kiểm tra xem phim có bị Block (Ẩn) hay không
        try {
          const blockRes = await fetch(`${API_URL}/movies/check-blocked/${slug}`, { signal: controller.signal });
          if (blockRes.ok) {
            const blockData = await blockRes.json();
            if (blockData.isBlocked) {
              throw new Error("Phim này hiện không khả dụng do bản quyền hoặc yêu cầu gỡ bỏ.");
            }
          }
        } catch (blockErr: any) {
          if (blockErr?.name === "AbortError") throw blockErr;
          if (blockErr.message.includes("bản quyền")) {
            throw blockErr;
          }
          // Lỗi mạng hoặc server chặn không cản trở việc load tiếp
          console.error("Lỗi kiểm tra chặn phim:", blockErr);
        }
        // b. Phim chưa công chiếu do TMDB quản lý riêng, không ép qua API tập phim.
        let ophimDetail: any = null;
        const tmdbUpcomingMatch = slug.match(/^tmdb-(\d+)(?:-|$)/);
        if (tmdbUpcomingMatch) {
          const upcomingRes = await fetch(`${API_URL}/movies/upcoming/${tmdbUpcomingMatch[1]}`, { signal: controller.signal });
          if (upcomingRes.ok) {
            const upcomingData = await upcomingRes.json();
            if (upcomingData.redirectSlug && upcomingData.redirectSlug !== slug) {
              router.replace(`/movie/${upcomingData.redirectSlug}`);
              return;
            }
            ophimDetail = {
              ...(upcomingData.movie || upcomingData.data?.item),
              episodes: upcomingData.episodes || upcomingData.movie?.episodes || [],
            };
          }
        } else {
          try {
            const res = await fetch(getProxyUrl(`${MOVIE_API_DOMAIN}/phim/${slug}`), { signal: controller.signal });
            if (res.ok) {
              const data = await res.json();
              if (data.status === true || data.status === "success") {
                ophimDetail = {
                  ...(data.movie || data.data?.item),
                  episodes: data.episodes || data.data?.item?.episodes || []
                };
              }
            }
          } catch (e) {
            console.warn("Lỗi tải từ API chính thức, thử chi tiết v1...");
          }
        }

        if (!ophimDetail) {
          try {
            const res = await fetch(getProxyUrl(`${MOVIE_API_DOMAIN}/v1/api/phim/${slug}`), { signal: controller.signal });
            if (res.ok) {
              const data = await res.json();
              if (data.status === true || data.status === "success") {
                const item = data.movie || data.data?.item;
                const eps = data.episodes || data.data?.item?.episodes || [];
                ophimDetail = { ...item, episodes: eps };
              }
            }
          } catch (e) {
            console.warn("Không tìm thấy trên v1/api/phim...");
          }
        }

        // c. Slug lấy từ danh sách OPhim có thể chưa tồn tại trên nguồn mặc định PhimAPI.
        if (!ophimDetail) {
          try {
            const res = await fetch(getProxyUrl(`/v1/api/phim/${slug}`, "ophim"), { signal: controller.signal });
            if (res.ok) {
              const data = await res.json();
              if (data.status === true || data.status === "success") {
                const item = data.movie || data.data?.item;
                ophimDetail = { ...item, episodes: data.episodes || item?.episodes || [] };
              }
            }
          } catch {
            console.warn("Không tìm thấy phim trên OPhim, thử kho phim tự đăng...");
          }
        }

        if (ophimDetail) {
          if (cancelled) return;
          setMovie(ophimDetail);
          primeMovieNavigationPreview(slug, ophimDetail);

          // Ảnh backdrop/poster cần ngay cho hero; credits được tải riêng khi mở tab Diễn viên.
          const tmdbId = ophimDetail.tmdb?.id;
          const tmdbType = ophimDetail.tmdb?.type || "movie";
          if (tmdbId || ophimDetail.name) {
            (async () => {
              try {
                const title = encodeURIComponent(ophimDetail.origin_name || ophimDetail.name);
                const imagesResult = await fetch(
                  `${API_URL}/movies/logo/${slug}?title=${title}&tmdbId=${tmdbId || ""}&tmdbType=${tmdbType}`,
                  { signal: controller.signal },
                );

                if (cancelled) return;
                if (imagesResult.ok) {
                  const proxyData = await imagesResult.json();
                  const images: { backdrop?: string; poster?: string } = {};
                  if (proxyData.backdropUrl) {
                    images.backdrop = proxyData.backdropUrl;
                  }
                  if (proxyData.posterUrl) {
                    images.poster = proxyData.posterUrl;
                  }
                  setTmdbImages(images);
                }
              } catch (e: any) {
                if (!cancelled && e?.name !== "AbortError") {
                  console.error("Lỗi tải ảnh TMDB cho MovieDetail qua proxy:", e);
                }
              }
            })();
          }
        } else {
          // d. Nếu OPhim không có, thử tìm trong Custom Movies của hệ thống
          const customRes = await fetch(`${API_URL}/movies/custom/${slug}`, { signal: controller.signal });
          if (!customRes.ok) {
            throw new Error("Không tìm thấy thông tin phim.");
          }
          const customData = await customRes.json();
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
          if (!cancelled) {
            setMovie(adaptedMovie);
            primeMovieNavigationPreview(slug, adaptedMovie);
          }
        }
      } catch (err: any) {
        if (err?.name === "AbortError" || cancelled) return;
        console.error("Lỗi lấy chi tiết phim:", err);
        const message = err.message || "Đã xảy ra lỗi ngoài ý muốn.";
        if (message.includes("bản quyền")) {
          setMovie(null);
          setError(message);
        } else if (!navigationPreview) {
          setError(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchMovieDetail();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [router, slug]);

  // Chỉ tải credits TMDB khi người dùng thật sự mở tab Diễn viên.
  useEffect(() => {
    const creditsActive = activeTab === "actors" || mobileActiveSection === "actors";
    if (!creditsActive) return;
    if (!movie || creditsLoaded) return;

    const controller = new AbortController();
    let isCurrentRequest = true;

    async function fetchCredits() {
      setLoadingCredits(true);
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
        const tmdbId = movie!.tmdb?.id;
        const tmdbType = movie!.tmdb?.type || "movie";
        const title = encodeURIComponent(movie!.origin_name || movie!.name);
        const res = await fetch(
          `${API_URL}/movies/credits/${slug}?title=${title}&tmdbId=${tmdbId || ""}&tmdbType=${tmdbType}`,
          { signal: controller.signal },
        );
        if (res.ok) {
          const data = await res.json();
          if (isCurrentRequest) {
            setTmdbCredits(Array.isArray(data) ? data : []);
          }
        }
      } catch (err: any) {
        if (isCurrentRequest && err?.name !== "AbortError") {
          console.error("Lỗi tải diễn viên TMDB:", err);
        }
      } finally {
        if (isCurrentRequest) {
          setCreditsLoaded(true);
          setLoadingCredits(false);
        }
      }
    }

    fetchCredits();
    return () => {
      isCurrentRequest = false;
      controller.abort();
      setLoadingCredits(false);
    };
  }, [activeTab, creditsLoaded, mobileActiveSection, movie, slug]);

  useEffect(() => {
    const tmdbId = movie?.tmdb?.id;
    const token = Cookies.get("token");
    if (!user || !token || !tmdbId || !isUpcomingMovie) {
      setReminderActive(false);
      return;
    }
    const controller = new AbortController();
    fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/movies/upcoming/${tmdbId}/reminder`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => data && setReminderActive(Boolean(data.active)))
      .catch((error) => error?.name !== "AbortError" && console.error("Lỗi tải trạng thái nhắc phim:", error));
    return () => controller.abort();
  }, [isUpcomingMovie, movie?.tmdb?.id, user]);

  // Tự động cuộn xuống khu vực bình luận nếu URL chứa hash #movie-comments
  useEffect(() => {
    if (!loading && movie) {
      const handleScrollToComments = () => {
        if (window.location.hash === "#movie-comments") {
          setTimeout(() => {
            const el = document.getElementById(isMobileViewport ? "mobile-movie-comments" : "movie-comments");
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
  }, [isMobileViewport, loading, movie]);

  // 2. Fetch phim liên quan dựa trên thể loại đầu tiên của phim hiện tại
  useEffect(() => {
    if (
      (activeTab !== "recommendations" && mobileActiveSection !== "recommendations") ||
      relatedLoaded ||
      !movie ||
      !movie.category ||
      movie.category.length === 0
    ) return;
    const controller = new AbortController();
    let cancelled = false;

    async function fetchRelated() {
      try {
        setLoadingRelated(true);
        const genreSlug = movie!.category[0].slug;
        const data = await fetchMovieDiscovery(
          { kind: "genre", slug: genreSlug, page: 1, limit: 24 },
          { signal: controller.signal, timeoutMs: 8000 },
        );
        const filtered = data.items.filter((item: any) => item.slug !== movie!.slug).slice(0, 6);
        setRelatedMovies(filtered);
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        console.error("Lỗi lấy phim liên quan:", err);
      } finally {
        if (!cancelled) {
          setLoadingRelated(false);
          setRelatedLoaded(true);
        }
      }
    }

    fetchRelated();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [activeTab, mobileActiveSection, movie, relatedLoaded]);



  const movieScore = Number(movie?.tmdb?.vote_average || movie?.imdb?.vote_average || averageRating || 0);
  const movieAgeRating = movie?.age_rating || movie?.rating || "";

  // Chuyển đổi YouTube URL thành định dạng nhúng
  const getYoutubeEmbedUrl = (url?: string) => {
    if (url && url.trim()) {
      let videoId = "";
      if (url.includes("v=")) {
        videoId = url.split("v=")[1]?.split("&")[0];
      } else if (url.includes("youtu.be/")) {
        videoId = url.split("youtu.be/")[1]?.split("?")[0];
      } else if (url.includes("embed/")) {
        return url;
      }
      if (videoId) return `https://www.youtube.com/embed/${videoId}`;
    }
    return "";
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

  const getAudioTrack = (serverName = "") => {
    const normalized = serverName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .toLowerCase();
    if (normalized.includes("thuyet minh")) return { key: "thuyet-minh", label: "Thuyết minh" };
    if (normalized.includes("long tieng")) return { key: "long-tieng", label: "Lồng tiếng" };
    return { key: "vietsub", label: "Vietsub" };
  };

  const currentHistory = (() => {
    const history = user?.watchHistory?.length ? user.watchHistory : localWatchHistory;
    const item = history.find((entry: any) => entry.movieSlug === slug);
    if (!item?.episodeName || !movie?.episodes?.length) return null;
    const targetKey = normalizeEpisodeKey(item.episodeName);
    const stillAvailable = movie.episodes.some((server) =>
      server.server_data?.some((episode) => normalizeEpisodeKey(episode.name) === targetKey),
    );
    return stillAvailable ? item : null;
  })();

  const formatContinueEpisode = (episodeName = "") => {
    if (/^full$/i.test(episodeName.trim())) return "Xem tiếp phim";
    return `Xem tiếp ${/^tập\s/i.test(episodeName) ? episodeName : `Tập ${episodeName}`}`;
  };

  // Chuyển hướng đến đúng tập đang xem dở, nếu chưa có lịch sử thì mở tập đầu tiên.
  const handleWatchNow = () => {
    if (!movie || !movie.episodes || movie.episodes.length === 0) return;
    const firstServer = movie.episodes[0];
    if (!firstServer || !firstServer.server_data || firstServer.server_data.length === 0) return;
    const firstEp = currentHistory?.episodeName
      ? { name: currentHistory.episodeName }
      : firstServer.server_data[0];

    router.push(`/watch/${movie.slug}?ep=${encodeURIComponent(firstEp.name)}`);
  };

  const handleWatchServer = (server: Server) => {
    if (!movie || !server.server_data?.length) return;
    const audioTrack = getAudioTrack(server.server_name);
    localStorage.setItem("dlowphim_audio_track_preference", audioTrack.key);
    const historyKey = currentHistory?.episodeName
      ? normalizeEpisodeKey(currentHistory.episodeName)
      : "";
    const episode = server.server_data.find((item) => normalizeEpisodeKey(item.name) === historyKey)
      || server.server_data[0];
    router.push(`/watch/${movie.slug}?ep=${encodeURIComponent(episode.name)}`);
  };

  const handleToggleReminder = async () => {
    if (!movie?.tmdb?.id) return;
    if (!user) {
      showAuthToast();
      return;
    }
    const token = Cookies.get("token");
    if (!token || reminderLoading) return;
    setReminderLoading(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/movies/upcoming/${movie.tmdb.id}/reminder`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          slug: movie.slug,
          movieName: movie.name,
          originName: movie.origin_name,
          releaseDate: movie.release_date,
          year: movie.year,
        }),
      });
      if (!response.ok) throw new Error("Không thể cập nhật lời nhắc");
      const data = await response.json();
      setReminderActive(Boolean(data.active));
      showToast(data.active ? "Đã bật nhắc lịch công chiếu" : "Đã tắt lời nhắc", "success");
    } catch {
      showToast("Chưa thể cập nhật lời nhắc, bạn thử lại nhé", "error");
    } finally {
      setReminderLoading(false);
    }
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
  const isTrailerOnly = isUpcomingMovie || hasNoEpisodes;

  if (isMobileViewport) {
    return (
      <MobileMovieDetail
        movie={movie}
        slug={slug}
        cleanedName={cleanedName}
        cleanedOrigin={cleanedOrigin}
        backdropSrc={tmdbImages?.backdrop || getImageUrl(movie.poster_url || movie.thumb_url)}
        posterSrc={tmdbImages?.poster || getImageUrl(movie.thumb_url || movie.poster_url)}
        movieScore={movieScore}
        movieAgeRating={movieAgeRating}
        isTrailerOnly={isTrailerOnly}
        isFavorite={isFavorite}
        reminderActive={reminderActive}
        reminderLoading={reminderLoading}
        shareCopied={shareCopied}
        currentEpisodeName={currentHistory?.episodeName}
        continueLabel={currentHistory ? formatContinueEpisode(currentHistory.episodeName) : "Xem ngay"}
        playlists={user?.playlists}
        playlistBusyId={playlistBusyId}
        newPlaylistName={newPlaylistName}
        isCreatingPlaylist={isCreatingPlaylist}
        tmdbCredits={tmdbCredits}
        loadingCredits={loadingCredits}
        relatedMovies={relatedMovies}
        loadingRelated={loadingRelated}
        activeSection={mobileActiveSection}
        showComments
        onWatchNow={handleWatchNow}
        onWatchServer={handleWatchServer}
        onWatchEpisode={handleWatchEpisode}
        onToggleFavorite={handleToggleFavorite}
        onToggleReminder={handleToggleReminder}
        onShare={handleShare}
        onTogglePlaylist={handleTogglePlaylist}
        onCreatePlaylistSubmit={handleQuickCreatePlaylist}
        onNewPlaylistNameChange={setNewPlaylistName}
        onCreatingPlaylistChange={setIsCreatingPlaylist}
        onCategory={(categorySlug) => router.push(`/the-loai/${categorySlug}`)}
        onActor={(actorName) => router.push(`/search?keyword=${encodeURIComponent(actorName)}`)}
        onSectionChange={setMobileActiveSection}
        onRatingChange={setAverageRating}
      />
    );
  }

  return (
      <div className="hidden md:block">
    <div className="w-full flex-grow flex flex-col bg-[#07070a] text-white pb-16 relative overflow-hidden">

      {/* 1. CINEMATIC BANNER */}
      <div className="relative w-full h-[440px] sm:h-[500px] lg:h-[65vh] lg:max-h-[700px] bg-zinc-950 overflow-hidden flex items-end pt-20 select-none">
        {/* Background Backdrop image */}
        <div className="absolute inset-0 z-0">
          <ProgressiveImage
            src={tmdbImages?.backdrop || getImageUrl(movie.poster_url || movie.thumb_url)}
            alt={cleanedName}
            referrerPolicy="no-referrer"
            priority
            className="w-full h-full object-cover object-[center_38%] opacity-75 md:opacity-90"
          />
          <HalftoneOverlay />
          {/* Bottom vignette gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#07070a] via-[#07070a]/15 to-black/20 z-10" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/45 via-transparent to-black/10 z-10" />
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
                {isTrailerOnly && (
                  <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-amber-300">
                    {movie.availability?.label || "Chưa có bản xem"}
                  </span>
                )}
                {isTrailerOnly ? (
                  <button
                    onClick={() => {
                      setActiveTab("episodes");
                      document.getElementById("right-tabs-area")?.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="flex items-center gap-2 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-extrabold text-xs md:text-sm px-6 py-3 rounded-full transition-all duration-300 hover:scale-105 hover:shadow-[0_0_25px_rgba(236,72,153,0.7)] active:scale-95 cursor-pointer shadow-lg shadow-pink-500/25"
                  >
                    <Play size={14} className="fill-white" /> {movie.trailer_url ? "Xem Trailer" : "Xem thông tin"}
                  </button>
                ) : (
                  <button
                    onClick={handleWatchNow}
                    className="flex items-center gap-2 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-extrabold text-xs md:text-sm px-6 py-3 rounded-full transition-all duration-300 hover:scale-105 hover:shadow-[0_0_25px_rgba(236,72,153,0.7)] active:scale-95 cursor-pointer shadow-lg shadow-pink-500/25"
                  >
                    <Play size={14} className="fill-white" /> {currentHistory ? formatContinueEpisode(currentHistory.episodeName) : "Xem Ngay"}
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

                {isTrailerOnly && movie.tmdb?.id && (
                  <button
                    onClick={handleToggleReminder}
                    disabled={reminderLoading}
                    className={`flex flex-col items-center gap-1 text-[10px] md:text-[11px] font-bold transition-colors cursor-pointer select-none disabled:opacity-50 ${reminderActive ? "text-amber-400" : "text-zinc-400 hover:text-white"}`}
                  >
                    <BellRing size={18} className={reminderActive ? "fill-amber-400/20" : ""} />
                    <span>{reminderActive ? "Đã nhắc" : "Nhắc tôi"}</span>
                  </button>
                )}

                <div className="relative">
                  <button
                    onClick={() => setShowPlaylistDropdown(!showPlaylistDropdown)}
                    className="flex flex-col items-center gap-1 text-[10px] md:text-[11px] font-bold text-zinc-400 hover:text-white transition-colors cursor-pointer select-none"
                  >
                    <Plus size={18} />
                    <span>Thêm vào</span>
                  </button>

                  {/* Dropdown list các danh sách phát */}
                  {showPlaylistDropdown && (
                    <>
                      {/* Lớp phủ overlay trong suốt để bấm ngoài tắt dropdown */}
                      <div
                        className="fixed inset-0 z-40 bg-transparent cursor-default"
                        onClick={() => {
                          setShowPlaylistDropdown(false);
                          setIsCreatingPlaylist(false);
                          setNewPlaylistName("");
                        }}
                      />
                      <div className="absolute bottom-16 left-0 z-50 w-56 bg-[#12131b]/95 border border-zinc-800 rounded-2xl p-3 shadow-2xl space-y-2.5 text-left animate-in fade-in slide-in-from-bottom-2 duration-150">
                        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">Thêm vào danh sách</p>

                        <div className="max-h-40 overflow-y-auto no-scrollbar space-y-1">
                          {user?.playlists && user.playlists.length > 0 ? (
                            user.playlists.map((playlist) => {
                              const hasMovie = playlist.movies?.includes(movie?.slug || "");
                              return (
                                <button
                                  type="button"
                                  key={playlist.id}
                                  onClick={() => handleTogglePlaylist(playlist.id)}
                                  disabled={Boolean(playlistBusyId)}
                                  aria-pressed={hasMovie}
                                  className="flex w-full items-center justify-between p-2 rounded-xl hover:bg-zinc-900/60 cursor-pointer transition-colors disabled:cursor-wait disabled:opacity-60"
                                >
                                  <span className="text-xs font-bold text-zinc-300 truncate max-w-[150px]">{playlist.name}</span>
                                  {playlistBusyId === playlist.id ? (
                                    <Loader2 size={13} className="animate-spin text-pink-500" />
                                  ) : hasMovie ? (
                                    <Check size={13} className="text-pink-500 stroke-[3]" />
                                  ) : (
                                    <Plus size={13} className="text-zinc-650" />
                                  )}
                                </button>
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
                                maxLength={40}
                                autoFocus
                              />
                              <button
                                type="submit"
                                disabled={playlistBusyId === "creating" || !newPlaylistName.trim()}
                                className="h-7.5 min-w-12 px-2.5 bg-pink-500 hover:bg-pink-600 disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-extrabold text-[10px] rounded-lg active:scale-95 transition-all shrink-0"
                              >
                                {playlistBusyId === "creating" ? <Loader2 size={12} className="mx-auto animate-spin" /> : "Thêm"}
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
                  type="button"
                  onClick={handleShare}
                  className="flex flex-col items-center gap-1 text-[10px] md:text-[11px] font-bold text-zinc-400 hover:text-white transition-colors cursor-pointer select-none"
                >
                  <Share2 size={18} className={shareCopied ? "text-emerald-400" : ""} />
                  <span>{shareCopied ? "Đã copy!" : "Chia sẻ"}</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById("movie-comments")?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="flex flex-col items-center gap-1 text-[10px] md:text-[11px] font-bold text-zinc-400 hover:text-white transition-colors cursor-pointer select-none"
                >
                  <MessageSquare size={18} />
                  <span>Bình luận</span>
                </button>

                {/* Rating button - blue background pill on the right side */}
                {!isTrailerOnly && (
                  <div
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById("movie-comments")?.scrollIntoView({ behavior: "smooth" });
                      window.dispatchEvent(new Event("dlowphim_switch_rating_tab"));
                    }}
                    className="ml-auto flex items-center gap-1 bg-blue-600/90 hover:bg-blue-700 text-white text-[11px] font-extrabold px-3.5 py-1.5 rounded-full shadow-md select-none transition-all cursor-pointer active:scale-95"
                  >
                    <Star size={12} className="fill-white animate-pulse" />
                    <span>{averageRating && averageRating > 0 ? `${averageRating.toFixed(1)} Điểm` : "0.0 Điểm"}</span>
                  </div>
                )}
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
                      className={`pb-2.5 font-extrabold uppercase tracking-wider relative transition-all cursor-pointer ${isActive
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
      <div className="container mx-auto px-4 md:px-6 max-w-7xl grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-8 md:gap-10 pb-8 relative z-20">

        {/* CỘT TRÁI: Poster nổi đè banner, TIÊU ĐỀ DƯỚI POSTER, badges, chi tiết phụ */}
        <div className="-mt-[105px] md:-mt-[125px] lg:-mt-[145px] relative z-30 flex flex-col gap-5 text-left px-4 lg:px-0 lg:pr-12">

          {/* Poster chính thu nhỏ tỷ lệ */}
          <div className="w-[110px] md:w-[130px] lg:w-[150px] mx-auto lg:mx-0 relative aspect-[2/3] rounded-2xl overflow-hidden shadow-[0_15px_40px_rgba(0,0,0,0.85)] bg-zinc-950 select-none">
            <ProgressiveImage
              src={tmdbImages?.poster || getImageUrl(movie.thumb_url || movie.poster_url)}
              alt={cleanedName}
              referrerPolicy="no-referrer"
              priority
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
            {movieScore > 0 && (
              <span className="bg-amber-400 text-black border border-amber-400 font-black px-2 py-0.5 rounded flex items-center gap-0.5 shadow-sm">
                {movie?.tmdb?.vote_average ? "TMDB" : "Đánh giá"} {movieScore.toFixed(1)}
              </span>
            )}
            {movieAgeRating && (
              <span className="border border-zinc-800 bg-zinc-950/60 px-2 py-0.5 rounded">
                {movieAgeRating}
              </span>
            )}
            <span className="border border-zinc-800 bg-zinc-950/60 px-2 py-0.5 rounded">
              {movie.year}
            </span>
            {movie.time && (
              <span className="border border-zinc-800 bg-zinc-950/60 px-2 py-0.5 rounded">
                {movie.time}
              </span>
            )}
          </div>

          {movie.category && movie.category.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 justify-center lg:justify-start">
              {movie.category.map((cat) => (
                <button
                  key={cat.slug}
                  onClick={() => router.push(`/the-loai/${cat.slug}`)}
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
                    <Film size={16} className="text-pink-500" /> {movie.trailer_url ? "Trailer phim chính thức" : "Thông tin phát hành"}
                  </h3>
                  {movie.trailer_url ? (
                    <div className="w-full aspect-video rounded-2xl overflow-hidden shadow-2xl bg-black border border-zinc-800">
                      <iframe
                        src={getYoutubeEmbedUrl(movie.trailer_url)}
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        className="w-full h-full"
                        title={`${cleanedName} - Trailer`}
                      />
                    </div>
                  ) : (
                    <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/70 px-6 text-center">
                      <Film size={28} className="text-zinc-600" />
                      <p className="text-sm font-black text-zinc-300">Trailer chính thức chưa được phát hành</p>
                      <p className="max-w-lg text-xs leading-5 text-zinc-500">DlowPhim sẽ tự cập nhật trailer và nút xem ngay khi nguồn phim có dữ liệu.</p>
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
                    const audioTrack = getAudioTrack(server.server_name);
                    return (
                      <div key={`server-${sIdx}`} className="p-4 rounded-xl bg-[#0d0e13]/40 space-y-4 shadow-sm border border-transparent">
                        <div className={`flex items-center justify-between gap-4 flex-wrap pb-2.5 ${epList.length > 1 ? "border-b border-zinc-900/40" : ""}`}>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-12 rounded-lg overflow-hidden shrink-0 shadow-md">
                              <img src={getImageUrl(movie.thumb_url || movie.poster_url)} className="w-full h-full object-cover" />
                            </div>
                            <div className="text-left">
                              <span className="text-[9px] text-zinc-550 font-extrabold uppercase bg-zinc-900 px-2 py-0.5 rounded border border-transparent">
                                Bản {audioTrack.label}
                              </span>
                              <h4 className="font-extrabold text-xs text-white mt-1">{cleanedName}</h4>
                            </div>
                          </div>

                          <button
                            onClick={() => handleWatchServer(server)}
                            className="px-3.5 py-2 bg-pink-500 hover:bg-pink-600 text-white text-[11px] font-black rounded-lg transition-all hover:scale-103 active:scale-97 uppercase tracking-wider shadow shadow-pink-500/10 cursor-pointer"
                          >
                            Xem bản {audioTrack.label}
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
                                      className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer border-none ${isActive
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
                <Users size={16} className="text-pink-500" /> Dàn diễn viên tham gia ({tmdbCredits.length > 0 ? tmdbCredits.length : (movie.actor?.length || 0)})
              </h3>

              {loadingCredits ? (
                <div className="flex items-center justify-center gap-2 py-10 text-xs font-bold text-zinc-500">
                  <Loader2 className="animate-spin text-pink-500" size={20} />
                  Đang tải thông tin diễn viên...
                </div>
              ) : tmdbCredits.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {tmdbCredits.map((actor, idx) => (
                    <div
                      key={`tmdb-actor-${actor.id || idx}`}
                      onClick={() => router.push(`/search?keyword=${encodeURIComponent(actor.name)}`)}
                      className="p-3.5 rounded-2xl bg-zinc-950/70 border border-zinc-900/60 flex flex-col items-center text-center gap-2.5 shadow-sm hover:border-pink-500/50 hover:scale-103 transition-all cursor-pointer group"
                      title={`Tìm phim của ${actor.name}`}
                    >
                      <div className="w-16 h-16 rounded-full overflow-hidden shrink-0 bg-zinc-900 border-2 border-pink-500/30 group-hover:border-pink-500 shadow-lg relative">
                        {actor.profileUrl ? (
                          <img
                            src={actor.profileUrl}
                            alt={actor.name}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                          />
                        ) : (
                          <div className={`w-full h-full font-black text-base flex items-center justify-center bg-gradient-to-tr ${getInitialsGradient(actor.name)} text-white`}>
                            {actor.name ? actor.name[0].toUpperCase() : "?"}
                          </div>
                        )}
                      </div>
                      <div className="w-full space-y-0.5">
                        <span className="text-xs font-black text-zinc-100 line-clamp-1 group-hover:text-pink-400 transition-colors">{actor.name}</span>
                        <span className="text-[10px] text-zinc-400 font-bold line-clamp-1 italic">{actor.character || "Diễn viên"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : movie.actor && movie.actor.filter(a => a && a.trim() && a !== "Đang cập nhật").length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {movie.actor.filter(a => a && a.trim() && a !== "Đang cập nhật").map((actor, idx) => (
                    <div
                      key={`actor-list-${idx}`}
                      onClick={() => router.push(`/search?keyword=${encodeURIComponent(actor)}`)}
                      className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-900/60 flex flex-col items-center text-center gap-2.5 shadow-sm hover:border-pink-500/40 transition-all hover:-translate-y-0.5 duration-200 cursor-pointer group"
                    >
                      <div className={`w-12 h-12 rounded-full font-black text-sm flex items-center justify-center bg-gradient-to-tr ${getInitialsGradient(actor)} shadow group-hover:scale-105 transition-transform`}>
                        {actor && actor[0] ? actor[0].toUpperCase() : "?"}
                      </div>
                      <span className="text-[11px] font-extrabold text-zinc-200 leading-snug truncate w-full group-hover:text-pink-400 transition-colors">{actor}</span>
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
          {!isMobileViewport && (
            <CommentRatingSection
              slug={slug}
              isTrailerOnly={isTrailerOnly}
              onRatingChange={setAverageRating}
            />
          )}
        </div>
      </div>
    </div>
      </div>
  );
}
