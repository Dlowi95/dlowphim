"use client";

import React, { useEffect, useState } from "react";
import { Heart, X, Loader2, Play } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { cleanMovieName } from "@/utils/movieUtils";
import Link from "next/link";
import Pagination from "@/components/Pagination";

interface MovieDetails {
  slug: string;
  name: string;
  origin_name: string;
  thumb_url: string;
  quality: string;
  lang: string;
}

export default function UserFavoritePage() {
  const { user, toggleFavorite } = useAuth();
  
  const [favoriteDetails, setFavoriteDetails] = useState<MovieDetails[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [activeTab, setActiveTab] = useState<"movies" | "actors">("movies");
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  useEffect(() => {
    const favorites = user?.favorites;
    if (!favorites || favorites.length === 0) {
      setFavoriteDetails([]);
      return;
    }

    const fetchAllFavoriteDetails = async () => {
      setLoadingDetails(true);
      try {
        const promises = favorites.map(async (slug) => {
          try {
            const res = await fetch(`https://ophim1.com/v1/api/phim/${slug}`);
            if (!res.ok) return null;
            const data = await res.json();
            if (data.status === true || data.status === "success") {
              const movie = data.data?.item || data.movie;
              if (movie) {
                return {
                  slug: movie.slug,
                  name: movie.name,
                  origin_name: movie.origin_name,
                  thumb_url: movie.thumb_url,
                  quality: movie.quality || "HD",
                  lang: movie.lang || "Vietsub"
                } as MovieDetails;
              }
            }
          } catch (e) {
            console.error(`Error loading detail for ${slug}:`, e);
          }
          return null;
        });

        const results = await Promise.all(promises);
        const validMovies = results.filter((m): m is MovieDetails => m !== null);
        setFavoriteDetails(validMovies);
      } catch (err) {
        console.error("Error fetching all favorite details:", err);
      } finally {
        setLoadingDetails(false);
      }
    };

    fetchAllFavoriteDetails();
  }, [user?.favorites?.join(",")]);

  const handleRemoveFavorite = async (e: React.MouseEvent, slug: string) => {
    e.stopPropagation();
    await toggleFavorite(slug);
    setFavoriteDetails((prev) => prev.filter((m) => m.slug !== slug));
  };

  const getImageUrl = (path?: string) => {
    if (!path) return "";
    if (path.startsWith("http")) return path;
    const fileName = path.split("/").pop();
    return `https://img.ophim.live/uploads/movies/${fileName}`;
  };

  // Pagination calculation
  const totalItems = activeTab === "movies" ? favoriteDetails.length : 0;
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
        
        {/* Tabs: Phim / Diễn viên */}
        <div className="inline-flex p-1 bg-[#12131b] border border-zinc-800/40 rounded-xl max-w-fit select-none">
          <button
            onClick={() => setActiveTab("movies")}
            className={`py-1.5 px-4 rounded-lg font-bold text-xs transition-all ${
              activeTab === "movies"
                ? "bg-zinc-800 text-white shadow-md"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Phim
          </button>
          <button
            onClick={() => {
              setActiveTab("actors");
              setCurrentPage(1);
            }}
            className={`py-1.5 px-4 rounded-lg font-bold text-xs transition-all ${
              activeTab === "actors"
                ? "bg-zinc-800 text-white shadow-md"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Diễn viên
          </button>
        </div>
      </div>

      {/* FAVORITE GRID */}
      {activeTab === "movies" ? (
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
                <div key={movie.slug} className="group relative flex flex-col gap-2.5">
                  {/* Card Wrapper */}
                  <div className="aspect-[2/3] relative rounded-2xl overflow-hidden border border-zinc-800/80 bg-zinc-950 shadow-md group">
                    <img
                      src={getImageUrl(movie.thumb_url)}
                      alt={movie.name}
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
                        onClick={(e) => handleRemoveFavorite(e, movie.slug)}
                        className="w-9 h-9 rounded-full bg-zinc-900/90 hover:bg-red-500 hover:text-white border border-zinc-800 text-zinc-350 flex items-center justify-center transition-all shadow-md active:scale-90 cursor-pointer"
                        title="Xóa khỏi yêu thích"
                      >
                        <X size={16} />
                      </button>
                    </div>

                    {/* Episode/Quality Tag */}
                    <div className="absolute top-2.5 left-2.5 flex flex-col gap-1 select-none">
                      <span className="bg-pink-500 px-1.5 py-0.5 rounded text-[9px] font-black text-white uppercase shadow-sm">
                        {movie.quality}
                      </span>
                      <span className="bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded text-[9px] font-black text-white border border-zinc-800">
                        {movie.lang === "Vietsub" ? "P.Đề" : movie.lang}
                      </span>
                    </div>
                  </div>

                  {/* Title & Origin Title */}
                  <div className="px-0.5 space-y-0.5 min-h-[46px]">
                    <h4 className="font-bold text-[13.5px] text-zinc-100 line-clamp-1 group-hover:text-pink-500 transition-colors">
                      {cleanMovieName(movie.name)}
                    </h4>
                    <p className="text-[11px] font-semibold text-zinc-500 truncate">
                      {movie.origin_name}
                    </p>
                  </div>
                </div>
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
      ) : (
        /* ACTORS TAB PLACEHOLDER */
        <div className="bg-[#12131b]/30 border border-zinc-900 rounded-3xl py-20 px-8 flex flex-col items-center justify-center gap-3 select-none text-center">
          <Heart size={44} className="text-zinc-700" />
          <h4 className="text-base font-bold text-zinc-400">Danh sách diễn viên yêu thích trống</h4>
          <p className="text-xs text-zinc-500 max-w-xs">
            Bạn chưa yêu thích diễn viên nào. Khi theo dõi diễn viên phim, danh sách sẽ hiển thị tại đây.
          </p>
        </div>
      )}
    </div>
  );
}
