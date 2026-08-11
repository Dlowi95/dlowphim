"use client";

import { Bell, Film, Info, Loader2, MessageSquare, X } from "lucide-react";

type Props = {
  notifications: any[];
  isLoading: boolean;
  unreadCount: number;
  onReadAll: () => void;
  onSelect: (notification: any) => void;
  onViewAll: () => void;
  onClose?: () => void;
};

export default function NotificationPreview({ notifications, isLoading, unreadCount, onReadAll, onSelect, onViewAll, onClose }: Props) {
  return (
    <div className="w-full text-left text-white">
      <div className="mb-3 flex items-center justify-between border-b border-zinc-800/50 pb-2.5">
        <span className="text-sm font-extrabold uppercase tracking-wider">Thông báo</span>
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <button type="button" onClick={onReadAll} className="text-[10px] font-black uppercase tracking-wider text-pink-500 transition hover:text-pink-400">
              Đọc tất cả
            </button>
          )}
          {onClose && (
            <button type="button" onClick={onClose} aria-label="Đóng thông báo" className="flex size-8 items-center justify-center rounded-full bg-white/[0.06] text-zinc-400 transition hover:text-white">
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="max-h-[min(55vh,360px)] space-y-1.5 overflow-y-auto pr-1 [scrollbar-width:thin] [scrollbar-color:#3f3f46_transparent]">
        {isLoading ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <Loader2 size={20} className="animate-spin text-pink-500" />
            <span className="text-xs font-medium text-zinc-500">Đang tải...</span>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 py-10 text-center text-zinc-500">
            <Bell size={24} className="stroke-[1.5]" />
            <span className="text-xs font-semibold">Không có thông báo mới nào</span>
          </div>
        ) : notifications.map((notification) => {
          let Icon = Info;
          let iconColor = "bg-sky-500/10 text-sky-500";
          if (notification.type === "reply") {
            Icon = MessageSquare;
            iconColor = "bg-pink-500/10 text-pink-500";
          } else if (["movie_update", "movie_available", "upcoming_release"].includes(notification.type)) {
            Icon = Film;
            iconColor = "bg-yellow-500/10 text-yellow-500";
          }
          return (
            <button key={notification._id} type="button" onClick={() => onSelect(notification)} className={`flex w-full items-start gap-3 rounded-2xl p-2.5 text-left transition hover:bg-zinc-800/40 ${!notification.isRead ? "border-l-2 border-pink-500 bg-pink-500/5 pl-2" : ""}`}>
              <span className={`shrink-0 rounded-xl p-2 ${iconColor}`}><Icon size={16} /></span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-xs font-bold text-zinc-200">{notification.title}</span>
                <span className="line-clamp-2 text-[11px] font-medium leading-relaxed text-zinc-400">{notification.content}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-2 border-t border-zinc-800/50 pt-2.5">
        <button type="button" onClick={onViewAll} className="h-10 w-full rounded-xl bg-zinc-900 text-xs font-extrabold text-zinc-300 transition hover:bg-zinc-800 hover:text-white">
          Xem tất cả thông báo
        </button>
      </div>
    </div>
  );
}
