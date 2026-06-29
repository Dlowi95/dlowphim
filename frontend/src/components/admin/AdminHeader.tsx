"use client";

import React, { useState } from "react";
import Cookies from "js-cookie";
import { useAuth } from "@/context/AuthContext";
import { Bell, Menu, AlertTriangle, ShieldCheck, CheckCheck } from "lucide-react";

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
  const { showToast } = useAuth();
  const [showNotif, setShowNotif] = useState(false);
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

  const handleMarkAsRead = async (id: string, targetTab: string) => {
    try {
      const token = Cookies.get("token");
      await fetch(`${API_URL}/notifications/${id}/read`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
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
        headers: {
          Authorization: `Bearer ${token}`,
        },
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
    <header className="h-16 shrink-0 bg-[#0d0e13]/60 backdrop-blur-md border-b border-zinc-900 flex items-center justify-between px-6 sticky top-0 z-30 select-none">
      <div className="flex items-center gap-4">
        {/* Mobile menu trigger */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 -ml-2 rounded-lg bg-zinc-900 text-zinc-400 hover:text-white border-none cursor-pointer lg:hidden flex items-center justify-center"
        >
          <Menu size={18} />
        </button>

        {/* Path indicator */}
        <div className="hidden sm:flex items-center gap-2 text-[11px] font-extrabold text-zinc-500 uppercase tracking-widest">
          <span>Admin Portal</span>
          <span>/</span>
          <span className="text-pink-500">
            {activeTab === "dashboard"
              ? "Thống kê chung"
              : activeTab === "comments"
              ? "Bình luận & Báo xấu"
              : activeTab === "movies"
              ? "Quản lý Phim"
              : activeTab === "users"
              ? "Quản lý Người dùng"
              : activeTab === "banners"
              ? "Quản lý Banner"
              : activeTab === "reports"
              ? "Báo cáo lỗi"
              : "Thông báo"}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Notifications badge */}
        <div className="relative">
          <button
            onClick={() => setShowNotif(!showNotif)}
            className={`w-9 h-9 rounded-xl bg-zinc-900/60 hover:bg-zinc-900 flex items-center justify-center transition-all cursor-pointer border-none ${
              showNotif ? "text-pink-500 bg-zinc-900" : "text-zinc-400"
            }`}
          >
            <Bell size={15} />
          </button>
          {unreadNotificationsCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full bg-red-500 text-[8px] font-black text-white px-1 flex items-center justify-center shadow-[0_0_8px_rgba(239,68,68,0.7)] animate-pulse border border-[#0d0e13]">
              {unreadNotificationsCount}
            </span>
          )}

          {showNotif && (
            <>
              {/* Click outside overlay */}
              <div className="fixed inset-0 z-40 bg-transparent cursor-default" onClick={() => setShowNotif(false)} />

              {/* Dropdown panel */}
              <div
                className="absolute right-0 mt-2 w-[340px] bg-[#0d0e13] border rounded-2xl shadow-[0_0_25px_rgba(236,72,153,0.18)] p-3.5 z-50 flex flex-col gap-3.5 animate-fadeIn"
                style={{ borderColor: "rgba(236, 72, 153, 0.25)" }}
              >
                <div className="flex items-center justify-between pb-2 border-b border-zinc-900">
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Thông báo mới</span>
                  {unreadNotificationsCount > 0 && (
                    <button
                      onClick={handleMarkAllAsRead}
                      className="text-pink-500 hover:text-pink-400 text-[9px] font-black uppercase tracking-wider flex items-center gap-1 border-none bg-transparent cursor-pointer transition-colors"
                    >
                      <CheckCheck size={11} /> Đọc tất cả
                    </button>
                  )}
                </div>

                <div className="flex flex-col gap-2 max-h-[320px] overflow-y-auto pr-1 custom-scrollbar">
                  {notifications.length > 0 ? (
                    <>
                      {notifications.slice(0, 5).map((notif) => (
                        <div
                          key={notif._id}
                          onClick={() => handleMarkAsRead(notif._id, notif.targetTab)}
                          className={`p-2.5 rounded-xl border cursor-pointer flex gap-2.5 items-start text-left transition-all ${
                            !notif.isRead
                              ? "bg-pink-500/5 hover:bg-pink-500/10 border-pink-500/20 hover:border-pink-500/30"
                              : "bg-zinc-950/40 hover:bg-zinc-900/60 border-zinc-900/60 hover:border-zinc-800"
                          }`}
                        >
                          <div
                            className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                              notif.type === "comment_report"
                                ? "bg-red-500/10 text-red-400"
                                : "bg-amber-500/10 text-amber-400"
                            }`}
                          >
                            <AlertTriangle size={12} />
                          </div>
                          <div className="space-y-1 flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className={`text-[10px] font-extrabold truncate ${!notif.isRead ? "text-zinc-100" : "text-zinc-400"}`}>
                                {notif.title}
                              </span>
                              <span className="text-[8px] font-bold text-zinc-550 shrink-0">
                                {notif.createdAt
                                  ? new Date(notif.createdAt).toLocaleDateString("vi-VN", {
                                      day: "numeric",
                                      month: "numeric",
                                    })
                                  : ""}
                              </span>
                            </div>
                            {notif.subtitle && (
                              <p className={`text-[9px] font-extrabold uppercase tracking-wider ${
                                notif.type === "comment_report" ? "text-pink-500" : "text-amber-500"
                              }`}>
                                {notif.subtitle}
                              </p>
                            )}
                            {notif.content && (
                              <p className="text-[10px] text-zinc-400 leading-normal italic line-clamp-2 bg-zinc-950/60 px-2 py-1.5 rounded border border-zinc-900/40">
                                {notif.content}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}

                      <div className="pt-2 border-t border-zinc-900 flex justify-center">
                        <button
                          onClick={() => {
                            setActiveTab("notifications");
                            setShowNotif(false);
                          }}
                          className="w-full py-2 rounded-xl bg-zinc-900/40 hover:bg-zinc-900 border border-zinc-900 hover:border-zinc-800 text-[9px] font-extrabold text-zinc-400 hover:text-white uppercase tracking-widest transition-all cursor-pointer text-center"
                        >
                          Xem tất cả thông báo →
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="py-8 flex flex-col items-center justify-center gap-2 text-zinc-550">
                      <ShieldCheck size={20} className="text-zinc-650" />
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-600">
                        Không có thông báo mới
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
