"use client";

import React, { useState } from "react";
import Cookies from "js-cookie";
import { useAuth } from "@/context/AuthContext";
import { Bell, Menu, AlertTriangle, ShieldCheck, CheckCheck, Sparkles } from "lucide-react";

interface AdminHeaderProps {
  activeTab: string;
  setSidebarOpen: (open: boolean) => void;
  reportsCount: number;
  setActiveTab: (tab: any) => void;
  reports?: any[];
  movieReports?: any[];
  notifications?: any[];
  unreadNotificationsCount?: number;
  onRefreshNotifications?: () => void;
}

const TAB_LABELS: Record<string, string> = {
  dashboard: "Tổng quan",
  comments: "Bình luận & Báo xấu",
  movies: "Quản lý Phim",
  users: "Người dùng",
  banners: "Banner",
  reports: "Báo cáo lỗi",
  notifications: "Thông báo",
  settings: "Cài đặt",
};

export default function AdminHeader({
  activeTab,
  setSidebarOpen,
  reportsCount,
  setActiveTab,
  reports = [],
  movieReports = [],
  notifications = [],
  unreadNotificationsCount = 0,
  onRefreshNotifications,
}: AdminHeaderProps) {
  const { showToast, user } = useAuth();
  const [showNotif, setShowNotif] = useState(false);
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

  const handleMarkAsRead = async (id: string, targetTab: string) => {
    try {
      const token = Cookies.get("token");
      await fetch(`${API_URL}/notifications/${id}/read`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (onRefreshNotifications) onRefreshNotifications();
    } catch (e) {
      console.error(e);
    }
    setActiveTab(targetTab);
    setShowNotif(false);
  };

  const handleMarkAllAsRead = async () => {
    try {
      const token = Cookies.get("token");
      const res = await fetch(`${API_URL}/notifications/read-all`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        if (onRefreshNotifications) onRefreshNotifications();
        showToast("Đã đọc tất cả thông báo", "success");
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <header className="h-14 shrink-0 flex items-center justify-between px-5 border-b border-white/[0.04] bg-[#09090f]/80 backdrop-blur-xl sticky top-0 z-30 select-none">
      {/* Left side: mobile toggle + breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setSidebarOpen(true)}
          className="lg:hidden w-8 h-8 rounded-lg bg-white/[0.05] hover:bg-white/[0.08] text-zinc-400 hover:text-white border-none cursor-pointer flex items-center justify-center transition-all"
        >
          <Menu size={15} />
        </button>

        {/* Breadcrumb */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest hidden sm:block">Admin</span>
          <span className="text-zinc-700 text-[10px] hidden sm:block">/</span>
          <div className="flex items-center gap-1.5">
            <Sparkles size={11} className="text-pink-500" />
            <span className="text-[11px] font-black text-zinc-300 uppercase tracking-wider">
              {TAB_LABELS[activeTab] || activeTab}
            </span>
          </div>
        </div>
      </div>

      {/* Right side: notification bell + avatar */}
      <div className="flex items-center gap-2.5">
        {/* Bell */}
        <div className="relative">
          <button
            onClick={() => setShowNotif(!showNotif)}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer border-none ${
              showNotif
                ? "bg-pink-500/15 text-pink-400 shadow-[inset_0_0_0_1px_rgba(236,72,153,0.3)]"
                : "bg-white/[0.04] hover:bg-white/[0.07] text-zinc-500 hover:text-zinc-200"
            }`}
          >
            <Bell size={14} />
          </button>
          {unreadNotificationsCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 rounded-full bg-red-500 text-[7px] font-black text-white px-1 flex items-center justify-center shadow-[0_0_8px_rgba(239,68,68,0.6)] animate-pulse border border-[#09090f]">
              {unreadNotificationsCount}
            </span>
          )}

          {/* Dropdown */}
          {showNotif && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowNotif(false)} />
              <div className="absolute right-0 mt-2.5 w-[320px] bg-[#0e0f16]/95 backdrop-blur-xl border border-white/[0.07] rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.7),0_0_0_1px_rgba(236,72,153,0.08)] p-3 z-50 flex flex-col gap-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
                  <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Thông báo</span>
                  {unreadNotificationsCount > 0 && (
                    <button
                      onClick={handleMarkAllAsRead}
                      className="text-pink-400 hover:text-pink-300 text-[9px] font-black uppercase tracking-wider flex items-center gap-1 border-none bg-transparent cursor-pointer transition-colors"
                    >
                      <CheckCheck size={10} /> Đọc hết
                    </button>
                  )}
                </div>

                <div className="flex flex-col gap-1.5 max-h-[280px] overflow-y-auto pr-0.5 custom-scrollbar">
                  {notifications.length > 0 ? (
                    <>
                      {notifications.slice(0, 5).map((notif) => (
                        <div
                          key={notif._id}
                          onClick={() => handleMarkAsRead(notif._id, notif.targetTab)}
                          className={`p-2.5 rounded-xl cursor-pointer flex gap-2.5 items-start text-left transition-all ${
                            !notif.isRead
                              ? "bg-pink-500/[0.07] hover:bg-pink-500/[0.11] shadow-[inset_0_0_0_1px_rgba(236,72,153,0.15)]"
                              : "bg-white/[0.025] hover:bg-white/[0.04]"
                          }`}
                        >
                          <div
                            className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                              notif.type === "comment_report"
                                ? "bg-red-500/10 text-red-400"
                                : "bg-amber-500/10 text-amber-400"
                            }`}
                          >
                            <AlertTriangle size={11} />
                          </div>
                          <div className="space-y-0.5 flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className={`text-[10px] font-extrabold truncate ${!notif.isRead ? "text-zinc-100" : "text-zinc-400"}`}>
                                {notif.title}
                              </span>
                              <span className="text-[8px] font-bold text-zinc-600 shrink-0">
                                {notif.createdAt
                                  ? new Date(notif.createdAt).toLocaleDateString("vi-VN", { day: "numeric", month: "numeric" })
                                  : ""}
                              </span>
                            </div>
                            {notif.content && (
                              <p className="text-[9px] text-zinc-500 leading-relaxed line-clamp-2">{notif.content}</p>
                            )}
                          </div>
                        </div>
                      ))}

                      <button
                        onClick={() => { setActiveTab("notifications"); setShowNotif(false); }}
                        className="w-full py-2 mt-1 rounded-xl bg-white/[0.025] hover:bg-white/[0.05] border border-white/[0.05] text-[9px] font-extrabold text-zinc-500 hover:text-white uppercase tracking-widest transition-all cursor-pointer"
                      >
                        Xem tất cả →
                      </button>
                    </>
                  ) : (
                    <div className="py-8 flex flex-col items-center justify-center gap-2">
                      <ShieldCheck size={20} className="text-zinc-700" />
                      <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Không có thông báo mới</span>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Subtle user avatar in header (optional) */}
        {user?.avatar ? (
          <img
            src={user.avatar}
            alt={user.displayName}
            className="w-7 h-7 rounded-full object-cover ring-1 ring-white/10 hidden sm:block"
          />
        ) : (
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-pink-500 to-rose-600 text-white text-[9px] font-black flex items-center justify-center hidden sm:flex ring-1 ring-white/10">
            {user?.displayName?.slice(0, 2).toUpperCase() || "AD"}
          </div>
        )}
      </div>
    </header>
  );
}
