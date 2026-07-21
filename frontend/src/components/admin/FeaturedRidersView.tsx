"use client";

import React, { useState, useEffect, useRef } from "react";
import Cookies from "js-cookie";
import { Plus, Trash2, Edit2, GripVertical, Image as ImageIcon, Upload, X, Check, Eye, EyeOff } from "lucide-react";

interface FeaturedRider {
  _id: string;
  name: string;
  originName: string;
  slug: string;
  posterUrl: string;
  bannerUrl: string;
  themeColor: string;
  description: string;
  year: string;
  quality: string;
  order: number;
  isActive: boolean;
}

const EMPTY_FORM: Omit<FeaturedRider, "_id" | "order"> = {
  name: "",
  originName: "",
  slug: "",
  posterUrl: "",
  bannerUrl: "",
  themeColor: "#FFD700",
  description: "",
  year: "",
  quality: "HD",
  isActive: true,
};

const COLOR_PRESETS = [
  { label: "Vàng Gold (Zi-O)", color: "#FFD700" },
  { label: "Hồng Magenta (Decade)", color: "#FF007F" },
  { label: "Đỏ Crimson (Build)", color: "#E60012" },
  { label: "Xanh Neon (Zero-One)", color: "#CCFF00" },
  { label: "Xanh Cobalt (Blade)", color: "#0072CE" },
  { label: "Tím Violet (Genm)", color: "#8A2BE2" },
  { label: "Xanh Cyan", color: "#06b6d4" },
  { label: "Cam", color: "#F97316" },
];

export default function FeaturedRidersView() {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
  const [riders, setRiders] = useState<FeaturedRider[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [uploadingPoster, setUploadingPoster] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const posterRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);

  const showMsg = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const authHeader = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${Cookies.get("token")}`,
  });

  const fetchRiders = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/featured-riders/admin`, {
        headers: { Authorization: `Bearer ${Cookies.get("token")}` },
      });
      if (res.ok) setRiders(await res.json());
    } catch {
      showMsg("Lỗi tải dữ liệu", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRiders();
  }, []);

  const openCreate = () => {
    setForm({ ...EMPTY_FORM });
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (r: FeaturedRider) => {
    setForm({
      name: r.name,
      originName: r.originName,
      slug: r.slug,
      posterUrl: r.posterUrl,
      bannerUrl: r.bannerUrl,
      themeColor: r.themeColor || "#FFD700",
      description: r.description,
      year: r.year,
      quality: r.quality,
      isActive: r.isActive,
    });
    setEditingId(r._id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.slug) {
      showMsg("Tên và slug là bắt buộc", "error");
      return;
    }
    setSaving(true);
    try {
      const url = editingId
        ? `${API_URL}/featured-riders/${editingId}`
        : `${API_URL}/featured-riders`;
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: authHeader(),
        body: JSON.stringify(form),
      });
      if (res.ok) {
        showMsg(editingId ? "Đã cập nhật Rider" : "Đã thêm Rider mới");
        setShowForm(false);
        fetchRiders();
      } else {
        showMsg("Lỗi lưu dữ liệu", "error");
      }
    } catch {
      showMsg("Lỗi kết nối", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Xóa Rider này?")) return;
    try {
      const res = await fetch(`${API_URL}/featured-riders/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${Cookies.get("token")}` },
      });
      if (res.ok) {
        showMsg("Đã xóa Rider");
        fetchRiders();
      }
    } catch {
      showMsg("Lỗi xóa", "error");
    }
  };

  const handleToggleActive = async (r: FeaturedRider) => {
    try {
      const res = await fetch(`${API_URL}/featured-riders/${r._id}`, {
        method: "PUT",
        headers: authHeader(),
        body: JSON.stringify({ ...r, isActive: !r.isActive }),
      });
      if (res.ok) fetchRiders();
    } catch {
      showMsg("Lỗi cập nhật", "error");
    }
  };

  // Upload file ảnh
  const handleUpload = async (
    file: File,
    type: "poster" | "banner"
  ) => {
    const setter = type === "poster" ? setUploadingPoster : setUploadingBanner;
    setter(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API_URL}/featured-riders/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${Cookies.get("token")}` },
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        // Trả về full URL để hiển thị
        const fullUrl = `${API_URL}${data.url}`;
        if (type === "poster") setForm((f) => ({ ...f, posterUrl: fullUrl }));
        else setForm((f) => ({ ...f, bannerUrl: fullUrl }));
        showMsg("Upload ảnh thành công!");
      } else {
        showMsg("Upload thất bại", "error");
      }
    } catch {
      showMsg("Lỗi upload", "error");
    } finally {
      setter(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-xl text-sm font-semibold shadow-xl transition-all ${
            toast.type === "success"
              ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-300"
              : "bg-red-500/20 border border-red-500/40 text-red-300"
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-white">🦾 Quản lý Siêu Nhân & Tokusatsu</h2>
          <p className="text-xs text-zinc-500 mt-1">
            Tùy chỉnh 6 phim Siêu Nhân hiển thị trên trang chủ — ảnh, màu sắc, thứ tự
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-sm font-black transition-all active:scale-95"
        >
          <Plus size={16} />
          Thêm Siêu Nhân
        </button>
      </div>

      {/* Rider list */}
      <div className="space-y-3">
        {riders.length === 0 && (
          <div className="text-center py-16 text-zinc-600 text-sm">
            Chưa có Rider nào. Nhấn "Thêm Rider" để bắt đầu.
          </div>
        )}
        {riders.map((rider, idx) => (
          <div
            key={rider._id}
            className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${
              rider.isActive
                ? "bg-zinc-900/60 border-zinc-800"
                : "bg-zinc-950/40 border-zinc-900 opacity-50"
            }`}
          >
            {/* Drag handle */}
            <GripVertical size={16} className="text-zinc-700 cursor-grab" />

            {/* Order badge */}
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black border"
              style={{
                backgroundColor: `${rider.themeColor}22`,
                borderColor: `${rider.themeColor}55`,
                color: rider.themeColor,
              }}
            >
              {idx + 1}
            </div>

            {/* Poster preview */}
            <div className="w-12 h-16 rounded-lg overflow-hidden bg-zinc-800 flex-shrink-0 border border-zinc-700">
              {rider.posterUrl ? (
                <img src={rider.posterUrl} alt={rider.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ImageIcon size={16} className="text-zinc-600" />
                </div>
              )}
            </div>

            {/* Banner preview */}
            <div className="w-24 h-16 rounded-lg overflow-hidden bg-zinc-800 flex-shrink-0 border border-zinc-700">
              {rider.bannerUrl ? (
                <img src={rider.bannerUrl} alt={rider.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ImageIcon size={16} className="text-zinc-600" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="font-bold text-white text-sm truncate">{rider.name}</p>
              <p className="text-xs text-zinc-500 truncate">{rider.originName}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-zinc-600">{rider.slug}</span>
                <span className="text-[10px]" style={{ color: rider.themeColor }}>●</span>
                <span className="text-[10px] text-zinc-600">{rider.themeColor}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => handleToggleActive(rider)}
                className={`p-2 rounded-lg border transition-all ${
                  rider.isActive
                    ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
                    : "text-zinc-600 border-zinc-800"
                }`}
                title={rider.isActive ? "Đang hiện — click để ẩn" : "Đang ẩn — click để hiện"}
              >
                {rider.isActive ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
              <button
                onClick={() => openEdit(rider)}
                className="p-2 rounded-lg border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 transition-all"
              >
                <Edit2 size={14} />
              </button>
              <button
                onClick={() => handleDelete(rider._id)}
                className="p-2 rounded-lg border border-zinc-800 text-zinc-600 hover:text-red-400 hover:border-red-500/30 transition-all"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl overflow-y-auto max-h-[90vh]">
            {/* Modal header */}
            <div className="flex items-center justify-between p-6 border-b border-zinc-800">
              <h3 className="text-lg font-black text-white">
                {editingId ? "Chỉnh sửa Rider" : "Thêm Rider mới"}
              </h3>
              <button onClick={() => setShowForm(false)} className="text-zinc-500 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Basic info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1 block">
                    Tên hiển thị *
                  </label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="VD: Kamen Rider Build"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1 block">
                    Origin Name
                  </label>
                  <input
                    value={form.originName}
                    onChange={(e) => setForm((f) => ({ ...f, originName: e.target.value }))}
                    placeholder="VD: Kamen Rider Build (Be The One)"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1 block">
                    Slug OPhim *
                  </label>
                  <input
                    value={form.slug}
                    onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                    placeholder="hiep-si-mat-na-build"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1 block">
                    Năm
                  </label>
                  <input
                    value={form.year}
                    onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))}
                    placeholder="2017"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1 block">
                    Chất lượng
                  </label>
                  <select
                    value={form.quality}
                    onChange={(e) => setForm((f) => ({ ...f, quality: e.target.value }))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                  >
                    <option>HD</option>
                    <option>FHD</option>
                    <option>4K</option>
                    <option>SD</option>
                  </select>
                </div>
              </div>

              {/* Theme color */}
              <div>
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 block">
                  Màu theme
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {COLOR_PRESETS.map((p) => (
                    <button
                      key={p.color}
                      onClick={() => setForm((f) => ({ ...f, themeColor: p.color }))}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-bold transition-all ${
                        form.themeColor === p.color ? "scale-110 shadow-lg" : "opacity-60 hover:opacity-100"
                      }`}
                      style={{
                        borderColor: p.color,
                        backgroundColor: `${p.color}22`,
                        color: p.color,
                        boxShadow: form.themeColor === p.color ? `0 0 10px ${p.color}55` : undefined,
                      }}
                    >
                      <span style={{ backgroundColor: p.color }} className="w-3 h-3 rounded-full" />
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={form.themeColor}
                    onChange={(e) => setForm((f) => ({ ...f, themeColor: e.target.value }))}
                    className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0"
                  />
                  <input
                    value={form.themeColor}
                    onChange={(e) => setForm((f) => ({ ...f, themeColor: e.target.value }))}
                    placeholder="#FFD700"
                    className="bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white font-mono w-32 focus:outline-none focus:border-amber-500"
                  />
                  <div
                    className="flex-1 h-10 rounded-xl transition-all"
                    style={{ backgroundColor: `${form.themeColor}33`, border: `2px solid ${form.themeColor}55` }}
                  />
                </div>
              </div>

              {/* Poster URL */}
              <div>
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 block">
                  Ảnh Poster (Dọc — hiển thị panel trái)
                </label>
                <div className="flex gap-3">
                  <input
                    value={form.posterUrl}
                    onChange={(e) => setForm((f) => ({ ...f, posterUrl: e.target.value }))}
                    placeholder="Paste URL ảnh hoặc upload file..."
                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                  />
                  <input
                    ref={posterRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], "poster")}
                  />
                  <button
                    onClick={() => posterRef.current?.click()}
                    disabled={uploadingPoster}
                    className="px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-50"
                  >
                    {uploadingPoster ? (
                      <div className="animate-spin w-4 h-4 border-2 border-zinc-500 border-t-white rounded-full" />
                    ) : (
                      <Upload size={14} />
                    )}
                    Upload
                  </button>
                </div>
                {form.posterUrl && (
                  <div className="mt-2 flex items-center gap-3">
                    <img src={form.posterUrl} alt="preview" className="w-14 h-20 object-cover rounded-lg border border-zinc-700" />
                    <button onClick={() => setForm((f) => ({ ...f, posterUrl: "" }))} className="text-xs text-zinc-600 hover:text-red-400">
                      Xóa ảnh
                    </button>
                  </div>
                )}
              </div>

              {/* Banner URL */}
              <div>
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 block">
                  Ảnh Banner (Ngang — hero card lớn trong grid)
                </label>
                <div className="flex gap-3">
                  <input
                    value={form.bannerUrl}
                    onChange={(e) => setForm((f) => ({ ...f, bannerUrl: e.target.value }))}
                    placeholder="Paste URL ảnh hoặc upload file..."
                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                  />
                  <input
                    ref={bannerRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], "banner")}
                  />
                  <button
                    onClick={() => bannerRef.current?.click()}
                    disabled={uploadingBanner}
                    className="px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-50"
                  >
                    {uploadingBanner ? (
                      <div className="animate-spin w-4 h-4 border-2 border-zinc-500 border-t-white rounded-full" />
                    ) : (
                      <Upload size={14} />
                    )}
                    Upload
                  </button>
                </div>
                {form.bannerUrl && (
                  <div className="mt-2 flex items-center gap-3">
                    <img src={form.bannerUrl} alt="preview" className="w-32 h-20 object-cover rounded-lg border border-zinc-700" />
                    <button onClick={() => setForm((f) => ({ ...f, bannerUrl: "" }))} className="text-xs text-zinc-600 hover:text-red-400">
                      Xóa ảnh
                    </button>
                  </div>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1 block">
                  Mô tả ngắn
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={3}
                  placeholder="Mô tả ngắn về bộ phim..."
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>

              {/* Active toggle */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setForm((f) => ({ ...f, isActive: !f.isActive }))}
                  className={`w-12 h-6 rounded-full transition-all relative ${form.isActive ? "bg-emerald-500" : "bg-zinc-700"}`}
                >
                  <div
                    className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all ${form.isActive ? "left-6" : "left-0.5"}`}
                  />
                </button>
                <span className="text-sm text-zinc-400">
                  {form.isActive ? "Hiển thị trên trang chủ" : "Ẩn (không hiển thị)"}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 p-6 border-t border-zinc-800">
              <button
                onClick={() => setShowForm(false)}
                className="px-5 py-2.5 rounded-xl border border-zinc-700 text-zinc-400 hover:text-white text-sm font-bold transition-all"
              >
                Hủy
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-sm font-black transition-all disabled:opacity-60"
              >
                {saving ? (
                  <div className="animate-spin w-4 h-4 border-2 border-black/30 border-t-black rounded-full" />
                ) : (
                  <Check size={16} />
                )}
                {editingId ? "Lưu thay đổi" : "Thêm Rider"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
