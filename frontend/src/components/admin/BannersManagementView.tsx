"use client";

import React, { useState, useEffect } from "react";
import Cookies from "js-cookie";
import {
  Image as ImageIcon,
  Plus,
  Search,
  Trash2,
  Edit,
  EyeOff,
  Eye,
  Loader2,
  RefreshCw,
  X,
  Download,
  Info,
  ExternalLink
} from "lucide-react";
import { createPortal } from "react-dom";
import { useAuth } from "@/context/AuthContext";

interface Banner {
  _id?: string;
  title: string;
  originName?: string;
  movieSlug: string;
  imageUrl: string;
  description?: string;
  order: number;
  isActive: boolean;
}

export default function BannersManagementView() {
  const { showToast } = useAuth();
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

  // Portal mounted state
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);

  // Form states
  const [formTitle, setFormTitle] = useState("");
  const [formOriginName, setFormOriginName] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formImageUrl, setFormImageUrl] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formOrder, setFormOrder] = useState(0);
  const [formIsActive, setFormIsActive] = useState(true);

  // Crawler state
  const [crawlerSlug, setCrawlerSlug] = useState("");
  const [crawlerSource, setCrawlerSource] = useState<"ophim" | "kkphim">("ophim");
  const [crawling, setCrawling] = useState(false);

  // Fetch banners from API
  const fetchBanners = async () => {
    setLoading(true);
    try {
      const token = Cookies.get("token");
      const res = await fetch(`${API_URL}/banners/admin`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        setBanners(await res.json());
      } else {
        showToast("Không thể tải danh sách banner", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Lỗi kết nối máy chủ", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBanners();
  }, []);

  // Filter banners based on search
  const filteredBanners = banners.filter((b) => {
    const q = searchTerm.toLowerCase();
    return (
      b.title.toLowerCase().includes(q) ||
      b.movieSlug.toLowerCase().includes(q) ||
      (b.originName && b.originName.toLowerCase().includes(q))
    );
  });

  // Open modal for adding
  const openAddModal = () => {
    setEditingBanner(null);
    setCrawlerSlug("");
    setFormTitle("");
    setFormOriginName("");
    setFormSlug("");
    setFormImageUrl("");
    setFormDescription("");
    setFormOrder(0);
    setFormIsActive(true);
    setShowModal(true);
  };

  // Open modal for editing
  const openEditModal = (banner: Banner) => {
    setEditingBanner(banner);
    setCrawlerSlug("");
    setFormTitle(banner.title);
    setFormOriginName(banner.originName || "");
    setFormSlug(banner.movieSlug);
    setFormImageUrl(banner.imageUrl);
    setFormDescription(banner.description || "");
    setFormOrder(banner.order);
    setFormIsActive(banner.isActive);
    setShowModal(true);
  };

  // Auto crawl info from OPhim/KKPhim API
  const handleAutoCrawl = async () => {
    if (!crawlerSlug) {
      showToast("Vui lòng nhập slug phim cần cào", "warning");
      return;
    }

    setCrawling(true);
    try {
      let url = "";
      if (crawlerSource === "ophim") {
        url = `https://ophim18.cc/api/phim/${crawlerSlug.trim().toLowerCase()}`;
      } else {
        url = `https://kkphim1.com/api/phim/${crawlerSlug.trim().toLowerCase()}`;
      }

      const res = await fetch(url);
      if (!res.ok) {
        throw new Error("Không thể kết nối máy chủ phim gốc.");
      }
      const data = await res.json();

      if (data.status === true || data.status === "success") {
        const movie = data.movie || data.data?.item;
        if (movie) {
          setFormTitle(movie.name || "");
          setFormOriginName(movie.origin_name || "");
          setFormSlug(movie.slug || crawlerSlug.trim().toLowerCase());
          
          // Image formatter (prefer landscape poster_url for banners)
          const formatImg = (path: string) => {
            if (!path) return "";
            if (path.startsWith("http")) return path;
            if (crawlerSource === "ophim") {
              const fileName = path.split("/").pop();
              return `https://img.ophim.live/uploads/movies/${fileName}`;
            } else {
              return `https://phimimg.com/${path}`;
            }
          };

          setFormImageUrl(formatImg(movie.poster_url || movie.thumb_url));
          setFormDescription(movie.content ? movie.content.replace(/<[^>]*>/g, "").trim() : "");
          showToast("Tự động cào thông tin phim thành công!", "success");
        } else {
          throw new Error("Không tìm thấy dữ liệu phim.");
        }
      } else {
        // Try internal endpoint if OPhim fails (maybe custom movie slug)
        const token = Cookies.get("token");
        const internalRes = await fetch(`${API_URL}/movies/custom/${crawlerSlug.trim().toLowerCase()}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (internalRes.ok) {
          const customMovie = await internalRes.json();
          setFormTitle(customMovie.name || "");
          setFormOriginName(customMovie.origin_name || "");
          setFormSlug(customMovie.slug || "");
          setFormImageUrl(customMovie.poster_url || customMovie.thumb_url || "");
          setFormDescription(customMovie.content || "");
          showToast("Lấy dữ liệu từ phim tự đăng thành công!", "success");
        } else {
          throw new Error("Không tìm thấy phim này trên OPhim/KKPhim hay phim tự đăng.");
        }
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "Lỗi tự động lấy tin", "error");
    } finally {
      setCrawling(false);
    }
  };

  // Save/Update Banner
  const handleSaveBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle || !formSlug || !formImageUrl) {
      showToast("Vui lòng nhập các thông tin bắt buộc", "warning");
      return;
    }

    const payload = {
      title: formTitle,
      originName: formOriginName || undefined,
      movieSlug: formSlug.trim().toLowerCase(),
      imageUrl: formImageUrl.trim(),
      description: formDescription || undefined,
      order: Number(formOrder),
      isActive: formIsActive,
    };

    try {
      const token = Cookies.get("token");
      const url = editingBanner
        ? `${API_URL}/banners/${editingBanner._id}`
        : `${API_URL}/banners`;
      const method = editingBanner ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        showToast(editingBanner ? "Cập nhật banner thành công" : "Tạo banner mới thành công", "success");
        setShowModal(false);
        fetchBanners();
      } else {
        const data = await res.json();
        showToast(data.message || "Thao tác thất bại", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Lỗi kết nối máy chủ", "error");
    }
  };

  // Toggle quick activation status
  const handleToggleActive = async (banner: Banner) => {
    try {
      const token = Cookies.get("token");
      const res = await fetch(`${API_URL}/banners/${banner._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isActive: !banner.isActive }),
      });

      if (res.ok) {
        setBanners((prev) =>
          prev.map((b) => (b._id === banner._id ? { ...b, isActive: !b.isActive } : b))
        );
        showToast(`Đã ${!banner.isActive ? "kích hoạt" : "ẩn"} banner thành công`, "success");
      } else {
        showToast("Thao tác thất bại", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Lỗi kết nối máy chủ", "error");
    }
  };

  // Delete banner
  const handleDeleteBanner = async (id: string) => {
    try {
      const token = Cookies.get("token");
      const res = await fetch(`${API_URL}/banners/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        showToast("Xóa banner thành công", "success");
        setBanners((prev) => prev.filter((b) => b._id !== id));
      } else {
        showToast("Xóa banner thất bại", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Lỗi kết nối máy chủ", "error");
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="text-left">
          <h3 className="text-base md:text-lg font-black text-white tracking-tight">Quản lý Banner nổi bật</h3>
          <p className="text-[10px] font-semibold text-zinc-500 mt-0.5">
            Tùy biến danh sách các phim nổi bật hiển thị trên thanh trượt lớn (Hero Banner) ngoài Trang chủ.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="h-9 px-4 rounded-xl bg-pink-500 hover:bg-pink-600 text-white font-extrabold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer border-none shadow-md shadow-pink-500/20"
        >
          <Plus size={15} /> Thêm Banner Mới
        </button>
      </div>

      {/* Control bar */}
      <div className="flex items-center gap-2 justify-end">
        <div className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm kiếm banner..."
            className="h-9 w-48 sm:w-60 bg-[#0d0e13] border border-zinc-900 rounded-xl px-3 pl-8 text-xs text-zinc-200 placeholder-zinc-650 focus:outline-none focus:border-pink-500/50"
          />
          <Search size={12} className="text-zinc-650 absolute top-1/2 left-3 -translate-y-1/2" />
        </div>

        <button
          onClick={fetchBanners}
          disabled={loading}
          className="w-9 h-9 rounded-xl bg-zinc-900/60 hover:bg-zinc-900 text-zinc-400 hover:text-white flex items-center justify-center transition-all cursor-pointer border-none disabled:opacity-50"
          title="Tải lại dữ liệu"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Banners Grid Container */}
      <div className="bg-[#0d0e13] border border-zinc-900 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 space-y-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="flex gap-4 p-4 rounded-xl border border-zinc-900 animate-pulse bg-zinc-900/20">
                <div className="w-28 h-16 rounded-lg bg-zinc-800 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="w-32 h-3.5 bg-zinc-800 rounded" />
                  <div className="w-full h-3 bg-zinc-900/40 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredBanners.length === 0 ? (
          <div className="p-16 text-center flex flex-col items-center justify-center gap-3.5 select-none">
            <div className="w-14 h-14 rounded-full bg-pink-500/5 border border-pink-500/10 flex items-center justify-center text-pink-400">
              <ImageIcon size={28} />
            </div>
            <div className="space-y-1">
              <h4 className="font-extrabold text-xs text-zinc-300">Chưa có banner tùy biến nào</h4>
              <p className="text-[10px] text-zinc-550 max-w-sm leading-normal">
                Hệ thống đang tự động lấy 5 phim mới cập nhật ngoài trang chủ làm fallback. Nhấp thêm banner để bắt đầu tùy biến.
              </p>
            </div>
          </div>
        ) : (
          <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredBanners.map((banner) => (
              <div
                key={banner._id}
                className="bg-[#0c0d12] border border-zinc-900/80 rounded-2xl p-4 flex flex-col sm:flex-row gap-4 transition-all hover:border-zinc-800"
              >
                {/* Image display */}
                <div className="w-full sm:w-40 aspect-[16/9] rounded-xl bg-zinc-950 border border-zinc-900 overflow-hidden shrink-0 relative select-none">
                  <img
                    src={banner.imageUrl}
                    alt={banner.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/images/dlowphim-logo.jpg";
                    }}
                  />
                  <div className="absolute top-2 left-2 bg-black/60 backdrop-blur px-2 py-0.5 rounded text-[8px] font-black text-pink-400 border border-zinc-800/40">
                    Thứ tự: {banner.order}
                  </div>
                </div>

                {/* Content info */}
                <div className="flex-grow min-w-0 flex flex-col justify-between text-left">
                  <div className="space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs font-bold text-white truncate leading-tight" title={banner.title}>
                        {banner.title}
                      </h4>
                      <button
                        onClick={() => handleToggleActive(banner)}
                        className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase border transition-all cursor-pointer ${
                          banner.isActive
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-zinc-800 text-zinc-500 border-transparent"
                        }`}
                      >
                        {banner.isActive ? "Hoạt động" : "Đang ẩn"}
                      </button>
                    </div>
                    {banner.originName && (
                      <p className="text-[10px] text-zinc-500 font-semibold truncate">{banner.originName}</p>
                    )}
                    <div className="pt-1.5">
                      <code className="text-[9px] font-bold text-pink-500 bg-pink-500/5 px-2 py-0.5 rounded border border-pink-500/10">
                        slug: {banner.movieSlug}
                      </code>
                    </div>
                    {banner.description && (
                      <p className="text-[9px] text-zinc-400 font-medium line-clamp-2 leading-relaxed pt-1.5">
                        {banner.description}
                      </p>
                    )}
                  </div>

                  {/* Actions buttons */}
                  <div className="flex items-center justify-end gap-2 border-t border-zinc-900/60 pt-3 mt-3">
                    <button
                      onClick={() => openEditModal(banner)}
                      className="w-7 h-7 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg flex items-center justify-center transition-all cursor-pointer border-none"
                      title="Chỉnh sửa banner"
                    >
                      <Edit size={12} />
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm("Bạn có chắc chắn muốn xóa banner này?")) {
                          handleDeleteBanner(banner._id!);
                        }
                      }}
                      className="w-7 h-7 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-lg flex items-center justify-center transition-all cursor-pointer border-none"
                      title="Xóa banner"
                    >
                      <Trash2 size={12} />
                    </button>
                    <a
                      href={`/movie/${banner.movieSlug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="w-7 h-7 bg-pink-500/10 hover:bg-pink-500/20 text-pink-400 hover:text-pink-300 rounded-lg flex items-center justify-center transition-all cursor-pointer border-none"
                      title="Xem phim"
                    >
                      <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── MODAL: THÊM / SỬA BANNER ─── */}
      {showModal && mounted && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-md px-4">
          <div
            className="w-full max-w-2xl bg-[#0c0d12] border border-zinc-900 shadow-2xl flex flex-col max-h-[85vh] animate-scaleUp text-left"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-900">
              <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                <ImageIcon size={16} className="text-pink-500" />
                {editingBanner ? "Chỉnh sửa Banner" : "Thêm Banner Mới"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 hover:bg-zinc-900 text-zinc-400 hover:text-white rounded-lg transition-colors cursor-pointer border-none bg-transparent"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Content Scroll */}
            <div className="overflow-y-auto p-5 space-y-4 text-left flex-1 custom-scrollbar">

              {/* Auto crawl banner helper */}
              {!editingBanner && (
                <div className="p-4 bg-pink-500/5 rounded-2xl border border-pink-500/10 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <Info size={16} className="text-pink-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-black uppercase text-pink-400 tracking-wider">Cào Tin Banner Nhanh</h4>
                      <p className="text-[10px] text-zinc-550 font-semibold mt-0.5 leading-normal">
                        Nhập slug phim (của OPhim hoặc phim tự đăng), hệ thống sẽ tự động điền tiêu đề, banner ngang và tóm tắt.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 pt-1">
                    <div className="flex rounded-xl bg-zinc-950 border border-zinc-900 p-0.5 overflow-hidden shrink-0">
                      <button
                        type="button"
                        onClick={() => setCrawlerSource("ophim")}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border-none cursor-pointer ${
                          crawlerSource === "ophim" ? "bg-pink-500 text-white" : "bg-transparent text-zinc-500"
                        }`}
                      >
                        OPhim
                      </button>
                      <button
                        type="button"
                        onClick={() => setCrawlerSource("kkphim")}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border-none cursor-pointer ${
                          crawlerSource === "kkphim" ? "bg-pink-500 text-white" : "bg-transparent text-zinc-500"
                        }`}
                      >
                        KKPhim
                      </button>
                    </div>

                    <div className="flex-1 flex gap-2">
                      <input
                        type="text"
                        placeholder="Nhập slug phim (ví dụ: tay-du-ky)"
                        value={crawlerSlug}
                        onChange={(e) => setCrawlerSlug(e.target.value)}
                        className="flex-1 h-9 bg-zinc-950 border border-zinc-900 rounded-xl px-3 text-xs text-zinc-200 focus:outline-none focus:border-pink-500/50"
                      />
                      <button
                        type="button"
                        disabled={crawling || !crawlerSlug}
                        onClick={handleAutoCrawl}
                        className="h-9 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 text-zinc-300 hover:text-white text-xs font-black border border-zinc-800 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        {crawling ? (
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

              {/* Form container */}
              <form onSubmit={handleSaveBanner} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-zinc-400">Tên phim hiển thị (Bắt buộc)</label>
                    <input
                      type="text"
                      required
                      placeholder="Tây Du Ký"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      className="w-full h-9 bg-zinc-950 border border-zinc-900 rounded-xl px-3 text-xs text-zinc-200 focus:outline-none focus:border-pink-500/50"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-zinc-400">Tên phim gốc</label>
                    <input
                      type="text"
                      placeholder="Journey to the West"
                      value={formOriginName}
                      onChange={(e) => setFormOriginName(e.target.value)}
                      className="w-full h-9 bg-zinc-950 border border-zinc-900 rounded-xl px-3 text-xs text-zinc-200 focus:outline-none focus:border-pink-500/50"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-zinc-400">Slug phim liên kết (Bắt buộc)</label>
                    <input
                      type="text"
                      required
                      placeholder="tay-du-ky"
                      value={formSlug}
                      onChange={(e) => setFormSlug(e.target.value)}
                      className="w-full h-9 bg-zinc-950 border border-zinc-900 rounded-xl px-3 text-xs text-zinc-200 focus:outline-none focus:border-pink-500/50"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-zinc-400">Thứ tự hiển thị</label>
                    <input
                      type="number"
                      required
                      value={formOrder}
                      onChange={(e) => setFormOrder(Number(e.target.value))}
                      className="w-full h-9 bg-zinc-950 border border-zinc-900 rounded-xl px-3 text-xs text-zinc-200 focus:outline-none focus:border-pink-500/50"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400">Đường dẫn ảnh Banner ngang 16:9 (Bắt buộc)</label>
                  <input
                    type="text"
                    required
                    placeholder="https://img.ophim.live/uploads/movies/tay-du-ky-poster.jpg"
                    value={formImageUrl}
                    onChange={(e) => setFormImageUrl(e.target.value)}
                    className="w-full h-9 bg-zinc-950 border border-zinc-900 rounded-xl px-3 text-xs text-zinc-200 focus:outline-none focus:border-pink-500/50"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400">Mô tả cốt truyện hiển thị trên Banner</label>
                  <textarea
                    placeholder="Nhập giới thiệu cốt truyện nổi bật của phim..."
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    className="w-full h-24 bg-zinc-950 border border-zinc-900 rounded-xl p-3 text-xs text-zinc-200 focus:outline-none focus:border-pink-500/50 resize-none custom-scrollbar"
                  />
                </div>

                <div className="flex items-center gap-2 select-none pt-1">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    className="w-4 h-4 accent-pink-500 cursor-pointer"
                  />
                  <label htmlFor="isActive" className="text-xs font-bold text-zinc-300 cursor-pointer select-none">
                    Kích hoạt hiển thị Banner ngay lập tức
                  </label>
                </div>

                {/* Modal Footer actions */}
                <div className="flex justify-end gap-3 border-t border-zinc-900 pt-4 mt-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="h-9 px-5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs font-extrabold rounded-xl transition-colors cursor-pointer border-none"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    className="h-9 px-6 bg-pink-500 hover:bg-pink-600 text-white text-xs font-extrabold rounded-xl transition-colors cursor-pointer border-none shadow-md shadow-pink-500/20"
                  >
                    Lưu Banner
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
