"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Bell, Loader2, MessageSquare, Film, Info, Trash2, CheckSquare } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/react";
import Pagination from "@/components/Pagination";
import { useConfirmDialog } from "@/components/ConfirmDialog";

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

function getNotificationGroup(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);

  if (date >= startOfToday) return "Hôm nay";
  if (date >= startOfYesterday) return "Hôm qua";
  return "Cũ hơn";
}

function getSafeNotificationLink(link?: string) {
  const value = String(link || "").trim();
  return value.startsWith("/") && !value.startsWith("//") ? value : null;
}

export default function UserNotificationsPage() {
  const { 
    user, 
    showToast, 
    unreadNotificationsCount,
    getUserNotifications, 
    readSingleNotification, 
    deleteSingleNotification,
    readAllNotifications, 
    clearAllNotifications 
  } = useAuth();
  
  const router = useRouter();
  const { confirm, confirmDialog } = useConfirmDialog();

  const [notifications, setNotifications] = useState<any[]>([]);
  const [loadingNotifs, setLoadingNotifs] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [isMutating, setIsMutating] = useState(false);
  const realtimeRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRequestRef = useRef(0);
  const inflightRequestsRef = useRef(new Map<number, Promise<any>>());

  const fetchNotifs = async (p = 1, showLoader = true) => {
    const requestId = ++latestRequestRef.current;
    if (showLoader) setLoadingNotifs(true);
    try {
      let request = inflightRequestsRef.current.get(p);
      if (!request) {
        request = getUserNotifications(p, 15);
        inflightRequestsRef.current.set(p, request);
        void request.finally(() => {
          if (inflightRequestsRef.current.get(p) === request) inflightRequestsRef.current.delete(p);
        });
      }
      const data = await request;
      if (data && requestId === latestRequestRef.current) {
        setNotifications(data.items || []);
        setTotalPages(data.totalPages || 1);
        setTotal(data.total || 0);
      }
    } catch (e) {
      console.error(e);
      showToast("Lỗi tải thông báo", "error");
    } finally {
      if (showLoader && requestId === latestRequestRef.current) setLoadingNotifs(false);
    }
  };

  useEffect(() => {
    if (user) {
      void fetchNotifs(page);
    }
    return () => {
      latestRequestRef.current += 1;
    };
  }, [user, page]);

  useEffect(() => {
    const refresh = () => {
      if (realtimeRefreshTimer.current) clearTimeout(realtimeRefreshTimer.current);
      realtimeRefreshTimer.current = setTimeout(() => {
        void fetchNotifs(page, false);
      }, 150);
    };
    window.addEventListener("dlowphim:notifications-changed", refresh);
    return () => {
      window.removeEventListener("dlowphim:notifications-changed", refresh);
      if (realtimeRefreshTimer.current) clearTimeout(realtimeRefreshTimer.current);
    };
  }, [page, user?.id]);

  const groupedNotifications = useMemo(() => {
    const groups = new Map<string, any[]>();
    notifications.forEach((notification) => {
      const label = getNotificationGroup(notification.createdAt);
      groups.set(label, [...(groups.get(label) || []), notification]);
    });
    return Array.from(groups.entries());
  }, [notifications]);

  const handleReadAll = async () => {
    if (isMutating || unreadNotificationsCount === 0) return;
    setIsMutating(true);
    const success = await readAllNotifications();
    if (success) {
      // Cập nhật client state
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      showToast("Đã đánh dấu tất cả thông báo là đã đọc", "success");
    } else {
      showToast("Không thể cập nhật trạng thái", "error");
    }
    setIsMutating(false);
  };

  const handleClearAll = async () => {
    const accepted = await confirm({
      title: "Xóa toàn bộ thông báo?",
      message: "Danh sách thông báo sẽ bị xóa khỏi tài khoản và không thể khôi phục.",
      confirmLabel: "Xóa hết",
      tone: "danger",
    });
    if (!accepted || isMutating) return;
    setIsMutating(true);
    const success = await clearAllNotifications();
    if (success) {
      setNotifications([]);
      setTotal(0);
      setTotalPages(1);
      showToast("Đã xóa toàn bộ thông báo thành công", "success");
    } else {
      showToast("Lỗi xóa thông báo", "error");
    }
    setIsMutating(false);
  };

  const handleNotifClick = async (notif: any) => {
    if (!notif.isRead) {
      setNotifications(prev => 
        prev.map(n => n._id === notif._id ? { ...n, isRead: true } : n)
      );
      void readSingleNotification(notif._id).then((success) => {
        if (!success) fetchNotifs(page);
      });
    }
    const target = getSafeNotificationLink(notif.link);
    if (target) {
      router.push(target);
    }
  };

  const handleDeleteNotification = async (notif: any) => {
    const accepted = await confirm({
      title: "Xóa thông báo này?",
      message: "Thông báo sẽ được xóa khỏi tài khoản và không thể khôi phục.",
      confirmLabel: "Xóa thông báo",
      tone: "danger",
    });
    if (!accepted || isMutating) return;

    setIsMutating(true);
    const success = await deleteSingleNotification(notif._id);
    if (success) {
      const remainingOnPage = notifications.length - 1;
      setTotal((value) => Math.max(0, value - 1));
      if (remainingOnPage === 0 && page > 1) {
        setPage((value) => value - 1);
      } else {
        setNotifications((items) => items.filter((item) => item._id !== notif._id));
      }
      showToast("Đã xóa thông báo", "success");
    } else {
      showToast("Không thể xóa thông báo lúc này", "error");
    }
    setIsMutating(false);
  };

  return (
    <div className="space-y-5 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 md:gap-4 border-b border-zinc-900 pb-4 md:pb-5 text-left">
        <div>
          <h2 className="text-lg md:text-2xl font-black uppercase tracking-tight text-zinc-100 flex items-center gap-2.5">
            <Bell className="h-[22px] w-[22px] text-pink-500 md:h-6 md:w-6" size={24} />
            <span>Thông báo của tôi</span>
          </h2>
          <p className="text-xs text-zinc-500 font-medium mt-1">
            Tổng cộng có {total} thông báo trong hệ thống
          </p>
        </div>

        {notifications.length > 0 && (
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:self-end">
            <Button
              size="sm"
              variant="light"
              className="bg-[#1c203e]/40 border border-zinc-800 hover:border-zinc-700 text-zinc-300 font-bold text-xs h-9 px-3.5 rounded-xl flex items-center gap-1.5 transition-all"
              onPress={handleReadAll}
              isDisabled={isMutating || unreadNotificationsCount === 0}
            >
              <CheckSquare size={13} className="text-pink-500" />
              <span>Đọc tất cả</span>
            </Button>
            
            <Button
              size="sm"
              variant="light"
              className="bg-red-500/5 border border-red-500/10 hover:border-red-500/25 hover:bg-red-500/10 text-red-400 font-bold text-xs h-9 px-3.5 rounded-xl flex items-center gap-1.5 transition-all"
              onPress={handleClearAll}
              isDisabled={isMutating}
            >
              <Trash2 size={13} className="text-red-400" />
              <span>Xóa hết</span>
            </Button>
          </div>
        )}
      </div>

      {/* Content */}
      {loadingNotifs ? (
        <div className="bg-[#12131b]/30 border border-zinc-900/60 rounded-2xl md:rounded-3xl py-16 md:py-24 flex flex-col items-center justify-center gap-3">
          <Loader2 className="animate-spin text-pink-500" size={32} />
          <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Đang tải danh sách thông báo...</p>
        </div>
      ) : notifications.length === 0 ? (
        <div className="bg-[#12131b]/30 border border-zinc-900/60 rounded-2xl md:rounded-3xl py-16 md:py-24 px-5 md:px-8 flex flex-col items-center justify-center gap-3 select-none text-center animate-in fade-in duration-200">
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
          {groupedNotifications.map(([groupLabel, items]) => (
            <section key={groupLabel} className="space-y-2.5">
              <h3 className="px-2 text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500">
                {groupLabel} <span className="text-zinc-700">· {items.length}</span>
              </h3>
              <div className="bg-[#12131b]/50 border border-zinc-900 rounded-2xl md:rounded-3xl overflow-hidden divide-y divide-zinc-900/60 shadow-lg">
                {items.map((notif) => {
                  let Icon = Info;
                  let iconColor = "text-sky-500 bg-sky-500/10 border-sky-500/10";

                  if (notif.type === "reply") {
                    Icon = MessageSquare;
                    iconColor = "text-pink-500 bg-pink-500/10 border-pink-500/10";
                  } else if (["movie_update", "movie_available", "upcoming_release"].includes(notif.type)) {
                    Icon = Film;
                    iconColor = "text-yellow-500 bg-yellow-500/10 border-yellow-500/10";
                  }

                  return (
                    <div
                      key={notif._id}
                      onClick={() => handleNotifClick(notif)}
                      className={`group p-3.5 md:p-5 flex items-start gap-3 md:gap-4 cursor-pointer hover:bg-zinc-800/20 active:bg-zinc-800/30 transition-all relative ${
                        !notif.isRead
                          ? "bg-pink-500/[0.02]"
                          : "opacity-75 hover:opacity-100"
                      }`}
                    >
                      {!notif.isRead && (
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-pink-500 shadow-lg shadow-pink-500/40" />
                      )}

                      <div className={`p-2.5 md:p-3 rounded-xl md:rounded-2xl border shrink-0 flex items-center justify-center ${iconColor}`}>
                        <Icon size={18} />
                      </div>

                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-start justify-between gap-2 md:gap-3">
                          <span className={`min-w-0 line-clamp-2 text-xs md:text-sm font-extrabold ${!notif.isRead ? "text-white" : "text-zinc-300"}`}>
                            {notif.title}
                          </span>
                          <div className="flex items-center gap-1 md:gap-2 shrink-0">
                            <span className="text-[10px] md:text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                              {formatTimeAgo(notif.createdAt)}
                            </span>
                            <button
                              type="button"
                              aria-label="Xóa thông báo"
                              disabled={isMutating}
                              onClick={(event) => {
                                event.stopPropagation();
                                void handleDeleteNotification(notif);
                              }}
                              className="p-1.5 rounded-lg text-zinc-600 opacity-100 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:pointer-events-none"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>

                        <p className={`text-xs leading-relaxed ${!notif.isRead ? "text-zinc-300 font-medium" : "text-zinc-400 font-normal"}`}>
                          {notif.content}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pt-8 flex justify-center">
              <Pagination
                compactOnMobile
                currentPage={page}
                totalPages={totalPages}
                onPageChange={(p) => setPage(p)}
              />
            </div>
          )}
        </div>
      )}

      {confirmDialog}
    </div>
  );
}
