"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Film, Play, Calendar, EyeOff, Sparkles, AlertCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import Cookies from "js-cookie";
import { cleanMovieName } from "@/utils/movieUtils";
import { getProxyUrl } from "@/utils/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

interface MovieDetail {
  name: string;
  slug: string;
  origin_name: string;
  content: string;
  thumb_url: string;
  poster_url: string;
  time: string;
  episode_current: string;
  year: number;
  category: { name: string; slug: string }[];
  country: { name: string; slug: string }[];
}

export default function CreateRoomPage() {
  const router = useRouter();
  const { slug } = useParams();
  const { user } = useAuth();

  const [movie, setMovie] = useState<MovieDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [roomName, setRoomName] = useState("");
  const [selectedPoster, setSelectedPoster] = useState(""); // Ảnh đại diện phòng
  const [isAutoStart, setIsAutoStart] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Lấy thông tin phim
  useEffect(() => {
    if (!slug) return;
    async function fetchMovieDetail() {
      try {
        setLoading(true);
        const res = await fetch(getProxyUrl(`https://ophim1.com/v1/api/phim/${slug}`));
        if (res.ok) {
          const data = await res.json();
          if (data.status === true || data.status === "success") {
            const item = data.data?.item || data.movie;
            setMovie(item);
            setRoomName(`Cùng xem ${cleanMovieName(item.name)}`);
            setSelectedPoster(item.poster_url); // Mặc định chọn poster dọc
          } else {
            throw new Error("Không tìm thấy thông tin phim");
          }
        } else {
          throw new Error("Lỗi API kết nối");
        }
      } catch (err: any) {
        console.error(err);
        setError(err.message || "Không thể tải thông tin phim.");
      } finally {
        setLoading(false);
      }
    }
    fetchMovieDetail();
  }, [slug]);

  // Bảo vệ route phía Client
  useEffect(() => {
    const token = Cookies.get("token");
    if (!token) {
      window.dispatchEvent(new Event("dlowphim_open_auth"));
      router.push(`/watch/${slug}`);
    }
  }, [router, slug]);

  const getImageUrl = (path: string) => {
    if (!path) return "";
    if (path.startsWith("http")) return path;
    const fileName = path.split("/").pop();
    return `https://img.ophim.live/uploads/movies/${fileName}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!movie) return;

    if (isAutoStart && !startTime) {
      alert("Vui lòng chọn thời gian bắt đầu tự động phát!");
      return;
    }

    setSubmitting(true);
    try {
      const token = Cookies.get("token");
      const res = await fetch(`${API_URL}/rooms/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          movieSlug: movie.slug,
          movieName: movie.name,
          moviePoster: movie.poster_url,
          roomName: roomName.trim(),
          posterOption: selectedPoster,
          isAutoStart,
          startTime: isAutoStart ? startTime : undefined,
          isPrivate,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        router.push(`/watch-together/room/${data.roomId}`);
      } else {
        const errData = await res.json();
        alert(errData.message || "Tạo phòng thất bại.");
      }
    } catch (err) {
      console.error(err);
      alert("Lỗi kết nối máy chủ.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 border-4 border-pink-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-zinc-400 text-sm font-bold">Đang tải thông tin phim...</p>
      </div>
    );
  }

  if (error || !movie) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-3 px-4">
        <AlertCircle className="text-red-500" size={48} />
        <p className="text-zinc-300 text-sm font-bold">{error || "Đã xảy ra lỗi ngoài ý muốn."}</p>
        <button
          onClick={() => router.push(`/watch/${slug}`)}
          className="mt-2 px-5 py-2 bg-zinc-800 text-white rounded-xl font-bold text-xs"
        >
          Quay lại trang xem phim
        </button>
      </div>
    );
  }

  const cleanedName = cleanMovieName(movie.name);

  return (
    <div className="min-h-screen bg-[#07070a] text-white pt-24 pb-16 px-4 md:px-6 relative select-none">
      <div className="max-w-6xl mx-auto space-y-8 relative z-10">
        
        {/* Nút quay lại và Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/watch/${slug}`)}
            className="w-10 h-10 rounded-full border border-zinc-850 hover:border-zinc-700 bg-zinc-950 flex items-center justify-center hover:text-pink-500 transition-all cursor-pointer"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-xl md:text-2xl font-black uppercase tracking-tight flex items-center gap-2">
              <Sparkles className="text-pink-500 animate-pulse" size={20} />
              Tạo phòng xem chung
            </h1>
            <p className="text-xs text-zinc-500 font-semibold uppercase">Xem phim thời gian thực cùng bạn bè và mọi người</p>
          </div>
        </div>

        {/* Cấu trúc 2 cột */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* CỘT TRÁI: Card Thông tin Phim */}
          <div className="lg:col-span-5 bg-[#0e0f17]/40 rounded-3xl overflow-hidden p-6 space-y-5">
            <div className="aspect-[2/3] w-full rounded-2xl overflow-hidden relative shadow-2xl">
              <img
                src={getImageUrl(movie.poster_url || movie.thumb_url)}
                alt={cleanedName}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
            </div>

            <div className="space-y-3.5 text-left">
              <h2 className="text-lg font-black tracking-tight uppercase leading-snug">{cleanedName}</h2>
              
              {/* Badges thông số */}
              <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-extrabold select-none">
                <span className="bg-amber-400 text-black px-2 py-0.5 rounded shadow-sm">IMDb 7.6</span>
                <span className="bg-[#1b1d2a] text-[#a0a5c0] px-2 py-0.5 rounded">T16</span>
                <span className="bg-[#1b1d2a] text-[#a0a5c0] px-2 py-0.5 rounded">{movie.year}</span>
                <span className="bg-[#1b1d2a] text-[#a0a5c0] px-2 py-0.5 rounded">{movie.time || "120 phút"}</span>
              </div>

              {/* Thể loại */}
              {movie.category && movie.category.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {movie.category.slice(0, 3).map((c) => (
                    <span key={c.slug} className="text-[10px] bg-zinc-900 text-zinc-400 font-extrabold px-2.5 py-0.5 rounded-full">
                      {c.name}
                    </span>
                  ))}
                </div>
              )}

              {/* Tóm tắt */}
              <p className="text-zinc-400 text-xs leading-relaxed font-semibold line-clamp-3">
                {movie.content ? movie.content.replace(/<[^>]*>/g, "") : "Chưa có mô tả chi tiết của phim này."}
              </p>
            </div>
          </div>

          {/* CỘT PHẢI: Form Cài đặt Phòng */}
          <form onSubmit={handleSubmit} className="lg:col-span-7 space-y-6">
            
            {/* Bước 1: Tên phòng */}
            <div className="bg-[#0e0f17]/40 rounded-3xl p-6 space-y-3.5 text-left">
              <label className="text-xs font-black text-zinc-450 uppercase tracking-widest flex items-center gap-2 select-none">
                <span className="w-5 h-5 rounded-full bg-pink-500/10 text-pink-500 flex items-center justify-center font-bold text-[10px]">1</span>
                Tên phòng
              </label>
              <input
                type="text"
                required
                maxLength={50}
                placeholder="Nhập tên phòng xem chung..."
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                className="w-full h-12 bg-zinc-950 border border-zinc-900/60 hover:border-zinc-800/50 focus:border-pink-500 rounded-xl px-4 text-sm text-zinc-200 outline-none font-bold transition-colors"
              />
            </div>

            {/* Bước 2: Chọn poster hiển thị */}
            <div className="bg-[#0e0f17]/40 rounded-3xl p-6 space-y-4 text-left">
              <label className="text-xs font-black text-zinc-450 uppercase tracking-widest flex items-center gap-2 select-none">
                <span className="w-5 h-5 rounded-full bg-pink-500/10 text-pink-500 flex items-center justify-center font-bold text-[10px]">2</span>
                Chọn poster hiển thị
              </label>
              
              <div className="grid grid-cols-2 gap-4">
                {/* Lựa chọn 1: Poster dọc */}
                <div
                  onClick={() => setSelectedPoster(movie.poster_url)}
                  className={`aspect-[3/4.2] rounded-2xl overflow-hidden cursor-pointer relative border-3 transition-all ${
                    selectedPoster === movie.poster_url
                      ? "border-pink-500 shadow-lg shadow-pink-500/10"
                      : "border-transparent hover:border-zinc-800/40 opacity-60 hover:opacity-90"
                  }`}
                >
                  <img
                    src={getImageUrl(movie.poster_url)}
                    alt="Poster dọc"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-black/75 py-2 text-center">
                    <span className="text-[10px] font-black uppercase tracking-wider text-zinc-200">Poster dọc</span>
                  </div>
                </div>

                {/* Lựa chọn 2: Backdrop ngang */}
                <div
                  onClick={() => setSelectedPoster(movie.thumb_url)}
                  className={`aspect-[3/4.2] rounded-2xl overflow-hidden cursor-pointer relative border-3 transition-all ${
                    selectedPoster === movie.thumb_url
                      ? "border-pink-500 shadow-lg shadow-pink-500/10"
                      : "border-transparent hover:border-zinc-800/40 opacity-60 hover:opacity-90"
                  }`}
                >
                  <img
                    src={getImageUrl(movie.thumb_url)}
                    alt="Backdrop ngang"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-black/75 py-2 text-center">
                    <span className="text-[10px] font-black uppercase tracking-wider text-zinc-200">Backdrop ngang</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bước 3: Cài đặt thời gian */}
            <div className="bg-[#0e0f17]/40 rounded-3xl p-6 space-y-4 text-left">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-zinc-450 uppercase tracking-widest flex items-center gap-2 select-none">
                  <span className="w-5 h-5 rounded-full bg-pink-500/10 text-pink-500 flex items-center justify-center font-bold text-[10px]">3</span>
                  Cài đặt thời gian
                </label>
                
                {/* Toggle switch */}
                <button
                  type="button"
                  onClick={() => setIsAutoStart(!isAutoStart)}
                  className={`w-10 h-6 rounded-full transition-colors duration-250 relative outline-none border-none cursor-pointer flex items-center p-0.5 ${
                    isAutoStart ? "bg-pink-500" : "bg-zinc-800"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform duration-200 ease-in-out ${
                      isAutoStart ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
              <p className="text-[11px] text-zinc-500 font-semibold leading-relaxed">
                Có thể bắt đầu thủ công bất cứ lúc nào hoặc thiết lập thời gian để phòng tự động phát.
              </p>

              {isAutoStart && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                  <span className="text-[10px] font-black text-zinc-450 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar size={12} className="text-pink-500" />
                    Thời gian phát phim:
                  </span>
                  <input
                    type="datetime-local"
                    required={isAutoStart}
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full h-12 bg-zinc-950 border border-zinc-900/60 hover:border-zinc-800/50 focus:border-pink-500 rounded-xl px-4 text-sm text-zinc-200 outline-none font-bold transition-colors"
                  />
                </div>
              )}
            </div>

            {/* Bước 4: Xem với bạn bè (Ẩn phòng) */}
            <div className="bg-[#0e0f17]/40 rounded-3xl p-6 space-y-4 text-left">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-zinc-450 uppercase tracking-widest flex items-center gap-2 select-none">
                  <span className="w-5 h-5 rounded-full bg-pink-500/10 text-pink-500 flex items-center justify-center font-bold text-[10px]">4</span>
                  Bạn chỉ muốn xem với bạn bè?
                </label>
                
                <button
                  type="button"
                  onClick={() => setIsPrivate(!isPrivate)}
                  className={`w-10 h-6 rounded-full transition-colors duration-250 relative outline-none border-none cursor-pointer flex items-center p-0.5 ${
                    isPrivate ? "bg-pink-500" : "bg-zinc-800"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform duration-200 ease-in-out ${
                      isPrivate ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
              <p className="text-[11px] text-zinc-500 font-semibold leading-relaxed flex items-center gap-1">
                <EyeOff size={12} className="text-zinc-550 shrink-0" />
                Nếu bật, phòng xem chung này sẽ bị ẩn, chỉ những ai được bạn chia sẻ liên kết mới có thể tìm thấy và tham gia.
              </p>
            </div>

            {/* Nút hành động */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 h-12 bg-pink-500 hover:bg-pink-600 text-white font-extrabold text-sm rounded-xl active:scale-95 shadow-lg shadow-pink-500/20 active:shadow-none transition-all flex items-center justify-center gap-2 cursor-pointer border-none disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Play className="fill-current" size={14} />
                    <span>Tạo phòng xem ngay</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => router.push(`/watch/${slug}`)}
                className="h-12 px-6 border border-zinc-900/60 bg-[#1b1d2a]/40 hover:bg-zinc-800/40 text-zinc-450 hover:text-white font-extrabold text-sm rounded-xl active:scale-95 transition-all cursor-pointer"
              >
                Hủy bỏ
              </button>
            </div>

          </form>

        </div>

      </div>
    </div>
  );
}
