"use client";

import { Bell } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import NotificationPreview from "@/components/NotificationPreview";

type MobileNotificationBellProps = {
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  unreadCount: number;
  onOpenAuth: () => void;
  notifications: any[];
  isLoading: boolean;
  onRequestNotifications: () => void;
  onReadAll: () => void;
  onSelect: (notification: any) => void;
  onViewAll: () => void;
};

export default function MobileNotificationBell({
  isAuthenticated,
  isAuthLoading,
  unreadCount,
  onOpenAuth,
  notifications,
  isLoading,
  onRequestNotifications,
  onReadAll,
  onSelect,
  onViewAll,
}: MobileNotificationBellProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const unreadLabel = unreadCount > 99 ? "99+" : unreadCount;
  const className = `relative flex size-11 items-center justify-center rounded-full border text-zinc-100 transition-colors md:hidden ${
    isOpen ? "border-pink-500/40 bg-pink-500/15" : "border-white/10 bg-white/[0.055] active:bg-pink-500/15"
  }`;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isOpen) return;
    const refresh = () => onRequestNotifications();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("dlowphim:notifications-changed", refresh);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("dlowphim:notifications-changed", refresh);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen, onRequestNotifications]);

  const content = (
    <>
      <Bell size={21} strokeWidth={2} />
      {isAuthenticated && unreadCount > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-pink-500 px-1 text-[9px] font-black leading-none text-white ring-2 ring-black">
          {unreadLabel}
        </span>
      )}
    </>
  );

  if (isAuthenticated) {
    return (
      <>
        <button
          type="button"
          aria-label="Mở thông báo gần đây"
          aria-expanded={isOpen}
          onClick={() => {
            const nextOpen = !isOpen;
            setIsOpen(nextOpen);
            if (nextOpen) onRequestNotifications();
          }}
          className={className}
        >
          {content}
        </button>

        {isMounted && isOpen && createPortal(
          <>
            <button
              type="button"
              aria-label="Đóng bảng thông báo"
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-[55] bg-black/55 backdrop-blur-[2px] md:hidden"
            />
            <aside
              aria-label="Thông báo gần đây"
              className="fixed inset-x-3 top-[calc(4rem+env(safe-area-inset-top)+0.65rem)] z-[65] mx-auto w-auto max-w-screen-sm rounded-[1.4rem] border border-white/10 bg-[#15182d]/98 p-4 shadow-[0_24px_70px_rgba(0,0,0,0.72)] backdrop-blur-2xl md:hidden"
            >
              <NotificationPreview
                notifications={notifications}
                isLoading={isLoading}
                unreadCount={unreadCount}
                onReadAll={onReadAll}
                onSelect={(notification) => {
                  setIsOpen(false);
                  onSelect(notification);
                }}
                onViewAll={() => {
                  setIsOpen(false);
                  onViewAll();
                }}
                onClose={() => setIsOpen(false)}
              />
            </aside>
          </>,
          document.body,
        )}
      </>
    );
  }

  return (
    <button
      type="button"
      aria-label="Đăng nhập để xem thông báo"
      disabled={isAuthLoading}
      onClick={onOpenAuth}
      className={`${className} disabled:opacity-50`}
    >
      {content}
    </button>
  );
}
