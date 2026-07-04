"use client";

import React, { useEffect, useState } from "react";
import { Bell, Loader2, MessageSquare, Film, Info, Trash2, CheckSquare, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/react";
import Pagination from "@/components/Pagination";

function formatTimeAgo(dateString: string) {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    if (diffMs < 0) return "Vừa xong";
    
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Vừa xong";
    if (diffMins < 60) return `${diffMins} phút trước`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} giờ trước`;
    
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return "Hôm qua";
    if (diffDays < 7) return `${diffDays} ngày trước`;
    
    return date.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch (e) {
    return "";
  }
}

export default function UserNotificationsPage() {
  const { 
    user, 
    showToast, 
    getUserNotifications, 
    readSingleNotification, 
    readAllNotifications, 
    clearAllNotifications 
  } = useAuth();
  
  const router = useRouter();

  const [notifications, setNotifications] = useState<any[]>([]);
  const [loadingNotifs, setLoadingNotifs] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const fetchNotifs = async (p = 1) => {
    setLoadingNotifs(true);
    try {
      const data = await getUserNotifications(p, 15);
      if (data) {
        setNotifications(data.items || []);
        setTotalPages(data.totalPages || 1);
        setTotal(data.total || 0);
      }
    } catch (e) {
      console.error(e);
      showToast("Lỗi tải thông báo", "error");
    } finally {
      setLoadingNotifs(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchNotifs(page);
    }
  }, [user, page]);

  const handleReadAll = async () => {
    const success = await readAllNotifications();
    if (success) {
      // Cập nhật client state
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      showToast("Đã đánh dấu tất cả thông báo là đã đọc", "success");
    } else {
      showToast("Không thể cập nhật trạng thái", "error");
    }
  };

  const handleClearAll = async () => {
    const success = await clearAllNotifications();
    if (success) {
      setNotifications([]);
      setTotal(0);
      setTotalPages(1);
      setShowClearConfirm(false);
      showToast("Đã xóa toàn bộ thông báo thành công", "success");
    } else {
      showToast("Lỗi xóa thông báo", "error");
    }
  };

  const handleNotifClick = async (notif: any) => {
    if (!notif.isRead) {
      await readSingleNotification(notif._id);
      // Cập nhật state cục bộ
      setNotifications(prev => 
        prev.map(n => n._id === notif._id ? { ...n, isRead: true } : n)
      );
    }
    if (notif.link) {
      router.push(notif.link);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-900 pb-5 text-left">
        <div>
          <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight text-zinc-100 flex items-center gap-2.5">
            <Bell className="text-pink-500" size={24} />
            <span>Thông báo của tôi</span>
          </h2>
          <p className="text-xs text-zinc-500 font-medium mt-1">
            Tổng cộng có {total} thông báo trong hệ thống
          </p>
        </div>

        {notifications.length > 0 && (
          <div className="flex items-center gap-2 sm:self-end">
            <Button
              size="sm"
              variant="light"
              className="bg-[#1c203e]/40 border border-zinc-800 hover:border-zinc-700 text-zinc-300 font-bold text-xs h-9 px-3.5 rounded-xl flex items-center gap-1.5 transition-all"
              onPress={handleReadAll}
            >
              <CheckSquare size={13} className="text-pink-500" />
              <span>Đọc tất cả</span>
            </Button>
            
            <Button
              size="sm"
              variant="light"
              className="bg-red-500/5 border border-red-500/10 hover:border-red-500/25 hover:bg-red-500/10 text-red-400 font-bold text-xs h-9 px-3.5 rounded-xl flex items-center gap-1.5 transition-all"
              onPress={() => setShowClearConfirm(true)}
            >
              <Trash2 size={13} className="text-red-400" />
              <span>Xóa hết</span>
            </Button>
          </div>
        )}
      </div>

      {/* Content */}
      {loadingNotifs ? (
        <div className="bg-[#12131b]/30 border border-zinc-900/60 rounded-3xl py-24 flex flex-col items-center justify-center gap-3">
          <Loader2 className="animate-spin text-pink-500" size={32} />
          <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Đang tải danh sách thông báo...</p>
        </div>
      ) : notifications.length === 0 ? (
        <div className="bg-[#12131b]/30 border border-zinc-900/60 rounded-3xl py-24 px-8 flex flex-col items-center justify-center gap-3 select-none text-center animate-in fade-in duration-200">
          <div className="p-4 bg-zinc-900/40 border border-zinc-800 rounded-full text-zinc-600 mb-2">
            <Bell size={40} className="stroke-[1.5]" />
          </div>
          <h4 className="text-base font-extrabold text-zinc-400">Không có thông báo nào</h4>
          <p className="text-xs text-zinc-550 max-w-xs leading-relaxed font-medium">
            Bạn đã đọc hết tất cả thông báo từ hệ thống DlowPhim. Chúng tôi sẽ cập nhật tin tức mới tại đây khi có.
          </p>
        </div>
      ) : (
        <div className="space-y-3.5 text-left animate-in fade-in duration-200">
          <div className="bg-[#12131b]/50 border border-zinc-900 rounded-3xl overflow-hidden divide-y divide-zinc-900/60 shadow-lg">
            {notifications.map((notif) => {
              let Icon = Info;
              let iconColor = "text-sky-500 bg-sky-500/10 border-sky-500/10";
              
              if (notif.type === "reply") {
                Icon = MessageSquare;
                iconColor = "text-pink-500 bg-pink-500/10 border-pink-500/10";
              } else if (notif.type === "movie_update") {
                Icon = Film;
                iconColor = "text-yellow-500 bg-yellow-500/10 border-yellow-500/10";
              }

              return (
                <div
                  key={notif._id}
                  onClick={() => handleNotifClick(notif)}
                  className={`p-4 md:p-5 flex items-start gap-4 cursor-pointer hover:bg-zinc-800/20 active:bg-zinc-800/30 transition-all relative ${
                    !notif.isRead 
                      ? "bg-pink-500/[0.02]" 
                      : "opacity-75 hover:opacity-100"
                  }`}
                >
                  {/* Chấm tròn tin nhắn mới */}
                  {!notif.isRead && (
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-pink-500 shadow-lg shadow-pink-500/40" />
                  )}

                  {/* Icon loại thông báo */}
                  <div className={`p-3 rounded-2xl border shrink-0 flex items-center justify-center ${iconColor}`}>
                    <Icon size={18} />
                  </div>

                  {/* Content Detail */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-4">
                      <span className={`text-xs md:text-sm font-extrabold truncate ${!notif.isRead ? "text-white" : "text-zinc-300"}`}>
                        {notif.title}
                      </span>
                      <span className="text-[10px] md:text-xs font-semibold text-zinc-500 shrink-0 uppercase tracking-wide">
                        {formatTimeAgo(notif.createdAt)}
                      </span>
                    </div>
                    
                    <p className={`text-xs leading-relaxed ${!notif.isRead ? "text-zinc-300 font-medium" : "text-zinc-400 font-normal"}`}>
                      {notif.content}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pt-8 flex justify-center">
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={(p) => setPage(p)}
              />
            </div>
          )}
        </div>
      )}

      {/* POPUP CONFIRMATION MODAL: XÓA TOÀN BỘ THÔNG BÁO */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
          <div className="w-full max-w-xs bg-[#12131b] border border-zinc-800 rounded-3xl p-5 shadow-2xl relative text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto mb-3">
              <Trash2 size={20} className="stroke-[2.5]" />
            </div>

            <h3 className="text-sm font-black text-zinc-200 uppercase tracking-wider mb-1.5">Xóa tất cả?</h3>
            <p className="text-[11px] text-zinc-450 leading-relaxed mb-5">
              Bạn có chắc chắn muốn xóa toàn bộ thông báo không? Hành động này không thể khôi phục.
            </p>

            <div className="flex gap-3 justify-center">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="h-9 px-4 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white font-extrabold text-[10px] uppercase tracking-wider rounded-xl transition-all cursor-pointer min-w-[85px] border-none"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className="h-9 px-4 bg-red-500 hover:bg-red-655 active:scale-98 text-white font-extrabold text-[10px] uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-red-500/10 cursor-pointer min-w-[85px] border-none"
              >
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
