"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Film, Send, Sparkles, MessageSquare, Users, Trash2, Calendar, Tv, Volume2, AlertCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import Cookies from "js-cookie";
import { cleanMovieName } from "@/utils/movieUtils";
import { getProxyUrl } from "@/utils/api";
import EpisodeSelector from "@/components/EpisodeSelector";

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
  const { user } = useAuth();

  const [room, setRoom] = useState<RoomDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Movie stream states
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [activeEpisodeIndex, setActiveEpisodeIndex] = useState(0);
  const [playerType, setPlayerType] = useState<"hls" | "embed">("hls");

  // Chat/Messages states
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Refs for players
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const plyrRef = useRef<any>(null);
  const hlsRef = useRef<any>(null);

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

        // 2. Lấy thông tin phim từ OPhim API để load nguồn phát
        const movieRes = await fetch(getProxyUrl(`https://ophim1.com/v1/api/phim/${roomData.movieSlug}`));
        if (movieRes.ok) {
          const movieData = await movieRes.json();
          if (movieData.status === true || movieData.status === "success") {
            const episodesList = movieData.data?.item?.episodes?.[0]?.server_data || [];
            setEpisodes(episodesList);

            // Mặc định chọn HLS player nếu có m3u8
            const hasHls = episodesList.some((ep: any) => ep.link_m3u8);
            setPlayerType(hasHls ? "hls" : "embed");
          }
        }

        // 3. Khởi tạo tin nhắn chào mừng hệ thống
        setMessages([
          {
            id: "sys-welcome",
            sender: "Hệ Thống",
            text: `Chào mừng bạn đến với phòng xem chung "${roomData.roomName}". Cùng xem phim vui vẻ nhé!`,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isSystem: true,
          }
        ]);

      } catch (err: any) {
        console.error(err);
        setError(err.message || "Lỗi tải phòng xem chung.");
      } finally {
        setLoading(false);
      }
    }

    fetchRoomAndMovie();
  }, [roomId]);

  // Lưu link m3u8 đang phát hiện tại để tránh khởi tạo lại nhiều lần gây lỗi blob URL
  const currentM3u8Ref = useRef<string>("");

  // Khởi tạo trình phát Plyr + HLS.js
  useEffect(() => {
    let active = true;
    const activeEp = episodes[activeEpisodeIndex];

    if (playerType === "hls" && activeEp?.link_m3u8) {
      if (currentM3u8Ref.current === activeEp.link_m3u8) {
        return; // Đã load nguồn phát này rồi, không khởi tạo lại nữa
      }
      currentM3u8Ref.current = activeEp.link_m3u8;

      const scriptId = "dlowphim-hls-script";
      let script = document.getElementById(scriptId) as HTMLScriptElement;

      const initPlayer = async () => {
        if (!active) return;
        const Hls = (window as any).Hls;
        const video = videoRef.current;
        if (!video) return;

        // Dọn dẹp các instance cũ
        if (plyrRef.current) {
          try { plyrRef.current.destroy(); } catch (e) {}
          plyrRef.current = null;
        }
        if (hlsRef.current) {
          try { hlsRef.current.destroy(); } catch (e) {}
          hlsRef.current = null;
        }

        const PlyrClass = (await import("plyr")).default;

        if (Hls && Hls.isSupported()) {
          const hls = new Hls();
          hls.loadSource(activeEp.link_m3u8);
          hls.attachMedia(video);
          hlsRef.current = hls;

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (!active) return;

            const player = new PlyrClass(video, {
              controls: [
                "play-large", "play", "progress", "current-time",
                "duration", "mute", "volume", "settings", "pip", "fullscreen"
              ],
              settings: ["quality", "speed"],
              speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 2] },
              quality: { default: 1080, options: [1080, 720, 480, 360] },
            });
            plyrRef.current = player;
          });
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
          // Hỗ trợ HLS native cho Safari / iOS
          video.src = activeEp.link_m3u8;
          const player = new PlyrClass(video, {
            controls: [
              "play-large", "play", "progress", "current-time",
              "duration", "mute", "volume", "settings", "pip", "fullscreen"
            ],
            settings: ["quality", "speed"],
            speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 2] },
            quality: { default: 1080, options: [1080, 720, 480, 360] },
          });
          plyrRef.current = player;
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
    };
  }, [playerType, activeEpisodeIndex, episodes]);

  // Dọn dẹp tài nguyên khi unmount khỏi phòng
  useEffect(() => {
    return () => {
      if (plyrRef.current) {
        try { plyrRef.current.destroy(); } catch (e) {}
        plyrRef.current = null;
      }
      if (hlsRef.current) {
        try { hlsRef.current.destroy(); } catch (e) {}
        hlsRef.current = null;
      }
      currentM3u8Ref.current = "";
    };
  }, []);

  // Tự động cuộn xuống đáy tin nhắn
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Gửi tin nhắn
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim()) return;

    const newMsg: Message = {
      id: `msg-${Date.now()}-${Math.random()}`,
      sender: user?.displayName || "Khách",
      avatar: user?.avatar,
      text: messageInput.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, newMsg]);
    setMessageInput("");

    // Bot trả lời tự động giả lập để tạo độ sinh động khi test
    setTimeout(() => {
      const responses = [
        "Phim này hay thật sự!",
        "Phân cảnh này đẹp quá dã man.",
        "Nhạc phim hay ghê luôn á.",
        "Mọi người xem phim mượt không?",
        "Tập phim đang load ngon lành nha.",
      ];
      const botMsg: Message = {
        id: `msg-bot-${Date.now()}`,
        sender: "Thành Viên Khác",
        text: responses[Math.floor(Math.random() * responses.length)],
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, botMsg]);
    }, 2500);
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

  const isHost = user && room.host._id === user.id;
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
                <span className="bg-pink-500/10 text-pink-400 font-extrabold text-[9px] px-2 py-0.5 rounded border border-pink-500/20 uppercase tracking-wider shrink-0 select-none">
                  Mã phòng: {room.roomId}
                </span>
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
                  onSelectEpisode={(idx) => setActiveEpisodeIndex(idx)}
                  batchSize={40}
                />
              </div>
            )}
          </div>

          {/* CỘT PHẢI (NHỎ): Chatbox Realtime */}
          <div className="lg:col-span-4 bg-[#0e0f17]/40 border border-zinc-900 rounded-3xl h-[650px] flex flex-col overflow-hidden relative shadow-2xl">
            
            {/* Chatbox Header */}
            <div className="p-4 border-b border-zinc-900 bg-zinc-950/45 flex items-center gap-2 select-none">
              <MessageSquare size={16} className="text-pink-500" />
              <span className="text-xs font-black text-zinc-300 uppercase tracking-wider">Hộp thoại xem chung</span>
              
              <div className="ml-auto flex items-center gap-1 text-[10px] text-zinc-500 font-extrabold bg-[#1b1d2a] border border-zinc-850 px-2.5 py-0.5 rounded-full">
                <Users size={10} className="text-pink-500 shrink-0" />
                <span>2 Đang xem</span>
              </div>
            </div>

            {/* List tin nhắn */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-none text-left">
              {messages.map((msg) => {
                if (msg.isSystem) {
                  return (
                    <div key={msg.id} className="w-full text-center py-2 animate-in fade-in zoom-in-95 duration-200">
                      <span className="text-[10px] text-zinc-550 font-bold bg-[#131422] border border-zinc-850/50 px-3 py-1 rounded-full leading-normal max-w-full inline-block">
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
                    <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 border border-zinc-800 bg-zinc-900">
                      <img
                        src={msg.avatar || "https://img.ophim.live/uploads/movies/default-avatar.png"}
                        alt={msg.sender}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="space-y-1">
                      {/* Name & Time */}
                      <div className={`flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider select-none ${
                        isMe ? "justify-end text-pink-400" : "text-zinc-500"
                      }`}>
                        <span>{msg.sender}</span>
                        <span>•</span>
                        <span>{msg.time}</span>
                      </div>

                      {/* Bubble */}
                      <div className={`px-3 py-2 rounded-2xl text-[11px] font-bold leading-relaxed whitespace-pre-wrap break-words ${
                        isMe
                          ? "bg-pink-500 text-white rounded-tr-none shadow-md shadow-pink-500/10"
                          : "bg-[#181926] text-zinc-200 rounded-tl-none border border-zinc-900/60"
                      }`}>
                        {msg.text}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input gửi tin nhắn */}
            <form onSubmit={handleSendMessage} className="p-3 border-t border-zinc-900 bg-zinc-950/45 flex items-center gap-2">
              <input
                type="text"
                required
                placeholder="Nhập nội dung trò chuyện..."
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                className="flex-1 h-9.5 bg-zinc-950 border border-zinc-850 hover:border-zinc-800 focus:border-pink-500 rounded-xl px-3.5 text-xs text-zinc-200 outline-none font-bold transition-colors"
                maxLength={200}
              />
              <button
                type="submit"
                className="w-9.5 h-9.5 rounded-xl bg-pink-500 hover:bg-pink-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-pink-500/20 hover:scale-105 active:scale-95 transition-all cursor-pointer border-none"
              >
                <Send size={14} className="translate-x-0.2 -translate-y-0.2" />
              </button>
            </form>

          </div>

        </div>

      </div>
    </div>
  );
}
