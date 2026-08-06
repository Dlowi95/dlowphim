"use client";

import React, { useEffect, useState } from "react";
import { Heart, X, Play, RefreshCw } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { cleanMovieName, getImageUrl } from "@/utils/movieUtils";
import Link from "next/link";
import Pagination from "@/components/Pagination";
import { getUserMovieSummaries, UserMovieSummary } from "@/utils/userMovieSummaries";
import { useConfirmDialog } from "@/components/ConfirmDialog";

type MovieDetails = UserMovieSummary;

export default function UserFavoritePage() {
  const { user, toggleFavorite, showToast } = useAuth();
  const { confirm, confirmDialog } = useConfirmDialog();
  
  const [favoriteDetails, setFavoriteDetails] = useState<MovieDetails[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [retryNonce, setRetryNonce] = useState(0);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  useEffect(() => {
    const favorites = user?.favorites;
    if (!favorites || favorites.length === 0) {
      setFavoriteDetails([]);
      return;
    }

    const controller = new AbortController();
    const fetchAllFavoriteDetails = async () => {
      setLoadingDetails(true);
      setLoadError("");
      try {
        setFavoriteDetails(await getUserMovieSummaries(favorites, controller.signal));
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error("Error fetching all favorite details:", err);
        setLoadError("Chưa thể tải danh sách yêu thích. Vui lòng thử lại.");
      } finally {
        if (!controller.signal.aborted) setLoadingDetails(false);
      }
    };

    fetchAllFavoriteDetails();
    return () => controller.abort();
  }, [user?.favorites?.join(","), retryNonce]);

  const handleRemoveFavorite = async (e: React.MouseEvent, slug: string) => {
    e.stopPropagation();
    const accepted = await confirm({
      title: "Bỏ phim yêu thích?",
      message: "Phim sẽ được gỡ khỏi danh sách yêu thích của bạn.",
      confirmLabel: "Bỏ yêu thích",
      tone: "danger",
    });
    if (!accepted) return;
    const success = await toggleFavorite(slug);
    if (success) {
      setFavoriteDetails((prev) => prev.filter((m) => m.slug !== slug));
      showToast("Đã xóa phim khỏi danh sách yêu thích", "success");
    }
  };

  // Pagination calculation
  const favoriteCount = user?.favorites?.length || 0;
  const totalItems = favoriteDetails.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedMovies = favoriteDetails.slice(startIndex, startIndex + itemsPerPage);

  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-900 pb-3.5 gap-4">
        <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight text-zinc-100 flex items-center gap-2.5">
          <Heart className="text-pink-500 fill-pink-500 drop-shadow-[0_0_8px_rgba(236,72,153,0.9)]" size={24} />
          <span>Yêu thích</span>
        </h2>
        
        <span className="rounded-full border border-pink-500/20 bg-pink-500/10 px-3 py-1.5 text-xs font-extrabold text-pink-400">
          {favoriteCount} phim
        </span>
      </div>

      {/* FAVORITE GRID */}
      {loadError ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-red-500/15 bg-red-500/[0.03] px-8 py-20 text-center">
          <p className="text-sm font-bold text-zinc-300">{loadError}</p>
          <button
            type="button"
            onClick={() => setRetryNonce((value) => value + 1)}
            className="flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-xs font-extrabold text-white hover:bg-zinc-800"
          >
            <RefreshCw size={13} /> Thử lại
          </button>
        </div>
      ) : (
        loadingDetails ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 py-10">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="flex flex-col gap-3.5 animate-pulse">
                <div className="aspect-[2/3] bg-zinc-900 border border-zinc-800 rounded-2xl w-full" />
                <div className="h-4.5 bg-zinc-900 rounded w-[85%]" />
                <div className="h-3.5 bg-zinc-900 rounded w-[60%]" />
              </div>
            ))}
          </div>
        ) : favoriteDetails.length === 0 ? (
          <div className="bg-[#12131b]/30 border border-zinc-900 rounded-3xl py-20 px-8 flex flex-col items-center justify-center gap-3 select-none text-center">
            <Heart size={44} className="text-zinc-700" />
            <h4 className="text-base font-bold text-zinc-400">Danh sách phim yêu thích trống</h4>
            <p className="text-xs text-zinc-500 max-w-xs">
              Bạn chưa thêm bộ phim nào vào danh sách yêu thích. Hãy nhấn nút Yêu thích ở trang chi tiết phim nhé!
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {paginatedMovies.map((movie) => (
                <FavoriteMovieCard key={movie.slug} movie={movie} onRemove={handleRemoveFavorite} />
              ))}
            </div>

            {/* PAGINATION */}
            {totalPages > 1 && (
              <div className="pt-8 flex justify-center">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={(page) => setCurrentPage(page)}
                />
              </div>
            )}
          </div>
        )
      )}
      {confirmDialog}
    </div>
  );
}

function FavoriteMovieCard({
  movie,
  onRemove
}: {
  movie: any;
  onRemove: (e: React.MouseEvent, slug: string) => void;
}) {
  const initialUrl = getImageUrl(movie.poster_url || movie.thumb_url);
  const [imgSrc, setImgSrc] = useState<string>(initialUrl);
  const [attemptCount, setAttemptCount] = useState(0);

  useEffect(() => {
    setImgSrc(getImageUrl(movie.poster_url || movie.thumb_url));
    setAttemptCount(0);
  }, [movie.slug, movie.thumb_url, movie.poster_url]);

  const handleImgError = () => {
    if (attemptCount === 0 && movie.thumb_url && movie.poster_url && movie.poster_url !== movie.thumb_url) {
      setAttemptCount(1);
      setImgSrc(getImageUrl(movie.thumb_url));
      return;
    }

    if (attemptCount < 2) {
      setAttemptCount(2);
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
      fetch(`${API_URL}/movies/logo/${movie.slug}?title=${encodeURIComponent(movie.origin_name || movie.name)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && (data.posterUrl || data.backdropUrl)) {
            setImgSrc(data.posterUrl || data.backdropUrl);
          } else {
            setImgSrc("https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&q=80");
          }
        })
        .catch(() => {
          setImgSrc("https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&q=80");
        });
    }
  };

  return (
    <div className="group relative flex flex-col gap-2.5">
      {/* Card Wrapper */}
      <div className="aspect-[2/3] relative rounded-2xl overflow-hidden border border-zinc-800/80 bg-zinc-950 shadow-md group">
        <img
          src={imgSrc}
          alt={movie.name}
          onError={handleImgError}
          className="w-full h-full object-cover transition-all duration-350 group-hover:scale-105"
          loading="lazy"
        />

        {/* Overlay control */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/35 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-2">
          <Link
            href={`/movie/${movie.slug}`}
            className="w-9 h-9 rounded-full bg-pink-500 hover:bg-pink-600 text-white flex items-center justify-center transition-all shadow-md active:scale-90"
          >
            <Play size={16} className="fill-white ml-0.5" />
          </Link>
          <button
            onClick={(e) => onRemove(e, movie.slug)}
            className="w-9 h-9 rounded-full bg-zinc-900/90 hover:bg-red-500 hover:text-white border border-zinc-800 text-zinc-350 flex items-center justify-center transition-all shadow-md active:scale-90 cursor-pointer"
            title="Xóa khỏi yêu thích"
          >
            <X size={16} />
          </button>
        </div>

      </div>

      {/* Title & Origin Title */}
      <div className="px-0.5 space-y-0.5 min-h-[46px]">
        <h4 className="text-xs font-bold text-zinc-200 line-clamp-1 group-hover:text-pink-400 transition-colors" title={movie.name}>
          {cleanMovieName(movie.name)}
        </h4>
        <p className="text-[10px] text-zinc-500 line-clamp-1 font-semibold" title={movie.origin_name}>
          {movie.origin_name}
        </p>
      </div>
    </div>
  );
}
