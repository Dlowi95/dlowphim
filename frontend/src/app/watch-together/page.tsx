"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Users, Radio, Clock, X, Film, ChevronRight, Search, Bell, VideoOff, AlertCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import HalftoneOverlay from "@/components/HalftoneOverlay";
import { io } from "socket.io-client";
import { getResilientSocketOptions } from "@/lib/socket-options";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

interface PublicRoom {
  _id: string;
  roomId: string;
  movieSlug: string;
  movieName: string;
  moviePoster: string;
  posterOption: string;
  roomName: string;
  currentEpisode: string;
  status: string;
  isPrivate: boolean;
  createdAt: string;
  startTime?: string;
  host: {
    _id: string;
    displayName: string;
    email: string;
    avatar?: string;
  };
}

type RoomTab = "live" | "scheduled" | "closed";

const getRoomTab = (status: string): RoomTab => {
  if (status === "closed") return "closed";
  if (status === "scheduled") return "scheduled";
  return "live";
};

const getImageUrl = (path: string) => {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  const fileName = path.split("/").pop();
  return `https://phimimg.com/uploads/movies/${fileName}`;
};

const isCreatedToday = (dateStr: string) => {
  const d = new Date(dateStr);
  const today = new Date();
  return (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  );
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return "vừa xong";
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  return `${Math.floor(diff / 86400)} ngày trước`;
}

function getEpisodeLabel(ep: string): string {
  if (!ep || ep === "full") return "T.Full";
  // ep dạng "tap-1", "1", etc.
  const num = ep.replace(/\D/g, "");
  return num ? `T.${num}` : ep;
}

export default function WatchTogetherPage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const closedReason = searchParams.get("closed");
  const privateNotice = searchParams.get("private");

  const getClosedMessage = (reason: string | null) => {
    switch (reason) {
      case "owner":
        return "Bạn đã đóng phòng thành công. Mọi người đã được đưa về sảnh.";
      case "host":
        return "Trưởng phòng đã đóng phòng. Bạn đã được đưa về sảnh xem chung.";
      case "expired":
        return "Phòng đã tự đóng vì Trưởng phòng vắng quá 30 phút.";
      case "disconnected":
        return "Phòng đã đóng vì Trưởng phòng mất kết nối quá lâu.";
      case "replaced":
        return "Trưởng phòng đã chuyển sang một phòng xem chung khác.";
      default:
        return "Phòng xem chung đã đóng. Bạn đã được đưa về sảnh.";
    }
  };

  const [rooms, setRooms] = useState<PublicRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHowTo, setShowHowTo] = useState(false);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState<RoomTab>("live");
  const [closedToast, setClosedToast] = useState(Boolean(closedReason));
  const [closedMessage] = useState(() =>
    privateNotice === "locked"
      ? "Bạn đã nhập sai mã PIN 3 lần. Phòng đã tạm khóa quyền thử trong 15 phút."
      : getClosedMessage(closedReason)
  );

  useEffect(() => {
    if (privateNotice === "locked") setClosedToast(true);
  }, [privateNotice]);

  useEffect(() => {
    if (closedToast) {
      window.history.replaceState(null, "", "/watch-together");
      const timer = setTimeout(() => {
        setClosedToast(false);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [closedToast]);

  // Reset về trang 1 khi đổi tìm kiếm hoặc trạng thái phòng.
  useEffect(() => {
    setCurrentPage(1);
  }, [search, activeTab]);

  useEffect(() => {
    fetchRooms();
    let socketHost = API_URL;
    try {
      socketHost = new URL(API_URL).origin;
    } catch {
      // Giữ nguyên URL đã cấu hình nếu đây đã là socket endpoint hợp lệ.
    }

    const socket = io(socketHost, getResilientSocketOptions());
    let hasConnected = false;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;

    socket.on("connect", () => {
      socket.emit("join_lobby");
      if (hasConnected) fetchRooms();
      hasConnected = true;
    });
    socket.on("rooms_changed", () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(fetchRooms, 200);
    });

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      socket.disconnect();
    };
  }, []);

  async function fetchRooms() {
    try {
      const res = await fetch(`${API_URL}/rooms/public`);
      if (res.ok) {
        const data = await res.json();
        setRooms(data);
      }
    } catch (e) {
      console.error("Lỗi tải danh sách phòng:", e);
    } finally {
      setLoading(false);
    }
  }

  const handleCreateNew = () => {
    if (!user) {
      router.push("/");
      return;
    }
    setShowHowTo(true);
  };

  const todayRooms = rooms.filter((room) => isCreatedToday(room.createdAt));
  const tabCounts = todayRooms.reduce<Record<RoomTab, number>>(
    (counts, room) => {
      counts[getRoomTab(room.status)] += 1;
      return counts;
    },
    { live: 0, scheduled: 0, closed: 0 },
  );
  const activeRoomCount = tabCounts.live + tabCounts.scheduled;
  const filtered = todayRooms.filter(
    (r) =>
      getRoomTab(r.status) === activeTab &&
      ((r.roomName || "").toLowerCase().includes(search.toLowerCase()) ||
        (r.movieName || "").toLowerCase().includes(search.toLowerCase()) ||
        (r.host?.displayName || "").toLowerCase().includes(search.toLowerCase()))
  );

  const roomsPerPage = 8;
  const totalPages = Math.ceil(filtered.length / roomsPerPage);
  const startIndex = (currentPage - 1) * roomsPerPage;
  const paginatedRooms = filtered.slice(startIndex, startIndex + roomsPerPage);

  return (
    <div className="min-h-screen bg-[#07070a] text-white">
      {/* Toast thông báo chủ phòng đã đóng phòng */}
      {closedToast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[9999] animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="bg-[#12131d]/95 backdrop-blur-xl border border-pink-500/30 text-white px-5 py-3 rounded-2xl shadow-[0_20px_50px_rgba(236,72,153,0.2)] flex items-center gap-3 border-l-4 border-l-pink-500">
            <div className="w-8 h-8 rounded-xl bg-pink-500/10 flex items-center justify-center shrink-0">
              <AlertCircle size={18} className="text-pink-400" />
            </div>
            <div>
              <p className="text-[10px] font-black text-pink-400 uppercase tracking-wider">Thông báo phòng xem chung</p>
              <p className="text-xs text-zinc-200 font-bold">{closedMessage}</p>
            </div>
            <button
              onClick={() => setClosedToast(false)}
              className="ml-3 text-zinc-400 hover:text-white p-1 transition-colors cursor-pointer border-none bg-transparent"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes bobbing {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        .animate-bob {
          animation: bobbing 1.8s ease-in-out infinite;
        }
      `}} />

      {/* ── HERO BANNER ── */}
      <div className="relative w-full h-[300px] md:h-[360px] overflow-hidden">
        <Image
          src="/images/cinema.png"
          alt="Xem chung banner"
          fill
          priority
          className="object-cover object-center"
        />
        {/* Chấm trắng giống banner hero */}
        <HalftoneOverlay />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#07070a] via-[#07070a]/55 to-transparent z-10" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#07070a]/40 via-transparent to-[#07070a]/40 z-10" />

        {/* Banner content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-4 z-20">
          <div className="text-center space-y-1">
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white drop-shadow-lg">
              🎬 Xem Chung
            </h1>
            <p className="text-sm text-zinc-300 font-medium">
              Cùng xem phim với bạn bè và mọi người theo thời gian thực
            </p>
          </div>

          <button
            onClick={handleCreateNew}
            className="flex items-center gap-2 px-6 py-3 rounded-full bg-white text-[#07070a] font-black text-sm hover:bg-zinc-100 active:scale-95 transition-all shadow-2xl shadow-black/50 cursor-pointer border-none"
          >
            <Plus size={16} strokeWidth={3} />
            Tạo mới
          </button>
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div className="max-w-[1300px] mx-auto px-4 md:px-6 py-8 space-y-6">
        {/* Header row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-black text-zinc-100">Xem Chung</h2>
            {/* LIVE pill */}
            <span className="flex items-center gap-1.5 bg-red-500/15 border border-red-500/30 text-red-400 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse inline-block" />
              {activeRoomCount} phòng hoạt động
            </span>
          </div>

          {/* Search */}
          <div className="relative max-w-xs w-full">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Tìm phòng, phim, host..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-zinc-900/80 border border-zinc-800 text-xs text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-pink-500 transition-colors"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-zinc-900 bg-[#0e0f17]/50 p-2">
          {([
            { id: "live" as const, label: "Đang chiếu", count: tabCounts.live, icon: Radio },
            { id: "scheduled" as const, label: "Sắp chiếu", count: tabCounts.scheduled, icon: Clock },
            { id: "closed" as const, label: "Đã kết thúc", count: tabCounts.closed, icon: VideoOff },
          ]).map((tab) => {
            const Icon = tab.icon;
            const selected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-black transition-all ${selected
                  ? "border-pink-500/40 bg-pink-500/15 text-pink-400 shadow-lg shadow-pink-500/10"
                  : "border-transparent text-zinc-500 hover:border-zinc-800 hover:bg-zinc-900 hover:text-zinc-200"
                  }`}
              >
                <Icon size={13} className={tab.id === "live" && selected ? "animate-pulse" : ""} />
                {tab.label}
                <span className={`rounded-full px-2 py-0.5 text-[9px] ${selected ? "bg-pink-500/20" : "bg-zinc-900"}`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-2 animate-pulse">
                <div className="aspect-[16/9] bg-zinc-800 rounded-xl" />
                <div className="flex gap-2">
                  <div className="w-8 h-8 rounded-full bg-zinc-800 shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-zinc-800 rounded w-3/4" />
                    <div className="h-2.5 bg-zinc-800 rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-zinc-900 flex items-center justify-center">
              <Film size={28} className="text-zinc-600" />
            </div>
            <p className="text-zinc-500 font-bold text-sm">
              {search
                ? "Không tìm thấy phòng nào phù hợp"
                : activeTab === "live"
                  ? "Chưa có phòng nào đang chiếu"
                  : activeTab === "scheduled"
                    ? "Chưa có phòng nào sắp chiếu"
                    : "Chưa có phòng nào đã kết thúc hôm nay"}
            </p>
            <button
              onClick={handleCreateNew}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-pink-500/10 hover:bg-pink-500/20 text-pink-400 border border-pink-500/20 text-xs font-bold transition-all cursor-pointer"
            >
              <Plus size={14} />
              Tạo phòng đầu tiên
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-7">
              {paginatedRooms.map((room) => (
                <RoomCard key={room._id} room={room} />
              ))}
            </div>

            {/* Điều khiển phân trang */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-12 animate-in fade-in duration-300 select-none">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  className="h-9 w-9 rounded-xl border border-zinc-800 bg-[#0e0f17]/40 text-zinc-400 hover:text-white hover:border-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-all cursor-pointer"
                >
                  &larr;
                </button>
                
                {Array.from({ length: totalPages }).map((_, idx) => {
                  const pageNum = idx + 1;
                  const isActive = pageNum === currentPage;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`h-9 w-9 rounded-xl border text-xs font-black transition-all flex items-center justify-center cursor-pointer ${
                        isActive
                          ? "bg-pink-600 border-pink-500 text-white shadow-lg shadow-pink-500/20"
                          : "border-zinc-800 bg-[#0e0f17]/40 text-zinc-400 hover:text-white hover:border-zinc-700"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  className="h-9 w-9 rounded-xl border border-zinc-800 bg-[#0e0f17]/40 text-zinc-400 hover:text-white hover:border-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-all cursor-pointer"
                >
                  &rarr;
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── MODAL: Hướng dẫn tạo phòng ── */}
      {showHowTo && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#111118] border border-zinc-800/60 rounded-2xl shadow-[0_30px_80px_rgba(0,0,0,0.9)] p-7 max-w-md w-[92%] relative">
            {/* Close */}
            <button
              onClick={() => setShowHowTo(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-zinc-200 transition-all cursor-pointer border-none"
            >
              <X size={15} />
            </button>

            <div className="mb-5">
              <h2 className="text-lg font-black text-zinc-100 mb-1">Tạo phòng xem chung</h2>
              <p className="text-xs text-zinc-500">Hướng dẫn nhanh cách tạo phòng xem chung</p>
            </div>

            <div className="space-y-0 divide-y divide-zinc-800/60">
              {[
                { n: 1, text: "Tìm phim bạn muốn xem chung." },
                {
                  n: 2,
                  text: null,
                  jsx: (
                    <span className="text-zinc-300 text-sm leading-relaxed">
                      Chuyển tới trang xem của tập phim đó, chọn biểu tượng{" "}
                      <span className="inline-flex items-center gap-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-0.5 text-xs font-bold text-pink-400">
                        <Users size={11} />
                        Xem chung
                      </span>{" "}
                      trên thanh công cụ phía dưới player.
                    </span>
                  ),
                },
                { n: 3, text: "Điền thông tin và cài đặt thời gian chiếu." },
                { n: 4, text: "Hoàn thành và chia sẻ link phòng cho bạn bè." },
              ].map((step) => (
                <div key={step.n} className="flex items-start gap-4 py-4">
                  <span className="w-7 h-7 rounded-full bg-zinc-800 text-zinc-400 font-black text-sm flex items-center justify-center shrink-0">
                    {step.n}
                  </span>
                  {step.jsx ? (
                    step.jsx
                  ) : (
                    <p className="text-zinc-300 text-sm leading-relaxed pt-1">{step.text}</p>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowHowTo(false)}
              className="mt-5 w-full py-3 rounded-xl bg-white hover:bg-zinc-100 text-[#07070a] font-black text-sm transition-all active:scale-95 cursor-pointer border-none"
            >
              Đã hiểu
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface RoomState {
  type: "live" | "upcoming" | "ended";
  label: string;
}

const getRoomState = (status: string, startTime?: string): RoomState => {
  if (status === "closed") {
    return { type: "ended", label: "Đã kết thúc" };
  }
  if (status === "scheduled") {
    const start = startTime ? new Date(startTime).getTime() : Number.NaN;
    return {
      type: "upcoming",
      label: Number.isFinite(start) && start <= Date.now()
        ? "Chờ trưởng phòng"
        : "Sắp chiếu",
    };
  }
  return { type: "live", label: "LIVE" };
};

/* ── ROOM CARD ── */
function RoomCard({ room }: { room: PublicRoom }) {
  const { user } = useAuth();
  const epLabel = getEpisodeLabel(room.currentEpisode);
  const [notified, setNotified] = useState(false);

  // Avatar fallback
  const hostInitial = (room.host?.displayName || "?")[0].toUpperCase();
  const posterUrl = room.posterOption || room.moviePoster;
  const state = getRoomState(room.status, room.startTime);
  const cardHref = state.type === "ended"
    ? `/watch/${room.movieSlug}`
    : `/watch-together/room/${room.roomId}`;
  const isLive = state.type === "live";
  const avatarBorderClass = isLive 
    ? "border-[2.5px] border-red-500 shadow-[0_0_12px_rgba(239,68,68,0.55)] animate-bob"
    : "border border-zinc-800 shadow-none";
  const avatarBgClass = isLive
    ? "from-pink-500 to-rose-600"
    : "from-zinc-800 to-zinc-900";

  const hostId = room.host?._id || (typeof room.host === "string" ? room.host : "");
  const userId = user?.id || (user as any)?._id || "";
  const isRoomHost = !!(hostId && userId && hostId === userId);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("dlow_notified_rooms");
      if (saved) {
        const list = JSON.parse(saved);
        if (list.includes(room.roomId)) {
          setNotified(true);
        }
      }
    } catch (e) {}
  }, [room.roomId]);

  const handleNotify = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const saved = localStorage.getItem("dlow_notified_rooms");
      let list = saved ? JSON.parse(saved) : [];
      if (list.includes(room.roomId)) {
        list = list.filter((id: string) => id !== room.roomId);
        setNotified(false);
      } else {
        list.push(room.roomId);
        setNotified(true);

        // Phát tín hiệu nhắc nhở gửi về chuông của chủ phòng
        fetch(`${API_URL}/rooms/${room.roomId}/notify-host`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ guestName: user?.displayName || "Khán giả ẩn danh" }),
        }).catch((err) => console.error("Failed to notify host:", err));
      }
      localStorage.setItem("dlow_notified_rooms", JSON.stringify(list));
    } catch (err) {}
  };

  const [roomImgSrc, setRoomImgSrc] = useState<string>(() => getImageUrl(posterUrl));
  const [roomFailed, setRoomFailed] = useState(false);

  useEffect(() => {
    setRoomImgSrc(getImageUrl(posterUrl));
    setRoomFailed(false);
  }, [posterUrl, room.movieSlug]);

  const handleRoomImgError = () => {
    if (roomFailed) return;
    setRoomFailed(true);
    if (!room.movieSlug) {
      setRoomImgSrc("https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&q=80");
      return;
    }
    fetch(`${API_URL}/movies/logo/${room.movieSlug}?title=${encodeURIComponent(room.movieName || "")}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && (data.posterUrl || data.backdropUrl)) {
          setRoomImgSrc(data.posterUrl || data.backdropUrl);
        } else {
          setRoomImgSrc("https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&q=80");
        }
      })
      .catch(() => {
        setRoomImgSrc("https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&q=80");
      });
  };

  return (
    <Link href={cardHref} className="group block text-left">
      {/* Thumbnail */}
      <div className="relative aspect-[16/9] rounded-xl overflow-hidden bg-zinc-950 mb-2.5 shadow-lg border border-zinc-800/80 group-hover:border-zinc-700/60 transition-all duration-300">
        {posterUrl ? (
          <>
            {/* Blurred Background */}
            <img
              src={roomImgSrc}
              alt=""
              onError={handleRoomImgError}
              className="w-full h-full object-cover blur-[8px] opacity-35"
            />
            {/* Centered Vertical Poster */}
            <div className="absolute inset-0 flex items-center justify-center p-1.5">
              <div className="relative h-full aspect-[2/3] rounded-lg overflow-hidden shadow-2xl">
                <img
                  src={roomImgSrc}
                  alt={room.movieName}
                  onError={handleRoomImgError}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
            {/* Chấm trắng/halftone overlay giống banner hero */}
            <HalftoneOverlay />
          </>
        ) : (
          <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
            <Film size={28} className="text-zinc-600" />
          </div>
        )}

        {/* Dim on hover */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-300 z-10" />

        {/* Badges based on status */}
        {state.type === "live" && (
          <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-red-600 text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded z-10 shadow">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            LIVE
          </div>
        )}

        {state.type === "ended" && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-[#181822]/90 border border-red-500/25 text-red-400 text-[9px] font-bold px-2 py-0.5 rounded z-10 backdrop-blur-sm">
            <VideoOff size={10} className="text-red-400 shrink-0" />
            Đã kết thúc
          </div>
        )}

        {state.type === "upcoming" && (
          <>
            <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-[#181822]/90 border border-amber-500/20 text-amber-400 text-[9px] font-bold px-2 py-0.5 rounded z-10 backdrop-blur-sm">
              <Clock size={10} className="animate-spin text-amber-400 shrink-0" />
              {state.label}
            </div>
            {/* Nhắc nhở button */}
            {!isRoomHost && (
              <button
                onClick={handleNotify}
                className={`absolute bottom-2 right-2 z-20 flex items-center gap-1 px-2.5 py-1 rounded-md text-[9px] font-black uppercase transition-all active:scale-95 border cursor-pointer ${
                  notified
                    ? "bg-pink-500 text-white border-pink-500 shadow-md shadow-pink-500/20"
                    : "bg-[#181822]/85 text-zinc-300 border-zinc-700/50 hover:bg-zinc-800"
                }`}
              >
                <span>🔔 {notified ? "Đã đặt" : "Nhắc"}</span>
              </button>
            )}
          </>
        )}

        {/* Episode badge */}
        {epLabel && (
          <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm text-zinc-200 text-[9px] font-bold px-2 py-0.5 rounded z-10">
            {epLabel}
          </div>
        )}

        {/* Enter overlay */}
        {state.type !== "upcoming" && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20">
            <div className="flex items-center gap-1.5 bg-white/90 text-[#07070a] font-black text-xs px-3.5 py-1.5 rounded-full shadow-lg">
              <ChevronRight size={13} />
              {state.type === "ended" ? "Xem phim" : "Vào xem"}
            </div>
          </div>
        )}
      </div>

      {/* Info row */}
      <div className="flex gap-3 items-center mt-2">
        {/* Host avatar */}
        <div className={`w-10 h-10 rounded-full shrink-0 overflow-hidden bg-gradient-to-br ${avatarBgClass} flex items-center justify-center text-xs font-black text-white ${avatarBorderClass}`}>
          {room.host?.avatar ? (
            <Image
              src={room.host.avatar}
              alt={room.host.displayName}
              width={40}
              height={40}
              className="object-cover w-full h-full"
              unoptimized
            />
          ) : (
            <span>{hostInitial}</span>
          )}
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-zinc-100 leading-snug line-clamp-2 group-hover:text-pink-300 transition-colors">
            {room.roomName}
          </p>
          <p className="text-[10px] text-zinc-550 mt-0.5 truncate">
            {epLabel} &bull; {room.movieName.length > 28 ? room.movieName.slice(0, 28) + "…" : room.movieName}
          </p>
          <p className="text-[10px] text-zinc-400 mt-0.5 flex items-center gap-1 font-semibold">
            <span className="font-extrabold text-zinc-300 truncate max-w-[90px]">{room.host?.displayName || "Khách"}</span>
            <span className="text-zinc-600">•</span>
            <Clock size={9} className="shrink-0 text-zinc-500" />
            <span className="text-zinc-550">{timeAgo(room.createdAt)}</span>
          </p>
        </div>
      </div>
    </Link>
  );
}
