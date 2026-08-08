"use client";

import React, { useEffect, useState, Suspense } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { Play, Heart, Share2, Film, Star, Loader2, ArrowLeft, Send, Sparkles, Tv, HelpCircle, Plus, Users, Flag, X, Check } from "lucide-react";
import CommentRatingSection from "@/components/CommentRatingSection";
import EpisodeSelector from "@/components/EpisodeSelector";
import EmbedCompatibilityPlayer from "@/components/EmbedCompatibilityPlayer";
import MovieReleaseStatus from "@/components/MovieReleaseStatus";
import { cleanMovieName, getImageUrl } from "@/utils/movieUtils";
import MovieCard from "@/components/MovieCard";
import { useAuth } from "@/context/AuthContext";
import Cookies from "js-cookie";
import { getProxyUrl, MOVIE_API_DOMAIN } from "@/utils/api";
import { useSmartStreamServer } from "@/hooks/useSmartStreamServer";
import { useHlsPlaybackTelemetry } from "@/hooks/useHlsPlaybackTelemetry";
import ProgressiveImage from "@/components/ProgressiveImage";
import { destroyHlsInstance, loadHlsLibrary, WATCH_HLS_CONFIG } from "@/utils/hlsLoader";
import { normalizeEpisodeKey } from "@/utils/episodeUtils";
import {
  findEpisodeHistory,
  findNextEpisode,
  getResumeTime,
  shouldPrefetchNextManifest,
} from "@/utils/watchPlaybackFlow";
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
  sourceId?: string;
  fallbackOnly?: boolean;
  tmdb?: { id?: string | number; type?: string };
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
  const [tmdbPoster, setTmdbPoster] = useState<string | null>(null);

  const { user, toggleFavorite: toggleFavoriteCtx, showToast, createPlaylist, toggleMovieInPlaylist, updateWatchHistory } = useAuth();

  // States phát phim
  const [activeServerIndex, setActiveServerIndex] = useState(0);
  const [activeEpisodeIndex, setActiveEpisodeIndex] = useState(0);
  const [cinemaMode, setCinemaMode] = useState(false);
  const isFavorite = user?.favorites?.includes(movie?.slug || "") || false;
  const [shareCopied, setShareCopied] = useState(false);
  const [playerType, setPlayerType] = useState<"embed" | "hls">("embed");
  const [sourceSelectionMode, setSourceSelectionMode] = useState<"auto" | "manual">("auto");
  const [selectedEpisodeBatch, setSelectedEpisodeBatch] = useState(0);
  const [autoplayNext, setAutoplayNext] = useState(false);
  const [tmdbCredits, setTmdbCredits] = useState<any[]>([]);

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
  const hlsAttemptStartedAtRef = React.useRef(0);
  const pendingHistoryRef = React.useRef<any>(null);
  const lastDatabaseHistorySyncRef = React.useRef(0);
  const prefetchedManifestKeyRef = React.useRef("");
  const pendingFailoverTimeRef = React.useRef(0);
  const manualPlayerSelectionKeyRef = React.useRef("");
  const audioPreferenceAppliedRef = React.useRef("");
  const lastHistorySavedTime = React.useRef<number>(0);
  const [kkServers, setKkServers] = useState<Server[]>([]);
  const [fallbackSourceId, setFallbackSourceId] = useState<string>("");
  const [preferFallbackServers, setPreferFallbackServers] = useState(false);

  const [showEpisodeDrawer, setShowEpisodeDrawer] = useState(false);

  // States đánh giá
  const [ratingData, setRatingData] = useState<RatingData>({ average: 0, count: 0, userRating: null });
  const [hoverStar, setHoverStar] = useState(0);
  const [submittingRating, setSubmittingRating] = useState(false);

  // Phim liên quan
  const [relatedMovies, setRelatedMovies] = useState<any[]>([]);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [watchExtrasReady, setWatchExtrasReady] = useState(false);
  const [streamStatus, setStreamStatus] = useState<"idle" | "loading" | "recovering" | "failed">("loading");
  const [streamRetryNonce, setStreamRetryNonce] = useState(0);

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

    const episodeName = activeEpisode?.name || "Tập 1";

    setSubmittingReport(true);
    try {
      const token = Cookies.get("token");
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const streamUrl = playerType === "hls"
        ? activeEpisode?.link_m3u8
        : activeEpisode?.link_embed;
      let streamOrigin = "";
      try {
        streamOrigin = streamUrl ? new URL(streamUrl).origin : "";
      } catch {
        streamOrigin = "";
      }

      const res = await fetch(`${API_URL}/movie-reports`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          movieSlug: movie.slug,
          movieName: movie.name,
          episodeName,
          episodeSlug: activeEpisode?.slug || undefined,
          errorType: reportErrorType,
          description: reportDescription.trim() || undefined,
          playbackType: playerType,
          serverName: currentServer?.server_name || undefined,
          streamOrigin: streamOrigin || undefined,
          currentTime: playerType === "hls"
            ? Math.floor(videoRef.current?.currentTime || 0)
            : undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(
          data.message || "Gửi báo cáo lỗi thành công! Admin sẽ sớm khắc phục.",
          "success",
        );
        setShowReportModal(false);
        setReportDescription("");
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.message || "Gửi báo cáo thất bại, vui lòng thử lại.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Lỗi kết nối máy chủ", "error");
    } finally {
      setSubmittingReport(false);
    }
  };

  useEffect(() => {
    if (!cinemaMode) return;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCinemaMode(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [cinemaMode]);

  useEffect(() => {
    setPlayerReady(false);
    setWatchExtrasReady(false);
    setRelatedMovies([]);
    setTmdbBackdrop(null);
    setTmdbPoster(null);
    setTmdbCredits([]);
  }, [slug]);

  useEffect(() => {
    if (!movie || watchExtrasReady) return;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let idleId: number | null = null;
    const revealExtras = () => setWatchExtrasReady(true);

    if (playerReady) {
      if ("requestIdleCallback" in window) {
        idleId = window.requestIdleCallback(revealExtras, { timeout: 1500 });
      } else {
        timeoutId = setTimeout(revealExtras, 600);
      }
    } else {
      // Không để nội dung phụ bị ẩn mãi nếu nguồn video đang lỗi/chuyển dự phòng.
      timeoutId = setTimeout(revealExtras, 8000);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (idleId !== null && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }
    };
  }, [movie, playerReady, watchExtrasReady]);

  // 1. Fetch movie data from the source selected in admin settings.
  useEffect(() => {
    async function fetchMovieDetail() {
      try {
        setLoading(true);
        setError(null);
        setPreferFallbackServers(false);

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
        // b. Load from the active movie source.
        let movieDetail: any = null;
        try {
          const res = await fetch(getProxyUrl(`${MOVIE_API_DOMAIN}/phim/${slug}`));
          if (res.ok) {
            const data = await res.json();
            if (data.status === true || data.status === "success") {
              movieDetail = {
                ...(data.movie || data.data?.item),
                episodes: data.episodes || data.data?.item?.episodes || [],
                sourceId: data._sourceId,
              };
            }
          }
        } catch (e) {
          console.warn("Lỗi tải từ nguồn phim chính, thử route chi tiết v1...");
        }

        if (!movieDetail) {
          try {
            const res = await fetch(getProxyUrl(`${MOVIE_API_DOMAIN}/v1/api/phim/${slug}`));
            if (res.ok) {
              const data = await res.json();
              if (data.status === true || data.status === "success") {
                const item = data.movie || data.data?.item;
                const eps = data.episodes || data.data?.item?.episodes || [];
                movieDetail = { ...item, episodes: eps, sourceId: data._sourceId };
              }
            }
          } catch (e) {
            console.warn("Không tìm thấy phim trên route chi tiết v1...");
          }
        }

        if (movieDetail) {
          // Check whether the active source has an immediately playable link.
          const firstEp = movieDetail.episodes?.[0]?.server_data?.[0];
          const hasValidLink = !!(firstEp && (firstEp.link_m3u8 || firstEp.link_embed));

          // The fallback source is fetched once by the source-merging effect.
          // Put it first only when the active source has no playable link.
          setPreferFallbackServers(!hasValidLink);

          setMovie(movieDetail);

        } else {
          // c. Nếu nguồn chính không có, thử tìm trên fallback hoặc Custom Movies
          try {
            const fbRes = await fetch(getProxyUrl(`/phim/${slug}`, "fallback"));
            if (fbRes.ok) {
              const fbData = await fbRes.json();
              if ((fbData.status === true || fbData.status === "success" || fbData.status === "true") && fbData.movie) {
                movieDetail = {
                  ...fbData.movie,
                  episodes: fbData.episodes || [],
                  sourceId: fbData._sourceId,
                  fallbackOnly: true,
                };
                setMovie(movieDetail);
              }
            }
          } catch (e) {
            console.warn("Không tìm thấy phim trên nguồn dự phòng");
          }

          if (!movieDetail) {
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

  // Fetch the provider opposite to the active admin source in parallel.
  useEffect(() => {
    setKkServers([]);
    setFallbackSourceId("");
    if (!slug || movie?.isCustom || movie?.fallbackOnly) return;
    async function fetchKKPhimDetail() {
      try {
        const params = new URLSearchParams({
          source: "fallback",
          title: movie?.name || "",
          originTitle: movie?.origin_name || "",
          year: movie?.year ? String(movie.year) : "",
          tmdbId: movie?.tmdb?.id ? String(movie.tmdb.id) : "",
        });
        const res = await fetch(
          `${API_URL}/movies/resolved-detail/${slug}?${params.toString()}`
        );
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
            setFallbackSourceId(data._sourceId || "");
          }
        }
      } catch (err) {
        console.error("Lỗi lấy chi tiết phim từ KKPhim:", err);
      }
    }
    fetchKKPhimDetail();
  }, [API_URL, slug, movie?.isCustom, movie?.fallbackOnly, movie?.name, movie?.origin_name, movie?.year, movie?.tmdb?.id]);

  useEffect(() => {
    if (!watchExtrasReady || !movie) return;
    const controller = new AbortController();
    const tmdbId = movie.tmdb?.id;
    const tmdbType = movie.tmdb?.type || "movie";
    const title = encodeURIComponent(movie.origin_name || movie.name);

    const fetchTmdbExtras = async () => {
      const [imagesResult, creditsResult] = await Promise.allSettled([
        fetch(
          `${API_URL}/movies/logo/${slug}?title=${title}&tmdbId=${tmdbId || ""}&tmdbType=${tmdbType}`,
          { signal: controller.signal },
        ),
        fetch(
          `${API_URL}/movies/credits/${slug}?title=${title}&tmdbId=${tmdbId || ""}&tmdbType=${tmdbType}`,
          { signal: controller.signal },
        ),
      ]);

      if (imagesResult.status === "fulfilled" && imagesResult.value.ok) {
        const imageData = await imagesResult.value.json();
        setTmdbBackdrop(imageData.backdropUrl || imageData.posterUrl || null);
        setTmdbPoster(imageData.posterUrl || null);
      }
      if (creditsResult.status === "fulfilled" && creditsResult.value.ok) {
        setTmdbCredits(await creditsResult.value.json());
      }
    };

    fetchTmdbExtras().catch((error) => {
      if (!controller.signal.aborted) {
        console.error("Lỗi tải TMDB sau khi player sẵn sàng:", error);
      }
    });
    return () => controller.abort();
  }, [API_URL, movie, slug, watchExtrasReady]);


  const cleanedName = movie ? cleanMovieName(movie.name) : "";

  const primarySourceLabel = movie?.isCustom
    ? "DlowServer"
    : movie?.sourceId === "ophim"
      ? "OPhim"
      : "PhimAPI";
  const fallbackSourceLabel = fallbackSourceId === "ophim" ? "OPhim" : "PhimAPI";

  // Merge servers from the configured primary source and its fallback.
  const primaryServers: Server[] = (movie?.episodes || []).map((srv) => ({
      server_name: srv.server_name.toLowerCase().includes(primarySourceLabel.toLowerCase())
        ? srv.server_name
        : `${primarySourceLabel} - ${srv.server_name}`,
      server_data: srv.server_data,
    }));
  const fallbackServers: Server[] = kkServers.map((srv) => ({
      server_name: srv.server_name.toLowerCase().includes(fallbackSourceLabel.toLowerCase())
        ? srv.server_name
        : `${fallbackSourceLabel} - ${srv.server_name}`,
      server_data: srv.server_data,
    }));
  const combinedServers: Server[] = preferFallbackServers
    ? [...fallbackServers, ...primaryServers]
    : [...primaryServers, ...fallbackServers];

  const servers = combinedServers;
  const {
    latencies: serverLatencies,
    serverScores,
    isProbing: isProbingServers,
    getMatchingEpisode,
    selectServer: selectSmartServer,
    selectAutomaticServer,
    reportPlaybackSuccess,
    reportPlaybackStarted,
    reportBuffering,
    reportPlaybackFailure,
    failover: failoverStream,
  } = useSmartStreamServer({
    movieSlug: slug,
    servers,
    activeServerIndex,
    activeEpisodeIndex,
    setActiveServerIndex,
    setActiveEpisodeIndex,
    setPlayerType,
  });
  const currentServer = servers[activeServerIndex];
  const episodesData = currentServer?.server_data || [];

  const getServerAudioTrack = (serverName: string) => {
    const normalizedName = serverName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .toLowerCase();
    if (normalizedName.includes("thuyet minh")) return "thuyet-minh";
    if (normalizedName.includes("long tieng")) return "long-tieng";
    return "vietsub";
  };

  const audioTrackLabels: Record<string, string> = {
    vietsub: "Vietsub",
    "long-tieng": "Lồng tiếng",
    "thuyet-minh": "Thuyết minh",
  };
  const availableAudioTracks = Array.from(
    new Set(servers.map((server) => getServerAudioTrack(server.server_name))),
  );
  const serverDisplayLabels = (() => {
    const counts: Record<string, number> = {};
    return servers.map((server) => {
      const audioTrack = getServerAudioTrack(server.server_name);
      counts[audioTrack] = (counts[audioTrack] || 0) + 1;
      return `${audioTrackLabels[audioTrack] || "Vietsub"} · Máy chủ ${counts[audioTrack]}`;
    });
  })();
  const activeAudioTrack = getServerAudioTrack(currentServer?.server_name || "");
  const visibleServerIndexes = servers
    .map((server, serverIndex) => ({ server, serverIndex }))
    .filter(({ server }) => getServerAudioTrack(server.server_name) === activeAudioTrack)
    .map(({ serverIndex }) => serverIndex);
  const recommendedServerIndex = [...visibleServerIndexes].sort(
    (left, right) =>
      (serverScores[left] ?? Number.MAX_SAFE_INTEGER) -
      (serverScores[right] ?? Number.MAX_SAFE_INTEGER),
  )[0] ?? visibleServerIndexes[0] ?? 0;

  const chooseServer = (serverIndex: number, mode: "auto" | "manual") => {
    const episode = getMatchingEpisode(serverIndex);
    if (!episode) return;
    setSourceSelectionMode(mode);
    manualPlayerSelectionKeyRef.current = `${slug}:${serverIndex}:${episode.name || ""}`;
    const streamType = episode.link_m3u8 ? "hls" : "embed";
    if (mode === "auto") {
      selectAutomaticServer(serverIndex, streamType);
    } else {
      selectSmartServer(serverIndex, streamType);
    }
    scrollToPlayer();
  };

  const chooseAudioTrack = (audioTrack: string) => {
    localStorage.setItem("dlowphim_audio_track_preference", audioTrack);
    const matchingIndexes = servers
      .map((server, serverIndex) => ({ server, serverIndex }))
      .filter(({ server }) => getServerAudioTrack(server.server_name) === audioTrack)
      .map(({ serverIndex }) => serverIndex);
    const bestIndex = [...matchingIndexes].sort(
      (left, right) =>
        (serverScores[left] ?? Number.MAX_SAFE_INTEGER) -
        (serverScores[right] ?? Number.MAX_SAFE_INTEGER),
    )[0];
    if (bestIndex !== undefined) chooseServer(bestIndex, "auto");
  };

  const serverPreferenceSignature = servers
    .map((server) => `${server.server_name}:${server.server_data?.length || 0}`)
    .join("|");

  useEffect(() => {
    if (!servers.length) return;
    const preferredTrack = localStorage.getItem("dlowphim_audio_track_preference");
    if (
      preferredTrack !== "vietsub" &&
      preferredTrack !== "long-tieng" &&
      preferredTrack !== "thuyet-minh"
    ) return;
    if (!availableAudioTracks.includes(preferredTrack)) return;
    const preferenceKey = `${slug}:${preferredTrack}:${serverPreferenceSignature}`;
    if (audioPreferenceAppliedRef.current === preferenceKey) return;

    const matchingIndexes = servers
      .map((server, serverIndex) => ({ server, serverIndex }))
      .filter(({ server }) => getServerAudioTrack(server.server_name) === preferredTrack)
      .map(({ serverIndex }) => serverIndex);
    const bestIndex = [...matchingIndexes].sort(
      (left, right) =>
        (serverScores[left] ?? Number.MAX_SAFE_INTEGER) -
        (serverScores[right] ?? Number.MAX_SAFE_INTEGER),
    )[0];
    if (bestIndex === undefined) return;

    audioPreferenceAppliedRef.current = preferenceKey;
    if (bestIndex === activeServerIndex) return;
    const episode = getMatchingEpisode(bestIndex);
    if (!episode) return;
    setSourceSelectionMode("auto");
    selectAutomaticServer(bestIndex, episode.link_m3u8 ? "hls" : "embed");
  }, [
    activeServerIndex,
    availableAudioTracks,
    getMatchingEpisode,
    selectAutomaticServer,
    serverPreferenceSignature,
    serverScores,
    servers,
    slug,
  ]);

  const retryCurrentStream = () => {
    setStreamStatus("loading");
    setPlayerType(activeEpisode?.link_m3u8 ? "hls" : "embed");
    setStreamRetryNonce((nonce) => nonce + 1);
  };

  const chooseAnotherStreamServer = () => {
    const nextServerIndex = servers
      .map((server, serverIndex) => ({ server, serverIndex }))
      .filter(({ server, serverIndex }) =>
        serverIndex !== activeServerIndex &&
        getServerAudioTrack(server.server_name) === activeAudioTrack &&
        Boolean(getMatchingEpisode(serverIndex)?.link_m3u8),
      )
      .sort(
        (left, right) =>
          (serverScores[left.serverIndex] ?? Number.MAX_SAFE_INTEGER) -
          (serverScores[right.serverIndex] ?? Number.MAX_SAFE_INTEGER),
      )[0]?.serverIndex;
    setStreamStatus("recovering");
    if (nextServerIndex !== undefined) {
      chooseServer(nextServerIndex, "manual");
      return;
    }
    if (activeEpisode?.link_embed) {
      setPlayerType("embed");
      return;
    }
    retryCurrentStream();
  };

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
  const formatEpisodeLabel = (episodeName = "") => {
    const normalizedName = episodeName.trim();
    if (!normalizedName) return "";
    if (/^full$/i.test(normalizedName)) return "Full";
    return /^tập\s/i.test(normalizedName) ? normalizedName : `Tập ${normalizedName}`;
  };

  useEffect(() => {
    if (episodesData.length <= 1 || playerType !== "hls") {
      setAutoplayNext(false);
    }
  }, [episodesData.length, playerType]);

  useEffect(() => {
    prefetchedManifestKeyRef.current = "";
  }, [playerType, activeServerIndex, activeEpisode?.name]);

  const hlsPlaybackEvents = useHlsPlaybackTelemetry({
    playbackKey: `${playerType}:${activeServerIndex}:${activeEpisode?.name || ""}`,
    fallbackStartedAtRef: hlsAttemptStartedAtRef,
    reportPlaybackStarted,
    reportBuffering,
    onPlaybackHealthy: () => setStreamStatus("idle"),
  });

  const prefetchNextEpisodeManifest = (currentTime: number, duration: number) => {
    if (
      !activeEpisode ||
      !shouldPrefetchNextManifest(currentTime, duration)
    ) return;
    const nextEpisode = findNextEpisode(sortedEpisodes, activeEpisode.name);
    if (!nextEpisode?.link_m3u8) return;
    const manifestKey = `${activeServerIndex}:${nextEpisode.name}:${nextEpisode.link_m3u8}`;
    if (prefetchedManifestKeyRef.current === manifestKey) return;
    prefetchedManifestKeyRef.current = manifestKey;
    void fetch(nextEpisode.link_m3u8, { cache: "force-cache" })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.text();
      })
      .catch(() => {
        if (prefetchedManifestKeyRef.current === manifestKey) {
          prefetchedManifestKeyRef.current = "";
        }
      });
  };

  useEffect(() => {
    if (playerType !== "hls") return;
    const handleSeekShortcut = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target?.isContentEditable ||
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT"
      ) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      const video = videoRef.current;
      if (!video) return;
      event.preventDefault();
      const delta = event.key === "ArrowLeft" ? -5 : 5;
      const duration = Number.isFinite(video.duration) ? video.duration : Infinity;
      video.currentTime = Math.max(0, Math.min(duration, video.currentTime + delta));
    };
    window.addEventListener("keydown", handleSeekShortcut);
    return () => window.removeEventListener("keydown", handleSeekShortcut);
  }, [playerType]);

  const handleStreamFailure = () => {
    setStreamStatus("recovering");
    const currentTime = videoRef.current?.currentTime || 0;
    if (currentTime > 0) pendingFailoverTimeRef.current = currentTime;
    // Thử HLS cùng ngôn ngữ ở nguồn còn lại trước, rồi mới dùng Embed.
    if (failoverStream()) {
      showToast("HLS nguồn hiện tại lỗi, đã chuyển sang HLS dự phòng cùng ngôn ngữ.", "warning");
      return;
    }
    if (activeEpisode?.link_embed) {
      setPlayerType("embed");
      showToast("Các nguồn HLS phù hợp đều lỗi, đã chuyển sang Embed cùng nguồn.", "warning");
      return;
    }
    setStreamStatus("failed");
    showToast("Các nguồn phát hiện tại đều không phản hồi.", "error");
  };

  // Ưu tiên HLS Player xịn (hls.js + Plyr.js) làm trình phát chính mặc định theo quy chuẩn AGENTS.md
  useEffect(() => {
    if (activeEpisode) {
      const selectionKey = `${slug}:${activeServerIndex}:${activeEpisode.name}`;
      if (manualPlayerSelectionKeyRef.current === selectionKey) return;
      if (activeEpisode.link_m3u8) {
        setPlayerType("hls");
      } else if (activeEpisode.link_embed) {
        setPlayerType("embed");
      }
    }
  }, [activeEpisode?.name, activeServerIndex, slug]);

  // 1.7. Đồng bộ đánh giá theo phim qua Backend
  useEffect(() => {
    if (!movie || !watchExtrasReady) return;

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
  }, [movie, slug, API_URL, watchExtrasReady]);


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

    // Tìm tập có tên khớp với queryEp (chuẩn hóa so sánh Tập 1 vs 1)
    const targetQuery = normalizeEpisodeKey(queryEp);
    const foundIdx = currentServer.server_data.findIndex((ep) => {
      return normalizeEpisodeKey(ep.name) === targetQuery;
    });

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
    let recoveryTimer: ReturnType<typeof setTimeout> | null = null;

    if (playerType === "hls" && activeEpisode?.link_m3u8) {
      setStreamStatus((current) => current === "recovering" ? current : "loading");
      let failureHandled = false;
      let networkRecoveryCount = 0;
      let mediaRecoveryCount = 0;

      const initPlayer = async () => {
        if (!active) return;
        let Hls: any;
        try {
          Hls = await loadHlsLibrary();
        } catch (error) {
          console.warn("[HLS] Không thể tải trình phát, chuyển nguồn dự phòng.", error);
          if (active && !failureHandled) {
            failureHandled = true;
            reportPlaybackFailure("library-load");
            handleStreamFailure();
          }
          return;
        }
        const video = document.getElementById("dlow-hls-video") as HTMLVideoElement;
        if (!video) return;

        // Cleanup previous instances before creating new ones
        if (plyrRef.current) {
          try { plyrRef.current.destroy(); } catch (e) { }
          plyrRef.current = null;
        }
        if (hlsRef.current) {
          destroyHlsInstance(hlsRef.current);
          hlsRef.current = null;
        }

        // Import động Plyr ở Client-side để tránh lỗi SSR "document is not defined"
        const PlyrClass = (await import("plyr")).default;

        if (Hls && Hls.isSupported()) {
          const hls = new Hls(WATCH_HLS_CONFIG);
          hlsAttemptStartedAtRef.current = performance.now();
          hls.loadSource(activeEpisode.link_m3u8);
          hls.attachMedia(video);
          hlsRef.current = hls;

          // Thử tự phục hồi lỗi mạng/media ngắn trước khi chuyển nguồn.
          hls.on(Hls.Events.ERROR, (_event: any, data: any) => {
            if (!active) return;
            if (data && data.fatal && !failureHandled) {
              if (
                data.type === Hls.ErrorTypes.NETWORK_ERROR &&
                networkRecoveryCount < 2
              ) {
                networkRecoveryCount += 1;
                recoveryTimer = setTimeout(
                  () => {
                    if (!active) return;
                    if (
                      data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR ||
                      data.details === Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT ||
                      data.details === Hls.ErrorDetails.MANIFEST_PARSING_ERROR
                    ) {
                      hls.loadSource(activeEpisode.link_m3u8);
                    } else {
                      hls.startLoad();
                    }
                  },
                  networkRecoveryCount * 600,
                );
                return;
              }
              if (
                data.type === Hls.ErrorTypes.MEDIA_ERROR &&
                mediaRecoveryCount < 1
              ) {
                mediaRecoveryCount += 1;
                hls.recoverMediaError();
                return;
              }
              failureHandled = true;
              console.warn("[HLS] Fatal playback error, switching source...", data);
              reportPlaybackFailure(`${data?.type || "unknown"}:${data?.details || "fatal"}`);
              if (hlsRef.current === hls) hlsRef.current = null;
              destroyHlsInstance(hls);
              handleStreamFailure();
            }
          });

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (!active) return;
            const manifestLatency = Math.max(
              1,
              Math.round(performance.now() - hlsAttemptStartedAtRef.current)
            );
            reportPlaybackSuccess(manifestLatency);
            networkRecoveryCount = 0;
            mediaRecoveryCount = 0;

            // Đọc vị trí xem trước đó
            let savedTime = 0;
            try {
              let savedItem = null;
              if (user && user.watchHistory) {
                savedItem = findEpisodeHistory(user.watchHistory, slug, activeEpisode.name);
              } else {
                const localHist = JSON.parse(localStorage.getItem("dlowphim_history") || "[]");
                savedItem = findEpisodeHistory(localHist, slug, activeEpisode.name);
              }
              savedTime = getResumeTime(savedItem, pendingFailoverTimeRef.current);
              if (pendingFailoverTimeRef.current > 0) {
                pendingFailoverTimeRef.current = 0;
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
                prefetchNextEpisodeManifest(
                  plyrInstance.currentTime,
                  plyrInstance.duration,
                );
                const now = Date.now();
                if (now - lastHistorySavedTime.current > 15000) {
                  saveWatchHistory(plyrInstance.currentTime, plyrInstance.duration);
                  lastHistorySavedTime.current = now;
                }
              });

              plyrInstance.on("pause", () => {
                saveWatchHistory(plyrInstance.currentTime, plyrInstance.duration, true);
              });
            };

            const qualityOptions = Array.from(
              new Set<number>(
                hls.levels
                  .map((level: any) => Number(level.height))
                  .filter((height: number) => Number.isFinite(height) && height > 0),
              ),
            ).sort((left, right) => right - left);
            const savedQuality = Number(localStorage.getItem("dlowphim_hls_quality") || 0);
            const defaultQuality = qualityOptions.includes(savedQuality) ? savedQuality : 0;
            const changeQuality = (height: number) => {
              localStorage.setItem("dlowphim_hls_quality", String(height));
              if (height === 0) {
                hls.currentLevel = -1;
                hls.nextLevel = -1;
                return;
              }
              const matchingLevels = hls.levels
                .map((level: any, index: number) => ({
                  index,
                  height: Number(level.height),
                  bitrate: Number(level.bitrate) || 0,
                }))
                .filter((level: any) => level.height === height)
                .sort((left: any, right: any) => right.bitrate - left.bitrate);
              hls.currentLevel = matchingLevels[0]?.index ?? -1;
            };

            // Khởi tạo trình phát Plyr
            const player = new PlyrClass(video, {
              controls: [
                "play-large", "rewind", "play", "fast-forward", "progress", "current-time",
                "duration", "mute", "volume", "settings", "pip", "fullscreen"
              ],
              seekTime: 5,
              keyboard: { focused: false, global: false },
              settings: ["quality", "speed"],
              quality: {
                default: defaultQuality,
                options: [0, ...qualityOptions],
                forced: true,
                onChange: changeQuality,
              },
              speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 2] },
              i18n: {
                play: "Phát",
                pause: "Tạm dừng",
                mute: "Tắt tiếng",
                unmute: "Bật tiếng",
                settings: "Cài đặt",
                speed: "Tốc độ",
                normal: "Bình thường",
                quality: "Chất lượng",
                rewind: "Lùi {seektime} giây",
                fastForward: "Tiến {seektime} giây",
                qualityLabel: { 0: "Tự động" },
              }
            });

            plyrRef.current = player;
            changeQuality(defaultQuality);
            setupEvents(player, savedTime);
          });

          hls.on(Hls.Events.FRAG_LOADED, () => {
            networkRecoveryCount = 0;
          });
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
          // Dành cho Safari gốc
          hlsAttemptStartedAtRef.current = performance.now();
          video.src = activeEpisode.link_m3u8;
          video.addEventListener("error", () => {
            reportPlaybackFailure("native-network-error");
            handleStreamFailure();
          }, { once: true });
          video.addEventListener(
            "loadedmetadata",
            () => {
              reportPlaybackSuccess(
                Math.max(1, Math.round(performance.now() - hlsAttemptStartedAtRef.current))
              );
            },
            { once: true }
          );

          let savedTime = 0;
          try {
            let savedItem = null;
            if (user && user.watchHistory) {
              savedItem = findEpisodeHistory(user.watchHistory, slug, activeEpisode.name);
            } else {
              const localHist = JSON.parse(localStorage.getItem("dlowphim_history") || "[]");
              savedItem = findEpisodeHistory(localHist, slug, activeEpisode.name);
            }
            savedTime = getResumeTime(savedItem, pendingFailoverTimeRef.current);
            if (pendingFailoverTimeRef.current > 0) {
              pendingFailoverTimeRef.current = 0;
            }
          } catch (e) { }

          const player = new PlyrClass(video, {
            controls: [
              "play-large", "rewind", "play", "fast-forward", "progress", "current-time",
              "duration", "mute", "volume", "settings", "pip", "fullscreen"
            ],
            seekTime: 5,
            keyboard: { focused: false, global: false },
            settings: ["speed"],
            speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 2] },
          });
          plyrRef.current = player;

          // Lắng nghe sự kiện để lưu lịch sử cho Safari
          if (savedTime > 0) {
            player.once("canplay", () => {
              player.currentTime = savedTime;
            });
          }
          player.on("timeupdate", () => {
            prefetchNextEpisodeManifest(player.currentTime, player.duration);
            const now = Date.now();
            if (now - lastHistorySavedTime.current > 15000) {
              saveWatchHistory(player.currentTime, player.duration);
              lastHistorySavedTime.current = now;
            }
          });
          player.on("pause", () => {
            saveWatchHistory(player.currentTime, player.duration, true);
          });
        }
      };

      void initPlayer();
    }

    return () => {
      active = false;
      if (recoveryTimer) clearTimeout(recoveryTimer);
      if (plyrRef.current) {
        try { plyrRef.current.destroy(); } catch (e) { }
        plyrRef.current = null;
      }
      if (hlsRef.current) {
        destroyHlsInstance(hlsRef.current);
        hlsRef.current = null;
      }
    };
  }, [playerType, activeEpisode?.link_m3u8, activeEpisode?.name, activeServerIndex, movie?.slug, streamRetryNonce]);

  // 3. Fetch phim liên quan
  useEffect(() => {
    if (!watchExtrasReady || !movie || !movie.category || movie.category.length === 0) return;

    const movieSlug = movie.slug;
    const genreSlug = movie.category[0].slug;
    const controller = new AbortController();

    async function fetchRelated() {
      try {
        setLoadingRelated(true);
        const res = await fetch(
          getProxyUrl(`${MOVIE_API_DOMAIN}/v1/api/the-loai/${genreSlug}?page=1`),
          { signal: controller.signal },
        );
        const data = await res.json();

        if (data.status === true || data.status === "success") {
          const items = data.data?.items || data.items || [];
          const filtered = items.filter((item: any) => item.slug !== movieSlug).slice(0, 7);
          setRelatedMovies(filtered);
        }
      } catch (err) {
        if (!controller.signal.aborted) console.error("Lỗi lấy phim liên quan:", err);
      } finally {
        if (!controller.signal.aborted) setLoadingRelated(false);
      }
    }

    fetchRelated();
    return () => controller.abort();
  }, [movie, watchExtrasReady]);

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

  const saveWatchHistory = async (
    currentTime: number,
    duration: number,
    forceDatabase = false,
    progressMode: "exact" | "embed" = "exact",
  ) => {
    if (!movie || !activeEpisode) return;

    const historyItem = {
      movieSlug: movie.slug,
      movieName: cleanMovieName(movie.name),
      episodeName: activeEpisode.name,
      episodeKey: normalizeEpisodeKey(activeEpisode.name),
      currentTime: Math.floor(currentTime),
      duration: Math.floor(duration),
      progressMode,
      updatedAt: new Date().toISOString(),
    };

    // Cập nhật state runtime (cả user.watchHistory và localStorage) thông qua AuthContext
    updateWatchHistory(historyItem);
    pendingHistoryRef.current = historyItem;

    // Keep local progress responsive, but throttle database writes to 20 seconds.
    const shouldSyncDatabase =
      forceDatabase || Date.now() - lastDatabaseHistorySyncRef.current >= 20_000;
    if (user && shouldSyncDatabase) {
      try {
        const token = Cookies.get("token");
        const response = await fetch(`${API_URL}/auth/history/update`, {
          method: "POST",
          keepalive: forceDatabase,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(historyItem),
        });
        if (response.ok) {
          lastDatabaseHistorySyncRef.current = Date.now();
          if (pendingHistoryRef.current === historyItem) {
            pendingHistoryRef.current = null;
          }
        }
      } catch (err) {
        console.error("Lỗi đồng bộ lịch sử xem:", err);
      }
    }
  };

  useEffect(() => {
    const flushPendingHistory = () => {
      const pendingItem = pendingHistoryRef.current;
      if (!user || !pendingItem) return;
      const token = Cookies.get("token");
      if (!token) return;
      void fetch(`${API_URL}/auth/history/update`, {
        method: "POST",
        keepalive: true,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(pendingItem),
      });
      pendingHistoryRef.current = null;
      lastDatabaseHistorySyncRef.current = Date.now();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") flushPendingHistory();
    };
    window.addEventListener("pagehide", flushPendingHistory);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      flushPendingHistory();
      window.removeEventListener("pagehide", flushPendingHistory);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [API_URL, user]);

  // Embed is cross-origin: record the latest episode, but never invent precise progress.
  const embedProgressRef = React.useRef<number>(0);
  useEffect(() => {
    if (playerType !== "embed" || !movie || !activeEpisode) return;

    // Đọc vị trí xem trước đó để làm điểm xuất phát đếm tiếp
    let savedTime = 0;
    try {
      let savedItem = null;
      if (user && user.watchHistory) {
        savedItem = findEpisodeHistory(user.watchHistory, slug, activeEpisode.name);
      } else {
        const localHist = JSON.parse(localStorage.getItem("dlowphim_history") || "[]");
        savedItem = findEpisodeHistory(localHist, slug, activeEpisode.name);
      }
      savedTime = getResumeTime(savedItem);
    } catch (e) {
      console.error("Lỗi đọc lịch sử cũ cho embed:", e);
    }

    embedProgressRef.current = savedTime;
    void saveWatchHistory(savedTime, 0, false, "embed");
  }, [playerType, activeEpisode?.name, movie?.slug]);

  const handleHlsVideoEnded = () => {
    if (autoplayNext) {
      const nextEp = findNextEpisode(sortedEpisodes, activeEpisode?.name || "");
      if (nextEp) {
        handleSelectEpisode(nextEp.name);
        scrollToPlayer();
      }
    }
  };

  // Thay đổi tập phim khi click -> push query mới lên url
  const handleSelectEpisode = (episodeName: string) => {
    const video = videoRef.current;
    if (playerType === "hls" && video && Number.isFinite(video.duration)) {
      void saveWatchHistory(video.currentTime, video.duration, true);
    } else if (playerType === "embed" && activeEpisode) {
      void saveWatchHistory(embedProgressRef.current, 0, true, "embed");
    }
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
        <ProgressiveImage
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
            Bạn đang xem: {cleanedName} {activeEpisode ? ` - ${formatEpisodeLabel(activeEpisode.name)}` : ""}
          </span>
        </div>

        {/* 1. TRÌNH PHÁT VIDEO CHÍNH (VIDEO PLAYER SECTION) */}
        <div
          id="watch-player-section"
          className={`transition-all duration-300 ${
            cinemaMode
              ? "fixed inset-0 z-[80] flex flex-col justify-center gap-3 overflow-hidden bg-black/95 px-3 py-3 md:px-6 md:py-5"
              : "space-y-4"
          }`}
        >
          <div
            className={`flex items-center justify-between gap-3 ${cinemaMode ? "relative z-50 mx-auto w-full" : "pb-2.5"}`}
            style={cinemaMode ? { maxWidth: "min(96vw, 145vh)" } : undefined}
          >
            <div className="flex items-center gap-2 text-left">
              <Film size={18} className="text-pink-500" />
              <h3 className="text-base md:text-lg font-bold uppercase tracking-tight">
                Đang phát: {cleanedName} {activeEpisode ? `(${formatEpisodeLabel(activeEpisode.name)})` : ""}
              </h3>
            </div>

            <button
              onClick={() => setCinemaMode(!cinemaMode)}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg border-none transition-all cursor-pointer flex items-center gap-1.5 ${cinemaMode
                  ? "bg-pink-500 text-white shadow-md shadow-pink-500/20 z-50"
                  : "bg-[#1b1d2a] text-zinc-400 hover:text-white"
                }`}
            >
              <span>{cinemaMode ? "Thoát chế độ rạp" : "Chế Độ Rạp Chiếu"}</span>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded leading-none transition-all ${cinemaMode
                  ? "text-white bg-white/20"
                  : "text-zinc-500 bg-[#252839]"
                }`}>
                {cinemaMode ? "ON" : "OFF"}
              </span>
            </button>
          </div>

          {/* Ambient Glow Wrapper */}
          <div
            className={`relative z-10 ${cinemaMode ? "mx-auto w-full" : "w-full"}`}
            style={cinemaMode ? { maxWidth: "min(96vw, 145vh)" } : undefined}
          >
            {/* Ambient Image Glow (Philips Ambilight / Ambient Mode style) */}
            <div className="absolute -inset-4 z-0 pointer-events-none select-none overflow-hidden blur-[60px] opacity-40 scale-[1.04] rounded-[32px] transition-opacity duration-500">
              <ProgressiveImage
                src={tmdbBackdrop || getImageUrl(movie.poster_url || movie.thumb_url)}
                alt=""
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>

            {/* Unified Movie Player Frame + Action Bar Container with soft shadow, no border */}
            <div
              className={`w-full overflow-hidden bg-black rounded-2xl md:rounded-3xl shadow-[0_15px_45px_rgba(0,0,0,0.85)] transition-all duration-300 relative z-10 ${cinemaMode
                  ? "shadow-pink-500/10"
                  : ""
                }`}
            >
            {/* Player Container */}
            <div className="relative w-full aspect-video bg-black overflow-hidden group">
              {playerType === "embed" ? (
                activeEmbed ? (
                  <EmbedCompatibilityPlayer
                    src={activeEmbed}
                    onLoad={() => {
                      setPlayerReady(true);
                      setStreamStatus("idle");
                    }}
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
                  <div key={`hls-player-wrap-${activeEpisode.name}-${activeServerIndex}`} className="w-full h-full">
                    <video
                      id="dlow-hls-video"
                      ref={videoRef}
                      playsInline
                      controls
                      onCanPlay={() => {
                        setPlayerReady(true);
                        setStreamStatus("idle");
                      }}
                      onPlay={hlsPlaybackEvents.onPlay}
                      onPlaying={hlsPlaybackEvents.onPlaying}
                      onWaiting={hlsPlaybackEvents.onWaiting}
                      onStalled={hlsPlaybackEvents.onWaiting}
                      onEnded={handleHlsVideoEnded}
                      className="w-full h-full bg-black"
                      title="DlowPhim HLS Video Player"
                    />
                  </div>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-zinc-900">
                    <Tv size={44} className="text-zinc-650 animate-pulse" />
                    <p className="text-zinc-500 text-xs font-bold">Nguồn HLS không khả dụng cho tập này!</p>
                  </div>
                )
              )}

              {(streamStatus === "recovering" || streamStatus === "failed") && (
                <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/85 px-5 text-center backdrop-blur-sm">
                  <div className="max-w-sm space-y-4">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-amber-400/30 bg-amber-400/10">
                      {streamStatus === "recovering" ? (
                        <Loader2 className="animate-spin text-amber-400" size={24} />
                      ) : (
                        <Tv className="text-amber-400" size={24} />
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <h4 className="text-lg font-black text-white">
                        Máy chủ đang gián đoạn
                      </h4>
                      <p className="text-sm font-semibold text-zinc-400">
                        {streamStatus === "recovering"
                          ? "Đang thử máy chủ dự phòng..."
                          : "Không thể kết nối với các nguồn phát hiện tại."}
                      </p>
                    </div>
                    {streamStatus === "failed" && (
                      <div className="flex flex-wrap justify-center gap-2.5">
                        <button
                          type="button"
                          onClick={retryCurrentStream}
                          className="rounded-xl bg-pink-500 px-4 py-2.5 text-xs font-black text-white transition-colors hover:bg-pink-400"
                        >
                          Thử lại
                        </button>
                        <button
                          type="button"
                          onClick={chooseAnotherStreamServer}
                          className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-xs font-black text-white transition-colors hover:bg-zinc-800"
                        >
                          Đổi máy chủ
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Hover Overlay kiểu CobePhim */}
              <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-in-out p-4 flex items-center justify-between pointer-events-none z-30 select-none">
                {/* Cột trái: Tên phim, phần và tập */}
                <div className="flex flex-col text-left pointer-events-auto">
                  <h4 className="text-sm md:text-base font-extrabold text-white tracking-tight leading-tight">{cleanedName}</h4>
                  {episodesData.length > 1 && activeEpisode && (
                    <p className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider mt-0.5">
                      {formatEpisodeLabel(activeEpisode.name)}
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
                          const serverIndex = parseInt(e.target.value, 10);
                          chooseServer(serverIndex, "manual");
                        }}
                        className="bg-[#1b1d2a] border border-zinc-800 text-zinc-200 text-xs rounded-lg px-2.5 py-1 focus:outline-none focus:border-pink-500 font-extrabold cursor-pointer"
                      >
                        {servers.map((_, idx) => (
                          <option key={`drawer-server-opt-${idx}`} value={idx}>
                            {serverDisplayLabels[idx] || `Máy chủ ${idx + 1}`}
                          </option>
                        ))}
                      </select>
                    </div>
                    {activeEpisode && (
                      <span className="text-xs text-zinc-500 font-semibold">{formatEpisodeLabel(activeEpisode.name)}</span>
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
                          <span className="text-xs font-bold truncate">{formatEpisodeLabel(ep.name)}</span>
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
              <div className={`w-full bg-[#0d0e13]/90 px-3 py-2 md:py-2.5 flex flex-wrap items-center justify-between gap-3 text-[11px] md:text-xs select-none border-b border-zinc-900/40 ${cinemaMode ? "rounded-b-2xl" : ""}`}>
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

                  {episodesData.length > 1 && playerType === "hls" && (
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
                  )}


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
                  src={tmdbPoster || getImageUrl(movie.poster_url || movie.thumb_url)}
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
              <MovieReleaseStatus
                slug={movie.slug}
                title={movie.name}
                originTitle={movie.origin_name}
                movieType={movie.type}
                movieStatus={movie.status}
                episodeCurrent={movie.episode_current}
                episodeTotal={movie.episode_total}
                tmdbId={movie.tmdb?.id}
                tmdbType={movie.tmdb?.type}
                compact
                delayMs={1500}
              />

              {/* Chọn bản dịch và máy chủ; tên nhà cung cấp/công nghệ chỉ dùng nội bộ. */}
              {servers.length > 0 && (
                <div className="space-y-4">
                  <div className="space-y-2.5">
                    <span className="block text-xs font-black text-zinc-455 uppercase tracking-wider">
                      Chọn bản dịch:
                      <span className="ml-2 normal-case text-[10px] font-semibold text-zinc-600">
                        Tự động ghi nhớ lựa chọn
                      </span>
                    </span>
                    <div className="flex flex-wrap gap-2.5">
                      {availableAudioTracks.map((audioTrack) => (
                        <button
                          key={`audio-track-${audioTrack}`}
                          onClick={() => chooseAudioTrack(audioTrack)}
                          className={`px-4 py-2 text-xs font-black rounded-xl transition-all border-none cursor-pointer ${
                            activeAudioTrack === audioTrack
                              ? "bg-pink-500 text-white shadow-md shadow-pink-500/20"
                              : "bg-[#1b1d2a] text-[#a0a5c0] hover:bg-zinc-800 hover:text-white"
                          }`}
                        >
                          {audioTrackLabels[audioTrack] || "Vietsub"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <span className="block text-xs font-black text-zinc-455 uppercase tracking-wider">
                      Chọn máy chủ:
                    {isProbingServers && (
                      <span className="ml-2 normal-case text-[10px] text-emerald-400">
                          Đang chọn máy chủ tốt nhất...
                      </span>
                    )}
                    </span>
                    <div className="flex flex-wrap gap-2.5">
                      <button
                        onClick={() => chooseServer(recommendedServerIndex, "auto")}
                        className={`px-4 py-2 text-xs font-black rounded-xl transition-all border-none cursor-pointer ${
                          sourceSelectionMode === "auto"
                            ? "bg-pink-500 text-white shadow-md shadow-pink-500/20"
                            : "bg-[#1b1d2a] text-[#a0a5c0] hover:bg-zinc-800 hover:text-white"
                        }`}
                      >
                        Tự động · Đề xuất
                      </button>
                      {visibleServerIndexes.map((serverIndex, visibleIndex) => (
                        <button
                          key={`friendly-server-${serverIndex}`}
                          onClick={() => chooseServer(serverIndex, "manual")}
                          className={`px-4 py-2 text-xs font-black rounded-xl transition-all border-none cursor-pointer ${
                            sourceSelectionMode === "manual" && activeServerIndex === serverIndex
                              ? "bg-pink-500 text-white shadow-md shadow-pink-500/20"
                              : "bg-[#1b1d2a] text-[#a0a5c0] hover:bg-zinc-800 hover:text-white"
                          }`}
                        >
                          Máy chủ {visibleIndex + 1}
                        </button>
                      ))}
                    </div>
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
            {watchExtrasReady ? (
              <CommentRatingSection
                slug={slug}
                title="Bình luận"
                episodeLabel={activeEpisode && episodesData.length > 1 ? `P.1 - ${formatEpisodeLabel(activeEpisode.name)}` : undefined}
                showTabs={false}
              />
            ) : (
              <div id="movie-comments" className="pt-6 border-t border-zinc-900/60 space-y-3 animate-pulse">
                <div className="h-5 w-32 rounded bg-zinc-900" />
                <div className="h-24 rounded-2xl bg-zinc-950/60" />
              </div>
            )}
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
            {(tmdbCredits.length > 0 || (movie.actor && movie.actor.filter(a => a && a.trim() && a !== "Đang cập nhật").length > 0)) && (
              <div className="space-y-4">
                <h3 className="text-sm font-black text-zinc-455 uppercase tracking-widest border-b border-zinc-900 pb-2.5">
                  Diễn viên
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  {tmdbCredits.length > 0 ? (
                    tmdbCredits.slice(0, 6).map((actor, idx) => (
                      <div
                        key={`actor-watch-tmdb-${actor.id || idx}`}
                        onClick={() => router.push(`/search?keyword=${encodeURIComponent(actor.name)}`)}
                        className="flex flex-col items-center text-center gap-1.5 cursor-pointer group"
                        title={`Tìm phim của ${actor.name}`}
                      >
                        <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 bg-zinc-800 border border-pink-500/30 group-hover:border-pink-500 flex items-center justify-center font-black text-xs text-white shadow transition-all group-hover:scale-105">
                          {actor.profileUrl ? (
                            <img src={actor.profileUrl} alt={actor.name} className="w-full h-full object-cover" />
                          ) : (
                            actor.name[0].toUpperCase()
                          )}
                        </div>
                        <span className="text-[10px] font-extrabold text-[#a0a5c0] group-hover:text-pink-400 truncate w-full transition-colors">{actor.name}</span>
                        <span className="text-[8px] font-semibold text-zinc-400 truncate w-full">{actor.character || "Diễn viên"}</span>
                      </div>
                    ))
                  ) : (
                    movie.actor.filter(a => a && a.trim() && a !== "Đang cập nhật").slice(0, 6).map((actor, idx) => (
                      <div
                        key={`actor-watch-${idx}`}
                        onClick={() => router.push(`/search?keyword=${encodeURIComponent(actor)}`)}
                        className="flex flex-col items-center text-center gap-1 cursor-pointer group"
                      >
                        <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 bg-zinc-800 flex items-center justify-center font-black text-xs text-white shadow bg-gradient-to-tr from-pink-500/20 to-rose-500/10 group-hover:scale-105 transition-transform">
                          {actor[0].toUpperCase()}
                        </div>
                        <span className="text-[10px] font-extrabold text-[#a0a5c0] group-hover:text-pink-400 truncate w-full transition-colors">{actor}</span>
                      </div>
                    ))
                  )}
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
                    onChange={(e) => setReportDescription(e.target.value.slice(0, 500))}
                    className="w-full bg-zinc-950 border border-zinc-900 rounded-xl p-3 text-xs text-zinc-200 focus:outline-none focus:border-pink-500/50 placeholder-zinc-650 resize-none"
                  />
                  <div className="flex justify-end">
                    <span className="text-[8px] font-bold text-zinc-600">{reportDescription.length}/500 ký tự</span>
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
