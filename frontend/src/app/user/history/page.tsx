"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { History, Trash2, Play, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import Cookies from "js-cookie";
import Link from "next/link";
import Pagination from "@/components/Pagination";
import { cleanMovieName, getImageUrl } from "@/utils/movieUtils";
import { getProxyUrl, MOVIE_API_DOMAIN } from "@/utils/api";

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
  const { user, showToast, deleteHistoryItem, clearAllHistory: clearAllHistoryCtx } = useAuth();
  
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [movieDetails, setMovieDetails] = useState<Record<string, MovieDetails>>({});
  const [loadingDetails, setLoadingDetails] = useState(false);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;
  const [showClearConfirm, setShowClearConfirm] = useState(false);

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
      
      const serverHist = (user && user.watchHistory) ? user.watchHistory : [];
      const historyMap = new Map<string, HistoryItem>();
      
      // Add server items first
      serverHist.forEach((item) => {
        historyMap.set(item.movieSlug, item);
      });
      
      // Add local items (if local item is newer, overwrite)
      localHist.forEach((item) => {
        const existing = historyMap.get(item.movieSlug);
        if (!existing || new Date(item.updatedAt) > new Date(existing.updatedAt)) {
          historyMap.set(item.movieSlug, item);
        }
      });
      
      const mergedList = Array.from(historyMap.values()).sort((a, b) => {
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
      
      setHistoryItems(mergedList);
    };

    loadHistory();
  }, [user]);

  // Fetch movie details for history items with multi-source fallback
  useEffect(() => {
    if (historyItems.length === 0) return;

    const fetchMovieDetails = async () => {
      setLoadingDetails(true);
      try {
        const promises = historyItems.map(async (item) => {
          if (movieDetails[item.movieSlug]) return null;
          try {
            let movie: any = null;
            // 1. Try the source currently selected by admin.
            let res = await fetch(getProxyUrl(`${MOVIE_API_DOMAIN}/phim/${item.movieSlug}`));
            if (res.ok) {
              const data = await res.json();
              if (data.status === true || data.status === "success") {
                movie = data.movie || data.data?.item;
              }
            }
            // 2. Thử v1/api/phim
            if (!movie) {
              res = await fetch(getProxyUrl(`${MOVIE_API_DOMAIN}/v1/api/phim/${item.movieSlug}`));
              if (res.ok) {
                const data = await res.json();
                if (data.status === true || data.status === "success") {
                  movie = data.movie || data.data?.item;
                }
              }
            }
            // 3. Try the provider opposite to the active source.
            if (!movie) {
              res = await fetch(getProxyUrl(`/phim/${item.movieSlug}`, "fallback"));
              if (res.ok) {
                const data = await res.json();
                if (data.status === true || data.status === "success") {
                  movie = data.movie;
                }
              }
            }

            if (movie) {
              return {
                slug: movie.slug,
                thumb_url: movie.thumb_url || movie.poster_url,
                quality: movie.quality || "HD",
                lang: movie.lang || "Vietsub"
              } as MovieDetails;
            }
          } catch (e) {
            console.error(`Error loading detail for history ${item.movieSlug}:`, e);
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

  const handleRemoveItem = async (e: React.MouseEvent, movieSlug: string) => {
    e.stopPropagation();
    
    // 1. Clear from localStorage
    try {
      const localHist = JSON.parse(localStorage.getItem("dlowphim_history") || "[]");
      const updatedLocal = localHist.filter((item: any) => item.movieSlug !== movieSlug);
      localStorage.setItem("dlowphim_history", JSON.stringify(updatedLocal));
    } catch (err) {
      console.error("Lỗi xóa local history:", err);
    }

    // 2. Clear from UI State
    setHistoryItems((prev) => prev.filter((item) => item.movieSlug !== movieSlug));

    // 3. Clear from Server & Context State
    if (deleteHistoryItem) {
      await deleteHistoryItem(movieSlug);
    } else {
      const token = Cookies.get("token");
      if (token) {
        await fetch(`${API_URL}/users/me/history/${movieSlug}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    }
    showToast("Đã xóa khỏi lịch sử xem", "success");
  };

  const handleClearAllHistory = async () => {
    // 1. Clear from localStorage
    try {
      localStorage.removeItem("dlowphim_history");
    } catch (err) {
      console.error("Lỗi xóa local history:", err);
    }

    // 2. Clear from UI State
    setHistoryItems([]);
    setShowClearConfirm(false);

    // 3. Clear from Server & Context State
    if (clearAllHistoryCtx) {
      await clearAllHistoryCtx();
    } else {
      const token = Cookies.get("token");
      if (token) {
        await fetch(`${API_URL}/users/me/history`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    }
    showToast("Đã xóa toàn bộ lịch sử xem", "success");
  };

  const totalPages = Math.max(1, Math.ceil(historyItems.length / itemsPerPage));
  const displayedHistory = historyItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

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
            onClick={() => setShowClearConfirm(true)}
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
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {displayedHistory.map((item) => (
              <HistoryItemCard
                key={item.movieSlug}
                item={item}
                detail={movieDetails[item.movieSlug]}
                onRemove={handleRemoveItem}
                onWatch={() => router.push(`/watch/${item.movieSlug}?ep=${encodeURIComponent(item.episodeName)}`)}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pt-8 flex justify-center">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={(page) => setCurrentPage(page)}
              />
            </div>
          )}
        </>
      )}

      {/* POPUP CONFIRMATION MODAL: XÓA TOÀN BỘ LỊCH SỬ */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
          <div className="w-full max-w-xs bg-[#12131b] border border-zinc-800 rounded-3xl p-5 shadow-2xl relative text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto mb-3">
              <Trash2 size={20} className="stroke-[2.5]" />
            </div>

            <h3 className="text-sm font-black text-zinc-200 uppercase tracking-wider mb-1.5">Xóa tất cả?</h3>
            <p className="text-[11px] text-zinc-450 leading-relaxed mb-5">
              Bạn có chắc chắn muốn xóa toàn bộ lịch sử xem không? Hành động này không thể hoàn tác.
            </p>

            <div className="flex gap-3 justify-center">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="h-9 px-4 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white font-extrabold text-[10px] uppercase tracking-wider rounded-xl transition-all cursor-pointer min-w-[85px] border-none"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleClearAllHistory}
                className="h-9 px-4 bg-red-500 hover:bg-red-655 active:scale-98 text-white font-extrabold text-[10px] uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-red-500/10 cursor-pointer min-w-[85px] border-none"
              >
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function HistoryItemCard({
  item,
  detail,
  onRemove,
  onWatch
}: {
  item: HistoryItem;
  detail?: MovieDetails;
  onRemove: (e: React.MouseEvent, slug: string) => void;
  onWatch: () => void;
}) {
  const initialUrl = getImageUrl(detail?.thumb_url);
  const [imgSrc, setImgSrc] = useState<string>(initialUrl);
  const [attemptCount, setAttemptCount] = useState(0);

  useEffect(() => {
    const url = getImageUrl(detail?.thumb_url);
    if (url) {
      setImgSrc(url);
    } else {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
      fetch(`${API_URL}/movies/logo/${item.movieSlug}?title=${encodeURIComponent(item.movieName)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && (data.posterUrl || data.backdropUrl)) {
            setImgSrc(data.posterUrl || data.backdropUrl);
          }
        })
        .catch(() => {});
    }
  }, [item.movieSlug, detail?.thumb_url]);

  const handleImgError = () => {
    if (attemptCount < 2) {
      setAttemptCount(attemptCount + 1);
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
      fetch(`${API_URL}/movies/logo/${item.movieSlug}?title=${encodeURIComponent(item.movieName)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && (data.posterUrl || data.backdropUrl)) {
            setImgSrc(data.posterUrl || data.backdropUrl);
          }
        })
        .catch(() => {});
    }
  };

  const progressPct = Math.min(100, Math.max(0, Math.round((item.currentTime / (item.duration || 1)) * 100)));

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <div
      onClick={onWatch}
      className="group relative flex flex-col gap-2.5 cursor-pointer text-left"
    >
      {/* Poster card with X button overlay */}
      <div className="relative aspect-[2/3] rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800/80 group-hover:border-zinc-700 transition-all select-none shadow-md">
        <img
          src={imgSrc || "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&q=80"}
          alt={item.movieName}
          onError={handleImgError}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
        
        {/* Remove item button */}
        <button
          onClick={(e) => onRemove(e, item.movieSlug)}
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
        <p className="text-[10px] text-zinc-550 font-semibold truncate">
          Đã xem {formatTime(item.currentTime)} / {formatTime(item.duration)}
        </p>
      </div>
    </div>
  );
}
