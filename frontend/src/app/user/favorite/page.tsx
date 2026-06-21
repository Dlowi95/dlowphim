"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, Plus, History, Bell, User, LogOut, ChevronLeft, ChevronRight, X, Loader2, Play, AlertCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import Cookies from "js-cookie";
import Link from "next/link";
import { cleanMovieName } from "@/utils/movieUtils";

interface MovieDetails {
  slug: string;
  name: string;
  origin_name: string;
  thumb_url: string;
  quality: string;
  lang: string;
}

export default function UserFavoritePage() {
  const router = useRouter();
  const { user, loading, logout, toggleFavorite } = useAuth();
  
  const [favoriteDetails, setFavoriteDetails] = useState<MovieDetails[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [activeTab, setActiveTab] = useState<"movies" | "actors">("movies");
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

  // Check login state
  useEffect(() => {
    if (!loading && !user) {
      // Trigger global open auth modal event
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("dlowphim_open_auth"));
      }
    }
  }, [user, loading]);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-3">
        <Loader2 className="animate-spin text-pink-500" size={40} />
        <p className="text-sm font-semibold text-zinc-400">Đang kiểm tra tài khoản...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[70vh] bg-black text-white flex flex-col items-center justify-center gap-4 px-6 text-center select-none">
        <AlertCircle size={56} className="text-zinc-650" />
        <h2 className="text-xl md:text-2xl font-black text-zinc-300">Vui lòng đăng nhập tài khoản</h2>
        <p className="text-sm text-zinc-500 max-w-sm">
          Đăng nhập tài khoản DlowPhim để đồng bộ và quản lý danh sách phim yêu thích của bạn.
        </p>
        <button
          onClick={() => {
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("dlowphim_open_auth"));
            }
          }}
          className="mt-2 h-11 px-6 rounded-full bg-pink-500 hover:bg-pink-600 text-white font-extrabold text-sm transition-all duration-200"
        >
          Đăng nhập ngay
        </button>
      </div>
    );
  }

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

  const userInitial = user.displayName ? user.displayName[0].toUpperCase() : (user.email ? user.email[0].toUpperCase() : "U");

  return (
    <div className="min-h-screen bg-black text-white py-10 pt-28">
      <div className="container mx-auto px-6 max-w-7xl">
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          
          {/* SIDEBAR: QUẢN LÝ TÀI KHOẢN (Cobephim Layout) */}
          <div className="w-full lg:w-[280px] bg-[#12131b] border border-zinc-800/40 rounded-3xl p-6 flex flex-col justify-between shrink-0 select-none">
            <div className="space-y-6">
              <h3 className="text-lg font-black text-zinc-300 tracking-tight px-1 uppercase">
                Quản lý tài khoản
              </h3>
              
              {/* Menu Navigation */}
              <div className="flex flex-col gap-1">
                <Link
                  href="/user/favorite"
                  className="flex items-center gap-3.5 py-3 px-4 rounded-xl font-bold text-sm bg-pink-500/10 border border-pink-500/15 text-pink-500 transition-all"
                >
                  <Heart size={18} className="fill-pink-500 text-pink-500" />
                  <span>Yêu thích</span>
                </Link>
                
                <Link
                  href="/user/watchlist"
                  className="flex items-center gap-3.5 py-3 px-4 rounded-xl font-bold text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 border border-transparent transition-all"
                >
                  <Plus size={18} />
                  <span>Danh sách</span>
                </Link>
                
                <Link
                  href="/user/history"
                  className="flex items-center gap-3.5 py-3 px-4 rounded-xl font-bold text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 border border-transparent transition-all"
                >
                  <History size={18} />
                  <span>Xem tiếp</span>
                </Link>
                
                <Link
                  href="/user/notifications"
                  className="flex items-center gap-3.5 py-3 px-4 rounded-xl font-bold text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 border border-transparent transition-all"
                >
                  <Bell size={18} />
                  <span>Thông báo</span>
                </Link>
                
                <Link
                  href="/user/vip"
                  className="flex items-center gap-3.5 py-3 px-4 rounded-xl font-bold text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 border border-transparent transition-all"
                >
                  <div className="flex items-center justify-center w-[18px] h-[18px] text-[10px] font-black border border-zinc-500 rounded-md shrink-0">VIP</div>
                  <span>Nâng cấp VIP</span>
                </Link>
                
                <Link
                  href="/user/account"
                  className="flex items-center gap-3.5 py-3 px-4 rounded-xl font-bold text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 border border-transparent transition-all"
                >
                  <User size={18} />
                  <span>Tài khoản</span>
                </Link>
              </div>
            </div>

            {/* Profile Avatar and Information (Vietnamese Flag Layout) */}
            <div className="border-t border-zinc-800/60 mt-8 pt-6 flex flex-col gap-4">
              <div className="flex items-center gap-3.5">
                {/* Vietnamese flag themed avatar (Red bg, yellow star in middle) */}
                <div className="w-12 h-12 rounded-full bg-[#da251d] flex items-center justify-center shrink-0 border border-[#da251d]/40 shadow-lg select-none">
                  {user.avatar ? (
                    <img 
                      src={user.avatar} 
                      alt={user.displayName}
                      className="w-full h-full rounded-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="#ffff00"
                      className="w-6 h-6"
                    >
                      <path d="M12 .587l3.668 7.431 8.2 1.192-5.934 5.786 1.4 8.168L12 18.896l-7.334 3.857 1.4-8.168L.132 9.21l8.2-1.192z" />
                    </svg>
                  )}
                </div>
                
                <div className="flex-1 min-w-0 text-left">
                  <h4 className="font-extrabold text-sm text-zinc-200 truncate leading-snug">
                    {user.displayName}
                  </h4>
                  <p className="text-[11px] text-zinc-500 font-semibold truncate mt-0.5 leading-none">
                    {user.email}
                  </p>
                </div>
              </div>

              {/* Logout Button */}
              <button
                onClick={logout}
                className="w-full py-2.5 px-4 rounded-xl bg-zinc-900/60 hover:bg-red-500/10 text-zinc-400 hover:text-red-500 border border-zinc-850 hover:border-red-500/20 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all duration-200"
              >
                <LogOut size={14} />
                <span>Thoát</span>
              </button>
            </div>
          </div>

          {/* MAIN CONTENT AREA */}
          <div className="flex-1 w-full space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-900 pb-3.5 gap-4">
              <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight text-zinc-100 flex items-center gap-2.5">
                <Heart className="text-pink-500 fill-pink-500" size={24} />
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
                  <h4 className="text-base font-bold text-zinc-400">Danh sách yêu thích trống</h4>
                  <p className="text-xs text-zinc-500 max-w-xs">
                    Bạn chưa thêm bộ phim nào vào mục yêu thích. Hãy khám phá và thêm phim ngay!
                  </p>
                  <Link
                    href="/"
                    className="mt-2 h-10 px-5 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-500 hover:bg-pink-500/20 font-bold text-xs flex items-center justify-center transition-all"
                  >
                    Khám phá phim
                  </Link>
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {paginatedMovies.map((movie) => (
                      <div
                        key={movie.slug}
                        onClick={() => router.push(`/movie/${movie.slug}`)}
                        className="group relative flex flex-col gap-2.5 cursor-pointer text-left"
                      >
                        {/* Poster card with X button overlay */}
                        <div className="relative aspect-[2/3] rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800/80 group-hover:border-zinc-700 transition-all select-none shadow-md">
                          <img
                            src={getImageUrl(movie.thumb_url)}
                            alt={movie.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                          
                          {/* Close X button to remove from favorites */}
                          <button
                            onClick={(e) => handleRemoveFavorite(e, movie.slug)}
                            className="absolute top-2.5 right-2.5 w-6.5 h-6.5 rounded-lg bg-black/60 hover:bg-[#ef4444] text-white flex items-center justify-center cursor-pointer transition-all z-10 border border-zinc-800/20 backdrop-blur-sm"
                            title="Xóa khỏi yêu thích"
                          >
                            <X size={13} strokeWidth={3} />
                          </button>

                          {/* Quality badges bottom left */}
                          <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1 z-10">
                            <span className="bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded text-[9px] font-black text-pink-400 border border-zinc-850">
                              {movie.quality}
                            </span>
                            <span className="bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded text-[9px] font-black text-white border border-zinc-850">
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

                  {/* PAGINATION (Cobephim layout style) */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-4 pt-4 select-none">
                      {/* Prev Button */}
                      <button
                        onClick={handlePrevPage}
                        disabled={currentPage === 1}
                        className={`w-10 h-10 rounded-full border border-zinc-850 bg-zinc-900/60 text-zinc-400 flex items-center justify-center transition-all ${
                          currentPage === 1
                            ? "opacity-40 cursor-not-allowed"
                            : "hover:border-zinc-700 hover:text-white hover:bg-zinc-800 cursor-pointer active:scale-95"
                        }`}
                      >
                        <ChevronLeft size={18} />
                      </button>

                      {/* Page Counter Label */}
                      <div className="flex items-center gap-2 text-zinc-400 font-bold text-xs">
                        <span>Trang</span>
                        <span className="bg-[#12131b] border border-zinc-850 text-white font-extrabold w-10 h-8 flex items-center justify-center rounded-lg">{currentPage}</span>
                        <span>/</span>
                        <span>{totalPages}</span>
                      </div>

                      {/* Next Button */}
                      <button
                        onClick={handleNextPage}
                        disabled={currentPage === totalPages}
                        className={`w-10 h-10 rounded-full border border-zinc-850 bg-zinc-900/60 text-zinc-400 flex items-center justify-center transition-all ${
                          currentPage === totalPages
                            ? "opacity-40 cursor-not-allowed"
                            : "hover:border-zinc-700 hover:text-white hover:bg-zinc-800 cursor-pointer active:scale-95"
                        }`}
                      >
                        <ChevronRight size={18} />
                      </button>
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
          
        </div>
      </div>
    </div>
  );
}
