"use client";

import React, { useState, useEffect, useRef, useTransition } from "react";
import Cookies from "js-cookie";
import {
  Image as ImageIcon,
  Trash2,
  Edit,
  Loader2,
  RefreshCw,
  X,
  Download,
  Info,
  ExternalLink,
  Search,
  AlertTriangle,
  CheckCircle2,
  Plus,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { createPortal } from "react-dom";
import { useAuth } from "@/context/AuthContext";
import { getImageUrl } from "@/utils/movieUtils";
import { getProxyUrl } from "@/utils/api";
import { useResolvedHeroBanners, ResolvedHeroSlot } from "@/hooks/useResolvedHeroBanners";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import { searchMovies } from "@/utils/movieSearch";

interface Banner {
  _id?: string;
  title: string;
  originName?: string;
  movieSlug: string;
  imageUrl: string;
  description?: string;
  order: number;
  isActive: boolean;
  isFallback?: boolean;
  missingLogo?: boolean;
  tmdbData?: any;
}

export default function BannersManagementView() {
  const { showToast } = useAuth();
  const { confirm, confirmDialog } = useConfirmDialog();
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
  const {
    slots: resolvedHeroSlots,
    rawBanners,
    sourceId,
    loading,
    error,
    refresh: refreshResolvedBanners,
  } = useResolvedHeroBanners({ apiUrl: API_URL, admin: true });

  // Portal mounted state
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const [banners, setBanners] = useState<Banner[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);

  // Form states
  const [formTitle, setFormTitle] = useState("");
  const [formOriginName, setFormOriginName] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formImageUrl, setFormImageUrl] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formOrder, setFormOrder] = useState(1);
  const [formIsActive, setFormIsActive] = useState(true);
  const [formLogoUrl, setFormLogoUrl] = useState<string | null>(null);
  const [checkingLogo, setCheckingLogo] = useState(false);

  // Movie Search Picker state
  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [crawlerSource, setCrawlerSource] = useState<"phimapi" | "ophim">("phimapi");
  const [showAdvancedManual, setShowAdvancedManual] = useState(false);

  // Crawler state for manual slug lookup
  const [crawlerSlug, setCrawlerSlug] = useState("");
  const [crawling, setCrawling] = useState(false);

  // Abort controller ref for search
  const searchAbortRef = useRef<AbortController | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Synchronize 5 slots representation
  useEffect(() => {
    const resolved: Banner[] = resolvedHeroSlots.map((slot) => {
      if (slot.bannerRecord) {
        return {
          ...slot.bannerRecord,
          isFallback: false,
          missingLogo: slot.missingLogo || !slot.tmdbData?.logoUrl,
          tmdbData: slot.tmdbData,
        };
      }

      return {
        title: slot.movie.name,
        originName: slot.movie.origin_name,
        movieSlug: slot.movie.slug,
        imageUrl: slot.tmdbData?.backdropUrl || slot.movie.thumb_url || "",
        description: "Banner tự động từ hệ thống phim + TMDB (có đầy đủ Logo và Backdrop HD).",
        order: slot.order,
        isActive: true,
        isFallback: true,
        missingLogo: !slot.tmdbData?.logoUrl,
        tmdbData: slot.tmdbData,
      };
    });

    const representedIds = new Set(
      resolved.map((banner) => banner._id).filter((id): id is string => Boolean(id))
    );
    const remainingCustomBanners: Banner[] = rawBanners
      .filter((banner) => !banner._id || !representedIds.has(banner._id))
      .map((banner) => ({
        ...banner,
        isFallback: false,
        missingLogo: false,
      }));

    setBanners([...resolved, ...remainingCustomBanners]);
  }, [rawBanners, resolvedHeroSlots]);

  useEffect(() => {
    fetch(`${API_URL}/system-settings/admin`, {
      headers: { Authorization: `Bearer ${Cookies.get("token")}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.activeMovieSourceId === "ophim" || data?.activeMovieSourceId === "phimapi") {
          setCrawlerSource(data.activeMovieSourceId);
        }
      })
      .catch(() => undefined);
  }, [API_URL]);

  // Debounced Movie Search in Picker
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (searchAbortRef.current) searchAbortRef.current.abort();

    const query = searchKeyword.trim();
    if (!query || query.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      const controller = new AbortController();
      searchAbortRef.current = controller;
      try {
        const result = await searchMovies(query, 1, {
          signal: controller.signal,
          timeoutMs: 6000,
        });
        if (!controller.signal.aborted) {
          setSearchResults(result.items || []);
        }
      } catch (err: any) {
        if (err?.name !== "AbortError") {
          setSearchResults([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setSearching(false);
        }
      }
    }, 350);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      if (searchAbortRef.current) searchAbortRef.current.abort();
    };
  }, [searchKeyword]);

  // Resolve TMDB Logo & Backdrop for a selected movie
  const resolveMovieDetailsAndLogo = async (slug: string, rawTitle?: string, rawOrigin?: string, tmdbId?: string, tmdbType?: string) => {
    setCheckingLogo(true);
    try {
      const cleanSlug = slug.trim().toLowerCase();
      // 1. Fetch movie detail via proxy
      let detail: any = null;
      try {
        const res = await fetch(getProxyUrl(`/phim/${cleanSlug}`, crawlerSource));
        if (res.ok) {
          const data = await res.json();
          detail = data?.movie || data?.data?.item || null;
        }
      } catch {}

      const title = rawTitle || detail?.name || cleanSlug;
      const originTitle = rawOrigin || detail?.origin_name || "";
      const effectiveTmdbId = tmdbId || detail?.tmdb?.id || "";
      const effectiveTmdbType = tmdbType || detail?.tmdb?.type || "movie";

      // 2. Query TMDB metadata & Logo
      let tmdbData: any = null;
      try {
        const tmdbResponse = await fetch(
          `${API_URL}/movies/logo/${cleanSlug}?title=${encodeURIComponent(title)}&originTitle=${encodeURIComponent(originTitle)}&tmdbId=${effectiveTmdbId}&tmdbType=${effectiveTmdbType}`
        );
        if (tmdbResponse.ok) tmdbData = await tmdbResponse.json();
      } catch (err) {
        console.error("Lỗi resolve TMDB logo:", err);
      }

      const formatImg = (path: string) => {
        if (!path) return "";
        if (path.startsWith("http")) return path;
        return getImageUrl(path);
      };

      const resolvedTitle = tmdbData?.tmdbTitle || title;
      const resolvedOrigin = tmdbData?.tmdbOriginalTitle || originTitle;
      const resolvedBackdrop = tmdbData?.backdropUrl || formatImg(detail?.poster_url || detail?.thumb_url);
      const resolvedLogo = tmdbData?.logoUrl || null;
      const resolvedDesc = detail?.content ? detail.content.replace(/<[^>]*>/g, "").trim() : "";

      setFormTitle(resolvedTitle);
      setFormOriginName(resolvedOrigin);
      setFormSlug(cleanSlug);
      setFormImageUrl(resolvedBackdrop);
      setFormDescription(resolvedDesc);
      setFormLogoUrl(resolvedLogo);

      if (!resolvedLogo) {
        setFormIsActive(false); // Strict policy: Missing logo cannot be activated
        showToast("Không tìm thấy Logo TMDB — Banner sẽ được lưu ở dạng Ẩn (Draft)", "warning");
      } else {
        showToast("Đã lấy thông tin và Logo TMDB chính thức thành công!", "success");
      }
    } catch (err: any) {
      showToast("Lỗi lấy thông tin phim: " + (err.message || ""), "error");
    } finally {
      setCheckingLogo(false);
    }
  };

  // Open modal for editing existing slot
  const openEditModal = (banner: Banner) => {
    setEditingBanner(banner);
    setSearchKeyword("");
    setSearchResults([]);
    setCrawlerSlug(banner.movieSlug);
    setFormTitle(banner.title);
    setFormOriginName(banner.originName || "");
    setFormSlug(banner.movieSlug);
    setFormImageUrl(banner.imageUrl);
    setFormDescription(banner.description || "");
    setFormOrder(banner.order);
    setFormIsActive(banner.isActive);
    setFormLogoUrl(banner.tmdbData?.logoUrl || null);
    setShowAdvancedManual(false);
    setShowModal(true);

    // If logo not yet cached, resolve it
    if (!banner.tmdbData?.logoUrl && banner.movieSlug) {
      resolveMovieDetailsAndLogo(banner.movieSlug, banner.title, banner.originName);
    }
  };

  // Open modal for adding a new banner at specific fixed slot
  const openCreateModal = (position: number) => {
    setEditingBanner(null);
    setSearchKeyword("");
    setSearchResults([]);
    setCrawlerSlug("");
    setFormTitle("");
    setFormOriginName("");
    setFormSlug("");
    setFormImageUrl("");
    setFormDescription("");
    setFormOrder(position);
    setFormIsActive(true);
    setFormLogoUrl(null);
    setShowAdvancedManual(false);
    setShowModal(true);
  };

  // Manual crawl slug handler
  const handleAutoCrawl = async () => {
    if (!crawlerSlug) {
      showToast("Vui lòng nhập slug phim cần cào", "warning");
      return;
    }
    setCrawling(true);
    try {
      await resolveMovieDetailsAndLogo(crawlerSlug.trim().toLowerCase());
    } finally {
      setCrawling(false);
    }
  };

  // Save/Update Banner
  const handleSaveBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle || !formSlug || !formImageUrl) {
      showToast("Vui lòng nhập đầy đủ các thông tin bắt buộc", "warning");
      return;
    }

    if (formIsActive && !formLogoUrl) {
      showToast("Không tìm thấy logo TMDB — banner chưa đủ điều kiện kích hoạt. Vui lòng bỏ chọn Kích hoạt để lưu ở dạng Bản nháp.", "error");
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
      const isEditMode = editingBanner && !editingBanner.isFallback && editingBanner._id;
      const url = isEditMode
        ? `${API_URL}/banners/${editingBanner._id}`
        : `${API_URL}/banners`;
      const method = isEditMode ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        showToast(isEditMode ? "Cập nhật banner thành công" : "Tạo banner mới thành công", "success");
        setShowModal(false);
        refreshResolvedBanners();
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
    if (!banner._id) return;
    if (!banner.isActive && banner.missingLogo) {
      showToast("Không thể kích hoạt: Phim này chưa có Logo TMDB.", "warning");
      return;
    }

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
        refreshResolvedBanners();
      } else {
        const data = await res.json().catch(() => null);
        showToast(data?.message || "Thao tác thất bại", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Lỗi kết nối máy chủ", "error");
    }
  };

  // Delete custom banner
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
        refreshResolvedBanners();
      } else {
        showToast("Xóa banner thất bại", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Lỗi kết nối máy chủ", "error");
    }
  };

  // Build the fixed 5 slots data structure
  const fixedFiveSlots = [1, 2, 3, 4, 5].map((pos) => {
    const customBanner = rawBanners.find((b) => b.order === pos);
    const resolvedSlot = resolvedHeroSlots.find((s) => s.order === pos);
    return {
      position: pos,
      customBanner,
      resolvedSlot,
    };
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="text-left">
          <h3 className="text-base md:text-lg font-black text-white tracking-tight">Quản lý Banner nổi bật</h3>
          <p className="text-[10px] font-semibold text-zinc-500 mt-0.5">
            Cấu hình danh sách 5 banner trình chiếu trên Hero Slider ngoài Trang chủ (Quy chuẩn bắt buộc: Có Backdrop và Logo TMDB).
          </p>
        </div>
      </div>

      {/* Control bar */}
      <div className="flex items-center gap-2 justify-end">
        <div className="mr-auto flex flex-wrap items-center gap-2 text-[9px] font-black uppercase tracking-wider">
          <span className="rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-zinc-400">
            {resolvedHeroSlots.filter((s) => s.tmdbData?.logoUrl).length}/5 vị trí đạt chuẩn hiển thị
          </span>
          {sourceId && (
            <span className="rounded-lg border border-blue-500/20 bg-blue-500/5 px-2.5 py-1.5 text-blue-400">
              Nguồn cào tự động: {sourceId === "phimapi" ? "PhimAPI" : sourceId === "ophim" ? "OPhim" : sourceId}
            </span>
          )}
        </div>
        <button
          onClick={refreshResolvedBanners}
          disabled={loading}
          className="w-9 h-9 rounded-xl bg-zinc-900/60 hover:bg-zinc-900 text-zinc-400 hover:text-white flex items-center justify-center transition-all cursor-pointer border-none disabled:opacity-50"
          title="Tải lại dữ liệu"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* ─── FIXED 5 SLOTS GRID ─── */}
      <div className="bg-[#0d0e13] border border-zinc-900 rounded-2xl overflow-hidden shadow-sm">
        {error && !loading && (
          <div className="m-5 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-[10px] font-bold text-red-300">
            Không thể đồng bộ bản xem trước Hero: {error}
          </div>
        )}

        {loading ? (
          <div className="p-12 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-4 p-4 rounded-xl border border-zinc-900 animate-pulse bg-zinc-900/20">
                <div className="w-28 h-16 rounded-lg bg-zinc-800 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="w-32 h-3.5 bg-zinc-800 rounded" />
                  <div className="w-full h-3 bg-zinc-900/40 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
            {fixedFiveSlots.map(({ position, customBanner, resolvedSlot }) => {
              // Priority: Custom Banner > Resolved System Banner > Empty Slot
              const displayBanner: Banner | null = customBanner
                ? {
                    ...customBanner,
                    isFallback: false,
                    missingLogo: resolvedSlot?.missingLogo || !resolvedSlot?.tmdbData?.logoUrl,
                    tmdbData: resolvedSlot?.tmdbData,
                  }
                : resolvedSlot
                ? {
                    _id: undefined,
                    title: resolvedSlot.movie.name,
                    originName: resolvedSlot.movie.origin_name,
                    movieSlug: resolvedSlot.movie.slug,
                    imageUrl: resolvedSlot.tmdbData?.backdropUrl || resolvedSlot.movie.thumb_url || "",
                    description: "Banner tự động từ nguồn phim đang bật + TMDB (có Logo và Backdrop ngang).",
                    order: resolvedSlot.order,
                    isActive: true,
                    isFallback: true,
                    missingLogo: !resolvedSlot.tmdbData?.logoUrl,
                    tmdbData: resolvedSlot.tmdbData,
                  }
                : null;

              if (displayBanner) {
                return (
                  <div
                    key={`slot-${position}-${displayBanner.movieSlug}`}
                    className={`bg-[#0c0d12] border rounded-2xl p-4 flex flex-col sm:flex-row gap-4 transition-all hover:border-zinc-800 ${
                      displayBanner.missingLogo
                        ? "border-amber-500/30 bg-amber-500/5"
                        : "border-zinc-900/80"
                    }`}
                  >
                    {/* Image display with Logo overlay */}
                    <div className="w-full sm:w-44 aspect-[21/9] rounded-xl bg-zinc-950 border border-zinc-900 overflow-hidden shrink-0 relative select-none">
                      <img
                        src={displayBanner.imageUrl}
                        alt={displayBanner.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "/images/dlowphim-logo.jpg";
                        }}
                      />
                      {displayBanner.tmdbData?.logoUrl && (
                        <div className="absolute inset-x-2 bottom-2 max-h-6 flex items-center justify-start pointer-events-none">
                          <img
                            src={displayBanner.tmdbData.logoUrl}
                            alt="TMDB Logo"
                            className="max-h-6 max-w-[80%] object-contain filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]"
                          />
                        </div>
                      )}
                      <div className="absolute top-2 left-2 bg-black/70 backdrop-blur px-2 py-0.5 rounded text-[8px] font-black text-pink-400 border border-zinc-800/40">
                        Vị trí {position}
                      </div>
                    </div>

                    {/* Content info */}
                    <div className="flex-grow min-w-0 flex flex-col justify-between text-left">
                      <div className="space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex flex-col gap-1 min-w-0">
                            <h4 className="text-xs font-bold text-white truncate leading-tight" title={displayBanner.title}>
                              {displayBanner.title}
                            </h4>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {displayBanner.isFallback ? (
                                <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[7px] font-extrabold uppercase select-none">
                                  Hệ thống
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded bg-pink-500/10 text-pink-400 border border-pink-500/20 text-[7px] font-extrabold uppercase select-none">
                                  Tùy biến
                                </span>
                              )}

                              {displayBanner.tmdbData?.logoUrl ? (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[7px] font-extrabold uppercase select-none flex items-center gap-0.5">
                                  <CheckCircle2 size={9} /> Có Logo TMDB
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[7px] font-extrabold uppercase select-none flex items-center gap-0.5" title="Banner thiếu logo TMDB sẽ không xuất hiện trên public">
                                  <AlertTriangle size={9} /> Thiếu Logo TMDB
                                </span>
                              )}
                            </div>
                          </div>

                          {displayBanner.isFallback ? (
                            <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase bg-zinc-900 text-zinc-400 select-none shrink-0">
                              Tự động
                            </span>
                          ) : (
                            <button
                              onClick={() => handleToggleActive(displayBanner as Banner)}
                              className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase border transition-all cursor-pointer shrink-0 ${
                                displayBanner.isActive
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                  : "bg-zinc-800 text-zinc-500 border-transparent"
                              }`}
                            >
                              {displayBanner.isActive ? "Hoạt động" : "Bản nháp"}
                            </button>
                          )}
                        </div>

                        {displayBanner.originName && (
                          <p className="text-[10px] text-zinc-500 font-semibold truncate">{displayBanner.originName}</p>
                        )}
                        <div className="pt-1">
                          <code className="text-[9px] font-bold text-pink-500 bg-pink-500/5 px-2 py-0.5 rounded border border-pink-500/10">
                            slug: {displayBanner.movieSlug}
                          </code>
                        </div>
                      </div>

                      {/* Actions buttons */}
                      <div className="flex items-center justify-end gap-2 border-t border-zinc-900/60 pt-3 mt-3">
                        <button
                          onClick={() => openEditModal(displayBanner as Banner)}
                          className="w-7 h-7 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg flex items-center justify-center transition-all cursor-pointer border-none"
                          title={displayBanner.isFallback ? "Cấu hình tùy biến vị trí này" : "Chỉnh sửa banner"}
                        >
                          <Edit size={12} />
                        </button>
                        {!displayBanner.isFallback && displayBanner._id && (
                          <button
                            onClick={async () => {
                              const accepted = await confirm({
                                title: "Xóa banner tùy biến?",
                                message: `Banner vị trí ${position} sẽ bị xóa và quay về banner mặc định tự động của hệ thống.`,
                                confirmLabel: "Xóa banner",
                              });
                              if (accepted) await handleDeleteBanner(displayBanner._id!);
                            }}
                            className="w-7 h-7 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-lg flex items-center justify-center transition-all cursor-pointer border-none"
                            title="Xóa banner tùy biến"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                        <a
                          href={`/movie/${displayBanner.movieSlug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="w-7 h-7 bg-pink-500/10 hover:bg-pink-500/20 text-pink-400 hover:text-pink-300 rounded-lg flex items-center justify-center transition-all cursor-pointer border-none"
                          title="Xem phim trên trang chủ"
                        >
                          <ExternalLink size={12} />
                        </a>
                      </div>
                    </div>
                  </div>
                );
              }

              // Empty Slot State: Always render fixed 5 slots!
              return (
                <div
                  key={`empty-slot-${position}`}
                  className="bg-[#0a0b0f] border border-dashed border-zinc-800 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4 transition-all hover:border-pink-500/40 text-left"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-center text-zinc-500 shrink-0 font-black text-sm">
                      #{position}
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-zinc-300">Banner vị trí {position} còn trống</h4>
                      <p className="text-[10px] text-zinc-500 font-semibold mt-0.5">
                        Chưa có banner nào ở vị trí này. Nhấp thêm để tùy biến.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => openCreateModal(position)}
                    className="h-8 px-4 rounded-xl bg-pink-500/10 hover:bg-pink-500 text-pink-400 hover:text-white border border-pink-500/20 hover:border-pink-500 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
                  >
                    <Plus size={13} />
                    Thêm vị trí {position}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── MODAL: THÊM / SỬA BANNER WITH MOVIE SEARCH PICKER ─── */}
      {confirmDialog}
      {showModal && mounted && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-md px-4">
          <div
            className="w-full max-w-2xl bg-[#0c0d12] border border-zinc-900 shadow-2xl flex flex-col max-h-[90vh] animate-scaleUp text-left rounded-2xl overflow-hidden"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-900 bg-[#0e0f15]">
              <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                <ImageIcon size={16} className="text-pink-500" />
                Cấu hình Banner Vị trí {formOrder}
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
              {/* ─── 1. MOVIE SEARCH PICKER ─── */}
              <div className="p-4 bg-zinc-950/80 rounded-2xl border border-zinc-900 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Search size={14} className="text-pink-500" />
                    <h4 className="text-xs font-black uppercase text-white tracking-wider">Tìm kiếm & Chọn phim</h4>
                  </div>

                  {/* Movie Source Toggle */}
                  <div className="flex items-center gap-1.5 bg-zinc-900/80 p-0.5 rounded-lg border border-zinc-800">
                    <span className="text-[8px] font-bold text-zinc-500 px-1.5 uppercase">Nguồn:</span>
                    <button
                      type="button"
                      onClick={() => setCrawlerSource("phimapi")}
                      className={`px-2 py-0.5 rounded text-[9px] font-black uppercase transition-all border-none cursor-pointer ${
                        crawlerSource === "phimapi" ? "bg-pink-500 text-white" : "bg-transparent text-zinc-400"
                      }`}
                    >
                      PhimAPI
                    </button>
                    <button
                      type="button"
                      onClick={() => setCrawlerSource("ophim")}
                      className={`px-2 py-0.5 rounded text-[9px] font-black uppercase transition-all border-none cursor-pointer ${
                        crawlerSource === "ophim" ? "bg-pink-500 text-white" : "bg-transparent text-zinc-400"
                      }`}
                    >
                      OPhim
                    </button>
                  </div>
                </div>

                {/* Search Input */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Nhập tên phim cần ghim (ví dụ: Dune, Tây Du Ký, Naruto, Avatar...)"
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    className="w-full h-10 bg-[#0c0d12] border border-zinc-800 rounded-xl pl-9 pr-8 text-xs text-zinc-200 focus:outline-none focus:border-pink-500/50"
                  />
                  <Search size={14} className="absolute left-3 top-3 text-zinc-500" />
                  {searching && (
                    <Loader2 size={14} className="absolute right-3 top-3 animate-spin text-pink-500" />
                  )}
                </div>

                {/* Search Results Dropdown List */}
                {searchResults.length > 0 && (
                  <div className="max-h-52 overflow-y-auto space-y-1.5 p-1 bg-[#0c0d12] rounded-xl border border-zinc-800/80 custom-scrollbar">
                    {searchResults.map((item: any) => (
                      <button
                        key={item.slug || item._id}
                        type="button"
                        onClick={() => {
                          setSearchKeyword(item.name || item.slug);
                          resolveMovieDetailsAndLogo(item.slug, item.name, item.origin_name, item.tmdb?.id, item.tmdb?.type);
                        }}
                        className="w-full p-2 rounded-lg bg-zinc-950/60 hover:bg-pink-500/10 border border-transparent hover:border-pink-500/20 flex items-center gap-3 text-left transition-all cursor-pointer"
                      >
                        <img
                          src={getImageUrl(item.thumb_url || item.poster_url)}
                          alt={item.name}
                          className="w-8 h-11 object-cover rounded bg-zinc-900 shrink-0"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "/images/dlowphim-logo.jpg";
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-white truncate">{item.name}</p>
                          <p className="text-[10px] text-zinc-500 truncate">{item.origin_name || item.slug}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {item.year && <span className="text-[8px] bg-zinc-800 text-zinc-400 px-1.5 py-0.2 rounded">{item.year}</span>}
                            {item.type && <span className="text-[8px] bg-zinc-800 text-zinc-400 px-1.5 py-0.2 rounded uppercase">{item.type}</span>}
                            <span className="text-[8px] text-pink-500 font-mono">slug: {item.slug}</span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* ─── 2. BANNER LIVE PREVIEW (Backdrop & TMDB Logo) ─── */}
              {formImageUrl && (
                <div className="p-3 bg-zinc-950 rounded-2xl border border-zinc-900 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black uppercase tracking-wider text-zinc-400">
                      Bản xem trước Banner
                    </span>
                    {checkingLogo ? (
                      <span className="text-[9px] text-zinc-500 flex items-center gap-1">
                        <Loader2 size={11} className="animate-spin text-pink-500" /> Đang kiểm tra Logo TMDB...
                      </span>
                    ) : formLogoUrl ? (
                      <span className="text-[9px] font-black text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        <CheckCircle2 size={11} /> Có Logo TMDB hợp lệ
                      </span>
                    ) : (
                      <span className="text-[9px] font-black text-amber-400 flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                        <AlertTriangle size={11} /> Không tìm thấy Logo TMDB
                      </span>
                    )}
                  </div>

                  <div className="aspect-[21/9] w-full rounded-xl bg-zinc-950 border border-zinc-800 overflow-hidden relative select-none">
                    <img
                      src={formImageUrl}
                      alt={formTitle || "Backdrop Preview"}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "/images/dlowphim-logo.jpg";
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                    {/* TMDB Logo Overlay */}
                    <div className="absolute bottom-3 left-4 max-h-12 flex items-center">
                      {formLogoUrl ? (
                        <img
                          src={formLogoUrl}
                          alt="TMDB Logo"
                          className="max-h-12 max-w-[200px] object-contain filter drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]"
                        />
                      ) : (
                        <h4 className="text-sm font-black text-white drop-shadow">{formTitle || "Tên phim"}</h4>
                      )}
                    </div>
                  </div>

                  {!formLogoUrl && !checkingLogo && (
                    <div className="p-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5 text-[10px] font-semibold text-amber-300 flex items-start gap-2">
                      <AlertTriangle size={14} className="shrink-0 mt-0.5 text-amber-400" />
                      <div>
                        <strong className="font-bold">Quy chuẩn Logo TMDB bắt buộc:</strong> Phim này không có logo ảnh từ TMDB. Banner chưa đủ điều kiện kích hoạt trên Trang chủ và sẽ được lưu ở dạng <strong>Bản nháp</strong>.
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ─── 3. FORM FIELDS ─── */}
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
                    <label className="text-[10px] font-bold text-zinc-400">Vị trí hiển thị (Khóa cố định)</label>
                    <input
                      type="number"
                      required
                      disabled
                      value={formOrder}
                      className="w-full h-9 bg-zinc-900/50 border border-zinc-900 rounded-xl px-3 text-xs text-zinc-500 cursor-not-allowed focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400">Đường dẫn ảnh Banner ngang 16:9 / 21:9 (Bắt buộc)</label>
                  <input
                    type="text"
                    required
                    placeholder="https://image.tmdb.org/t/p/original/...jpg"
                    value={formImageUrl}
                    onChange={(e) => setFormImageUrl(e.target.value)}
                    className="w-full h-9 bg-zinc-950 border border-zinc-900 rounded-xl px-3 text-xs text-zinc-200 focus:outline-none focus:border-pink-500/50"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400">Mô tả cốt truyện</label>
                  <textarea
                    placeholder="Nhập giới thiệu tóm tắt của phim..."
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    className="w-full h-20 bg-zinc-950 border border-zinc-900 rounded-xl p-3 text-xs text-zinc-200 focus:outline-none focus:border-pink-500/50 resize-none custom-scrollbar"
                  />
                </div>

                {/* Collapsible Advanced Section for Manual Slug Crawl */}
                <div className="border border-zinc-900 rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowAdvancedManual((prev) => !prev)}
                    className="w-full p-2.5 bg-zinc-950 hover:bg-zinc-900 text-zinc-400 hover:text-white text-[10px] font-bold flex items-center justify-between cursor-pointer border-none"
                  >
                    <span>⚙️ Cào tin bằng slug thủ công (Nâng cao)</span>
                    {showAdvancedManual ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>

                  {showAdvancedManual && (
                    <div className="p-3 bg-black/40 space-y-2 border-t border-zinc-900">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Nhập slug phim chính xác (ví dụ: avatar-2)"
                          value={crawlerSlug}
                          onChange={(e) => setCrawlerSlug(e.target.value)}
                          className="flex-1 h-8 bg-zinc-950 border border-zinc-800 rounded-lg px-3 text-xs text-zinc-200"
                        />
                        <button
                          type="button"
                          disabled={crawling || !crawlerSlug}
                          onClick={handleAutoCrawl}
                          className="h-8 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                        >
                          {crawling ? <Loader2 size={12} className="animate-spin text-pink-500" /> : <Download size={12} />}
                          Lấy tin
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Activation Checkbox with Strict TMDB Logo Safeguard */}
                <div className="flex items-center gap-2 select-none pt-1">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formIsActive}
                    onChange={(e) => {
                      if (e.target.checked && !formLogoUrl) {
                        showToast("Không thể kích hoạt: Phim chưa có Logo TMDB.", "warning");
                        return;
                      }
                      setFormIsActive(e.target.checked);
                    }}
                    className="w-4 h-4 accent-pink-500 cursor-pointer"
                  />
                  <label
                    htmlFor="isActive"
                    className={`text-xs font-bold cursor-pointer select-none ${
                      !formLogoUrl ? "text-zinc-500" : "text-zinc-300"
                    }`}
                  >
                    Kích hoạt hiển thị Banner trên Trang chủ
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
