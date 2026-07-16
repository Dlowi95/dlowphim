"use client";

export const dynamic = "force-dynamic";

import React, { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Film, Send, Sparkles, MessageSquare, Users, Trash2, Calendar, Tv, Volume2, AlertCircle, Copy, Check, Bot, Clock, VideoOff, VolumeX, Maximize } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import Cookies from "js-cookie";
import { cleanMovieName } from "@/utils/movieUtils";
import { getProxyUrl } from "@/utils/api";
import EpisodeSelector from "@/components/EpisodeSelector";
import { io } from "socket.io-client";
import HalftoneOverlay from "@/components/HalftoneOverlay";

const getImageUrl = (path: string) => {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  const fileName = path.split("/").pop();
  return `https://img.ophim.live/uploads/movies/${fileName}`;
};

// Import dynamic Plyr
import "plyr/dist/plyr.css";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

interface RoomDetails {
  roomId: string;
  movieSlug: string;
  movieName: string;
  moviePoster: string;
  roomName: string;
  posterOption: string;
  isAutoStart: boolean;
  startTime?: string;
  isPrivate: boolean;
  host: { _id: string; name: string; email: string; avatar?: string };
}

interface Message {
  id: string;
  sender: string;
  senderId?: string;
  avatar?: string;
  text: string;
  time: string;
  isSystem?: boolean;
}

interface Episode {
  name: string;
  slug: string;
  filename: string;
  link_embed: string;
  link_m3u8: string;
}

export default function RoomPage() {
  const router = useRouter();
  const { roomId } = useParams();
  const { user, loading: authLoading } = useAuth();

  const [room, setRoom] = useState<RoomDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [socketError, setSocketError] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [isAiActive, setIsAiActive] = useState(false);

  // Custom modal states (thay thế alert/confirm của trình duyệt)
  const [roomClosedModal, setRoomClosedModal] = useState(false);
  const [confirmCloseModal, setConfirmCloseModal] = useState(false);
  const [errorModal, setErrorModal] = useState<string | null>(null);

  // States quản lý đếm ngược công chiếu cho member
  const [hasMovieStarted, setHasMovieStarted] = useState(false);
  const [countdownText, setCountdownText] = useState("");
  const [isMuted, setIsMuted] = useState(false);

  // States quản lý nhắc nhở chủ phòng
  const [reminderToast, setReminderToast] = useState<string | null>(null);
  const [hasUrgedHost, setHasUrgedHost] = useState(false);

  // Khởi tạo & chạy đồng hồ đếm ngược công chiếu
  useEffect(() => {
    if (!room) return;
    if (!room.startTime) {
      setHasMovieStarted(true);
      return;
    }

    const startTimeMs = new Date(room.startTime).getTime();
    if (Date.now() >= startTimeMs) {
      setHasMovieStarted(true);
    } else {
      const updateCountdown = () => {
        const now = Date.now();
        const diff = startTimeMs - now;
        if (diff <= 0) {
          setHasMovieStarted(true);
          return true; // Dừng
        }
        const hrs = Math.floor(diff / 3600000);
        const mins = Math.floor((diff % 3600000) / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        
        let text = "";
        if (hrs > 0) text += `${hrs} giờ `;
        text += `${mins} phút ${secs} giây`;
        setCountdownText(text);
        return false;
      };

      const ended = updateCountdown();
      if (!ended) {
        const interval = setInterval(() => {
          const stop = updateCountdown();
          if (stop) clearInterval(interval);
        }, 1000);
        return () => clearInterval(interval);
      }
    }
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

  const handleCopyRoomId = () => {
    if (!room) return;
    navigator.clipboard.writeText(room.roomId);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  // Movie stream states
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [activeEpisodeIndex, setActiveEpisodeIndex] = useState(0);
  const [playerType, setPlayerType] = useState<"hls" | "embed">("hls");

  // Chat/Messages states
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [viewerCount, setViewerCount] = useState(1);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);

  // Refs for players and socket
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<any>(null);
  const socketRef = useRef<any>(null);
  const isSyncingRef = useRef<boolean>(false);
  const playerContainerRef = useRef<HTMLDivElement | null>(null);

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
        const roomRes = await fetch(`${API_URL}/rooms/${roomId}`);
        if (!roomRes.ok) {
          throw new Error("Phòng xem chung không tồn tại hoặc đã bị đóng.");
        }
        const roomData = await roomRes.json();
        setRoom(roomData);

        // 2. Khởi tạo tin nhắn chào mừng hệ thống & nạp lịch sử chat từ database
        const welcomeMsg: Message = {
          id: "sys-welcome",
          sender: "Hệ Thống",
          text: `📢 Chào mừng bạn đến với phòng xem chung "${roomData.roomName}". Cùng xem phim vui vẻ nhé!`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isSystem: true,
        };

        try {
          const messagesRes = await fetch(`${API_URL}/rooms/${roomId}/messages`);
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

          if (epSlug) {
            const activeIndex = episodesList.findIndex((ep: any) => ep.slug === epSlug);
            setActiveEpisodeIndex(activeIndex !== -1 ? activeIndex : 0);
          } else {
            setActiveEpisodeIndex(0);
          }

          // Mặc định chọn HLS player nếu có m3u8
          const hasHls = episodesList.some((ep: any) => ep.link_m3u8);
          setPlayerType(hasHls ? "hls" : "embed");
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

        // 3. Lấy thông tin phim từ OPhim API chạy nền bất đồng bộ (không làm nghẽn socket/chat)
        fetch(getProxyUrl(`https://ophim1.com/v1/api/phim/${roomData.movieSlug}`))
          .then(res => {
            if (res.ok) return res.json();
            throw new Error("Lỗi API kết nối OPhim");
          })
          .then(movieData => {
            if (movieData.status === true || movieData.status === "success") {
              const episodesList = movieData.data?.item?.episodes?.[0]?.server_data || [];
              handleLoadEpisodes(episodesList);
            } else {
              fetchCustomMovie(roomData.movieSlug);
            }
          })
          .catch(movieErr => {
            console.warn("Không tìm thấy trên OPhim, thử tìm phim Custom...", movieErr.message);
            fetchCustomMovie(roomData.movieSlug);
          });

      } catch (err: any) {
        console.error(err);
        setError(err.message || "Lỗi tải phòng xem chung.");
        setLoading(false);
      }
    }

    fetchRoomAndMovie();
  }, [roomId]);

  const isHost = user && room && (room.host._id === user.id || room.host._id === (user as any)._id || (room.host as any) === user.id || (room.host as any) === (user as any)._id);

  // Quản lý kết nối Socket.io Realtime
  useEffect(() => {
    if (!room || loading || authLoading) return;

    // Khởi tạo socket.io client
    const socketHost = API_URL.replace("/api", "");
    const socket = io(socketHost);
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[Socket] Connected successfully!");
      setSocketError(null);
    });

    socket.on("connect_error", (err) => {
      console.error("[Socket] Connection error:", err.message);
      setSocketError(`Mất kết nối máy chủ chat: ${err.message}`);
    });

    socket.on("disconnect", (reason) => {
      console.warn("[Socket] Disconnected:", reason);
      setSocketError(`Mất kết nối: ${reason}`);
    });

    // Tham gia phòng xem chung
    socket.emit("join_room", {
      roomId: room.roomId,
      userId: user ? (user.id || (user as any)._id) : `guest-${Date.now()}`,
      name: user ? user.displayName : `Khách ${Math.floor(Math.random() * 1000)}`,
      avatar: user?.avatar,
      isHost: !!isHost,
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

    // Lắng nghe thông báo phòng bị đóng
    socket.on("room_closed", () => {
      setRoomClosedModal(true);
    });

    // Lắng nghe tín hiệu đồng bộ video của Host gửi xuống (chỉ Member mới thực thi)
    socket.on("video_state", (state: { action: "play" | "pause" | "seek"; currentTime: number }) => {
      if (isHost) return; // Host không bao giờ bị member điều khiển ngược
      const video = videoRef.current;
      if (!video) return;

      isSyncingRef.current = true;
      if (state.action === "play") {
        const startTimeMs = room?.startTime ? new Date(room.startTime).getTime() : 0;
        if (!startTimeMs || Date.now() >= startTimeMs) {
          setHasMovieStarted(true);
        }
        video.play().catch(() => {});
      } else if (state.action === "pause") {
        video.pause();
      } else if (state.action === "seek") {
        if (Math.abs(video.currentTime - state.currentTime) > 2.5) {
          video.currentTime = state.currentTime;
        }
      }
      
      // Mở khóa cờ đồng bộ sau khi lệnh thực thi hoàn tất
      setTimeout(() => {
        isSyncingRef.current = false;
      }, 500);
    });

    // Khi member mới join hoặc F5 → server gửi snapshot để seek đúng vị trí host
    socket.on("sync_state", (state: { currentTime: number; episodeIndex: number; episodeSlug: string; action: "play" | "pause" }) => {
      if (isHost) return;
      console.log("[Socket] Received sync_state snapshot:", state);
      
      const startTimeMs = room?.startTime ? new Date(room.startTime).getTime() : 0;
      if (!startTimeMs || Date.now() >= startTimeMs) {
        setHasMovieStarted(true);
      }

      // Chuyển đúng tập trước
      setActiveEpisodeIndex(state.episodeIndex);

      // Sau khi video element sẵn sàng thì seek tới đúng thời gian
      const seekWhenReady = () => {
        const video = videoRef.current;
        if (!video) return;

        const doSeek = () => {
          if (state.currentTime > 2) {
            isSyncingRef.current = true;
            video.currentTime = state.currentTime;
            setTimeout(() => { isSyncingRef.current = false; }, 500);
          }
        };

        if (video.readyState >= 2) {
          doSeek();
        } else {
          video.addEventListener("canplay", doSeek, { once: true });
        }
      };

      // Chờ một chút để player khởi tạo xong sau khi đổi tập
      setTimeout(seekWhenReady, 1500);
    });

    // Lắng nghe tín hiệu khán giả hối thúc mở phòng chiếu (chỉ Host mới nhận và hiển thị Toast)
    socket.on("host_reminder", (data: { guestName: string }) => {
      if (isHost) {
        setReminderToast(`🔔 ${data.guestName} đang hối thúc bạn bắt đầu chiếu phim kìa!`);
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [room, user, isHost]);

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

  // Khởi tạo trình phát HLS.js thuần kết hợp video controls của trình duyệt để tránh lỗi DOM Plyr
  useEffect(() => {
    let active = true;
    const activeEp = episodes[activeEpisodeIndex];

    if (playerType === "hls" && activeEp?.link_m3u8) {
      if (currentM3u8Ref.current === activeEp.link_m3u8) {
        return; // Đã load nguồn phát này rồi, không khởi tạo lại nữa
      }

      const scriptId = "dlowphim-hls-script";
      let script = document.getElementById(scriptId) as HTMLScriptElement;

      const initPlayer = async () => {
        if (!active) return;
        const Hls = (window as any).Hls;
        const video = videoRef.current;
        if (!video) return;

        currentM3u8Ref.current = activeEp.link_m3u8;

        // Dọn dẹp Hls instance cũ
        if (hlsRef.current) {
          try { hlsRef.current.destroy(); } catch (e) {}
          hlsRef.current = null;
        }

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

        // Gỡ các listener cũ nếu có
        if ((video as any)._dlowListeners) {
          const old = (video as any)._dlowListeners;
          video.removeEventListener("play", old.onPlay);
          video.removeEventListener("pause", old.onPause);
          video.removeEventListener("seeked", old.onSeeked);
        }

        // Gắn listener mới
        video.addEventListener("play", onPlay);
        video.addEventListener("pause", onPause);
        video.addEventListener("seeked", onSeeked);
        (video as any)._dlowListeners = { onPlay, onPause, onSeeked };

        if (Hls && Hls.isSupported()) {
          const hls = new Hls();
          hls.loadSource(activeEp.link_m3u8);
          hls.attachMedia(video);
          hlsRef.current = hls;

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (!active) return;
          });
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
          // Hỗ trợ HLS native cho Safari / iOS
          video.src = activeEp.link_m3u8;
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
      const video = videoRef.current;
      if (video && (video as any)._dlowListeners) {
        const { onPlay, onPause, onSeeked } = (video as any)._dlowListeners;
        video.removeEventListener("play", onPlay);
        video.removeEventListener("pause", onPause);
        video.removeEventListener("seeked", onSeeked);
        delete (video as any)._dlowListeners;
      }
      if (hlsRef.current) {
        try { hlsRef.current.destroy(); } catch (e) {}
        hlsRef.current = null;
      }
      currentM3u8Ref.current = "";
    };
  }, [playerType, activeEpisodeIndex, episodes]);

  // Dọn dẹp tài nguyên khi unmount khỏi phòng
  useEffect(() => {
    return () => {
      if (hlsRef.current) {
        try { hlsRef.current.destroy(); } catch (e) {}
        hlsRef.current = null;
      }
      currentM3u8Ref.current = "";
    };
  }, []);


  // Gửi tin nhắn
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !socketRef.current) return;

    socketRef.current.emit("send_message", {
      roomId: room?.roomId,
      userId: user?.id,
      name: user?.displayName || "Khách",
      avatar: user?.avatar,
      text: messageInput.trim(),
    });

    setMessageInput("");
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
      const token = Cookies.get("token");
      const res = await fetch(`${API_URL}/rooms/${room.roomId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        router.push(`/watch/${room.movieSlug}`);
      } else {
        alert("Đóng phòng thất bại.");
      }
    } catch (e) {
      console.error(e);
      alert("Lỗi kết nối.");
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
                  title="Click để sao chép mã phòng"
                >
                  <span>Mã phòng: {room.roomId}</span>
                  {codeCopied ? (
                    <span className="text-[10px] text-green-400 font-bold bg-green-500/10 px-1.5 py-0.2 rounded flex items-center gap-0.5 border border-green-500/20 animate-in zoom-in-95 duration-150">
                      <Check size={10} /> Đã chép
                    </span>
                  ) : (
                    <Copy size={12} className="text-pink-400" />
                  )}
                </button>
              </div>
              <p className="text-xs text-zinc-500 font-semibold uppercase flex items-center gap-1.5 mt-0.5">
                <Film size={12} className="text-pink-500" />
                Đang phát: {cleanMovieName(room.movieName)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-left shrink-0">
              <span className="text-[10px] text-zinc-550 block font-bold uppercase tracking-wider text-right">Trưởng phòng</span>
              <span className="text-xs text-zinc-300 font-bold">{room.host.name}</span>
            </div>

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
              <div ref={playerContainerRef} className="relative w-full aspect-video bg-black overflow-hidden group">
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
                {!isHost && !hasMovieStarted ? (
                  <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#07070a] px-6 text-center select-none">
                    {posterUrl && (
                      <Image
                        src={getImageUrl(posterUrl)}
                        alt=""
                        fill
                        className="object-cover blur-[25px] opacity-20 pointer-events-none"
                        unoptimized
                      />
                    )}
                    <HalftoneOverlay />
                    
                    <div className="w-20 h-20 rounded-3xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center mb-6 animate-pulse shadow-[0_0_30px_rgba(245,158,11,0.2)]">
                      <Clock size={36} className="text-amber-400 animate-[spin_8s_linear_infinite]" />
                    </div>
                    
                    <div className="max-w-md space-y-4">
                      <span className="inline-flex items-center gap-1.5 bg-amber-500/15 border border-amber-500/35 text-amber-400 text-xs font-black uppercase tracking-widest px-4 py-2 rounded-full">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                        Đang Chờ Công Chiếu
                      </span>
                      <h2 className="text-2xl md:text-3xl font-black text-zinc-500 uppercase tracking-tight drop-shadow-md">
                        {room?.movieName ? cleanMovieName(room.movieName) : "Phim sắp chiếu"}
                      </h2>
                      <p className="text-sm md:text-base text-zinc-400 font-bold leading-relaxed">
                        Thời gian chiếu: <span className="text-zinc-100 font-extrabold">{room?.startTime ? new Date(room.startTime).toLocaleString("vi-VN") : "Đang chờ Trưởng phòng"}</span>
                      </p>
                      
                      {countdownText && (
                        <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl px-7 py-4.5 mt-5 inline-block shadow-lg">
                          <p className="text-[10px] text-zinc-550 font-black uppercase tracking-wider mb-1">Bắt đầu sau</p>
                          <p className="text-2xl md:text-3xl font-black text-amber-400 tracking-tight drop-shadow">{countdownText}</p>
                        </div>
                      )}
                      
                      <p className="text-xs md:text-sm text-zinc-400 mt-4 leading-relaxed max-w-sm mx-auto">
                        Bạn vẫn có thể gửi tin nhắn trò chuyện ở ô chat bên cạnh trong lúc chờ đợi nhé!
                      </p>

                      {/* Nút hối thúc chủ phòng */}
                      <button
                        disabled={hasUrgedHost}
                        onClick={() => {
                          socketRef.current?.emit("request_start_movie", {
                            roomId: room?.roomId,
                            guestName: user?.displayName || "Khán giả ẩn danh",
                          });
                          setHasUrgedHost(true);
                        }}
                        className={`mt-5 px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer border ${
                          hasUrgedHost
                            ? "bg-zinc-900 text-zinc-650 border-zinc-800 cursor-not-allowed shadow-inner"
                            : "bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white border-pink-500/20 shadow-lg shadow-pink-500/20 hover:shadow-pink-500/35"
                        }`}
                      >
                        {hasUrgedHost ? "🔔 Đã gửi tín hiệu nhắc" : "🔔 Hối thúc Trưởng phòng"}
                      </button>
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
                        className="w-full h-full bg-black"
                        title="DlowPhim Watch Together Player"
                        onContextMenu={(e) => { if (!isHost) e.preventDefault(); }}
                      />

                      {/* Overlay chặn member tua/play/pause nhưng cho thao tác volume & full screen */}
                      {!isHost && (
                        <div
                          className="absolute inset-0 z-10"
                          onMouseDown={(e) => { if (e.target === e.currentTarget) e.preventDefault(); }}
                          onClick={(e) => { if (e.target === e.currentTarget) e.preventDefault(); }}
                          onDoubleClick={(e) => { if (e.target === e.currentTarget) e.preventDefault(); }}
                        >
                          {/* Vùng chặn click chính */}
                          <div className="absolute inset-0 z-10 cursor-not-allowed" />

                          {/* Dải nút điều khiển phụ ở đáy (vẫn cho tương tác) */}
                          <div className="absolute bottom-3 left-3 right-3 z-20 flex items-center justify-between pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            {/* Badge thông báo + Mute button */}
                            <div className="flex items-center gap-2 pointer-events-auto">
                              <div className="flex items-center gap-1.5 bg-black/80 backdrop-blur-md px-3 py-2 rounded-xl border border-white/10 select-none shadow-lg">
                                <Volume2 size={12} className="text-zinc-400" />
                                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">Chỉ xem — Trưởng phòng điều khiển</span>
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
                                className="h-8 w-8 rounded-xl bg-black/80 backdrop-blur-md border border-white/10 hover:border-pink-500/40 text-zinc-300 hover:text-white flex items-center justify-center transition-all cursor-pointer shadow-lg active:scale-90"
                                title={isMuted ? "Bật âm thanh" : "Tắt âm thanh"}
                              >
                                {isMuted ? <VolumeX size={14} className="text-pink-400" /> : <Volume2 size={14} />}
                              </button>
                            </div>

                            {/* Nút phóng to */}
                            <div className="pointer-events-auto">
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  const container = playerContainerRef.current;
                                  if (container) {
                                    if (document.fullscreenElement) {
                                      document.exitFullscreen().catch(() => {});
                                    } else {
                                      if (container.requestFullscreen) {
                                        container.requestFullscreen();
                                      } else if ((container as any).webkitRequestFullscreen) {
                                        (container as any).webkitRequestFullscreen();
                                      }
                                    }
                                  }
                                }}
                                className="h-8 w-8 rounded-xl bg-black/80 backdrop-blur-md border border-white/10 hover:border-pink-500/40 text-zinc-300 hover:text-white flex items-center justify-center transition-all cursor-pointer shadow-lg active:scale-90"
                                title="Toàn màn hình"
                              >
                                <Maximize size={14} />
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
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer border-none active:scale-90 ${
                    isAiActive
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
            <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4 text-left scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
              {messages.map((msg) => {
                if (msg.isSystem) {
                  return (
                    <div key={msg.id} className="w-full text-center py-2 animate-in fade-in zoom-in-95 duration-200">
                      <span className="text-[10px] text-zinc-500 font-extrabold bg-zinc-950/40 border border-zinc-900/30 px-3 py-1 rounded-full leading-normal max-w-[90%] inline-block backdrop-blur-sm italic">
                        📢 {msg.text}
                      </span>
                    </div>
                  );
                }

                const isMe = user && msg.sender === user.displayName;
                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-2.5 max-w-[85%] animate-in fade-in duration-200 ${
                      isMe ? "ml-auto flex-row-reverse" : ""
                    }`}
                  >
                    {/* Avatar */}
                    <div className={`w-7 h-7 rounded-full overflow-hidden shrink-0 bg-zinc-900 shadow-md border-2 transition-all ${
                      room && msg.senderId === room.host._id
                        ? "border-pink-500 shadow-lg shadow-pink-500/25 scale-105"
                        : "border-zinc-850/30"
                    }`}>
                      <img
                        src={msg.avatar || "https://img.ophim.live/uploads/movies/default-avatar.png"}
                        alt={msg.sender}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className={`flex flex-col space-y-1 ${isMe ? "items-end" : "items-start"}`}>
                      {/* Name & Time */}
                      <div className={`flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider select-none ${
                        isMe ? "justify-end text-pink-400" : msg.senderId === 'dlow-ai-bot' ? "text-purple-400" : "text-zinc-500"
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

                      {/* Bubble */}
                      <div className={`px-3 py-2 rounded-2xl text-[11px] font-bold leading-relaxed whitespace-pre-wrap break-words w-fit max-w-full ${
                        isMe
                          ? "bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-tr-none shadow-md shadow-pink-500/20"
                          : msg.senderId === 'dlow-ai-bot'
                            ? "bg-gradient-to-br from-[#2f225e] to-[#1a1438] text-purple-100 rounded-tl-none border border-purple-400/35 shadow-md shadow-purple-500/10"
                            : "bg-[#25283b]/85 backdrop-blur-sm text-zinc-100 rounded-tl-none border border-zinc-700/50"
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
                className="w-10 h-10 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-pink-500/20 hover:scale-105 hover:shadow-pink-500/35 active:scale-95 transition-all cursor-pointer border-none"
              >
                <Send size={13} className="translate-x-0.5 -translate-y-0.5" />
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
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0e0f16] border border-red-500/20 rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.8),0_0_0_1px_rgba(239,68,68,0.1)] p-7 max-w-sm w-[90%] text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto">
              <AlertCircle size={28} className="text-red-400" />
            </div>
            <div>
              <h3 className="text-base font-black text-zinc-100 mb-1">Phòng đã bị đóng</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">Phòng xem chung đã bị đóng hoặc Trưởng phòng đã rời đi quá lâu.</p>
            </div>
            <button
              onClick={() => { setRoomClosedModal(false); router.push(`/watch/${room?.movieSlug}`); }}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-black text-sm transition-all active:scale-95 cursor-pointer border-none shadow-lg shadow-pink-500/20"
            >
              Về trang phim
            </button>
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
