"use client";

import React, { useState, useEffect } from "react";
import Cookies from "js-cookie";
import {
  Bell,
  Trash2,
  CheckCheck,
  Loader2,
  RefreshCw,
  Clock,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ShieldAlert
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface NotificationItem {
  _id: string;
  type: "movie_report" | "comment_report" | "system";
  title: string;
  subtitle?: string;
  content?: string;
  targetId: string;
  targetTab: "reports" | "comments";
  isRead: boolean;
  createdAt: string;
}

interface NotificationsManagementViewProps {
  setActiveTab: (tab: any) => void;
  onRefreshStats?: () => void;
}

export default function NotificationsManagementView({
  setActiveTab,
  onRefreshStats,
}: NotificationsManagementViewProps) {
  const { showToast } = useAuth();
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const limit = 10;

  const fetchNotifications = async (currentPage = page, currentFilter = filter) => {
    setLoading(true);
    try {
      const token = Cookies.get("token");
      
      // Fetch notifications
      const res = await fetch(`${API_URL}/notifications?page=${currentPage}&limit=${limit}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        let items: NotificationItem[] = data.items || [];
        
        // Frontend filtering for Read vs Unread
        if (currentFilter === "unread") {
          items = items.filter((item) => !item.isRead);
        }

        setNotifications(items);
        setTotalPages(data.totalPages || 1);
        setTotalItems(data.total || 0);
        setUnreadCount(data.unreadCount || 0);
      } else {
        showToast("Không thể tải danh sách thông báo", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Lỗi kết nối máy chủ", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications(page, filter);
  }, [page, filter]);

  const handleMarkAsRead = async (id: string, targetTab: string) => {
    try {
      const token = Cookies.get("token");
      const res = await fetch(`${API_URL}/notifications/${id}/read`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        // Cập nhật state local
        setNotifications((prev) =>
          prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
        );
        if (onRefreshStats) onRefreshStats();
        
        // Điều hướng sang tab xử lý
        setActiveTab(targetTab);
      }
    } catch (err) {
      console.error(err);
    }
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
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        setUnreadCount(0);
        showToast("Đã đánh dấu đọc tất cả thông báo", "success");
        if (onRefreshStats) onRefreshStats();
      } else {
        showToast("Thao tác thất bại", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Lỗi kết nối máy chủ", "error");
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa toàn bộ lịch sử thông báo?")) {
      return;
    }
    try {
      const token = Cookies.get("token");
      const res = await fetch(`${API_URL}/notifications/clear`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        setNotifications([]);
        setTotalItems(0);
        setUnreadCount(0);
        setTotalPages(1);
        showToast("Đã xóa toàn bộ lịch sử thông báo", "success");
        if (onRefreshStats) onRefreshStats();
      } else {
        showToast("Xóa lịch sử thất bại", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Lỗi kết nối máy chủ", "error");
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="text-left">
          <h3 className="text-base md:text-lg font-black text-white tracking-tight flex items-center gap-2">
            <Bell size={18} className="text-pink-500" />
            Lịch sử Thông báo
          </h3>
          <p className="text-[10px] font-semibold text-zinc-500 mt-0.5">
            Xem và quản lý tất cả thông báo hệ thống được gộp từ báo lỗi phim và báo xấu bình luận.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 self-end">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[10px] font-black text-zinc-300 hover:text-white uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCheck size={12} className="text-emerald-400" />
              Đọc tất cả
            </button>
          )}

          {totalItems > 0 && (
            <button
              onClick={handleClearAll}
              className="px-3.5 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/30 text-[10px] font-black text-red-400 hover:text-red-300 uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 size={12} />
              Xóa lịch sử
            </button>
          )}

          <button
            onClick={() => fetchNotifications()}
            disabled={loading}
            className="w-9 h-9 rounded-xl bg-zinc-900/60 hover:bg-zinc-900 text-zinc-400 hover:text-white flex items-center justify-center transition-all cursor-pointer border-none disabled:opacity-50"
            title="Tải lại dữ liệu"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Filter and stats banner */}
      <div className="flex items-center justify-between p-1 bg-zinc-950 rounded-xl border border-zinc-900">
        <div className="flex">
          {(["all", "unread"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setFilter(tab);
                setPage(1);
              }}
              className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border-none cursor-pointer ${
                filter === tab
                  ? "bg-pink-500 text-white"
                  : "bg-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {tab === "all" ? "Tất cả thông báo" : `Chưa đọc (${unreadCount})`}
            </button>
          ))}
        </div>
        <div className="text-[10px] font-bold text-zinc-500 pr-3">
          Tổng số: <span className="text-zinc-300">{totalItems}</span>
        </div>
      </div>

      {/* Notifications list */}
      <div className="space-y-3">
        {loading ? (
          <div className="p-20 text-center flex flex-col items-center justify-center gap-3">
            <Loader2 className="animate-spin text-pink-500" size={24} />
            <span className="text-xs text-zinc-500 font-bold">Đang tải lịch sử thông báo...</span>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-20 bg-[#0d0e13] border border-zinc-900 rounded-2xl text-center flex flex-col items-center justify-center gap-3.5 select-none">
            <div className="w-14 h-14 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500">
              <ShieldAlert size={26} />
            </div>
            <div className="space-y-1">
              <h4 className="font-extrabold text-xs text-zinc-300">Không có thông báo nào</h4>
              <p className="text-[10px] text-zinc-550 max-w-sm leading-normal mx-auto">
                {filter === "unread"
                  ? "Không có thông báo chưa đọc nào. Mọi thứ đã được xem qua."
                  : "Hộp thư thông báo đang trống. Mọi thông báo sẽ được lưu vết tại đây."}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notif) => (
              <div
                key={notif._id}
                onClick={() => handleMarkAsRead(notif._id, notif.targetTab)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex gap-4 items-start text-left ${
                  !notif.isRead
                    ? "bg-pink-500/5 hover:bg-pink-500/10 border-pink-500/20 hover:border-pink-500/30 shadow-[0_0_12px_rgba(236,72,153,0.03)]"
                    : "bg-[#0d0e13] hover:bg-zinc-900/40 border-zinc-900 hover:border-zinc-800"
                }`}
              >
                {/* Indicator dot */}
                {!notif.isRead && (
                  <span className="w-2 h-2 rounded-full bg-pink-500 mt-1.5 shrink-0 animate-pulse" />
                )}

                {/* Left Icon based on type */}
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    notif.type === "comment_report"
                      ? "bg-red-500/10 text-red-400"
                      : "bg-amber-500/10 text-amber-400"
                  }`}
                >
                  <AlertTriangle size={16} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className={`text-xs font-black truncate ${!notif.isRead ? "text-white" : "text-zinc-350"}`}>
                      {notif.title}
                    </h4>
                    <span className="text-[9px] font-semibold text-zinc-550 shrink-0 flex items-center gap-1">
                      <Clock size={10} />
                      {new Date(notif.createdAt).toLocaleString("vi-VN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        day: "numeric",
                        month: "numeric",
                      })}
                    </span>
                  </div>

                  {notif.subtitle && (
                    <p className={`text-[10px] font-extrabold uppercase tracking-wide ${
                      notif.type === "comment_report" ? "text-pink-500" : "text-amber-500"
                    }`}>
                      {notif.subtitle}
                    </p>
                  )}

                  {notif.content && (
                    <p className="text-[10px] text-zinc-400 leading-relaxed italic bg-zinc-950/60 px-3 py-2 rounded-xl border border-zinc-900/40 mt-1 max-w-2xl line-clamp-3">
                      {notif.content}
                    </p>
                  )}
                </div>
              </div>
            ))}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 pt-4 select-none">
                <button
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  disabled={page === 1}
                  className="w-8 h-8 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-zinc-900/80 text-zinc-400 hover:text-white flex items-center justify-center border-none transition-all cursor-pointer"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-[11px] font-extrabold text-zinc-400">
                  Trang <span className="text-pink-500">{page}</span> / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                  disabled={page === totalPages}
                  className="w-8 h-8 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-zinc-900/80 text-zinc-400 hover:text-white flex items-center justify-center border-none transition-all cursor-pointer"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
