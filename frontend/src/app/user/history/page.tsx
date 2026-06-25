"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { History, Trash2, Play } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import Cookies from "js-cookie";
import Link from "next/link";
import { cleanMovieName } from "@/utils/movieUtils";

interface HistoryItem {
  movieSlug: string;
  movieName: string;
  episodeName: string;
  currentTime: number;
  duration: number;
  updatedAt: string;
}

interface MovieDetails {
  slug: string;
  thumb_url: string;
  quality: string;
  lang: string;
}

export default function UserHistoryPage() {
  const router = useRouter();
  const { user, showToast } = useAuth();
  
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [movieDetails, setMovieDetails] = useState<Record<string, MovieDetails>>({});
  const [loadingDetails, setLoadingDetails] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

  // Load history items
  useEffect(() => {
    const loadHistory = () => {
      let localHist: HistoryItem[] = [];
      try {
        localHist = JSON.parse(localStorage.getItem("dlowphim_history") || "[]");
      } catch (e) {
        console.error(e);
      }
      
      if (user && user.watchHistory && user.watchHistory.length > 0) {
        setHistoryItems(user.watchHistory);
      } else {
        setHistoryItems(localHist);
      }
    };

    loadHistory();
  }, [user]);

  // Fetch movie details for history items
  useEffect(() => {
    if (historyItems.length === 0) return;

    const fetchMovieDetails = async () => {
      setLoadingDetails(true);
      try {
        const promises = historyItems.map(async (item) => {
          if (movieDetails[item.movieSlug]) return null;
          try {
            const res = await fetch(`https://ophim1.com/v1/api/phim/${item.movieSlug}`);
            if (!res.ok) return null;
            const data = await res.json();
            if (data.status === true || data.status === "success") {
              const movie = data.data?.item || data.movie;
              if (movie) {
                return {
                  slug: movie.slug,
                  thumb_url: movie.thumb_url,
                  quality: movie.quality || "HD",
                  lang: movie.lang || "Vietsub"
                } as MovieDetails;
              }
            }
          } catch (e) {
            console.error(e);
          }
          return null;
        });

        const results = await Promise.all(promises);
        const newDetails: Record<string, MovieDetails> = { ...movieDetails };
        results.forEach((detail) => {
          if (detail) {
            newDetails[detail.slug] = detail;
          }
        });
        setMovieDetails(newDetails);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingDetails(false);
      }
    };

    fetchMovieDetails();
  }, [historyItems]);

  const handleRemoveHistory = async (e: React.MouseEvent, slug: string) => {
    e.stopPropagation();
    
    try {
      const localHist = JSON.parse(localStorage.getItem("dlowphim_history") || "[]");
      const filtered = localHist.filter((item: any) => item.movieSlug !== slug);
      localStorage.setItem("dlowphim_history", JSON.stringify(filtered));
      setHistoryItems(filtered);
    } catch (err) {
      console.error(err);
    }

    if (user) {
      try {
        const token = Cookies.get("token");
        const res = await fetch(`${API_URL}/auth/history/clear/${slug}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          }
        });

        if (res.ok) {
          const data = await res.json();
          user.watchHistory = data.watchHistory || [];
          setHistoryItems(data.watchHistory || []);
        }
      } catch (err) {
        console.error("Lỗi xóa lịch sử:", err);
      }
    }
    showToast("Đã xóa khỏi lịch sử xem", "success");
  };

  const handleClearAllHistory = async () => {
    if (!confirm("Bạn có chắc chắn muốn xóa toàn bộ lịch sử xem không?")) return;

    localStorage.removeItem("dlowphim_history");
    setHistoryItems([]);

    if (user) {
      try {
        const token = Cookies.get("token");
        const res = await fetch(`${API_URL}/auth/history/clear-all`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          }
        });

        if (res.ok) {
          user.watchHistory = [];
        }
      } catch (err) {
        console.error("Lỗi xóa toàn bộ lịch sử:", err);
      }
    }
    showToast("Đã xóa toàn bộ lịch sử xem", "success");
  };

  const getImageUrl = (path?: string) => {
    if (!path) return "";
    if (path.startsWith("http")) return path;
    const fileName = path.split("/").pop();
    return `https://img.ophim.live/uploads/movies/${fileName}`;
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-900 pb-3.5 gap-4">
        <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight text-zinc-100 flex items-center gap-2.5">
          <History className="text-pink-500" size={24} />
          <span>Lịch sử xem tiếp</span>
        </h2>

        {historyItems.length > 0 && (
          <button
            onClick={handleClearAllHistory}
            className="h-9 px-4 rounded-full border border-red-500/20 text-red-400 hover:bg-red-500/10 font-bold text-xs flex items-center gap-1.5 transition-all select-none cursor-pointer"
          >
            <Trash2 size={13} />
            <span>Xóa tất cả</span>
          </button>
        )}
      </div>

      {historyItems.length === 0 ? (
        <div className="bg-[#12131b]/30 border border-zinc-900 rounded-3xl py-20 px-8 flex flex-col items-center justify-center gap-3 select-none text-center">
          <History size={44} className="text-zinc-700" />
          <h4 className="text-base font-bold text-zinc-400">Lịch sử xem trống</h4>
          <p className="text-xs text-zinc-500 max-w-xs">
            Bạn chưa xem bộ phim nào gần đây hoặc đã xóa toàn bộ lịch sử xem.
          </p>
          <Link
            href="/"
            className="mt-2 h-10 px-5 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-500 hover:bg-pink-500/20 font-bold text-xs flex items-center justify-center transition-all"
          >
            Khám phá phim ngay
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {historyItems.map((item) => {
            const detail = movieDetails[item.movieSlug];
            const progressPct = Math.min(100, Math.max(0, Math.round((item.currentTime / (item.duration || 1)) * 100)));
            
            return (
              <div
                key={item.movieSlug}
                onClick={() => router.push(`/watch/${item.movieSlug}?ep=${encodeURIComponent(item.episodeName)}`)}
                className="group relative flex flex-col gap-2.5 cursor-pointer text-left"
              >
                {/* Poster card with X button overlay */}
                <div className="relative aspect-[2/3] rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800/80 group-hover:border-zinc-700 transition-all select-none shadow-md">
                  <img
                    src={getImageUrl(detail?.thumb_url)}
                    alt={item.movieName}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                  
                  {/* Remove item button */}
                  <button
                    onClick={(e) => handleRemoveHistory(e, item.movieSlug)}
                    className="absolute top-2.5 right-2.5 w-6.5 h-6.5 rounded-lg bg-black/60 hover:bg-[#ef4444] text-white flex items-center justify-center cursor-pointer transition-all z-10 border border-zinc-800/20 backdrop-blur-sm"
                    title="Xóa lịch sử"
                  >
                    <Trash2 size={12} />
                  </button>

                  {/* Play button hover mask */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-300">
                    <div className="w-10 h-10 rounded-full bg-pink-500 flex items-center justify-center text-white scale-90 group-hover:scale-100 transition-transform duration-300">
                      <Play size={16} className="fill-white ml-0.5" />
                    </div>
                  </div>

                  {/* Watch Progress Bar */}
                  <div className="absolute bottom-0 inset-x-0 h-1.5 bg-white/10 z-10">
                    <div 
                      style={{ width: `${progressPct}%` }}
                      className="h-full bg-pink-500 transition-all duration-300"
                    />
                  </div>
                </div>

                {/* Title & Info */}
                <div className="px-0.5 space-y-0.5">
                  <h4 className="font-bold text-[13.5px] text-zinc-100 line-clamp-1 group-hover:text-pink-500 transition-colors">
                    {cleanMovieName(item.movieName)}
                  </h4>
                  <p className="text-[11px] font-bold text-pink-400">
                    Đang xem Tập {item.episodeName} ({progressPct}%)
                  </p>
                  <p className="text-[10px] text-zinc-500 font-semibold truncate">
                    Đã xem {formatTime(item.currentTime)} / {formatTime(item.duration)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
