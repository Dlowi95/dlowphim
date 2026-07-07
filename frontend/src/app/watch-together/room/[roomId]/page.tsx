"use client";

export const dynamic = "force-dynamic";

import React, { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Film, Send, Sparkles, MessageSquare, Users, Trash2, Calendar, Tv, Volume2, AlertCircle, Copy, Check, Bot } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import Cookies from "js-cookie";
import { cleanMovieName } from "@/utils/movieUtils";
import { getProxyUrl } from "@/utils/api";
import EpisodeSelector from "@/components/EpisodeSelector";
import { io } from "socket.io-client";

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
      alert("Phòng xem chung đã bị đóng hoặc Trưởng phòng đã rời đi quá lâu.");
      router.push(`/watch/${room.movieSlug}`);
    });

    // Lắng nghe tín hiệu đồng bộ video của Host gửi xuống (chỉ Member mới thực thi)
    socket.on("video_state", (state: { action: "play" | "pause" | "seek"; currentTime: number }) => {
      if (isHost) return; // Host không bao giờ bị member điều khiển ngược
      const video = videoRef.current;
      if (!video) return;

      isSyncingRef.current = true;
      if (state.action === "play") {
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

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [room, user, isHost]);

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
    const confirm = window.confirm("Bạn có chắc chắn muốn đóng phòng xem chung này không? Tất cả mọi người sẽ bị rời khỏi phòng.");
    if (!confirm) return;

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

  return (
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
          
          {/* CỘT TRÁI (LỚN): Video Player & Server Episodes */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Khung Player */}
            <div className="w-full overflow-hidden bg-black rounded-3xl shadow-[0_15px_45px_rgba(0,0,0,0.85)] relative">
              <div className="relative w-full aspect-video bg-black overflow-hidden group">
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
                    <video
                      id="dlow-room-video"
                      ref={videoRef}
                      playsInline
                      controls
                      className="w-full h-full bg-black"
                      title="DlowPhim Watch Together Player"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-zinc-900">
                      <Tv size={44} className="text-zinc-650 animate-pulse" />
                      <p className="text-zinc-500 text-xs font-bold">Nguồn phát HLS bị lỗi hoặc không khả dụng!</p>
                    </div>
                  )
                )}
              </div>
            </div>

            {/* Danh sách tập phim */}
            {episodes.length > 1 && (
              <div className="bg-[#0e0f17]/40 p-5 rounded-2xl space-y-3.5 text-left">
                <span className="block text-xs font-black text-zinc-455 uppercase tracking-wider select-none">
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
            )}
          </div>

          {/* CỘT PHẢI (NHỎ): Chatbox Realtime */}
            <div className="lg:col-span-4 bg-[#161622]/95 backdrop-blur-md border border-zinc-800/80 rounded-3xl h-[650px] flex flex-col overflow-hidden relative shadow-2xl shadow-black/80">
            
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
    </div>
  );
}
