"use client";

import React, { useEffect, useState } from "react";
import { Plus, ListPlus, Folder, Edit3, Trash2, X, ChevronLeft, Loader2, Play, Save, RefreshCw } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { cleanMovieName, getImageUrl } from "@/utils/movieUtils";
import Link from "next/link";
import Pagination from "@/components/Pagination";
import { getUserMovieSummaries, UserMovieSummary } from "@/utils/userMovieSummaries";
import { useConfirmDialog } from "@/components/ConfirmDialog";

type MovieDetails = UserMovieSummary;

interface Playlist {
  id: string;
  name: string;
  movies: string[];
}

export default function UserWatchlistPage() {
  const { user, createPlaylist, deletePlaylist, updatePlaylistName, toggleMovieInPlaylist, showToast } = useAuth();
  const { confirm, confirmDialog } = useConfirmDialog();
  
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  
  const [playlistMovies, setPlaylistMovies] = useState<MovieDetails[]>([]);
  const [loadingMovies, setLoadingMovies] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [retryNonce, setRetryNonce] = useState(0);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const playlistsPerPage = 9;
  
  const [movieCurrentPage, setMovieCurrentPage] = useState(1);
  const moviesPerPage = 12;
  
  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [playlistName, setPlaylistName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [editingPlaylist, setEditingPlaylist] = useState<Playlist | null>(null);
  const [editName, setEditName] = useState("");

  const playlists: Playlist[] = user?.playlists || [];

  const totalPages = Math.ceil(playlists.length / playlistsPerPage);
  const displayedPlaylists = playlists.slice((currentPage - 1) * playlistsPerPage, currentPage * playlistsPerPage);

  const totalMoviePages = Math.ceil(playlistMovies.length / moviesPerPage);
  const displayedMovies = playlistMovies.slice((movieCurrentPage - 1) * moviesPerPage, movieCurrentPage * moviesPerPage);

  // Đồng bộ lại selectedPlaylist khi user data thay đổi (ví dụ khi xóa phim khỏi playlist)
  useEffect(() => {
    if (selectedPlaylist) {
      const updated = playlists.find(p => p.id === selectedPlaylist.id);
      if (updated) {
        setSelectedPlaylist(updated);
      } else {
        setSelectedPlaylist(null);
      }
    }
  }, [user?.playlists]);

  // Reset movie pagination when active playlist changes
  useEffect(() => {
    setMovieCurrentPage(1);
  }, [selectedPlaylist?.id]);

  // Load chi tiết các phim trong playlist được chọn
  useEffect(() => {
    if (!selectedPlaylist || selectedPlaylist.movies.length === 0) {
      setPlaylistMovies([]);
      return;
    }

    const controller = new AbortController();
    const fetchPlaylistMovieDetail = async () => {
      setLoadingMovies(true);
      setLoadError("");
      try {
        setPlaylistMovies(
          await getUserMovieSummaries(selectedPlaylist.movies, controller.signal),
        );
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error("Error fetching playlist movies:", err);
        setLoadError("Chưa thể tải phim trong danh sách này.");
      } finally {
        if (!controller.signal.aborted) setLoadingMovies(false);
      }
    };

    fetchPlaylistMovieDetail();
    return () => controller.abort();
  }, [selectedPlaylist?.movies?.join(","), retryNonce]);

  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    const nameTrim = playlistName.trim();
    if (!nameTrim) return;

    // Kiểm tra trùng tên danh sách phát
    const isDuplicate = playlists.some(p => p.name.toLowerCase() === nameTrim.toLowerCase());
    if (isDuplicate) {
      showToast(`Danh sách "${nameTrim}" đã tồn tại! Vui lòng chọn tên khác.`, "error");
      return;
    }

    setIsSubmitting(true);
    const success = await createPlaylist(nameTrim);
    setIsSubmitting(false);
    if (success) {
      setPlaylistName("");
      setShowCreateModal(false);
    }
  };

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    const nameTrim = editName.trim();
    if (!editingPlaylist || !nameTrim) return;

    // Kiểm tra trùng tên danh sách phát
    const isDuplicate = playlists.some(
      p => p.id !== editingPlaylist.id && p.name.toLowerCase() === nameTrim.toLowerCase()
    );
    if (isDuplicate) {
      showToast(`Danh sách "${nameTrim}" đã tồn tại!`, "error");
      return;
    }

    setIsSubmitting(true);
    const success = await updatePlaylistName(editingPlaylist.id, nameTrim);
    setIsSubmitting(false);
    if (success) {
      setEditingPlaylist(null);
      setEditName("");
    }
  };

  const handleDeletePlaylistClick = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const accepted = await confirm({
      title: "Xóa danh sách phát?",
      message: "Danh sách này sẽ bị xóa khỏi tài khoản. Các phim vẫn có thể được thêm lại sau.",
      confirmLabel: "Xóa danh sách",
      tone: "danger",
    });
    if (!accepted) return;
    const success = await deletePlaylist(id);
    if (success) showToast("Đã xóa danh sách phát thành công", "success");
  };

  const handleRemoveMovie = async (e: React.MouseEvent, movieSlug: string) => {
    e.stopPropagation();
    if (selectedPlaylist) {
      const accepted = await confirm({
        title: "Xóa phim khỏi danh sách?",
        message: `Phim sẽ được gỡ khỏi “${selectedPlaylist.name}”.`,
        confirmLabel: "Gỡ phim",
        tone: "danger",
      });
      if (accepted) await toggleMovieInPlaylist(selectedPlaylist.id, movieSlug);
    }
  };

  return (
    <div className="space-y-6 select-none relative min-h-[60vh]">
      
      {/* MÀN HÌNH 1: HIỂN THỊ DANH SÁCH CÁC PLAYLISTS */}
      {!selectedPlaylist ? (
        <>
          <div className="flex items-center justify-between border-b border-zinc-900 pb-3.5 gap-4">
            <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight text-zinc-100 flex items-center gap-2.5">
              <ListPlus className="text-pink-500" size={24} />
              <span>Danh sách phát</span>
            </h2>
            
            <button
              onClick={() => setShowCreateModal(true)}
              className="h-10 px-5 bg-pink-500 hover:bg-pink-600 active:scale-98 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-pink-500/10 transition-all cursor-pointer"
            >
              <Plus size={14} className="stroke-[3]" />
              <span>Thêm mới</span>
            </button>
          </div>

          {playlists.length === 0 ? (
            <div className="bg-[#12131b]/30 border border-zinc-900 rounded-3xl py-20 px-8 flex flex-col items-center justify-center gap-3 text-center">
              <Folder size={48} className="text-zinc-800" />
              <h4 className="text-base font-bold text-zinc-400">Danh sách phát trống</h4>
              <p className="text-xs text-zinc-550 max-w-xs">
                Hãy tạo danh sách phát đầu tiên của bạn để lưu lại những thước phim hay nhất.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 pt-4">
                {displayedPlaylists.map((playlist) => (
                  <div
                    key={playlist.id}
                    onClick={() => setSelectedPlaylist(playlist)}
                    className="bg-[#12131b]/60 hover:bg-[#151621] border border-zinc-800/40 hover:border-pink-500/20 p-4 rounded-2xl cursor-pointer transition-all duration-300 relative group flex items-center justify-between shadow-sm hover:shadow-md hover:shadow-pink-500/5 hover:-translate-y-0.5"
                  >
                    <div className="space-y-1 min-w-0 pr-8 text-left">
                      <h3 className="font-extrabold text-sm text-zinc-200 group-hover:text-pink-500 transition-colors truncate">
                        {playlist.name}
                      </h3>
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-550">
                        <Play size={10} className="fill-zinc-550 stroke-none" />
                        <span>{playlist.movies.length} phim</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      {/* Nút sửa */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingPlaylist(playlist);
                          setEditName(playlist.name);
                        }}
                        className="text-zinc-500 hover:text-pink-500 transition-colors p-1"
                        title="Sửa tên"
                      >
                        <Edit3 size={13} />
                      </button>
                      {/* Nút xóa */}
                      <button
                        onClick={(e) => handleDeletePlaylistClick(e, playlist.id)}
                        className="text-zinc-500 hover:text-red-500 transition-colors p-1"
                        title="Xóa danh sách"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Nút Phân trang Client-side */}
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
        </>
      ) : (
        
        // MÀN HÌNH 2: HIỂN THỊ CHI TIẾT PHIM TRONG PLAYLIST
        <>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-900 pb-3.5 gap-4">
            <div className="flex items-center gap-3.5">
              <button
                onClick={() => setSelectedPlaylist(null)}
                className="w-10 h-10 hover:bg-zinc-900/60 rounded-xl flex items-center justify-center text-zinc-400 hover:text-white transition-all"
              >
                <ChevronLeft size={20} />
              </button>
              
              <div className="text-left">
                <p className="text-[10px] font-black text-pink-500 uppercase tracking-widest leading-none">Danh sách phát</p>
                <h2 className="text-lg md:text-xl font-black text-zinc-200 mt-1 flex items-center gap-2">
                  <span>{selectedPlaylist.name}</span>
                  <span className="text-xs font-semibold text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded-full">
                    {selectedPlaylist.movies.length}
                  </span>
                </h2>
              </div>
            </div>
          </div>

          {/* HIỂN THỊ PHIM TRONG PLAYLIST */}
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
          ) : loadingMovies ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 py-10">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="flex flex-col gap-3.5 animate-pulse">
                  <div className="aspect-[2/3] bg-zinc-900 border border-zinc-800 rounded-2xl w-full" />
                  <div className="h-4.5 bg-zinc-900 rounded w-[85%]" />
                  <div className="h-3.5 bg-zinc-900 rounded w-[60%]" />
                </div>
              ))}
            </div>
          ) : playlistMovies.length === 0 ? (
            <div className="bg-[#12131b]/30 border border-zinc-900 rounded-3xl py-20 px-8 flex flex-col items-center justify-center gap-3 text-center">
              <Folder size={44} className="text-zinc-800" />
              <h4 className="text-base font-bold text-zinc-400">Không có phim nào</h4>
              <p className="text-xs text-zinc-550 max-w-xs">
                Danh sách này chưa chứa phim. Hãy truy cập trang chi tiết phim và bấm nút "Thêm vào danh sách" để thêm.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4.5 pt-4">
                {displayedMovies.map((movie) => (
                  <div key={movie.slug} className="group relative flex flex-col gap-2 bg-[#12131b]/30 border border-zinc-900/50 p-2.5 rounded-2xl hover:border-zinc-850 hover:bg-[#151621] transition-all">
                    <Link href={`/movie/${movie.slug}`} className="block relative aspect-[2/3] w-full rounded-xl overflow-hidden bg-zinc-900">
                      <PlaylistMoviePoster movie={movie} />
                      {/* Lớp phủ hover chơi phim */}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-300">
                        <div className="w-10 h-10 rounded-full bg-pink-500 flex items-center justify-center shadow-lg transform translate-y-3 group-hover:translate-y-0 transition-all duration-300">
                          <Play size={16} className="text-white fill-white ml-0.5" />
                        </div>
                      </div>
                    </Link>

                    {/* Nút xóa phim khỏi playlist */}
                    <button
                      onClick={(e) => handleRemoveMovie(e, movie.slug)}
                      className="absolute top-4 right-4 w-7 h-7 rounded-full bg-black/80 backdrop-blur-md border border-zinc-800 hover:border-red-500/30 text-zinc-400 hover:text-red-500 flex items-center justify-center transition-all shadow-md cursor-pointer opacity-0 group-hover:opacity-100 z-10"
                      title="Xóa khỏi danh sách"
                    >
                      <X size={14} className="stroke-[2.5]" />
                    </button>

                    <div className="text-left px-1 py-0.5">
                      <Link href={`/movie/${movie.slug}`} className="block font-black text-sm text-zinc-200 group-hover:text-pink-500 transition-colors truncate">
                        {cleanMovieName(movie.name)}
                      </Link>
                      <p className="text-[10px] text-zinc-550 truncate mt-0.5 leading-none">
                        {movie.origin_name}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Nút Phân trang cho Phim trong Playlist */}
              {totalMoviePages > 1 && (
                <div className="pt-8 flex justify-center">
                  <Pagination
                    currentPage={movieCurrentPage}
                    totalPages={totalMoviePages}
                    onPageChange={(page) => setMovieCurrentPage(page)}
                  />
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* POPUP MODAL 1: TẠO DANH SÁCH MỚI */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
          <form onSubmit={handleCreatePlaylist} className="w-full max-w-sm bg-[#12131b] border border-zinc-800 rounded-3xl p-6 shadow-2xl relative text-left animate-in fade-in zoom-in-95 duration-200">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="absolute top-5 right-5 text-zinc-500 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>

            <h3 className="text-lg font-black text-zinc-200 tracking-tight uppercase mb-4 mt-1">Thêm danh sách mới</h3>
            
            <div className="space-y-4 mb-6">
              <input
                type="text"
                required
                value={playlistName}
                onChange={(e) => setPlaylistName(e.target.value)}
                placeholder="Nhập tên danh sách..."
                className="w-full h-11 bg-zinc-900/60 border border-zinc-800 focus:border-pink-500 rounded-xl px-4 text-sm text-zinc-200 outline-none transition-colors font-semibold"
                maxLength={40}
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isSubmitting || !playlistName.trim()}
                className="h-10 px-5 bg-pink-500 hover:bg-pink-600 disabled:bg-zinc-800 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-lg shadow-pink-500/10 cursor-pointer active:scale-98 transition-all"
              >
                {isSubmitting ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Plus size={12} className="stroke-[3]" />
                )}
                <span>Thêm</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* POPUP MODAL 2: SỬA TÊN DANH SÁCH */}
      {editingPlaylist && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
          <form onSubmit={handleUpdateName} className="w-full max-w-sm bg-[#12131b] border border-zinc-800 rounded-3xl p-6 shadow-2xl relative text-left animate-in fade-in zoom-in-95 duration-200">
            <button
              type="button"
              onClick={() => setEditingPlaylist(null)}
              className="absolute top-5 right-5 text-zinc-500 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>

            <h3 className="text-lg font-black text-zinc-200 tracking-tight uppercase mb-4 mt-1">Sửa tên danh sách</h3>
            
            <div className="space-y-4 mb-6">
              <input
                type="text"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Nhập tên mới..."
                className="w-full h-11 bg-zinc-900/60 border border-zinc-800 focus:border-pink-500 rounded-xl px-4 text-sm text-zinc-200 outline-none transition-colors font-semibold"
                maxLength={40}
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isSubmitting || !editName.trim()}
                className="h-10 px-5 bg-pink-500 hover:bg-pink-600 disabled:bg-zinc-800 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-lg shadow-pink-500/10 cursor-pointer active:scale-98 transition-all"
              >
                {isSubmitting ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Save size={12} />
                )}
                <span>Lưu</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {confirmDialog}
    </div>
  );
}

function PlaylistMoviePoster({ movie }: { movie: MovieDetails }) {
  const fallbackSrc = getImageUrl(movie.thumb_url);
  const [src, setSrc] = useState(getImageUrl(movie.poster_url || movie.thumb_url));

  useEffect(() => {
    setSrc(getImageUrl(movie.poster_url || movie.thumb_url));
  }, [movie.slug, movie.poster_url, movie.thumb_url]);

  return (
    <img
      src={src}
      alt={movie.name}
      onError={() => {
        if (src !== fallbackSrc) setSrc(fallbackSrc);
      }}
      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  );
}
