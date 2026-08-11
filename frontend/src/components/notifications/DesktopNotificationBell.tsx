"use client";

import { Bell } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@heroui/react";
import NotificationPreview from "@/components/NotificationPreview";

type DesktopNotificationBellProps = {
  notifications: any[];
  isLoading: boolean;
  unreadCount: number;
  onOpenChange: (open: boolean) => void;
  onReadAll: () => void;
  onSelect: (notification: any) => void;
  onViewAll: () => void;
};

export default function DesktopNotificationBell({
  notifications,
  isLoading,
  unreadCount,
  onOpenChange,
  onReadAll,
  onSelect,
  onViewAll,
}: DesktopNotificationBellProps) {
  return (
    <div className="hidden md:block">
      <Popover placement="bottom-end" offset={12} showArrow onOpenChange={onOpenChange}>
        <PopoverTrigger>
          <button
            type="button"
            aria-label="Mở thông báo gần đây"
            className={
              unreadCount > 0
                ? "bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/30 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 relative cursor-pointer select-none animate-pulse text-pink-500"
                : "bg-[#1c203e]/60 hover:bg-[#23284e] border border-zinc-800/60 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 relative cursor-pointer select-none text-white"
            }
          >
            <Bell size={18} className={unreadCount > 0 ? "text-pink-500 fill-pink-500" : "text-white fill-white"} />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 z-10 flex h-3.5 min-w-[14px] items-center justify-center rounded-full border border-black bg-red-600 px-0.5 text-[8px] font-black text-white shadow-md">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent className="block w-[340px] rounded-3xl border border-zinc-800 bg-[#161a33] p-4 text-left text-white shadow-[0_25px_60px_rgba(0,0,0,0.8)]">
          <NotificationPreview
            notifications={notifications}
            isLoading={isLoading}
            unreadCount={unreadCount}
            onReadAll={onReadAll}
            onSelect={onSelect}
            onViewAll={onViewAll}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
