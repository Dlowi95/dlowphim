"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { History, Trash2, Play, RefreshCw } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import Pagination from "@/components/Pagination";
import { cleanMovieName, getImageUrl } from "@/utils/movieUtils";
import ProgressiveImage from "@/components/ProgressiveImage";
import { getUserMovieSummaries, UserMovieSummary } from "@/utils/userMovieSummaries";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import { fetchMovieArtwork, LOCAL_MOVIE_IMAGE_FALLBACK } from "@/utils/movieArtwork";

interface HistoryItem {
  movieSlug: string;
  movieName: string;
  episodeName: string;
  episodeKey?: string;
  currentTime: number;
  duration: number;
  progressMode?: "exact" | "embed";
  updatedAt: string;
}

type MovieDetails = UserMovieSummary;

export default function UserHistoryPage() {
  const router = useRouter();
  const { user, showToast, deleteHistoryItem, clearAllHistory: clearAllHistoryCtx } = useAuth();
  const { confirm, confirmDialog } = useConfirmDialog();
  
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [movieDetails, setMovieDetails] = useState<Record<string, MovieDetails>>({});
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [retryNonce, setRetryNonce] = useState(0);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

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

  // Load all movie summaries in one backend batch instead of one request per item.
  useEffect(() => {
    if (historyItems.length === 0) {
      setMovieDetails({});
      setLoadError("");
      return;
    }

    const controller = new AbortController();

    const fetchMovieDetails = async () => {
      setLoadingDetails(true);
      setLoadError("");
      try {
        const summaries = await getUserMovieSummaries(
          historyItems.map((item) => item.movieSlug),
          controller.signal,
        );
        setMovieDetails(Object.fromEntries(summaries.map((item) => [item.slug, item])));
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("Unable to load history movie summaries:", error);
          setLoadError("Chưa tải được ảnh và thông tin phim trong lịch sử.");
        }
      } finally {
        if (!controller.signal.aborted) setLoadingDetails(false);
      }
    };

    fetchMovieDetails();
    return () => controller.abort();
  }, [historyItems.map((item) => item.movieSlug).join(","), retryNonce]);

  const handleRemoveItem = async (e: React.MouseEvent, movieSlug: string) => {
    e.stopPropagation();
    const accepted = await confirm({
      title: "Xóa lịch sử phim này?",
      message: "Tiến trình xem gần nhất của phim sẽ bị xóa khỏi tài khoản của bạn.",
      confirmLabel: "Xóa lịch sử",
      tone: "danger",
    });
    if (!accepted) return;

    const removed = await deleteHistoryItem(movieSlug);
    if (!removed) return;
    setHistoryItems((prev) => prev.filter((item) => item.movieSlug !== movieSlug));
    showToast("Đã xóa khỏi lịch sử xem", "success");
  };

  const handleClearAllHistory = async () => {
    const accepted = await confirm({
      title: "Xóa toàn bộ lịch sử?",
      message: "Toàn bộ tập và thời gian xem gần nhất sẽ bị xóa. Hành động này không thể hoàn tác.",
      confirmLabel: "Xóa tất cả",
      tone: "danger",
    });
    if (!accepted) return;

    const cleared = await clearAllHistoryCtx();
    if (!cleared) return;
    setHistoryItems([]);
    showToast("Đã xóa toàn bộ lịch sử xem", "success");
  };

  const totalPages = Math.max(1, Math.ceil(historyItems.length / itemsPerPage));
  const displayedHistory = historyItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <div className="space-y-5 md:space-y-6">
      <div className="flex items-center justify-between border-b border-zinc-900 pb-3.5 gap-3">
        <h2 className="min-w-0 text-lg md:text-2xl font-black uppercase tracking-tight text-zinc-100 flex items-center gap-2.5">
          <History className="h-[22px] w-[22px] shrink-0 text-pink-500 md:h-6 md:w-6" size={24} />
          <span>Lịch sử xem tiếp</span>
        </h2>

        {historyItems.length > 0 && (
          <button
            onClick={handleClearAllHistory}
            className="h-9 shrink-0 px-3 md:px-4 rounded-full border border-red-500/20 text-red-400 hover:bg-red-500/10 font-bold text-[11px] md:text-xs flex items-center gap-1.5 transition-all select-none cursor-pointer"
          >
            <Trash2 size={13} />
            <span>Xóa tất cả</span>
          </button>
        )}
      </div>

      {loadError && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-amber-200">
          <span>{loadError}</span>
          <button
            type="button"
            onClick={() => setRetryNonce((value) => value + 1)}
            disabled={loadingDetails}
            className="flex items-center gap-1.5 rounded-full border border-amber-400/25 px-3 py-1.5 font-bold transition hover:bg-amber-400/10 disabled:opacity-50"
          >
            <RefreshCw size={13} className={loadingDetails ? "animate-spin" : ""} />
            Thử lại
          </button>
        </div>
      )}

      {historyItems.length === 0 ? (
        <div className="bg-[#12131b]/30 border border-zinc-900 rounded-2xl md:rounded-3xl py-14 md:py-20 px-5 md:px-8 flex flex-col items-center justify-center gap-3 select-none text-center">
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
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-3 gap-y-4 md:gap-4">
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
                compactOnMobile
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={(page) => setCurrentPage(page)}
              />
            </div>
          )}
        </>
      )}

      {confirmDialog}
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
  const initialUrl = getImageUrl(detail?.poster_url || detail?.thumb_url);
  const [imgSrc, setImgSrc] = useState<string>(initialUrl);
  const [attemptCount, setAttemptCount] = useState(0);

  useEffect(() => {
    const url = getImageUrl(detail?.poster_url || detail?.thumb_url);
    setImgSrc(url);
    setAttemptCount(0);
  }, [item.movieSlug, detail?.poster_url, detail?.thumb_url]);

  const handleImgError = () => {
    if (attemptCount < 2) {
      setAttemptCount((value) => value + 1);
      fetchMovieArtwork({ slug: item.movieSlug, title: item.movieName })
        .then((data) => {
          if (data && (data.posterUrl || data.backdropUrl)) {
            setImgSrc(data.posterUrl || data.backdropUrl || LOCAL_MOVIE_IMAGE_FALLBACK);
          } else {
            setImgSrc(LOCAL_MOVIE_IMAGE_FALLBACK);
          }
        })
        .catch(() => setImgSrc(LOCAL_MOVIE_IMAGE_FALLBACK));
    }
  };

  const hasExactProgress = item.progressMode !== "embed" && item.duration > 0;
  const progressPct = hasExactProgress
    ? Math.min(100, Math.max(0, Math.round((item.currentTime / item.duration) * 100)))
    : 0;

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
      <div className="relative aspect-[2/3] rounded-xl md:rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800/80 group-hover:border-zinc-700 transition-all select-none shadow-md">
        <ProgressiveImage
          src={imgSrc || LOCAL_MOVIE_IMAGE_FALLBACK}
          alt={item.movieName}
          onError={handleImgError}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
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
        {hasExactProgress && (
          <div className="absolute bottom-0 inset-x-0 h-1.5 bg-white/10 z-10">
            <div
              style={{ width: `${progressPct}%` }}
              className="h-full bg-pink-500 transition-all duration-300"
            />
          </div>
        )}
      </div>

      {/* Title & Info */}
      <div className="px-0.5 space-y-0.5">
        <h4 className="font-bold text-[13.5px] text-zinc-100 line-clamp-1 group-hover:text-pink-500 transition-colors">
          {cleanMovieName(item.movieName)}
        </h4>
        <p className="text-[11px] font-bold text-pink-400">
          Đang xem {/^tập\s|^full$/i.test(item.episodeName) ? item.episodeName : `Tập ${item.episodeName}`}
          {hasExactProgress ? ` (${progressPct}%)` : ""}
        </p>
        <p className="text-[10px] text-zinc-550 font-semibold truncate">
          {hasExactProgress
            ? `Đã xem ${formatTime(item.currentTime)} / ${formatTime(item.duration)}`
            : "Đã mở bằng chế độ tương thích · Không có thời gian chính xác"}
        </p>
      </div>
    </div>
  );
}
