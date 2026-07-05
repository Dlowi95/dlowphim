"use client";

import React, { useState } from "react";
import Cookies from "js-cookie";
import { Search, Loader2, Save, Sparkles, RefreshCw, FileText } from "lucide-react";
import { Button } from "@heroui/react";

interface MoviesOverrideViewProps {
  showToast: (msg: string, type: "success" | "error" | "warning") => void;
}

export default function MoviesOverrideView({ showToast }: MoviesOverrideViewProps) {
  const [slug, setSlug] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dữ liệu phim lấy về từ OPhim
  const [originalMovie, setOriginalMovie] = useState<any>(null);

  // Dữ liệu đè của admin
  const [customName, setCustomName] = useState("");
  const [customContent, setCustomContent] = useState("");

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

  const handleFetchMovie = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSlug = slug.trim().toLowerCase();
    if (!cleanSlug) {
      showToast("Vui lòng nhập slug phim", "warning");
      return;
    }

    setLoading(true);
    setOriginalMovie(null);
    setCustomName("");
    setCustomContent("");

    try {
      // 1. Fetch thông tin phim gốc qua backend proxy
      const token = Cookies.get("token");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const movieRes = await fetch(`${API_URL}/movies/ophim-proxy?path=${encodeURIComponent(`/v1/api/phim/${cleanSlug}`)}`);
      if (!movieRes.ok) throw new Error("Không tìm thấy phim trên hệ thống OPhim");

      const movieData = await movieRes.json();
      const movieItem = movieData.data?.item || movieData.movie;
      if (!movieItem) throw new Error("Không thể phân tích dữ liệu phim từ OPhim");

      setOriginalMovie(movieItem);

      // 2. Fetch thông tin chỉnh sửa đè (nếu có) từ database của chúng ta
      const overrideRes = await fetch(`${API_URL}/movies/override/${cleanSlug}`, { headers });
      if (overrideRes.ok) {
        const overrideData = await overrideRes.json();
        setCustomName(overrideData.customName || "");
        setCustomContent(overrideData.customContent || "");
      }
      showToast("Tải dữ liệu phim thành công!", "success");
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "Không thể tải phim. Hãy kiểm tra lại slug.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSlug = slug.trim().toLowerCase();
    if (!cleanSlug || !originalMovie) return;

    setIsSubmitting(true);
    try {
      const token = Cookies.get("token");
      const res = await fetch(`${API_URL}/movies/override`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          slug: cleanSlug,
          customName: customName.trim(),
          customContent: customContent.trim(),
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || "Không thể lưu thông tin chỉnh sửa");
      }

      showToast("Lưu thông tin chỉnh sửa đè thành công!", "success");
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "Lỗi lưu chỉnh sửa đè", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 text-left">
      <div className="border-b border-zinc-900 pb-3">
        <h2 className="text-xl font-black text-zinc-100 flex items-center gap-2.5">
          <Sparkles className="text-pink-500 fill-pink-500/10" size={20} />
          <span>Sửa đè thông tin phim OPhim</span>
        </h2>
        <p className="text-xs text-zinc-500 font-medium mt-1 leading-relaxed">
          Tìm kiếm phim của OPhim theo slug để ghi đè tên dịch tiếng Việt hoặc viết lại phần tóm tắt nội dung mô tả phim.
        </p>
      </div>

      {/* Tìm kiếm phim theo Slug */}
      <form onSubmit={handleFetchMovie} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
          <input
            type="text"
            required
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="Nhập slug phim OPhim (ví dụ: khoa-chat-cua-nao-suzume, nguoi-tren-van-nguoi)..."
            className="w-full h-11 bg-zinc-900/40 border border-zinc-800 focus:border-pink-500 rounded-xl pl-11 pr-4 text-sm text-zinc-200 outline-none transition-all font-semibold"
          />
        </div>
        <Button
          type="submit"
          disabled={loading || !slug.trim()}
          className="h-11 px-6 bg-pink-500 hover:bg-pink-600 disabled:bg-zinc-800 text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer active:scale-98 transition-all shrink-0 border-none"
        >
          {loading ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <RefreshCw size={13} />
          )}
          <span>Tải thông tin</span>
        </Button>
      </form>

      {/* Nội dung cấu hình */}
      {originalMovie && (
        <form onSubmit={handleSaveOverride} className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-[#12131b]/30 border border-zinc-900 rounded-3xl p-5 md:p-6 animate-in fade-in duration-200">

          {/* CỘT TRÁI: THÔNG TIN PHIM GỐC */}
          <div className="space-y-4">
            <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2 border-b border-zinc-900 pb-2">
              <FileText size={12} className="text-zinc-500" />
              <span>Dữ liệu gốc từ OPhim</span>
            </h3>

            {/* Poster / Thumb preview */}
            <div className="flex gap-4 items-start bg-zinc-950/40 border border-zinc-900/50 p-3 rounded-2xl">
              {originalMovie.thumb_url && (
                <div className="w-16 aspect-[2/3] rounded-lg overflow-hidden shrink-0 bg-zinc-900 border border-zinc-800">
                  <img
                    src={originalMovie.thumb_url.startsWith("http") ? originalMovie.thumb_url : `https://img.ophim.live/uploads/movies/${originalMovie.thumb_url.split("/").pop()}`}
                    alt={originalMovie.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="min-w-0 space-y-1">
                <p className="font-extrabold text-sm text-zinc-200 truncate">{originalMovie.name}</p>
                <p className="text-xs font-semibold text-zinc-500 truncate">{originalMovie.origin_name} ({originalMovie.year})</p>
                <div className="inline-flex gap-1.5 pt-1">
                  <span className="bg-zinc-900 px-2 py-0.5 rounded text-[10px] font-bold text-zinc-400 border border-zinc-850">
                    Quality: {originalMovie.quality || "HD"}
                  </span>
                  <span className="bg-zinc-900 px-2 py-0.5 rounded text-[10px] font-bold text-zinc-400 border border-zinc-850">
                    Language: {originalMovie.lang || "Vietsub"}
                  </span>
                </div>
              </div>
            </div>

            {/* Nội dung tóm tắt gốc */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Mô tả tóm tắt gốc:</label>
              <div className="w-full h-64 overflow-y-auto bg-zinc-950/40 border border-zinc-900 text-xs text-zinc-400 p-4 rounded-2xl leading-relaxed whitespace-pre-wrap scrollbar-thin scrollbar-thumb-zinc-800">
                {originalMovie.content || "Không có mô tả nội dung cho phim này."}
              </div>
            </div>
          </div>

          {/* CỘT PHẢI: FORM CHỈNH SỬA ĐÈ CỦA ADMIN */}
          <div className="space-y-4 flex flex-col h-full justify-between">
            <div className="space-y-4">
              <h3 className="text-xs font-black text-pink-500 uppercase tracking-widest flex items-center gap-2 border-b border-zinc-900 pb-2">
                <Sparkles size={12} className="text-pink-500" />
                <span>Nội dung ghi đè (Tiếng Việt)</span>
              </h3>

              {/* Tên phim dịch đè */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Tên phim muốn đổi (Tùy chọn):</label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Ghi đè tên hiển thị tiếng Việt (bỏ trống nếu dùng tên gốc)..."
                  className="w-full h-11 bg-zinc-900/30 border border-zinc-800 focus:border-pink-500 rounded-xl px-4 text-xs text-zinc-200 outline-none transition-all font-semibold"
                  maxLength={100}
                />
              </div>

              {/* Mô tả tóm tắt đè */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Mô tả tóm tắt đè (Tiếng Việt):</label>
                <textarea
                  value={customContent}
                  onChange={(e) => setCustomContent(e.target.value)}
                  placeholder="Nhập mô tả tóm tắt tiếng Việt mượt mà ở đây (hệ thống sẽ hiển thị nội dung này thay vì mô tả tiếng Anh gốc)..."
                  className="w-full h-64 bg-zinc-900/30 border border-zinc-800 focus:border-pink-500 rounded-2xl p-4 text-xs text-zinc-200 outline-none transition-all font-medium leading-relaxed resize-none scrollbar-thin scrollbar-thumb-zinc-800"
                  required
                />
              </div>
            </div>

            {/* Nút lưu */}
            <div className="pt-4 border-t border-zinc-900 flex justify-end">
              <Button
                type="submit"
                disabled={isSubmitting || !customContent.trim()}
                className="h-10 px-6 bg-pink-500 hover:bg-pink-600 disabled:bg-zinc-800 text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer active:scale-98 transition-all border-none"
              >
                {isSubmitting ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Save size={13} />
                )}
                <span>Lưu thay đổi</span>
              </Button>
            </div>

          </div>

        </form>
      )}

      {/* State chưa tải phim */}
      {!originalMovie && !loading && (
        <div className="bg-[#12131b]/30 border border-zinc-900 rounded-3xl py-24 flex flex-col items-center justify-center gap-3 text-center">
          <Sparkles className="text-zinc-800" size={40} />
          <h4 className="text-sm font-extrabold text-zinc-400 uppercase tracking-wider">Chưa có phim nào được chọn</h4>
          <p className="text-xs text-zinc-550 max-w-xs font-semibold">
            Hãy nhập slug của phim OPhim ở ô tìm kiếm phía trên để bắt đầu sửa đổi mô tả tóm tắt hoặc tên phim.
          </p>
        </div>
      )}
    </div>
  );
}
