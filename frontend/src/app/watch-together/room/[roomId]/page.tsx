"use client";

export const dynamic = "force-dynamic";

import React, { useCallback, useEffect, useState, useRef } from "react";
import Image from "next/image";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Film, Send, Sparkles, MessageSquare, Users, Trash2, Calendar, Tv, Volume2, AlertCircle, Copy, Check, Bot, Clock, VideoOff, VolumeX, Maximize, Minimize, LockKeyhole, KeyRound } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import Cookies from "js-cookie";
import { cleanMovieName, getImageUrl } from "@/utils/movieUtils";
import { getProxyUrl, MOVIE_API_DOMAIN } from "@/utils/api";
import EpisodeSelector from "@/components/EpisodeSelector";
import { io } from "socket.io-client";
import HalftoneOverlay from "@/components/HalftoneOverlay";
import { loadHlsLibrary } from "@/utils/hlsLoader";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

const getGuestDeviceId = () => {
  const storageKey = "dlowphim_guest_device_id";
  try {
    const existing = localStorage.getItem(storageKey);
    if (existing) return existing;
    const created = globalThis.crypto?.randomUUID?.() || `device-${Date.now()}`;
    localStorage.setItem(storageKey, created);
    return created;
  } catch {
    return "";
  }
};

interface RoomDetails {
  roomId: string;
  movieSlug: string;
  movieName: string;
  moviePoster: string;
  roomName: string;
  posterOption: string;
  isAutoStart: boolean;
  startTime?: string;
  startedAt?: string;
  startedBy?: "schedule" | "host";
  status: "scheduled" | "live" | "closed" | "active";
  serverTime?: string;
  isPrivate: boolean;
  host: { _id: string; name?: string; displayName?: string; email: string; avatar?: string };
}

interface Message {
  id: string;
  sender: string;
  senderId?: string;
  avatar?: string;
  text: string;
  time: string;
  createdAt?: string;
  isSystem?: boolean;
}

interface Episode {
  name: string;
  slug: string;
  filename: string;
  link_embed: string;
  link_m3u8: string;
}

interface RemoteVideoState {
  action: "play" | "pause" | "seek";
  currentTime: number;
  serverTime?: number;
  episodeIndex?: number;
  episodeSlug?: string;
}

export default function RoomPage() {
  const router = useRouter();
  const { roomId } = useParams();
  const { user, loading: authLoading } = useAuth();

  const [room, setRoom] = useState<RoomDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [socketError, setSocketError] = useState<string | null>(null);
  const [streamNotice, setStreamNotice] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [isAiActive, setIsAiActive] = useState(false);
  const [privateAccessRequired, setPrivateAccessRequired] = useState(false);
  const [privatePin, setPrivatePin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [verifyingPin, setVerifyingPin] = useState(false);
  const [accessRevision, setAccessRevision] = useState(0);
  const [hostPrivatePin, setHostPrivatePin] = useState("");

  // Custom modal states (thay thế alert/confirm của trình duyệt)
  const [roomClosedModal, setRoomClosedModal] = useState(false);
  const [confirmCloseModal, setConfirmCloseModal] = useState(false);
  const [errorModal, setErrorModal] = useState<string | null>(null);

  // States quản lý đếm ngược công chiếu cho member
  const [hasMovieStarted, setHasMovieStarted] = useState(false);
  const [countdownText, setCountdownText] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showMemberControls, setShowMemberControls] = useState(true);
  const memberControlsTimeoutRef = useRef<any>(null);

  // States quản lý nhắc nhở chủ phòng
  const [reminderToast, setReminderToast] = useState<string | null>(null);
  const [hasUrgedHost, setHasUrgedHost] = useState(false);

  const clearMemberControlsTimer = () => {
    if (memberControlsTimeoutRef.current) {
      clearTimeout(memberControlsTimeoutRef.current);
      memberControlsTimeoutRef.current = null;
    }
  };

  const scheduleMemberControlsHide = () => {
    clearMemberControlsTimer();
    memberControlsTimeoutRef.current = setTimeout(() => {
      setShowMemberControls(false);
      memberControlsTimeoutRef.current = null;
    }, 3500);
  };

  const handleMemberMouseMove = () => {
    setShowMemberControls(true);
    scheduleMemberControlsHide();
  };

  useEffect(() => () => clearMemberControlsTimer(), []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFull = !!(
        document.fullscreenElement ||
        (document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement
      );
      setIsFullscreen(isFull);
      setShowMemberControls(true);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
    };
  }, []);

  // Hiển thị countdown theo đồng hồ server; backend mới là nguồn quyết định lúc bắt đầu.
  useEffect(() => {
    if (!room) return;
    if (room.status === "live" || room.status === "active" || room.startedAt) {
      setHasMovieStarted(true);
      setCountdownText("");
      return;
    }
    setHasMovieStarted(false);
    if (!room.startTime) return;

    const startTimeMs = new Date(room.startTime).getTime();
    const serverOffset = room.serverTime
      ? new Date(room.serverTime).getTime() - Date.now()
      : 0;
    const updateCountdown = () => {
      const diff = startTimeMs - (Date.now() + serverOffset);
      if (diff <= 0) {
        setCountdownText("Đang chờ Trưởng phòng...");
        return;
      }
      const hrs = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);

      let text = "";
      if (hrs > 0) text += `${hrs} giờ `;
      text += `${mins} phút ${secs} giây`;
      setCountdownText(text);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [room]);

  const handleToggleAi = () => {
    if (!socketRef.current || !room) return;
    const nextState = !isAiActive;
    socketRef.current.emit("toggle_ai", {
      roomId: room.roomId,
      active: nextState,
      userName: user?.displayName || "Khách",
    });
  };

  // Movie stream states
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [activeEpisodeIndex, setActiveEpisodeIndex] = useState(0);
  const [playerType, setPlayerType] = useState<"hls" | "embed">("hls");

  // Chat/Messages states
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [viewerCount, setViewerCount] = useState(1);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);

  // Refs for players and socket
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<any>(null);
  const socketRef = useRef<any>(null);
  const isSyncingRef = useRef<boolean>(false);
  const pendingVideoStateRef = useRef<RemoteVideoState | null>(null);
  const latestRemoteStateRef = useRef<RemoteVideoState | null>(null);
  const isBufferingRef = useRef(false);
  const serverClockOffsetRef = useRef(0);
  const activeEpisodeIndexRef = useRef(0);
  const episodesRef = useRef<Episode[]>([]);
  const hlsNetworkRetriesRef = useRef(0);
  const hlsMediaRetriesRef = useRef(0);
  const playerContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    activeEpisodeIndexRef.current = activeEpisodeIndex;
    episodesRef.current = episodes;
  }, [activeEpisodeIndex, episodes]);

  // States quản lý chiều cao đồng bộ giữa trình phát và chatbox
  const [playerHeight, setPlayerHeight] = useState<number>(550);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    checkDesktop();
    window.addEventListener("resize", checkDesktop);
    return () => window.removeEventListener("resize", checkDesktop);
  }, []);

  useEffect(() => {
    if (!room) return;
    const updateHeight = () => {
      const el = playerContainerRef.current;
      if (el) {
        setPlayerHeight(el.clientHeight);
      }
    };

    updateHeight();
    window.addEventListener("resize", updateHeight);

    let observer: ResizeObserver | null = null;
    if (typeof window !== "undefined" && "ResizeObserver" in window) {
      observer = new ResizeObserver(() => {
        updateHeight();
      });
      const el = playerContainerRef.current;
      if (el) observer.observe(el);
    }

    const timer = setTimeout(updateHeight, 600);
    return () => {
      window.removeEventListener("resize", updateHeight);
      if (observer) observer.disconnect();
      clearTimeout(timer);
    };
  }, [room, episodes, playerType]);

  // Lấy thông tin phòng và danh sách tập phim
  useEffect(() => {
    if (!roomId) return;

    async function fetchRoomAndMovie() {
      try {
        setLoading(true);
        // 1. Lấy chi tiết phòng
        const authToken = Cookies.get("token");
        const roomAccessToken = sessionStorage.getItem(
          `dlowphim_room_access:${roomId}`
        );
        const accessHeaders: Record<string, string> = {};
        if (authToken) accessHeaders.Authorization = `Bearer ${authToken}`;
        if (roomAccessToken) accessHeaders["X-Room-Access-Token"] = roomAccessToken;
        const guestDeviceId = getGuestDeviceId();
        if (guestDeviceId) accessHeaders["X-Guest-Device-Id"] = guestDeviceId;
        const roomRes = await fetch(`${API_URL}/rooms/${roomId}`, {
          headers: accessHeaders,
        });
        if (roomRes.status === 403) {
          const accessError = await roomRes.json().catch(() => null);
          if (accessError?.requiresPin || accessError?.message) {
            sessionStorage.removeItem(`dlowphim_room_access:${roomId}`);
            const statusResponse = await fetch(
              `${API_URL}/rooms/${roomId}/access-status`,
              { headers: accessHeaders },
            );
            const accessStatus = await statusResponse.json().catch(() => null);
            if (accessStatus?.locked) {
              router.replace("/watch-together?private=locked");
              return;
            }
            setPrivateAccessRequired(true);
            setPinError(null);
            setLoading(false);
            return;
          }
        }
        if (!roomRes.ok) {
          throw new Error("Phòng xem chung không tồn tại hoặc đã bị đóng.");
        }
        const roomData = await roomRes.json();
        if (roomData.serverTime) {
          serverClockOffsetRef.current =
            new Date(roomData.serverTime).getTime() - Date.now();
        }
        setRoom(roomData);
        setPrivateAccessRequired(false);
        if (roomData.isPrivate) {
          setHostPrivatePin(
            sessionStorage.getItem(`dlowphim_room_pin:${roomId}`) || ""
          );
        }

        // 2. Khởi tạo tin nhắn chào mừng hệ thống & nạp lịch sử chat từ database
        const welcomeMsg: Message = {
          id: "sys-welcome",
          sender: "Hệ Thống",
          text: `📢 Chào mừng bạn đến với phòng xem chung "${roomData.roomName}". Cùng xem phim vui vẻ nhé!`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isSystem: true,
        };

        try {
          const messagesRes = await fetch(`${API_URL}/rooms/${roomId}/messages`, {
            headers: accessHeaders,
          });
          if (messagesRes.ok) {
            const msgsData = await messagesRes.json();
            const formattedMsgs = msgsData.map((m: any) => ({
              id: m._id,
              sender: m.senderName,
              senderId: m.sender,
              avatar: m.senderAvatar,
              text: m.text,
              isSystem: m.isSystem,
              time: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              createdAt: m.createdAt,
            }));
            setMessages([welcomeMsg, ...formattedMsgs]);
          } else {
            setMessages([welcomeMsg]);
          }
        } catch (msgErr) {
          console.error("Lỗi lấy lịch sử chat:", msgErr);
          setMessages([welcomeMsg]);
        }

        // MỞ KHÓA LOADING NGAY TẠI ĐÂY: Cho phép Socket.io kết nối ngay lập tức!
        setLoading(false);

        const handleLoadEpisodes = (episodesList: any[]) => {
          setEpisodes(episodesList);

          // Tìm tập phim đang phát đã lưu trên database hoặc trên URL để khôi phục
          const urlParams = new URLSearchParams(window.location.search);
          const queryEp = urlParams.get("ep");
          const epSlug = queryEp || roomData.currentEpisode;

          const matchedIndex = epSlug
            ? episodesList.findIndex((ep: any) => ep.slug === epSlug)
            : -1;
          const resolvedIndex = matchedIndex !== -1 ? matchedIndex : 0;
          const selectedEpisode = episodesList[resolvedIndex];
          setActiveEpisodeIndex(resolvedIndex);

          // Chọn player theo đúng tập đang mở, không dựa vào HLS của tập khác.
          setPlayerType(selectedEpisode?.link_m3u8 ? "hls" : "embed");
        };

        const fetchCustomMovie = async (slug: string) => {
          try {
            const customRes = await fetch(`${API_URL}/movies/custom/${slug}`);
            if (customRes.ok) {
              const customData = await customRes.json();
              const customEpisodes = [
                {
                  name: "Full",
                  slug: "full",
                  filename: customData.name,
                  link_embed: "",
                  link_m3u8: customData.link_m3u8,
                }
              ];
              handleLoadEpisodes(customEpisodes);
            }
          } catch (e) {
            console.error("Lỗi tải thông tin phim Custom:", e);
          }
        };

        // 3. So sánh server từ nguồn active và fallback, ưu tiên server có HLS.
        (async () => {
          const fetchSourceServers = async (source: "active" | "fallback") => {
            try {
              const response = await fetch(
                getProxyUrl(`${MOVIE_API_DOMAIN}/phim/${roomData.movieSlug}`, source)
              );
              if (!response.ok) return [];
              const movieData = await response.json();
              if (
                movieData.status !== true &&
                movieData.status !== "success" &&
                movieData.status !== "true"
              ) {
                return [];
              }
              return movieData.episodes || movieData.data?.item?.episodes || [];
            } catch {
              return [];
            }
          };

          const [activeServers, fallbackServers] = await Promise.all([
            fetchSourceServers("active"),
            fetchSourceServers("fallback"),
          ]);
          const candidates = [...activeServers, ...fallbackServers]
            .map((server: any, index: number) => ({
              index,
              episodes: server?.server_data || [],
            }))
            .filter((candidate) => candidate.episodes.length > 0)
            .sort((left, right) => {
              const score = (candidate: { episodes: Episode[] }) =>
                candidate.episodes.some((episode) => episode.link_m3u8)
                  ? 2
                  : candidate.episodes.some((episode) => episode.link_embed)
                    ? 1
                    : 0;
              return score(right) - score(left) || left.index - right.index;
            });

          if (candidates[0]) {
            handleLoadEpisodes(candidates[0].episodes);
          } else {
            await fetchCustomMovie(roomData.movieSlug);
          }
        })().catch((movieError) => {
          console.warn("Không tìm thấy nguồn phòng xem chung:", movieError);
          fetchCustomMovie(roomData.movieSlug);
        });

      } catch (err: any) {
        console.error(err);
        setError(err.message || "Lỗi tải phòng xem chung.");
        setLoading(false);
      }
    }

    fetchRoomAndMovie();
  }, [roomId, accessRevision]);

  const handleVerifyPrivatePin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!roomId || !/^\d{4}$/.test(privatePin)) {
      setPinError("Vui lòng nhập mã PIN gồm đúng 4 chữ số.");
      return;
    }

    setVerifyingPin(true);
    setPinError(null);
    try {
      const authToken = Cookies.get("token");
      const response = await fetch(`${API_URL}/rooms/${roomId}/access`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          ...(getGuestDeviceId()
            ? { "X-Guest-Device-Id": getGuestDeviceId() }
            : {}),
        },
        body: JSON.stringify({ pin: privatePin }),
      });
      const data = await response.json().catch(() => null);
      if (response.ok && data?.accessToken) {
        sessionStorage.setItem(
          `dlowphim_room_access:${roomId}`,
          data.accessToken
        );
        setPrivatePin("");
        setPrivateAccessRequired(false);
        setLoading(true);
        setAccessRevision((current) => current + 1);
        return;
      }

      const message = data?.message || "Mã PIN không đúng.";
      setPinError(
        data?.attemptsRemaining
          ? `${message} Bạn còn ${data.attemptsRemaining} lần thử.`
          : message
      );
      if (response.status === 429) {
        window.setTimeout(() => {
          router.replace("/watch-together?private=locked");
        }, 2500);
      }
    } catch {
      setPinError("Không thể xác thực mã PIN. Vui lòng kiểm tra kết nối.");
    } finally {
      setVerifyingPin(false);
    }
  };

  const isHost = user && room && (room.host._id === user.id || room.host._id === (user as any)._id || (room.host as any) === user.id || (room.host as any) === (user as any)._id);

  const applyRemotePlaybackState = useCallback((state: RemoteVideoState) => {
    if (isHost) return;
    latestRemoteStateRef.current = state;

    const video = videoRef.current;
    if (!video || video.readyState < 2) {
      pendingVideoStateRef.current = state;
      return;
    }

    const networkCompensation =
      state.action === "play" && state.serverTime
        ? Math.max(
            0,
            (Date.now() + serverClockOffsetRef.current - state.serverTime) / 1000,
          )
        : 0;
    const targetTime = Math.max(0, state.currentTime + networkCompensation);
    const drift = targetTime - video.currentTime;
    const absoluteDrift = Math.abs(drift);

    isSyncingRef.current = true;
    pendingVideoStateRef.current = null;

    if (state.action === "seek") {
      video.playbackRate = 1;
      video.currentTime = targetTime;
    } else if (state.action === "pause") {
      video.playbackRate = 1;
      if (absoluteDrift >= 0.5) video.currentTime = targetTime;
      video.pause();
    } else {
      if (absoluteDrift > 2) {
        video.playbackRate = 1;
        video.currentTime = targetTime;
      } else if (absoluteDrift >= 0.5) {
        video.playbackRate = drift > 0 ? 1.05 : 0.95;
      } else {
        video.playbackRate = 1;
      }

      video.play().catch(() => {
        pendingVideoStateRef.current = state;
        setStreamNotice("Trình duyệt đang chặn tự phát. Hãy bấm phát để tiếp tục đồng bộ.");
      });
    }

    window.setTimeout(() => {
      isSyncingRef.current = false;
    }, 350);
  }, [isHost]);

  // Quản lý kết nối Socket.io Realtime
  useEffect(() => {
    if (!room || loading || authLoading) return;

    // Khởi tạo socket.io client
    let socketHost = API_URL;
    try {
      socketHost = new URL(API_URL).origin;
    } catch {
      // Keep the configured value when it is already a socket-compatible URL.
    }
    const socket = io(socketHost, {
      auth: {
        token: Cookies.get("token"),
      },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });
    socketRef.current = socket;

    const authenticatedUserId = user ? (user.id || (user as any)._id) : "";
    let guestId = "";
    if (!authenticatedUserId) {
      const storageKey = `dlowphim_room_guest:${room.roomId}`;
      const generatedGuestId = `guest-${globalThis.crypto?.randomUUID?.() || Date.now()}`;
      try {
        guestId =
          localStorage.getItem(storageKey) ||
          sessionStorage.getItem(storageKey) ||
          generatedGuestId;
        localStorage.setItem(storageKey, guestId);
        sessionStorage.removeItem(storageKey);
      } catch {
        guestId = generatedGuestId;
      }
    }
    const joinPayload = {
      roomId: room.roomId,
      userId: authenticatedUserId || guestId,
      name: user?.displayName || `Khách ${guestId.slice(-4)}`,
      avatar: user?.avatar,
      isHost: !!isHost,
      roomAccessToken: sessionStorage.getItem(
        `dlowphim_room_access:${room.roomId}`
      ) || undefined,
    };

    socket.on("connect", () => {
      console.log("[Socket] Connected successfully!");
      setSocketError(null);
      // A reconnect creates a new server-side socket, so it must rejoin room.
      socket.emit("join_room", joinPayload, () => {
        if (!isHost) socket.emit("request_sync", { roomId: room.roomId });
      });
    });

    socket.on("connect_error", (err) => {
      console.error("[Socket] Connection error:", err.message);
      setSocketError(`Mất kết nối máy chủ chat: ${err.message}`);
    });

    socket.on("disconnect", (reason) => {
      console.warn("[Socket] Disconnected:", reason);
      if (videoRef.current) videoRef.current.playbackRate = 1;
      if (reason !== "io client disconnect") {
        setSocketError("Đang kết nối lại máy chủ phòng...");
      }
    });

    socket.on("socket_error", (data: { message?: string; requiresPin?: boolean }) => {
      setSocketError(data?.message || "Socket phòng vừa gặp lỗi xử lý dữ liệu.");
      if (data?.requiresPin && !isHost) {
        sessionStorage.removeItem(`dlowphim_room_access:${room.roomId}`);
        setPrivateAccessRequired(true);
        socket.disconnect();
      }
    });

    // Lắng nghe tin nhắn chat realtime
    socket.on("message", (msg: any) => {
      setMessages((prev) => {
        // Tránh bị trùng lặp tin nhắn
        if (prev.some((p) => p.id === msg.id)) return prev;
        return [
          ...prev,
          {
            id: msg.id,
            sender: msg.senderName,
            senderId: msg.senderId,
            avatar: msg.senderAvatar,
            text: msg.text,
            isSystem: msg.isSystem,
            time: msg.time,
            createdAt: msg.createdAt || new Date().toISOString(),
          },
        ];
      });
    });

    // Lắng nghe thay đổi trạng thái AI
    socket.on("ai_state_changed", (data: { active: boolean }) => {
      setIsAiActive(data.active);
    });

    // Lắng nghe tín hiệu chuyển tập phim từ Host
    socket.on("episode_changed", (data: { episodeSlug: string; episodeIndex: number }) => {
      console.log("[Socket] Episode changed to index:", data.episodeIndex);
      setActiveEpisodeIndex(data.episodeIndex);
    });

    // Lắng nghe số lượng người đang xem thay đổi
    socket.on("viewer_count", (data: { count: number }) => {
      setViewerCount(data.count);
    });

    // Lắng nghe tín hiệu bắt đầu chiếu phim từ Host
    socket.on("movie_started", (data?: { startedAt?: string; startedBy?: "schedule" | "host" }) => {
      const startedAt = data?.startedAt || new Date().toISOString();
      setHasMovieStarted(true);
      setCountdownText("");
      setRoom((current) => {
        if (!current) return current;
        const startedBy = data?.startedBy || current.startedBy;
        if (
          current.status === "live" &&
          current.startedAt === startedAt &&
          current.startedBy === startedBy
        ) {
          return current;
        }
        return {
          ...current,
          status: "live",
          startedAt,
          startedBy,
        };
      });

      const elapsedSeconds = Math.max(
        0,
        (Date.now() - new Date(startedAt).getTime()) / 1000,
      );
      const scheduledState = {
        action: "play" as const,
        currentTime: elapsedSeconds,
        serverTime: Date.now(),
      };
      if (!isHost) applyRemotePlaybackState(scheduledState);

      const video = videoRef.current;
      if (isHost && video && playerType === "hls") {
        isSyncingRef.current = true;
        if (elapsedSeconds > 1) video.currentTime = elapsedSeconds;
        video.play().then(() => {
          pendingVideoStateRef.current = null;
        }).catch(() => {
          setStreamNotice("Trình duyệt đang chặn tự phát. Hãy bấm nút phát để bắt đầu xem.");
        }).finally(() => {
          setTimeout(() => { isSyncingRef.current = false; }, 500);
        });
      }
    });

    // Lắng nghe thông báo phòng bị đóng -> Lập tức đẩy khách về trang sảnh /watch-together
    socket.on("room_closed", (data?: { reason?: string }) => {
      if (!isHost) {
        const reason = data?.reason || "closed";
        const queryReason = reason === "host_closed"
          ? "host"
          : reason === "host_absent"
            ? "expired"
            : reason === "host_disconnected"
              ? "disconnected"
              : reason === "room_replaced"
                ? "replaced"
                : "closed";
        router.replace(`/watch-together?closed=${queryReason}`);
      }
    });

    // Lắng nghe tín hiệu đồng bộ video của Host gửi xuống (chỉ Member mới thực thi)
    socket.on("video_state", (state: RemoteVideoState) => {
      if (isHost) return;
      if (state.action === "play") setHasMovieStarted(true);
      applyRemotePlaybackState(state);
    });

    socket.on("video_heartbeat", (state: RemoteVideoState) => {
      if (isHost) return;
      if (
        Number.isInteger(state.episodeIndex) &&
        state.episodeIndex !== activeEpisodeIndexRef.current
      ) {
        latestRemoteStateRef.current = state;
        pendingVideoStateRef.current = state;
        setActiveEpisodeIndex(state.episodeIndex as number);
      } else {
        applyRemotePlaybackState(state);
      }
    });

    // Khi member mới join hoặc F5 → server gửi snapshot để seek đúng vị trí host
    socket.on("sync_state", (state: RemoteVideoState & { episodeIndex: number; episodeSlug: string }) => {
      if (isHost) return;
      console.log("[Socket] Received sync_state snapshot:", state);

      if (room?.status === "live" || room?.status === "active" || room?.startedAt) {
        setHasMovieStarted(true);
      }

      // Chuyển đúng tập trước; giữ snapshot để áp dụng sau khi HLS của tập mới sẵn sàng.
      if (activeEpisodeIndexRef.current !== state.episodeIndex) {
        latestRemoteStateRef.current = state;
        pendingVideoStateRef.current = state;
        setActiveEpisodeIndex(state.episodeIndex);
      } else {
        applyRemotePlaybackState(state);
      }
    });

    // Lắng nghe tín hiệu khán giả hối thúc mở phòng chiếu (chỉ Host mới nhận và hiển thị Toast)
    socket.on("host_reminder", (data: { guestName: string }) => {
      if (isHost) {
        setReminderToast(`🔔 ${data.guestName} đang hối thúc bạn bắt đầu chiếu phim kìa!`);
      }
    });

    const heartbeatInterval = window.setInterval(() => {
      if (!isHost || !socket.connected || playerType !== "hls") return;
      const video = videoRef.current;
      if (!video || !Number.isFinite(video.currentTime)) return;
      const episodeIndex = activeEpisodeIndexRef.current;
      socket.emit("video_heartbeat", {
        roomId: room.roomId,
        currentTime: video.currentTime,
        paused: video.paused,
        episodeIndex,
        episodeSlug: episodesRef.current[episodeIndex]?.slug || "",
      });
    }, 4000);

    return () => {
      window.clearInterval(heartbeatInterval);
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [room?.roomId, room?.startTime, room?.status, room?.startedAt, user?.id, user?.displayName, user?.avatar, isHost, loading, authLoading, router, playerType, applyRemotePlaybackState]);

  useEffect(() => {
    const requestFreshSnapshot = () => {
      if (
        document.visibilityState === "visible" &&
        !isHost &&
        room?.roomId &&
        socketRef.current?.connected
      ) {
        socketRef.current.emit("request_sync", { roomId: room.roomId });
      }
    };
    document.addEventListener("visibilitychange", requestFreshSnapshot);
    return () => document.removeEventListener("visibilitychange", requestFreshSnapshot);
  }, [isHost, room?.roomId]);

  // Tự động tắt thông báo nhắc nhở sau 6 giây
  useEffect(() => {
    if (reminderToast) {
      const timer = setTimeout(() => {
        setReminderToast(null);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [reminderToast]);

  // Cuộn trang lên trên cùng khi vừa truy cập phòng
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Tự động cuộn khung chat xuống dưới cùng khi có tin nhắn mới
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Tự động cập nhật query parameter "ep" trên URL theo tập phim đang phát
  useEffect(() => {
    if (episodes.length > 0) {
      const activeEp = episodes[activeEpisodeIndex];
      if (activeEp) {
        const url = new URL(window.location.href);
        if (url.searchParams.get("ep") !== activeEp.slug) {
          url.searchParams.set("ep", activeEp.slug);
          window.history.replaceState(null, "", url.pathname + url.search);
        }
      }
    }
  }, [activeEpisodeIndex, episodes]);

  // Lưu link m3u8 đang phát hiện tại để tránh khởi tạo lại nhiều lần gây lỗi blob URL
  const currentM3u8Ref = useRef<string>("");

  // Khởi tạo HLS.js trực tiếp; Host dùng native controls, member dùng controls giới hạn.
  useEffect(() => {
    let active = true;
    const activeEp = episodes[activeEpisodeIndex];

    if (playerType === "hls" && activeEp?.link_m3u8) {
      const initPlayer = async () => {
        let Hls: any = null;
        try {
          Hls = await loadHlsLibrary();
        } catch (loadError) {
          console.error("[WatchTogether] Không tải được HLS.js:", loadError);
        }
        if (!active) return;
        const video = videoRef.current;
        if (!video) return;

        currentM3u8Ref.current = activeEp.link_m3u8;

        // Dọn dẹp MediaSource cũ trước khi đổi tập/nguồn.
        if (hlsRef.current) {
          try { hlsRef.current.detachMedia(); } catch (e) { }
          try { hlsRef.current.destroy(); } catch (e) { }
          hlsRef.current = null;
        }
        try {
          video.pause();
          video.removeAttribute("src");
          video.load();
        } catch (e) { }

        const onPlay = () => {
          if (isHost && !isSyncingRef.current) {
            socketRef.current?.emit("video_control", {
              roomId,
              action: "play",
              currentTime: video.currentTime,
            });
          } else if (!isHost && !isSyncingRef.current) {
            // Member không được tự play → pause ngay lại
            video.pause();
          }
        };

        const onPause = () => {
          if (isHost && !isSyncingRef.current) {
            socketRef.current?.emit("video_control", {
              roomId,
              action: "pause",
              currentTime: video.currentTime,
            });
          }
        };

        const onSeeked = () => {
          if (isHost && !isSyncingRef.current) {
            socketRef.current?.emit("video_control", {
              roomId,
              action: "seek",
              currentTime: video.currentTime,
            });
          }
        };

        const onWaiting = () => {
          if (!isHost) isBufferingRef.current = true;
        };

        const onCanPlay = () => {
          if (isHost) return;
          const pendingState = pendingVideoStateRef.current;
          if (pendingState) applyRemotePlaybackState(pendingState);
          if (isBufferingRef.current) {
            isBufferingRef.current = false;
            socketRef.current?.emit("request_sync", { roomId });
          }
        };

        // Gỡ các listener cũ nếu có
        if ((video as any)._dlowListeners) {
          const old = (video as any)._dlowListeners;
          video.removeEventListener("play", old.onPlay);
          video.removeEventListener("pause", old.onPause);
          video.removeEventListener("seeked", old.onSeeked);
          if (old.onWaiting) video.removeEventListener("waiting", old.onWaiting);
          if (old.onCanPlay) video.removeEventListener("canplay", old.onCanPlay);
        }

        // Gắn listener mới
        video.addEventListener("play", onPlay);
        video.addEventListener("pause", onPause);
        video.addEventListener("seeked", onSeeked);
        video.addEventListener("waiting", onWaiting);
        video.addEventListener("canplay", onCanPlay);
        (video as any)._dlowListeners = {
          onPlay,
          onPause,
          onSeeked,
          onWaiting,
          onCanPlay,
        };

        if (Hls && Hls.isSupported()) {
          hlsNetworkRetriesRef.current = 0;
          hlsMediaRetriesRef.current = 0;
          const hls = new Hls({
            maxBufferLength: 30,
            backBufferLength: 30,
            enableWorker: true,
          });
          hls.loadSource(activeEp.link_m3u8);
          hls.attachMedia(video);
          hlsRef.current = hls;

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (!active) return;
            setStreamNotice(null);
            hlsNetworkRetriesRef.current = 0;
            hlsMediaRetriesRef.current = 0;
            const pendingState = pendingVideoStateRef.current;
            if (pendingState) {
              applyRemotePlaybackState(pendingState);
            }
          });

          hls.on(Hls.Events.ERROR, (_event: any, data: any) => {
            if (!active || !data?.fatal) return;
            if (
              data.type === Hls.ErrorTypes.NETWORK_ERROR &&
              hlsNetworkRetriesRef.current < 2
            ) {
              hlsNetworkRetriesRef.current += 1;
              hls.startLoad();
              return;
            }
            if (
              data.type === Hls.ErrorTypes.MEDIA_ERROR &&
              hlsMediaRetriesRef.current < 1
            ) {
              hlsMediaRetriesRef.current += 1;
              hls.recoverMediaError();
              return;
            }

            console.error("[WatchTogether] HLS fatal error:", data);
            try { hls.destroy(); } catch (e) { }
            if (activeEp.link_embed) {
              setPlayerType("embed");
              setStreamNotice("HLS không phản hồi, đã chuyển sang Embed dự phòng.");
            } else {
              setErrorModal("Nguồn HLS của tập này đang lỗi và không có Embed dự phòng.");
            }
          });
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
          // Hỗ trợ HLS native cho Safari / iOS
          video.src = activeEp.link_m3u8;
          video.addEventListener(
            "loadedmetadata",
            () => {
              const pendingState = pendingVideoStateRef.current;
              if (!pendingState) return;
              applyRemotePlaybackState(pendingState);
            },
            { once: true }
          );
        } else if (activeEp.link_embed) {
          setPlayerType("embed");
          setStreamNotice("Trình duyệt không hỗ trợ HLS, đang dùng Embed dự phòng.");
        } else {
          setErrorModal("Trình duyệt không hỗ trợ nguồn HLS của tập này.");
        }
      };

      initPlayer();
    }

    return () => {
      active = false;
      const video = videoRef.current;
      if (video && (video as any)._dlowListeners) {
        const { onPlay, onPause, onSeeked, onWaiting, onCanPlay } = (video as any)._dlowListeners;
        video.removeEventListener("play", onPlay);
        video.removeEventListener("pause", onPause);
        video.removeEventListener("seeked", onSeeked);
        if (onWaiting) video.removeEventListener("waiting", onWaiting);
        if (onCanPlay) video.removeEventListener("canplay", onCanPlay);
        delete (video as any)._dlowListeners;
      }
      if (hlsRef.current) {
        try { hlsRef.current.detachMedia(); } catch (e) { }
        try { hlsRef.current.destroy(); } catch (e) { }
        hlsRef.current = null;
      }
      if (video) {
        try {
          video.pause();
          video.removeAttribute("src");
          video.load();
        } catch (e) { }
      }
      currentM3u8Ref.current = "";
    };
  }, [playerType, activeEpisodeIndex, episodes, isHost, roomId, applyRemotePlaybackState]);

  // Sao chép liên kết URL đầy đủ của phòng xem chung
  const handleCopyRoomId = () => {
    const fullUrl = typeof window !== "undefined" ? window.location.href : "";
    if (fullUrl && navigator.clipboard) {
      const shareText = room?.isPrivate && hostPrivatePin
        ? `Mời bạn xem phim cùng mình: ${fullUrl}\nMã PIN: ${hostPrivatePin}`
        : fullUrl;
      navigator.clipboard.writeText(shareText);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2500);
    }
  };

  // Gửi tin nhắn
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const socket = socketRef.current;
    const text = messageInput.trim();
    if (!text || !socket || isSendingMessage) return;
    if (!socket.connected) {
      setSocketError("Socket đang kết nối lại, hãy thử gửi sau vài giây.");
      return;
    }

    setIsSendingMessage(true);
    socket.timeout(6000).emit("send_message", {
      roomId: room?.roomId,
      userId: user?.id,
      name: user?.displayName || "Khách",
      avatar: user?.avatar,
      text,
    }, (timeoutError: Error | null, response?: { ok?: boolean; message?: string }) => {
      setIsSendingMessage(false);
      if (timeoutError || !response?.ok) {
        setSocketError(
          response?.message || "Gửi tin nhắn thất bại, vui lòng thử lại."
        );
        return;
      }
      setSocketError(null);
      setMessageInput((current) => (current.trim() === text ? "" : current));
    });
  };

  // Đóng phòng
  const handleCloseRoom = async () => {
    if (!room || !user || room.host._id !== user.id) return;
    setConfirmCloseModal(true);
  };

  const doCloseRoom = async () => {
    if (!room) return;
    setConfirmCloseModal(false);
    try {
      // Backend chỉ broadcast đẩy khách ra sảnh sau khi đóng database thành công.
      const token = Cookies.get("token");
      const res = await fetch(`${API_URL}/rooms/${room.roomId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        router.replace("/watch-together?closed=owner");
      } else {
        const data = await res.json().catch(() => null);
        setErrorModal(data?.message || "Đóng phòng thất bại. Vui lòng thử lại.");
      }
    } catch (e) {
      console.error(e);
      setErrorModal("Mất kết nối máy chủ nên phòng chưa được đóng. Vui lòng thử lại.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 border-4 border-pink-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-zinc-400 text-sm font-bold">Đang tải phòng xem chung...</p>
      </div>
    );
  }

  if (privateAccessRequired) {
    return (
      <div className="min-h-screen bg-[#07070a] text-white flex items-center justify-center px-4">
        <form
          onSubmit={handleVerifyPrivatePin}
          className="w-full max-w-sm rounded-3xl border border-pink-500/20 bg-[#0e0f17] p-7 text-center shadow-[0_25px_80px_rgba(0,0,0,0.85)] space-y-5"
        >
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-pink-500/20 bg-pink-500/10">
            <LockKeyhole size={28} className="text-pink-400" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-xl font-black uppercase">Phòng xem riêng tư</h1>
            <p className="text-xs leading-relaxed text-zinc-500">
              Nhập mã PIN được chủ phòng chia sẻ để xem phim và trò chuyện.
            </p>
          </div>
          <div className="space-y-2">
            <div className="relative">
              <KeyRound size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" />
              <input
                autoFocus
                type="password"
                inputMode="numeric"
                autoComplete="one-time-code"
                minLength={4}
                maxLength={4}
                pattern="[0-9]{4}"
                value={privatePin}
                onChange={(event) =>
                  setPrivatePin(event.target.value.replace(/\D/g, "").slice(0, 4))
                }
                placeholder="Nhập mã pin 4 số"
                className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 pl-11 pr-4 text-center text-lg font-black tracking-[0.35em] outline-none transition-colors focus:border-pink-500"
              />
            </div>
            {pinError && (
              <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-[11px] font-bold leading-relaxed text-red-400">
                {pinError}
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={verifyingPin || privatePin.length < 4}
            className="h-12 w-full rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 text-sm font-black text-white shadow-lg shadow-pink-500/20 transition-all hover:from-pink-600 hover:to-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {verifyingPin ? "Đang kiểm tra..." : "Vào phòng"}
          </button>
          <button
            type="button"
            onClick={() => router.replace("/watch-together")}
            className="text-xs font-bold text-zinc-500 transition-colors hover:text-zinc-300"
          >
            Quay lại sảnh xem chung
          </button>
        </form>
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-3 px-4">
        <AlertCircle className="text-red-500" size={48} />
        <p className="text-zinc-300 text-sm font-bold">{error || "Đã xảy ra lỗi ngoài ý muốn."}</p>
        <button
          onClick={() => router.push("/")}
          className="mt-2 px-5 py-2 bg-zinc-800 text-white rounded-xl font-bold text-xs"
        >
          Quay lại Trang Chủ
        </button>
      </div>
    );
  }

  const activeEp = episodes[activeEpisodeIndex];
  const posterUrl = room?.posterOption || room?.moviePoster;

  return (
    <>
      <div className="min-h-screen bg-[#07070a] text-white pt-24 pb-12 px-4 md:px-6 relative select-none">
        <div className="max-w-[1550px] mx-auto space-y-6 relative z-10">

          {/* Header thông tin phòng */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-900 pb-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push(`/watch/${room.movieSlug}`)}
                className="w-10 h-10 rounded-full border border-zinc-850 hover:border-zinc-700 bg-zinc-950 flex items-center justify-center hover:text-pink-500 transition-all cursor-pointer shrink-0"
              >
                <ArrowLeft size={16} />
              </button>
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <h1 className="text-lg md:text-xl font-black uppercase tracking-tight text-zinc-100">
                    {room.roomName}
                  </h1>
                  <button
                    onClick={handleCopyRoomId}
                    className="bg-pink-500/10 hover:bg-pink-500/20 text-pink-400 font-black text-xs px-3.5 py-1.5 rounded-xl border border-pink-500/20 uppercase tracking-wider shrink-0 select-none transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
                    title={room.isPrivate ? "Sao chép liên kết mời và mã PIN" : "Sao chép liên kết phòng xem chung"}
                  >
                    <span>Mã phòng: {room.roomId}</span>
                    {codeCopied ? (
                      <span className="text-[10px] text-green-400 font-bold bg-green-500/10 px-1.5 py-0.2 rounded flex items-center gap-0.5 border border-green-500/20 animate-in zoom-in-95 duration-150">
                        <Check size={10} /> Đã sao chép!
                      </span>
                    ) : (
                      <Copy size={12} className="text-pink-400" />
                    )}
                  </button>
                  {room.isPrivate && (
                    <span className="inline-flex items-center gap-1 rounded-lg border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-amber-400">
                      <LockKeyhole size={11} /> Phòng riêng
                      {isHost && hostPrivatePin ? ` • PIN ${hostPrivatePin}` : ""}
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-500 font-semibold uppercase flex items-center gap-1.5 mt-0.5">
                  <Film size={12} className="text-pink-500" />
                  <span className={room.status === "scheduled" ? "text-amber-400" : "text-pink-400"}>
                    {room.status === "scheduled" ? "Sắp chiếu" : "Đang phát"}:
                  </span>
                  {cleanMovieName(room.movieName)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {isHost && (
                <button
                  onClick={handleCloseRoom}
                  className="h-9 px-3.5 bg-red-600/15 hover:bg-red-600 text-red-500 hover:text-white border border-red-500/20 text-xs font-black rounded-xl active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 size={13} />
                  <span>Đóng phòng</span>
                </button>
              )}
            </div>
          </div>

          {/* Layout 2 cột: Trình phát & Chatbox */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

            {/* CỘT TRÁI (LỚN): Video Player */}
            <div className="lg:col-span-8">

              {/* Khung Player */}
              <div className="w-full overflow-hidden bg-black rounded-3xl shadow-[0_15px_45px_rgba(0,0,0,0.85)] relative">
                <div
                  ref={playerContainerRef}
                  className={`relative bg-black overflow-hidden group ${isFullscreen
                    ? "w-screen h-screen !aspect-auto"
                    : "w-full aspect-video"
                    }`}
                >
                  {streamNotice && (
                    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 max-w-[90%] rounded-xl bg-amber-500/15 border border-amber-500/30 backdrop-blur-md px-3 py-2 text-[10px] font-bold text-amber-300 shadow-lg">
                      {streamNotice}
                    </div>
                  )}
                  {/* Toast hối thúc của khán giả (chỉ hiển thị cho Host) */}
                  {isHost && reminderToast && (
                    <div className="absolute top-4 right-4 z-40 bg-[#0e0f17]/95 backdrop-blur-md border border-pink-500/30 text-pink-400 px-4.5 py-3 rounded-2xl shadow-[0_10px_30px_rgba(236,72,153,0.15)] flex items-center gap-2.5 animate-in fade-in slide-in-from-top-3 duration-300 max-w-xs border-l-4 border-l-pink-500">
                      <span className="relative flex h-2 w-2 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-pink-500"></span>
                      </span>
                      <p className="text-xs font-black leading-snug">{reminderToast}</p>
                    </div>
                  )}

                  {/* Countdown/waiting screen overlay for scheduled rooms */}
                  {!hasMovieStarted ? (
                    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#07070a] px-6 text-center select-none overflow-hidden">
                      {posterUrl && (
                        <img
                          src={getImageUrl(posterUrl)}
                          alt=""
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            if (room?.movieSlug) {
                              fetch(`${API_URL}/movies/logo/${room.movieSlug}?title=${encodeURIComponent(room.movieName || "")}`)
                                .then((res) => (res.ok ? res.json() : null))
                                .then((data) => {
                                  if (data && (data.backdropUrl || data.posterUrl)) {
                                    target.src = data.backdropUrl || data.posterUrl;
                                  } else {
                                    target.src = "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&q=80";
                                  }
                                })
                                .catch(() => {
                                  target.src = "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&q=80";
                                });
                            } else {
                              target.src = "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&q=80";
                            }
                          }}
                          className="w-full h-full object-cover blur-[35px] opacity-25 pointer-events-none absolute inset-0"
                        />
                      )}
                      <HalftoneOverlay />

                      <div className="relative z-20 flex flex-col items-center justify-center max-w-md space-y-4">
                        <div className="w-20 h-20 rounded-3xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mb-2 animate-pulse shadow-[0_0_40px_rgba(245,158,11,0.3)]">
                          <Clock size={36} className="text-amber-400 animate-[spin_10s_linear_infinite]" />
                        </div>

                        <span className="inline-flex items-center gap-1.5 bg-amber-500/15 border border-amber-500/35 text-amber-400 text-xs font-black uppercase tracking-widest px-4 py-2 rounded-full shadow-lg">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
                          Đang Chờ Công Chiếu
                        </span>
                        
                        <h2 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
                          {room?.movieName ? cleanMovieName(room.movieName) : "Phim sắp chiếu"}
                        </h2>
                        
                        <p className="text-sm md:text-base text-zinc-300 font-bold leading-relaxed">
                          Thời gian chiếu: <span className="text-pink-400 font-extrabold">{room?.startTime ? new Date(room.startTime).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "Đang chờ Trưởng phòng"}</span>
                        </p>

                        {countdownText && (
                          <div className="bg-black/60 backdrop-blur-md border border-white/10 rounded-2xl px-8 py-4.5 mt-3 inline-block shadow-2xl">
                            <p className="text-[10px] text-zinc-400 font-black uppercase tracking-wider mb-1">Bắt đầu sau</p>
                            <p className="text-2xl md:text-3xl font-black text-amber-400 tracking-tight drop-shadow-[0_0_15px_rgba(245,158,11,0.4)]">{countdownText}</p>
                          </div>
                        )}

                        <p className="text-xs text-zinc-400 leading-relaxed max-w-sm mx-auto">
                          {room?.startTime && Date.now() >= new Date(room.startTime).getTime()
                            ? "Phòng sẽ bắt đầu ngay khi Trưởng phòng có mặt và tự đóng nếu vắng quá 30 phút."
                            : "Bạn vẫn có thể gửi tin nhắn trò chuyện ở ô chat bên cạnh trong lúc chờ đợi nhé!"}
                        </p>

                        {/* Nút thao tác cho Host & Member */}
                        {isHost ? (
                          <button
                            onClick={() => {
                              if (socketRef.current) {
                                socketRef.current.emit("start_scheduled_movie", { roomId: room?.roomId });
                              }
                            }}
                            className="mt-4 px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-wider bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg shadow-amber-500/25 active:scale-95 transition-all cursor-pointer border-none flex items-center gap-2"
                          >
                            <Sparkles size={15} />
                            <span>🚀 Bắt Đầu Chiếu Phim Ngay</span>
                          </button>
                        ) : (
                          <button
                            disabled={hasUrgedHost}
                            onClick={() => {
                              socketRef.current?.emit("request_start_movie", {
                                roomId: room?.roomId,
                                guestName: user?.displayName || "Khán giả ẩn danh",
                              });
                              setHasUrgedHost(true);
                              window.setTimeout(() => setHasUrgedHost(false), 60_000);
                            }}
                            className={`mt-4 px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer border ${hasUrgedHost
                              ? "bg-zinc-900 text-zinc-500 border-zinc-800 cursor-not-allowed shadow-inner"
                              : "bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white border-pink-500/20 shadow-lg shadow-pink-500/20 hover:shadow-pink-500/35"
                              }`}
                          >
                            {hasUrgedHost ? "🔔 Đã gửi tín hiệu nhắc" : "🔔 Hối thúc Trưởng phòng"}
                          </button>
                        )}
                      </div>
                    </div>
                  ) : null}

                  {playerType === "embed" ? (
                    activeEp?.link_embed ? (
                      <iframe
                        src={activeEp.link_embed}
                        referrerPolicy="no-referrer"
                        allowFullScreen
                        frameBorder="0"
                        scrolling="no"
                        className="absolute -top-8 -left-4 w-[calc(100%+16px)] h-[calc(100%+32px)]"
                        title="DlowPhim Watch Together Player"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-zinc-900">
                        <Tv size={44} className="text-zinc-650 animate-pulse" />
                        <p className="text-zinc-500 text-xs font-bold">Chưa chọn tập phim!</p>
                      </div>
                    )
                  ) : (
                    activeEp?.link_m3u8 ? (
                      <div className="relative w-full h-full">
                        <video
                          id="dlow-room-video"
                          ref={videoRef}
                          playsInline
                          controls={!!isHost}
                          className="absolute inset-0 w-full h-full object-contain bg-black"
                          title="DlowPhim Watch Together Player"
                          onContextMenu={(e) => { if (!isHost) e.preventDefault(); }}
                        />

                        {/* Overlay chặn member tua/play/pause nhưng cho thao tác volume & full screen */}
                        {!isHost && (
                          <div
                            className="absolute inset-0 z-20 group"
                            onMouseMove={handleMemberMouseMove}
                            onMouseEnter={handleMemberMouseMove}
                            onMouseLeave={scheduleMemberControlsHide}
                            onMouseDown={(e) => { if (e.target === e.currentTarget) e.preventDefault(); }}
                            onClick={(e) => { if (e.target === e.currentTarget) e.preventDefault(); }}
                            onDoubleClick={(e) => { if (e.target === e.currentTarget) e.preventDefault(); }}
                          >
                            {/* Vùng chặn click chính */}
                            <div className="absolute inset-0 z-10 cursor-not-allowed" />

                            {/* Dải nút điều khiển phụ ở đáy (tự động hiện khi di chuột và ẩn sau 3.5s) */}
                            <div
                              onMouseEnter={() => {
                                clearMemberControlsTimer();
                                setShowMemberControls(true);
                              }}
                              onMouseLeave={scheduleMemberControlsHide}
                              className={`absolute bottom-4 left-4 right-4 z-30 flex items-center justify-between pointer-events-none transition-all duration-300 ${showMemberControls ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
                                }`}
                            >
                              {/* Badge thông báo + Mute button */}
                              <div className="flex items-center gap-2 pointer-events-auto">
                                <div className="flex items-center gap-1.5 bg-black/80 backdrop-blur-md px-3 py-2 rounded-xl border border-white/10 select-none shadow-lg">
                                  <Volume2 size={12} className="text-pink-500 animate-pulse" />
                                  <span className="text-[10px] font-black text-zinc-300 uppercase tracking-wider">Chỉ xem — Trưởng phòng điều khiển</span>
                                </div>

                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const video = videoRef.current;
                                    if (video) {
                                      video.muted = !video.muted;
                                      setIsMuted(video.muted);
                                    }
                                  }}
                                  className="h-9 w-9 rounded-xl bg-black/80 backdrop-blur-md border border-white/10 hover:border-pink-500/50 text-zinc-200 hover:text-white flex items-center justify-center transition-all cursor-pointer shadow-xl active:scale-95"
                                  title={isMuted ? "Bật âm thanh" : "Tắt âm thanh"}
                                >
                                  {isMuted ? <VolumeX size={15} className="text-pink-400" /> : <Volume2 size={15} />}
                                </button>
                              </div>

                              {/* Nút phóng to / Thu nhỏ */}
                              <div className="pointer-events-auto">
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const container = playerContainerRef.current;
                                    if (container) {
                                      const fullscreenElement = document.fullscreenElement ||
                                        (document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement;
                                      try {
                                        if (fullscreenElement) {
                                          const exitFullscreen = document.exitFullscreen?.bind(document) ||
                                            (document as Document & { webkitExitFullscreen?: () => Promise<void> }).webkitExitFullscreen?.bind(document);
                                          void exitFullscreen?.().catch(() => {
                                            setErrorModal("Không thể thoát chế độ toàn màn hình. Bạn có thể nhấn Esc để thoát.");
                                          });
                                        } else {
                                          const requestFullscreen = container.requestFullscreen?.bind(container) ||
                                            (container as HTMLDivElement & { webkitRequestFullscreen?: () => Promise<void> }).webkitRequestFullscreen?.bind(container);
                                          void requestFullscreen?.().catch(() => {
                                            setErrorModal("Trình duyệt đang chặn chế độ toàn màn hình. Vui lòng thử lại.");
                                          });
                                        }
                                      } catch {
                                        setErrorModal("Không thể chuyển chế độ toàn màn hình trên trình duyệt này.");
                                      }
                                    }
                                  }}
                                  className="h-9 px-3 rounded-xl bg-black/80 backdrop-blur-md border border-white/10 hover:border-pink-500/50 text-zinc-200 hover:text-white flex items-center gap-1.5 transition-all cursor-pointer shadow-xl active:scale-95 font-bold text-xs"
                                  title={isFullscreen ? "Thoát toàn màn hình" : "Toàn màn hình"}
                                >
                                  {isFullscreen ? (
                                    <>
                                      <Minimize size={14} className="text-pink-400" />
                                      <span className="hidden sm:inline">Thoát phóng to</span>
                                    </>
                                  ) : (
                                    <>
                                      <Maximize size={14} />
                                      <span className="hidden sm:inline">Toàn màn hình</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-zinc-900">
                        <Tv size={44} className="text-zinc-650 animate-pulse" />
                        <p className="text-zinc-500 text-xs font-bold">Nguồn phát HLS bị lỗi hoặc không khả dụng!</p>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>

            {/* CỘT PHẢI (NHỎ): Chatbox Realtime */}
            <div className="lg:col-span-4">
              <div
                style={{ height: isDesktop ? `${playerHeight}px` : "480px" }}
                className="bg-[#161622]/95 backdrop-blur-md border border-zinc-800/80 rounded-3xl flex flex-col overflow-hidden relative shadow-2xl shadow-black/80 transition-all duration-150"
              >

                {/* Chatbox Header */}
                <div className="p-4 border-b border-zinc-900 bg-gradient-to-b from-zinc-950/60 to-transparent flex items-center gap-2 select-none">
                  <MessageSquare size={16} className="text-pink-500" />
                  <span className="text-xs font-black text-zinc-300 uppercase tracking-wider">Hộp thoại xem chung</span>

                  <div className="ml-auto flex items-center gap-2">
                    {/* Nút Toggle AI Chat */}
                    <button
                      onClick={handleToggleAi}
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer border-none active:scale-90 ${isAiActive
                        ? "bg-gradient-to-r from-purple-500/35 to-indigo-500/35 text-purple-300 shadow-lg shadow-purple-500/20 border border-purple-500/40 animate-pulse"
                        : "bg-zinc-800/60 text-zinc-400 hover:text-zinc-200 border border-zinc-700/40 hover:border-zinc-650/60"
                        }`}
                      title={isAiActive ? "Tắt trợ lý ảo DlowAI" : "Bật trợ lý ảo DlowAI"}
                    >
                      <Bot size={14} className={isAiActive ? "scale-110" : ""} />
                    </button>

                    <div className="flex items-center gap-1.5 text-[9px] text-zinc-400 font-extrabold bg-zinc-800/50 px-2.5 py-1 rounded-full">
                      <Users size={10} className="text-pink-500 shrink-0" />
                      <span>{viewerCount} Đang xem</span>
                    </div>
                  </div>
                </div>

                {/* List tin nhắn */}
                <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 text-left scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
                  {messages.map((msg, index) => {
                    if (msg.isSystem) {
                      return (
                        <div key={msg.id} className="w-full text-center py-2 animate-in fade-in zoom-in-95 duration-200">
                          <span className="text-[10px] text-zinc-500 font-extrabold bg-zinc-950/40 border border-zinc-900/30 px-3 py-1 rounded-full leading-normal max-w-[90%] inline-block backdrop-blur-sm italic">
                            📢 {msg.text}
                          </span>
                        </div>
                      );
                    }

                    const currentUserId = user?.id || (user as any)?._id;
                    const isMe = Boolean(
                      user &&
                      (msg.senderId && currentUserId
                        ? msg.senderId === currentUserId
                        : msg.sender === user.displayName)
                    );
                    const previousMessage = messages[index - 1];
                    const currentTimestamp = msg.createdAt ? Date.parse(msg.createdAt) : Number.NaN;
                    const previousTimestamp = previousMessage?.createdAt
                      ? Date.parse(previousMessage.createdAt)
                      : Number.NaN;
                    const isSameSender = Boolean(
                      previousMessage &&
                      !previousMessage.isSystem &&
                      (msg.senderId && previousMessage.senderId
                        ? msg.senderId === previousMessage.senderId
                        : msg.sender === previousMessage.sender)
                    );
                    const isWithinOneMinute = Number.isFinite(currentTimestamp) && Number.isFinite(previousTimestamp)
                      ? currentTimestamp >= previousTimestamp && currentTimestamp - previousTimestamp <= 60_000
                      : previousMessage?.time === msg.time;
                    const isContinuation = isSameSender && isWithinOneMinute;
                    const nextMessage = messages[index + 1];
                    const nextTimestamp = nextMessage?.createdAt
                      ? Date.parse(nextMessage.createdAt)
                      : Number.NaN;
                    const isSameNextSender = Boolean(
                      nextMessage &&
                      !nextMessage.isSystem &&
                      (msg.senderId && nextMessage.senderId
                        ? msg.senderId === nextMessage.senderId
                        : msg.sender === nextMessage.sender)
                    );
                    const isNextWithinOneMinute = Number.isFinite(currentTimestamp) && Number.isFinite(nextTimestamp)
                      ? nextTimestamp >= currentTimestamp && nextTimestamp - currentTimestamp <= 60_000
                      : nextMessage?.time === msg.time;
                    const isGroupEnd = !(isSameNextSender && isNextWithinOneMinute);
                    return (
                      <div
                        key={msg.id}
                        className={`flex items-end gap-2.5 max-w-[85%] animate-in fade-in duration-200 ${index > 0 && !isContinuation ? "mt-3" : "mt-1"} ${isMe ? "ml-auto flex-row-reverse" : ""
                          }`}
                      >
                        {/* Avatar */}
                        {!isGroupEnd ? (
                          <div className="w-7 shrink-0" aria-hidden="true" />
                        ) : (
                          <div className={`w-7 h-7 rounded-full overflow-hidden shrink-0 bg-zinc-900 shadow-md border-2 transition-all animate-in fade-in slide-in-from-top-1 ${room && msg.senderId === room.host._id
                            ? "border-pink-500 shadow-lg shadow-pink-500/25 scale-105"
                            : "border-zinc-850/30"
                            }`}>
                            <img
                              src={msg.avatar || "https://img.ophim.live/uploads/movies/default-avatar.png"}
                              alt={msg.sender}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}

                        <div className={`flex flex-col space-y-1 ${isMe ? "items-end" : "items-start"}`}>
                          {/* Name & Time */}
                          {!isContinuation && (
                            <div className={`flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider select-none ${isMe ? "justify-end text-pink-400" : msg.senderId === 'dlow-ai-bot' ? "text-purple-400" : "text-zinc-500"
                              }`}>
                              <span>{msg.sender}</span>
                              {msg.senderId === 'dlow-ai-bot' && (
                                <span className="bg-purple-500/10 text-purple-400 px-1 py-0.2 rounded border border-purple-500/20 text-[8px] tracking-wide shrink-0 font-extrabold">
                                  AI Trợ lý
                                </span>
                              )}
                              <span>•</span>
                              <span>{msg.time}</span>
                            </div>
                          )}

                          {/* Bubble */}
                          <div className={`px-3 py-2 rounded-2xl text-[11px] font-bold leading-relaxed whitespace-pre-wrap break-words w-fit max-w-full ${isMe
                            ? `bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-md shadow-pink-500/20 ${isGroupEnd ? "rounded-br-none" : "rounded-br-md"}`
                            : msg.senderId === 'dlow-ai-bot'
                              ? `bg-gradient-to-br from-[#2f225e] to-[#1a1438] text-purple-100 border border-purple-400/35 shadow-md shadow-purple-500/10 ${isGroupEnd ? "rounded-bl-none" : "rounded-bl-md"}`
                              : `bg-[#25283b]/85 backdrop-blur-sm text-zinc-100 border border-zinc-700/50 ${isGroupEnd ? "rounded-bl-none" : "rounded-bl-md"}`
                            }`}>
                            {msg.text}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {socketError && (
                  <div className="bg-red-500/10 border-t border-red-500/20 px-3.5 py-2 text-[10px] text-red-450 font-extrabold flex items-center gap-1.5 select-none animate-in fade-in duration-200">
                    <AlertCircle size={12} className="shrink-0 animate-pulse text-red-500" />
                    <span>{socketError}</span>
                  </div>
                )}

                {/* Input gửi tin nhắn */}
                <form onSubmit={handleSendMessage} className="p-3.5 border-t border-zinc-900/45 bg-zinc-950/80 backdrop-blur-md flex items-center gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Nhập nội dung trò chuyện..."
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    className="flex-1 h-10 bg-zinc-900/40 border border-zinc-800/80 focus:border-pink-500 focus:bg-zinc-900/90 rounded-full px-4 text-xs text-zinc-200 outline-none font-bold transition-all placeholder:text-zinc-600 shadow-inner"
                    maxLength={200}
                  />
                  <button
                    type="submit"
                    disabled={isSendingMessage || !messageInput.trim()}
                    className="w-10 h-10 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-pink-500/20 hover:scale-105 hover:shadow-pink-500/35 active:scale-95 transition-all cursor-pointer border-none"
                  >
                    {isSendingMessage ? (
                      <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                    ) : (
                      <Send size={13} className="translate-x-0.5 -translate-y-0.5" />
                    )}
                  </button>
                </form>

              </div>

            </div>

          </div>

          {/* Dòng danh sách tập phim phía dưới player */}
          {episodes.length > 1 && (
            <div className="lg:w-8/12 pr-0 lg:pr-3 mt-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="bg-[#0e0f17]/40 p-5 rounded-2xl space-y-3.5 text-left border border-zinc-900/60 shadow-lg">
                <span className="block text-xs font-black text-zinc-400 uppercase tracking-wider select-none">
                  Danh sách tập phim xem chung:
                </span>
                <EpisodeSelector
                  episodes={episodes}
                  activeEpisodeIndex={activeEpisodeIndex}
                  onSelectEpisode={(idx) => {
                    if (!isHost) {
                      alert("Chỉ có Trưởng phòng mới được quyền chuyển tập phim nhé! 🎬");
                      return;
                    }
                    const ep = episodes[idx];
                    if (!ep) return;

                    socketRef.current?.emit("change_episode", {
                      roomId: room.roomId,
                      episodeSlug: ep.slug,
                      episodeIndex: idx,
                      episodeName: ep.name.toLowerCase().includes("tập") ? ep.name : `Tập ${ep.name}`,
                      userName: user?.displayName || "Trưởng phòng",
                    });
                    setActiveEpisodeIndex(idx);
                  }}
                  batchSize={40}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── MODAL: Phòng bị đóng ── */}
      {roomClosedModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#0e0f16] border border-red-500/30 rounded-3xl shadow-[0_25px_60px_rgba(0,0,0,0.9),0_0_20px_rgba(239,68,68,0.2)] p-7 max-w-sm w-[90%] text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto animate-pulse">
              <AlertCircle size={32} className="text-red-400" />
            </div>
            <div>
              <h3 className="text-lg font-black text-zinc-100 mb-1">Trưởng Phòng Đã Đóng Phòng</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Trưởng phòng vừa thao tác đóng phòng xem chung. Đang tự động chuyển hướng bạn ra ngoài...
              </p>
            </div>
            <div className="pt-2">
              <button
                onClick={() => { setRoomClosedModal(false); router.push(room?.movieSlug ? `/watch/${room.movieSlug}` : "/"); }}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-black text-xs transition-all active:scale-95 cursor-pointer border-none shadow-lg shadow-pink-500/25 flex items-center justify-center gap-2"
              >
                <span>Về trang phim ngay</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Xác nhận đóng phòng ── */}
      {confirmCloseModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0e0f16] border border-orange-500/20 rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.8),0_0_0_1px_rgba(249,115,22,0.1)] p-7 max-w-sm w-[90%] text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-orange-500/10 flex items-center justify-center mx-auto">
              <Trash2 size={26} className="text-orange-400" />
            </div>
            <div>
              <h3 className="text-base font-black text-zinc-100 mb-1">Đóng phòng xem chung?</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">Tất cả thành viên trong phòng sẽ bị đưa ra ngoài ngay lập tức. Hành động này không thể hoàn tác.</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmCloseModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-sm transition-all active:scale-95 cursor-pointer border border-zinc-700 hover:border-zinc-600"
              >
                Huỷ bỏ
              </button>
              <button
                onClick={doCloseRoom}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-black text-sm transition-all active:scale-95 cursor-pointer border-none shadow-lg shadow-red-500/20"
              >
                Đóng phòng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Thông báo lỗi ── */}
      {errorModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0e0f16] border border-zinc-700/40 rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.8)] p-7 max-w-sm w-[90%] text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-zinc-800 flex items-center justify-center mx-auto">
              <AlertCircle size={26} className="text-zinc-400" />
            </div>
            <div>
              <h3 className="text-base font-black text-zinc-100 mb-1">Đã xảy ra lỗi</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">{errorModal}</p>
            </div>
            <button
              onClick={() => setErrorModal(null)}
              className="w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-sm transition-all active:scale-95 cursor-pointer border border-zinc-700"
            >
              Đã hiểu
            </button>
          </div>
        </div>
      )}
    </>
  );
}
