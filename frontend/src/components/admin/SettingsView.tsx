"use client";

import React, { useState, useEffect } from "react";
import Cookies from "js-cookie";
import {
  Settings,
  Globe,
  Film,
  Link as LinkIcon,
  Mail,
  Shield,
  Loader2,
  RefreshCw,
  Save,
  Radio
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface SystemSettingsData {
  websiteName: string;
  websiteDescription?: string;
  maintenanceMode: boolean;
  movieCrawlSource?: string;
  autoCrawlInterval?: number;
  contactEmail?: string;
  facebookLink?: string;
  telegramLink?: string;
  adsEnabled: boolean;
}

export default function SettingsView() {
  const { showToast } = useAuth();
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

  const [activeSubTab, setActiveSubTab] = useState<"general" | "crawl" | "business">("general");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [settings, setSettings] = useState<SystemSettingsData>({
    websiteName: "DlowPhim",
    websiteDescription: "Trải Nghiệm Điện Ảnh Premium",
    maintenanceMode: false,
    movieCrawlSource: "https://ophim1.com/danh-sach/phim-moi-cap-nhat",
    autoCrawlInterval: 12,
    contactEmail: "support@dlowphim.com",
    facebookLink: "https://facebook.com/dlowphim",
    telegramLink: "https://t.me/dlowphim",
    adsEnabled: false,
  });

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/system-settings`);
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      } else {
        showToast("Không thể tải cấu hình hệ thống", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Lỗi kết nối máy chủ", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setSettings((prev) => ({ ...prev, [name]: checked }));
    } else {
      setSettings((prev) => ({ 
        ...prev, 
        [name]: name === "autoCrawlInterval" ? parseInt(value, 10) : value 
      }));
    }
  };

  const handleToggle = (name: keyof SystemSettingsData) => {
    setSettings((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const token = Cookies.get("token");
      const res = await fetch(`${API_URL}/system-settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(settings),
      });

      if (res.ok) {
        const updated = await res.json();
        setSettings(updated);
        showToast("Lưu cấu hình hệ thống thành công", "success");
      } else {
        showToast("Lưu cấu hình thất bại", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Lỗi kết nối máy chủ", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="text-left">
          <h3 className="text-base md:text-lg font-black text-white tracking-tight flex items-center gap-2">
            <Settings size={18} className="text-pink-500" />
            Cài đặt Hệ thống
          </h3>
          <p className="text-[10px] font-semibold text-zinc-500 mt-0.5">
            Cấu hình hoạt động, SEO, nguồn API phim, thông tin liên hệ và chế độ bảo trì của DlowPhim.
          </p>
        </div>

        <button
          onClick={fetchSettings}
          disabled={loading || saving}
          className="w-9 h-9 rounded-xl bg-zinc-900/60 hover:bg-zinc-900 text-zinc-400 hover:text-white flex items-center justify-center transition-all cursor-pointer border-none disabled:opacity-50 self-end"
          title="Tải lại dữ liệu"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Internal Tabs Navigator */}
      <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-900">
        {[
          { id: "general", label: "Cấu hình chung", icon: Globe },
          { id: "crawl", label: "Nguồn cào phim", icon: Film },
          { id: "business", label: "Kinh doanh & Liên hệ", icon: Mail },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border-none cursor-pointer flex items-center justify-center gap-2 ${
                isActive
                  ? "bg-pink-500 text-white"
                  : "bg-transparent text-zinc-500 hover:text-zinc-350"
              }`}
            >
              <Icon size={12} />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Form Settings */}
      {loading ? (
        <div className="p-20 text-center flex flex-col items-center justify-center gap-3">
          <Loader2 className="animate-spin text-pink-500" size={24} />
          <span className="text-xs text-zinc-500 font-bold">Đang tải cấu hình...</span>
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          <div className="bg-[#0d0e13] border border-zinc-900 rounded-2xl p-5 md:p-6 space-y-6 text-left">
            
            {/* 1. GENERAL TAB */}
            {activeSubTab === "general" && (
              <div className="space-y-5">
                <div className="border-b border-zinc-900 pb-3">
                  <h4 className="text-xs font-black text-white uppercase tracking-wider">Cấu hình Website & SEO</h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">Tên Website</label>
                    <input
                      type="text"
                      name="websiteName"
                      value={settings.websiteName}
                      onChange={handleChange}
                      required
                      placeholder="VD: DlowPhim"
                      className="w-full bg-zinc-950 border border-zinc-900 hover:border-zinc-800 focus:border-pink-500/50 rounded-xl px-4 py-3 text-xs text-white outline-none transition-all placeholder-zinc-700"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">Mô tả Website (SEO)</label>
                    <input
                      type="text"
                      name="websiteDescription"
                      value={settings.websiteDescription || ""}
                      onChange={handleChange}
                      placeholder="VD: Trải Nghiệm Điện Ảnh Premium"
                      className="w-full bg-zinc-950 border border-zinc-900 hover:border-zinc-800 focus:border-pink-500/50 rounded-xl px-4 py-3 text-xs text-white outline-none transition-all placeholder-zinc-700"
                    />
                  </div>
                </div>

                {/* Maintenance mode toggle card */}
                <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10 flex items-center justify-between gap-4 mt-6">
                  <div className="space-y-0.5 max-w-lg">
                    <h5 className="text-xs font-extrabold text-amber-400 flex items-center gap-1.5">
                      <Shield size={14} /> Chế độ bảo trì hệ thống
                    </h5>
                    <p className="text-[10px] text-zinc-500 leading-normal font-semibold">
                      Khi được bật, người xem thông thường sẽ không thể xem phim hay sử dụng các tính năng trên website. Chỉ quản trị viên mới được phép truy cập.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggle("maintenanceMode")}
                    className={`w-11 h-6 rounded-full transition-all relative outline-none border-none cursor-pointer ${
                      settings.maintenanceMode ? "bg-amber-500" : "bg-zinc-800"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all shadow-sm ${
                        settings.maintenanceMode ? "left-5.5" : "left-0.5"
                      }`}
                    />
                  </button>
                </div>
              </div>
            )}

            {/* 2. CRAWL TAB */}
            {activeSubTab === "crawl" && (
              <div className="space-y-5">
                <div className="border-b border-zinc-900 pb-3">
                  <h4 className="text-xs font-black text-white uppercase tracking-wider">Cấu hình Cào Phim & API Nguồn</h4>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                    <LinkIcon size={12} />
                    API Nguồn Phim (Mới Cập Nhật)
                  </label>
                  <input
                    type="url"
                    name="movieCrawlSource"
                    value={settings.movieCrawlSource || ""}
                    onChange={handleChange}
                    placeholder="Link API cào phim dạng JSON"
                    className="w-full bg-zinc-950 border border-zinc-900 hover:border-zinc-800 focus:border-pink-500/50 rounded-xl px-4 py-3 text-xs text-white outline-none transition-all placeholder-zinc-700 font-mono"
                  />
                  <span className="text-[9px] font-bold text-zinc-650">
                    Được sử dụng làm nguồn API cào phim định kỳ tự động và nhập phim thủ công.
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">
                      Tần suất Tự động cập nhật
                    </label>
                    <select
                      name="autoCrawlInterval"
                      value={settings.autoCrawlInterval}
                      onChange={handleChange}
                      className="w-full bg-zinc-950 border border-zinc-900 hover:border-zinc-800 focus:border-pink-500/50 rounded-xl px-4 py-3 text-xs text-white outline-none transition-all cursor-pointer"
                    >
                      <option value={4}>4 giờ một lần</option>
                      <option value={8}>8 giờ một lần</option>
                      <option value={12}>12 giờ một lần</option>
                      <option value={24}>24 giờ một lần (Hàng ngày)</option>
                      <option value={48}>48 giờ một lần (2 ngày)</option>
                    </select>
                  </div>
                  
                  <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-900 flex items-center justify-between gap-3 self-end h-[46px]">
                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Radio size={12} className="text-pink-500 animate-pulse" />
                      Trạng thái quét tự động:
                    </span>
                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider bg-emerald-500/10 px-2 py-0.5 rounded">
                      Đang Bật
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* 3. BUSINESS TAB */}
            {activeSubTab === "business" && (
              <div className="space-y-5">
                <div className="border-b border-zinc-900 pb-3">
                  <h4 className="text-xs font-black text-white uppercase tracking-wider">Thông tin liên hệ & Cấu hình thương mại</h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">Email hỗ trợ</label>
                    <input
                      type="email"
                      name="contactEmail"
                      value={settings.contactEmail || ""}
                      onChange={handleChange}
                      placeholder="VD: support@dlowphim.com"
                      className="w-full bg-zinc-950 border border-zinc-900 hover:border-zinc-800 focus:border-pink-500/50 rounded-xl px-4 py-3 text-xs text-white outline-none transition-all placeholder-zinc-700"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">Facebook Fanpage</label>
                    <input
                      type="url"
                      name="facebookLink"
                      value={settings.facebookLink || ""}
                      onChange={handleChange}
                      placeholder="Link Facebook Page"
                      className="w-full bg-zinc-950 border border-zinc-900 hover:border-zinc-800 focus:border-pink-500/50 rounded-xl px-4 py-3 text-xs text-white outline-none transition-all placeholder-zinc-700"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">Telegram Channel</label>
                    <input
                      type="url"
                      name="telegramLink"
                      value={settings.telegramLink || ""}
                      onChange={handleChange}
                      placeholder="Link Telegram"
                      className="w-full bg-zinc-950 border border-zinc-900 hover:border-zinc-800 focus:border-pink-500/50 rounded-xl px-4 py-3 text-xs text-white outline-none transition-all placeholder-zinc-700"
                    />
                  </div>
                </div>

                {/* Ads monetization toggle card */}
                <div className="p-4 rounded-xl bg-pink-500/5 border border-pink-500/10 flex items-center justify-between gap-4 mt-6">
                  <div className="space-y-0.5 max-w-lg">
                    <h5 className="text-xs font-extrabold text-pink-500 flex items-center gap-1.5">
                      💰 Doanh thu: Banner Quảng cáo
                    </h5>
                    <p className="text-[10px] text-zinc-500 leading-normal font-semibold">
                      Bật hoặc tắt toàn bộ các vị trí đặt biểu ngữ quảng cáo trên trang chủ, trang tìm kiếm và trang xem phim của người dùng.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggle("adsEnabled")}
                    className={`w-11 h-6 rounded-full transition-all relative outline-none border-none cursor-pointer ${
                      settings.adsEnabled ? "bg-pink-500" : "bg-zinc-800"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all shadow-sm ${
                        settings.adsEnabled ? "left-5.5" : "left-0.5"
                      }`}
                    />
                  </button>
                </div>
              </div>
            )}
            
            {/* Submit button */}
            <div className="flex justify-end pt-2 border-t border-zinc-900/60 mt-4">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 bg-pink-500 hover:bg-pink-600 disabled:bg-pink-500/50 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer border-none flex items-center gap-2 shadow shadow-pink-500/10"
              >
                {saving ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Đang lưu...
                  </>
                ) : (
                  <>
                    <Save size={14} />
                    Lưu cấu hình
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
