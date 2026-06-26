"use client";

import React, { useState, useEffect } from "react";
import Cookies from "js-cookie";
import {
  Film,
  Plus,
  Search,
  Trash2,
  Edit,
  EyeOff,
  Star,
  ExternalLink,
  Loader2,
  AlertTriangle,
  RefreshCw,
  X,
  Globe,
  Tag,
  Download,
  Info
} from "lucide-react";
import { createPortal } from "react-dom";
import { useAuth } from "@/context/AuthContext";
import Pagination from "./Pagination";

interface BlockedMovie {
  slug: string;
  title: string;
  reason: string;
  createdAt?: string;
}

interface CustomMovie {
  _id?: string;
  name: string;
  origin_name: string;
  slug: string;
  thumb_url: string;
  poster_url: string;
  year: number;
  time: string;
  quality: string;
  lang: string;
  content: string;
  category: { name: string; slug: string }[];
  country: { name: string; slug: string }[];
  link_m3u8: string;
}

interface RatingStat {
  movieSlug: string;
  averageScore: number;
  totalRatings: number;
}

export default function MoviesManagementView() {
  const { showToast } = useAuth();
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

  // Portal mounted state
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Sub-tabs state
  const [subTab, setSubTab] = useState<"custom" | "blocked" | "ratings">("custom");

  // Loading states
  const [loading, setLoading] = useState(false);

  // Pagination states
  const itemsPerPage = 6;
  const [customPage, setCustomPage] = useState(1);
  const [blockedPage, setBlockedPage] = useState(1);
  const [ratingsPage, setRatingsPage] = useState(1);

  // Blocked movies state
  const [blockedMovies, setBlockedMovies] = useState<BlockedMovie[]>([]);
  const [newBlockSlug, setNewBlockSlug] = useState("");
  const [newBlockTitle, setNewBlockTitle] = useState("");
  const [newBlockReason, setNewBlockReason] = useState("");

  // Custom movies state
  const [customMovies, setCustomMovies] = useState<CustomMovie[]>([]);
  const [searchCustom, setSearchCustom] = useState("");
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [editingMovie, setEditingMovie] = useState<CustomMovie | null>(null);

  // Custom Movie Form state
  const [formName, setFormName] = useState("");
  const [formOriginName, setFormOriginName] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formThumbUrl, setFormThumbUrl] = useState("");
  const [formPosterUrl, setFormPosterUrl] = useState("");
  const [formYear, setFormYear] = useState(2026);
  const [formTime, setFormTime] = useState("120 phút");
  const [formQuality, setFormQuality] = useState("FHD");
  const [formLang, setFormLang] = useState("Vietsub");
  const [formContent, setFormContent] = useState("");
  const [formCategory, setFormCategory] = useState("Hành động");
  const [formCountry, setFormCountry] = useState("Âu Mỹ");
  const [formLink, setFormLink] = useState("");

  // Auto Import Form state
  const [importSlug, setImportSlug] = useState("");
  const [importSource, setImportSource] = useState<"ophim" | "kkphim">("ophim");
  const [importing, setImporting] = useState(false);

  // Rating stats state
  const [ratingStats, setRatingStats] = useState<RatingStat[]>([]);

  // ─── FETCH DỮ LIỆU ───
  const fetchBlocked = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/movies/blocked`);
      if (res.ok) {
        setBlockedMovies(await res.json());
      }
    } catch (err) {
      console.error(err);
      showToast("Lỗi tải danh sách phim bị ẩn", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchCustom = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/movies/custom?search=${searchCustom}`);
      if (res.ok) {
        setCustomMovies(await res.json());
      }
    } catch (err) {
      console.error(err);
      showToast("Lỗi tải danh sách phim tự đăng", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchRatings = async () => {
    try {
      setLoading(true);
      const token = Cookies.get("token");
      const res = await fetch(`${API_URL}/ratings/admin/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setRatingStats(await res.json());
      }
    } catch (err) {
      console.error(err);
      showToast("Lỗi tải thống kê đánh giá", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (subTab === "blocked") fetchBlocked();
    if (subTab === "custom") fetchCustom();
    if (subTab === "ratings") fetchRatings();
  }, [subTab, searchCustom]);

  // Reset pagination on tab change or search changes
  useEffect(() => {
    setCustomPage(1);
    setBlockedPage(1);
    setRatingsPage(1);
  }, [subTab, searchCustom]);

  // ─── AUTO IMPORT (CRAWL DATA) ───
  const handleAutoImport = async () => {
    if (!importSlug) {
      showToast("Vui lòng nhập slug phim từ OPhim hoặc KKPhim", "warning");
      return;
    }

    try {
      setImporting(true);
      let url = "";
      if (importSource === "ophim") {
        url = `https://ophim18.cc/api/phim/${importSlug.trim().toLowerCase()}`;
      } else {
        url = `https://kkphim1.com/api/phim/${importSlug.trim().toLowerCase()}`;
      }

      const res = await fetch(url);
      if (!res.ok) {
        throw new Error("Không thể kết nối máy chủ phim gốc.");
      }
      const data = await res.json();

      if (importSource === "ophim") {
        if (data.status === true || data.status === "success") {
          const item = data.data?.item || data.movie;
          if (item) {
            setFormName(item.name || "");
            setFormOriginName(item.origin_name || "");
            setFormSlug(item.slug || "");

            // Format images
            const getOphimImage = (path: string) => {
              if (!path) return "";
              if (path.startsWith("http")) return path;
              const fileName = path.split("/").pop();
              return `https://img.ophim.live/uploads/movies/${fileName}`;
            };
            setFormThumbUrl(getOphimImage(item.thumb_url));
            setFormPosterUrl(getOphimImage(item.poster_url));

            setFormYear(item.year || 2026);
            setFormTime(item.time || "120 phút");
            setFormQuality(item.quality || "FHD");
            setFormLang(item.lang || "Vietsub");
            setFormContent(item.content || "");
            setFormCategory(item.category?.[0]?.name || "Hành động");
            setFormCountry(item.country?.[0]?.name || "Âu Mỹ");

            // Find streaming link
            const link = item.episodes?.[0]?.server_data?.[0]?.link_m3u8 || "";
            setFormLink(link);
            showToast("Tự động lấy dữ liệu từ OPhim thành công!", "success");
          } else {
            throw new Error("Không tìm thấy thông tin phim.");
          }
        } else {
          throw new Error("Dữ liệu phim từ OPhim bị lỗi.");
        }
      } else {
        // KKPhim
        if (data.status === true || data.status === "success") {
          const movie = data.movie;
          if (movie) {
            setFormName(movie.name || "");
            setFormOriginName(movie.origin_name || "");
            setFormSlug(movie.slug || "");

            const getKkImage = (path: string) => {
              if (!path) return "";
              if (path.startsWith("http")) return path;
              return `https://phimimg.com/${path}`;
            };
            setFormThumbUrl(getKkImage(movie.thumb_url));
            setFormPosterUrl(getKkImage(movie.poster_url));

            setFormYear(movie.year || 2026);
            setFormTime(movie.time || "120 phút");
            setFormQuality(movie.quality || "FHD");
            setFormLang(movie.lang || "Vietsub");
            setFormContent(movie.content || "");
            setFormCategory(movie.category?.[0]?.name || "Hành động");
            setFormCountry(movie.country?.[0]?.name || "Âu Mỹ");

            const link = data.episodes?.[0]?.server_data?.[0]?.link_m3u8 || "";
            setFormLink(link);
            showToast("Tự động lấy dữ liệu từ KKPhim thành công!", "success");
          } else {
            throw new Error("Không tìm thấy thông tin phim.");
          }
        } else {
          throw new Error("Dữ liệu phim từ KKPhim bị lỗi.");
        }
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "Lỗi tự động lấy tin", "error");
    } finally {
      setImporting(false);
    }
  };

  // ─── BLOCK MOVIE ───
  const handleBlockMovie = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBlockSlug) return;
    try {
      const token = Cookies.get("token");
      const res = await fetch(`${API_URL}/movies/blocked`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          slug: newBlockSlug.trim().toLowerCase(),
          title: newBlockTitle.trim() || newBlockSlug,
          reason: newBlockReason.trim() || undefined,
        }),
      });

      if (res.ok) {
        showToast("Đã thêm phim vào danh sách chặn", "success");
        setNewBlockSlug("");
        setNewBlockTitle("");
        setNewBlockReason("");
        fetchBlocked();
      } else {
        const data = await res.json();
        showToast(data.message || "Thao tác thất bại", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Lỗi kết nối máy chủ", "error");
    }
  };

  const handleUnblockMovie = async (slug: string) => {
    try {
      const token = Cookies.get("token");
      const res = await fetch(`${API_URL}/movies/blocked/${slug}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        showToast("Đã khôi phục hiển thị phim", "success");
        fetchBlocked();
      } else {
        showToast("Thao tác thất bại", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Lỗi kết nối máy chủ", "error");
    }
  };

  // ─── CUSTOM MOVIE SAVE/EDIT/DELETE ───
  const openAddModal = () => {
    setEditingMovie(null);
    setImportSlug("");
    setFormName("");
    setFormOriginName("");
    setFormSlug("");
    setFormThumbUrl("");
    setFormPosterUrl("");
    setFormYear(2026);
    setFormTime("120 phút");
    setFormQuality("FHD");
    setFormLang("Vietsub");
    setFormContent("");
    setFormCategory("Hành động");
    setFormCountry("Âu Mỹ");
    setFormLink("");
    setShowCustomModal(true);
  };

  const openEditModal = (movie: CustomMovie) => {
    setEditingMovie(movie);
    setImportSlug("");
    setFormName(movie.name);
    setFormOriginName(movie.origin_name);
    setFormSlug(movie.slug);
    setFormThumbUrl(movie.thumb_url);
    setFormPosterUrl(movie.poster_url);
    setFormYear(movie.year);
    setFormTime(movie.time);
    setFormQuality(movie.quality);
    setFormLang(movie.lang);
    setFormContent(movie.content);
    setFormCategory(movie.category?.[0]?.name || "Hành động");
    setFormCountry(movie.country?.[0]?.name || "Âu Mỹ");
    setFormLink(movie.link_m3u8);
    setShowCustomModal(true);
  };

  const handleSaveCustomMovie = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formOriginName || !formThumbUrl || !formPosterUrl || !formLink) {
      showToast("Vui lòng điền đầy đủ các thông tin bắt buộc", "warning");
      return;
    }

    const payload = {
      name: formName,
      origin_name: formOriginName,
      slug: formSlug ? formSlug.trim().toLowerCase() : undefined,
      thumb_url: formThumbUrl,
      poster_url: formPosterUrl,
      year: Number(formYear),
      time: formTime,
      quality: formQuality,
      lang: formLang,
      content: formContent,
      category: [{ name: formCategory, slug: generateSlug(formCategory) }],
      country: [{ name: formCountry, slug: generateSlug(formCountry) }],
      link_m3u8: formLink,
    };

    try {
      const token = Cookies.get("token");
      const url = editingMovie
        ? `${API_URL}/movies/custom/${editingMovie._id}`
        : `${API_URL}/movies/custom`;
      const method = editingMovie ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        showToast(editingMovie ? "Cập nhật phim thành công" : "Thêm phim mới thành công", "success");
        setShowCustomModal(false);
        fetchCustom();
      } else {
        const data = await res.json();
        showToast(data.message || "Không thể lưu thông tin phim", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Lỗi kết nối máy chủ", "error");
    }
  };

  const handleDeleteCustomMovie = async (id: string) => {
    try {
      const token = Cookies.get("token");
      const res = await fetch(`${API_URL}/movies/custom/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        showToast("Xóa phim tự đăng thành công", "success");
        fetchCustom();
      } else {
        showToast("Thao tác thất bại", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Lỗi kết nối máy chủ", "error");
    }
  };

  // ─── CLEAR RATINGS ───
  const handleDeleteRatings = async (slug: string) => {
    try {
      const token = Cookies.get("token");
      const res = await fetch(`${API_URL}/ratings/admin/movie/${slug}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        showToast(`Đã reset điểm đánh giá phim: ${slug}`, "success");
        fetchRatings();
      } else {
        showToast("Thao tác thất bại", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Lỗi kết nối máy chủ", "error");
    }
  };

  const generateSlug = (text: string): string => {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[đĐ]/g, "d")
      .replace(/([^0-9a-z-\s])/g, "")
      .replace(/(\s+)/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");
  };

  // ─── PAGINATION COMPUTED ITEMS ───
  const paginatedCustomMovies = customMovies.slice(
    (customPage - 1) * itemsPerPage,
    customPage * itemsPerPage
  );
  const totalCustomPages = Math.ceil(customMovies.length / itemsPerPage);

  const paginatedBlockedMovies = blockedMovies.slice(
    (blockedPage - 1) * itemsPerPage,
    blockedPage * itemsPerPage
  );
  const totalBlockedPages = Math.ceil(blockedMovies.length / itemsPerPage);

  // Sorting ratings with highest totalRatings first (then averageScore)
  const sortedRatings = [...ratingStats].sort((a, b) => {
    if (b.totalRatings !== a.totalRatings) {
      return b.totalRatings - a.totalRatings;
    }
    return b.averageScore - a.averageScore;
  });
  const paginatedRatings = sortedRatings.slice(
    (ratingsPage - 1) * itemsPerPage,
    ratingsPage * itemsPerPage
  );
  const totalRatingsPages = Math.ceil(sortedRatings.length / itemsPerPage);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="text-left">
          <h3 className="text-base md:text-lg font-black text-white tracking-tight">Quản lý Phim & Đánh giá</h3>
          <p className="text-[10px] font-semibold text-zinc-500 mt-0.5">
            Quản lý ẩn phim bản quyền, đăng phim tự lưu trữ, và theo dõi điểm đánh giá từ người dùng.
          </p>
        </div>

        {subTab === "custom" && (
          <button
            onClick={openAddModal}
            className="h-9 px-4 rounded-xl bg-pink-500 hover:bg-pink-600 text-white font-extrabold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer border-none shadow-md shadow-pink-500/20"
          >
            <Plus size={15} /> Thêm Phim Tự Đăng
          </button>
        )}
      </div>

      {/* Sub-tabs menu selector */}
      <div className="flex gap-2.5 border-b border-zinc-900 pb-px">
        {[
          { id: "custom", label: "Phim tự đăng", count: customMovies.length },
          { id: "blocked", label: "Phim bị ẩn", count: blockedMovies.length },
          { id: "ratings", label: "Quản lý Đánh giá", count: ratingStats.length },
        ].map((tab) => {
          const isActive = subTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSubTab(tab.id as any)}
              className={`pb-3 px-1.5 text-xs font-black uppercase tracking-wider relative transition-colors cursor-pointer border-none bg-transparent ${isActive ? "text-pink-500" : "text-zinc-500 hover:text-zinc-300"
                }`}
            >
              <span className="flex items-center gap-2">
                {tab.label}
                <span
                  className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full ${isActive ? "bg-pink-500/10 text-pink-400" : "bg-zinc-900 text-zinc-600"
                    }`}
                >
                  {tab.count}
                </span>
              </span>
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-pink-500 rounded-t-full shadow-[0_-2px_6px_rgba(236,72,153,0.4)]" />
              )}
            </button>
          );
        })}
      </div>

      {/* Loading state bar */}
      {loading && (
        <div className="py-12 flex flex-col items-center justify-center gap-2">
          <Loader2 className="animate-spin text-pink-500" size={24} />
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-500">Đang đồng bộ dữ liệu...</span>
        </div>
      )}

      {/* ─── TAB 1: CUSTOM MOVIES VIEW ─── */}
      {!loading && subTab === "custom" && (
        <div className="space-y-4">
          <div className="relative w-full max-w-sm">
            <input
              type="text"
              value={searchCustom}
              onChange={(e) => setSearchCustom(e.target.value)}
              placeholder="Tìm kiếm phim tự đăng..."
              className="h-9 w-full bg-[#0d0e13] border border-zinc-900 rounded-xl px-3 pl-8 text-xs text-zinc-200 placeholder-zinc-650 focus:outline-none focus:border-pink-500/50"
            />
            <Search size={12} className="text-zinc-650 absolute top-1/2 left-3 -translate-y-1/2" />
          </div>

          {customMovies.length > 0 ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {paginatedCustomMovies.map((movie) => (
                  <div
                    key={movie._id}
                    className="bg-[#0c0d12] border border-zinc-900/60 rounded-2xl p-4 flex gap-4 transition-all hover:border-zinc-800"
                  >
                    <img
                      src={movie.thumb_url}
                      alt={movie.name}
                      className="w-16 h-24 object-cover rounded-xl bg-zinc-900 border border-zinc-800/40 shrink-0"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "/images/dlowphim-logo.jpg";
                      }}
                    />
                    <div className="flex-1 min-w-0 text-left flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-xs font-bold text-white truncate leading-tight">{movie.name}</h4>
                          <span className="bg-pink-500/10 text-pink-400 font-extrabold text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0">
                            {movie.quality}
                          </span>
                        </div>
                        <p className="text-[10px] text-zinc-500 font-medium truncate mt-0.5">{movie.origin_name}</p>

                        <div className="flex flex-wrap gap-1.5 mt-2">
                          <span className="flex items-center gap-1 text-[9px] font-black text-zinc-400 uppercase tracking-widest bg-zinc-900/80 px-1.5 py-0.5 rounded border border-zinc-800/20">
                            <Globe size={9} className="text-zinc-650" /> {movie.country?.[0]?.name || "Âu Mỹ"}
                          </span>
                          <span className="flex items-center gap-1 text-[9px] font-black text-zinc-400 uppercase tracking-widest bg-zinc-900/80 px-1.5 py-0.5 rounded border border-zinc-800/20">
                            <Tag size={9} className="text-zinc-650" /> {movie.category?.[0]?.name || "Hành động"}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between border-t border-zinc-900/60 pt-3 mt-3">
                        <span className="text-[9px] text-zinc-550 font-semibold">{movie.year} • {movie.time}</span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => openEditModal(movie)}
                            className="w-7 h-7 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg flex items-center justify-center transition-all cursor-pointer border-none"
                            title="Chỉnh sửa phim"
                          >
                            <Edit size={12} />
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm("Bạn có chắc chắn muốn xóa phim tự đăng này không?")) {
                                handleDeleteCustomMovie(movie._id!);
                              }
                            }}
                            className="w-7 h-7 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-lg flex items-center justify-center transition-all cursor-pointer border-none"
                            title="Xóa phim"
                          >
                            <Trash2 size={12} />
                          </button>
                          <a
                            href={`/movie/${movie.slug}`}
                            target="_blank"
                            rel="noreferrer"
                            className="w-7 h-7 bg-pink-500/10 hover:bg-pink-500/20 text-pink-400 hover:text-pink-300 rounded-lg flex items-center justify-center transition-all cursor-pointer border-none"
                            title="Xem trên trang chủ"
                          >
                            <ExternalLink size={12} />
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Reusable Pagination */}
              <Pagination
                currentPage={customPage}
                totalPages={totalCustomPages}
                onPageChange={setCustomPage}
              />
            </div>
          ) : (
            <div className="py-16 border border-dashed border-zinc-900 rounded-2xl flex flex-col items-center justify-center gap-2">
              <Film size={28} className="text-zinc-700" />
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-550">
                Không tìm thấy phim tự đăng nào
              </span>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 2: BLOCKED MOVIES VIEW ─── */}
      {!loading && subTab === "blocked" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Block form */}
          <form
            onSubmit={handleBlockMovie}
            className="lg:col-span-1 bg-[#0c0d12] border border-zinc-900 rounded-2xl p-5 space-y-4 text-left"
          >
            <div>
              <h4 className="text-xs font-black uppercase text-zinc-400 tracking-wider">Ẩn phim mới</h4>
              <p className="text-[9px] text-zinc-550 font-semibold mt-0.5">
                Nhập slug phim cần ẩn khỏi toàn hệ thống.
              </p>
            </div>

            <div className="space-y-3.5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400">Slug phim (Bắt buộc)</label>
                <input
                  type="text"
                  required
                  placeholder="vi-du: avengers-endgame"
                  value={newBlockSlug}
                  onChange={(e) => setNewBlockSlug(e.target.value)}
                  className="w-full h-9 bg-zinc-950 border border-zinc-900 rounded-xl px-3 text-xs text-zinc-200 focus:outline-none focus:border-pink-500/50"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400">Tên phim hiển thị (Tùy chọn)</label>
                <input
                  type="text"
                  placeholder="Avengers: Endgame"
                  value={newBlockTitle}
                  onChange={(e) => setNewBlockTitle(e.target.value)}
                  className="w-full h-9 bg-zinc-950 border border-zinc-900 rounded-xl px-3 text-xs text-zinc-200 focus:outline-none focus:border-pink-500/50"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400">Lý do ẩn (Tùy chọn)</label>
                <textarea
                  placeholder="Vi phạm bản quyền hoặc yêu cầu gỡ bỏ từ nhà phát hành"
                  value={newBlockReason}
                  onChange={(e) => setNewBlockReason(e.target.value)}
                  className="w-full h-16 bg-zinc-950 border border-zinc-900 rounded-xl p-3 text-xs text-zinc-200 focus:outline-none focus:border-pink-500/50 resize-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={!newBlockSlug}
              className="w-full h-9 bg-red-500/10 hover:bg-red-500/20 disabled:opacity-50 text-red-400 font-extrabold text-xs rounded-xl transition-all cursor-pointer border border-red-500/15 hover:border-red-500/30 flex items-center justify-center gap-1.5"
            >
              <EyeOff size={13} /> Ẩn Phim Này
            </button>
          </form>

          {/* Block list */}
          <div className="lg:col-span-2 space-y-3.5 text-left">
            <h4 className="text-xs font-black uppercase text-zinc-400 tracking-wider">Danh sách phim đang bị ẩn</h4>
            {blockedMovies.length > 0 ? (
              <div className="space-y-4">
                <div className="bg-[#0c0d12] border border-zinc-900 rounded-2xl overflow-hidden">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-900/60 bg-zinc-950/40">
                        <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-zinc-500 text-left">Thông tin phim</th>
                        <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-zinc-500 text-left">Lý do ẩn</th>
                        <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-zinc-500 text-right">Hành động</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-900/40">
                      {paginatedBlockedMovies.map((movie) => (
                        <tr key={movie.slug} className="hover:bg-zinc-900/25 transition-colors">
                          <td className="px-4 py-3.5">
                            <p className="text-xs font-bold text-zinc-200">{movie.title}</p>
                            <code className="text-[9px] text-pink-500 font-bold bg-pink-500/5 px-1 py-0.5 rounded border border-pink-500/10 mt-1 inline-block">
                              {movie.slug}
                            </code>
                          </td>
                          <td className="px-4 py-3.5">
                            <p className="text-xs text-zinc-400">{movie.reason}</p>
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <button
                              onClick={() => handleUnblockMovie(movie.slug)}
                              className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white text-[10px] font-black rounded-lg transition-colors cursor-pointer border-none uppercase tracking-wider"
                            >
                              Bỏ ẩn
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Reusable Pagination */}
                <Pagination
                  currentPage={blockedPage}
                  totalPages={totalBlockedPages}
                  onPageChange={setBlockedPage}
                />
              </div>
            ) : (
              <div className="py-16 border border-dashed border-zinc-900 rounded-2xl flex flex-col items-center justify-center gap-2">
                <Globe size={28} className="text-zinc-700" />
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-550">
                  Không có phim nào bị ẩn trong hệ thống
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 3: RATINGS MANAGEMENT VIEW ─── */}
      {!loading && subTab === "ratings" && (
        <div className="space-y-4 text-left">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black uppercase text-zinc-400 tracking-wider">Thống kê điểm đánh giá</h4>
            <button
              onClick={fetchRatings}
              className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer border-none"
              title="Làm mới"
            >
              <RefreshCw size={13} />
            </button>
          </div>

          {ratingStats.length > 0 ? (
            <div className="space-y-4">
              <div className="bg-[#0c0d12] border border-zinc-900 rounded-2xl overflow-hidden">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-900/60 bg-zinc-950/40">
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-zinc-500 text-left">Slug Phim</th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-zinc-500 text-center">Điểm Trung Bình</th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-zinc-500 text-center">Lượt Đánh Giá</th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-zinc-500 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900/40">
                    {paginatedRatings.map((stat) => (
                      <tr key={stat.movieSlug} className="hover:bg-zinc-900/25 transition-colors">
                        <td className="px-4 py-3.5">
                          <code className="text-[11px] text-zinc-300 font-bold bg-zinc-900 px-2 py-1 rounded border border-zinc-800">
                            {stat.movieSlug}
                          </code>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <Star size={13} className="text-yellow-500 fill-yellow-500 shrink-0" />
                            <span className="text-xs font-black text-white">{stat.averageScore}</span>
                            <span className="text-[9px] text-zinc-550 font-bold">/10</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span className="text-xs font-black text-pink-400 bg-pink-500/5 px-2 py-0.5 rounded border border-pink-500/10">
                            {stat.totalRatings} lượt
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex justify-end gap-2.5">
                            <button
                              onClick={() => {
                                if (window.confirm(`Xóa toàn bộ điểm đánh giá của phim ${stat.movieSlug}?`)) {
                                  handleDeleteRatings(stat.movieSlug);
                                }
                              }}
                              className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 text-[10px] font-black rounded-lg transition-colors cursor-pointer border-none uppercase tracking-wider"
                            >
                              Reset điểm
                            </button>
                            <a
                              href={`/movie/${stat.movieSlug}`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg flex items-center justify-center transition-colors cursor-pointer border-none"
                              title="Đến trang xem phim"
                            >
                              <ExternalLink size={12} />
                            </a>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Reusable Pagination */}
              <Pagination
                currentPage={ratingsPage}
                totalPages={totalRatingsPages}
                onPageChange={setRatingsPage}
              />
            </div>
          ) : (
            <div className="py-16 border border-dashed border-zinc-900 rounded-2xl flex flex-col items-center justify-center gap-2">
              <Star size={28} className="text-zinc-700" />
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-550">
                Chưa có phim nào được đánh giá
              </span>
            </div>
          )}
        </div>
      )}

      {/* ─── MODAL: ĐĂNG / SỬA PHIM TỰ ĐĂNG ─── */}
      {showCustomModal && mounted && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md px-4">
          <div
            className="w-full max-w-3xl bg-[#0c0d12] border border-zinc-900 shadow-2xl flex flex-col max-h-[90vh]"
          >
            {/* Modal header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-900">
              <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                <Film size={16} className="text-pink-500 animate-pulse" />
                {editingMovie ? "Chỉnh sửa phim tự đăng" : "Đăng phim mới lên hệ thống"}
              </h3>
              <button
                onClick={() => setShowCustomModal(false)}
                className="p-1.5 hover:bg-zinc-900 text-zinc-400 hover:text-white rounded-lg transition-colors cursor-pointer border-none bg-transparent"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Scrollable container */}
            <div className="overflow-y-auto p-5 space-y-5 text-left flex-1 custom-scrollbar">

              {/* ─── ĐĂNG TIN TỰ ĐỘNG (AUTO CRAWLER) SECTION ─── */}
              {!editingMovie && (
                <div className="p-4 bg-pink-500/5 rounded-2xl border border-pink-500/10 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <Info size={16} className="text-pink-400 shrink-0 mt-0.5 animate-pulse" />
                    <div>
                      <h4 className="text-xs font-black uppercase text-pink-400 tracking-wider">Đăng Tin Tự Động (Auto Crawler)</h4>
                      <p className="text-[10px] text-zinc-550 font-semibold mt-0.5 leading-normal">
                        Chỉ cần nhập slug phim và chọn nguồn API, hệ thống sẽ tự động cào tiêu đề, poster, năm, thể loại và link stream m3u8.
                      </p>

                      {/* Lookup helper links */}
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[9px] font-extrabold text-zinc-500">
                        <span>Nếu chưa biết slug phim, tra cứu tại:</span>
                        <a
                          href="https://ophim18.cc/"
                          target="_blank"
                          rel="noreferrer"
                          className="text-pink-500 hover:underline flex items-center gap-1"
                        >
                          Tra OPhim API <ExternalLink size={9} />
                        </a>
                        <span className="text-zinc-800">|</span>
                        <a
                          href="https://kkphim1.com/"
                          target="_blank"
                          rel="noreferrer"
                          className="text-pink-500 hover:underline flex items-center gap-1"
                        >
                          Tra KKPhim API <ExternalLink size={9} />
                        </a>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 pt-1.5">
                    <div className="flex rounded-xl bg-zinc-950 border border-zinc-900 p-0.5 overflow-hidden shrink-0">
                      <button
                        type="button"
                        onClick={() => setImportSource("ophim")}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border-none cursor-pointer ${importSource === "ophim" ? "bg-pink-500 text-white" : "bg-transparent text-zinc-500"
                          }`}
                      >
                        OPhim
                      </button>
                      <button
                        type="button"
                        onClick={() => setImportSource("kkphim")}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border-none cursor-pointer ${importSource === "kkphim" ? "bg-pink-500 text-white" : "bg-transparent text-zinc-500"
                          }`}
                      >
                        KKPhim
                      </button>
                    </div>

                    <div className="flex-1 flex gap-2">
                      <input
                        type="text"
                        placeholder="Nhập slug phim cần cào (ví dụ: bo-gia-2021)"
                        value={importSlug}
                        onChange={(e) => setImportSlug(e.target.value)}
                        className="flex-1 h-9 bg-zinc-950 border border-zinc-900 rounded-xl px-3 text-xs text-zinc-200 focus:outline-none focus:border-pink-500/50"
                      />
                      <button
                        type="button"
                        disabled={importing || !importSlug}
                        onClick={handleAutoImport}
                        className="h-9 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 text-zinc-300 hover:text-white text-xs font-black border border-zinc-800 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        {importing ? (
                          <Loader2 size={13} className="animate-spin text-pink-500" />
                        ) : (
                          <Download size={13} className="text-pink-500" />
                        )}
                        Lấy tin
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ─── MANUAL DETAILS SECTION ─── */}
              <form onSubmit={handleSaveCustomMovie} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-zinc-400">Tên phim Việt hóa (Bắt buộc)</label>
                    <input
                      type="text"
                      required
                      placeholder="Bố Già (2021)"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="w-full h-9 bg-zinc-950 border border-zinc-900 rounded-xl px-3 text-xs text-zinc-200 focus:outline-none focus:border-pink-500/50"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-zinc-400">Tên gốc tiếng Anh/gốc (Bắt buộc)</label>
                    <input
                      type="text"
                      required
                      placeholder="The Godfather"
                      value={formOriginName}
                      onChange={(e) => setFormOriginName(e.target.value)}
                      className="w-full h-9 bg-zinc-950 border border-zinc-900 rounded-xl px-3 text-xs text-zinc-200 focus:outline-none focus:border-pink-500/50"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-zinc-400">Slug phim (Để trống sẽ tự tạo)</label>
                    <input
                      type="text"
                      placeholder="bo-gia-2021"
                      value={formSlug}
                      onChange={(e) => setFormSlug(e.target.value)}
                      className="w-full h-9 bg-zinc-950 border border-zinc-900 rounded-xl px-3 text-xs text-zinc-200 focus:outline-none focus:border-pink-500/50"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-zinc-400">Đường dẫn Poster đứng (Bắt buộc)</label>
                    <input
                      type="text"
                      required
                      placeholder="https://imgur.com/link-anh-poster.jpg"
                      value={formThumbUrl}
                      onChange={(e) => setFormThumbUrl(e.target.value)}
                      className="w-full h-9 bg-zinc-950 border border-zinc-900 rounded-xl px-3 text-xs text-zinc-200 focus:outline-none focus:border-pink-500/50"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-zinc-400">Đường dẫn Banner ngang (Bắt buộc)</label>
                    <input
                      type="text"
                      required
                      placeholder="https://imgur.com/link-anh-banner.jpg"
                      value={formPosterUrl}
                      onChange={(e) => setFormPosterUrl(e.target.value)}
                      className="w-full h-9 bg-zinc-950 border border-zinc-900 rounded-xl px-3 text-xs text-zinc-200 focus:outline-none focus:border-pink-500/50"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-zinc-400">Link luồng video m3u8/mp4 (Bắt buộc)</label>
                    <input
                      type="text"
                      required
                      placeholder="https://examples.com/stream/index.m3u8"
                      value={formLink}
                      onChange={(e) => setFormLink(e.target.value)}
                      className="w-full h-9 bg-zinc-950 border border-zinc-900 rounded-xl px-3 text-xs text-zinc-200 focus:outline-none focus:border-pink-500/50"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-zinc-400">Năm phát hành</label>
                    <input
                      type="number"
                      value={formYear}
                      onChange={(e) => setFormYear(Number(e.target.value))}
                      className="w-full h-9 bg-zinc-950 border border-zinc-900 rounded-xl px-3 text-xs text-zinc-200 focus:outline-none focus:border-pink-500/50"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-zinc-400">Thời lượng phim</label>
                    <input
                      type="text"
                      value={formTime}
                      onChange={(e) => setFormTime(e.target.value)}
                      className="w-full h-9 bg-zinc-950 border border-zinc-900 rounded-xl px-3 text-xs text-zinc-200 focus:outline-none focus:border-pink-500/50"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-zinc-400">Độ phân giải hiển thị</label>
                    <input
                      type="text"
                      value={formQuality}
                      onChange={(e) => setFormQuality(e.target.value)}
                      className="w-full h-9 bg-zinc-950 border border-zinc-900 rounded-xl px-3 text-xs text-zinc-200 focus:outline-none focus:border-pink-500/50"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-zinc-400">Ngôn ngữ</label>
                    <input
                      type="text"
                      value={formLang}
                      onChange={(e) => setFormLang(e.target.value)}
                      className="w-full h-9 bg-zinc-950 border border-zinc-900 rounded-xl px-3 text-xs text-zinc-200 focus:outline-none focus:border-pink-500/50"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-zinc-400">Thể loại</label>
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      className="w-full h-9 bg-zinc-950 border border-zinc-900 rounded-xl px-2 text-xs text-zinc-300 focus:outline-none focus:border-pink-500/50"
                    >
                      {["Hành động", "Viễn tưởng", "Kinh dị", "Tình cảm", "Hoạt hình", "Cổ trang", "Hài hước", "Kịch tính", "Tài liệu", "Phiêu lưu"].map(
                        (cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-zinc-400">Quốc gia</label>
                    <select
                      value={formCountry}
                      onChange={(e) => setFormCountry(e.target.value)}
                      className="w-full h-9 bg-zinc-950 border border-zinc-900 rounded-xl px-2 text-xs text-zinc-300 focus:outline-none focus:border-pink-500/50"
                    >
                      {["Âu Mỹ", "Trung Quốc", "Hàn Quốc", "Nhật Bản", "Việt Nam", "Thái Lan", "Ấn Độ", "Đài Loan"].map((cou) => (
                        <option key={cou} value={cou}>
                          {cou}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400">Tóm tắt nội dung phim</label>
                  <textarea
                    placeholder="Nhập giới thiệu tóm tắt cho phim..."
                    value={formContent}
                    onChange={(e) => setFormContent(e.target.value)}
                    className="w-full h-24 bg-zinc-950 border border-zinc-900 rounded-xl p-3 text-xs text-zinc-200 focus:outline-none focus:border-pink-500/50 resize-none custom-scrollbar"
                  />
                </div>

                {/* Modal action buttons */}
                <div className="flex justify-end gap-3 border-t border-zinc-900 pt-4 mt-2">
                  <button
                    type="button"
                    onClick={() => setShowCustomModal(false)}
                    className="h-9 px-5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs font-extrabold rounded-xl transition-colors cursor-pointer border-none"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    className="h-9 px-6 bg-pink-500 hover:bg-pink-600 text-white text-xs font-extrabold rounded-xl transition-colors cursor-pointer border-none shadow-md shadow-pink-500/20"
                  >
                    Lưu thông tin
                  </button>
                </div>
              </form>

            </div>
          </div>
        </div>
        , document.body)}
    </div>
  );
}
