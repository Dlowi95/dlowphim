"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, CalendarDays, Home, Search, UserRound } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { shouldHideMobileNavigation } from "@/utils/mobileNavigation";

interface MobileNavigationProps {
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  unreadNotificationsCount: number;
  onOpenAuth: () => void;
}

const NAV_ITEMS = [
  { href: "/", label: "Trang chủ", icon: Home, section: "home" },
  { href: "/search", label: "Tìm kiếm", icon: Search, section: "search" },
  {
    href: "/lich-chieu",
    label: "Lịch chiếu",
    icon: CalendarDays,
    section: "schedule",
  },
  {
    href: "/user/account",
    label: "Tài khoản",
    icon: UserRound,
    section: "account",
  },
] as const;

function isItemActive(
  pathname: string,
  section: (typeof NAV_ITEMS)[number]["section"],
) {
  if (section === "home") return pathname === "/";
  if (section === "search") {
    return pathname === "/search" || pathname.startsWith("/dien-vien/");
  }
  if (section === "schedule") return pathname === "/lich-chieu";
  return pathname === "/user" || pathname.startsWith("/user/");
}

export default function MobileNavigation({
  isAuthenticated,
  isAuthLoading,
  unreadNotificationsCount,
  onOpenAuth,
}: MobileNavigationProps) {
  const pathname = usePathname();
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const lastScrollYRef = useRef(0);
  const frameRef = useRef<number | null>(null);

  const updateHeader = useCallback(() => {
    const currentScrollY = Math.max(window.scrollY, 0);
    const delta = currentScrollY - lastScrollYRef.current;

    if (currentScrollY <= 24) {
      setIsHeaderVisible(true);
    } else if (delta > 8 && currentScrollY > 80) {
      setIsHeaderVisible(false);
    } else if (delta < -8) {
      setIsHeaderVisible(true);
    }

    lastScrollYRef.current = currentScrollY;
    frameRef.current = null;
  }, []);

  useEffect(() => {
    lastScrollYRef.current = window.scrollY;
    setIsHeaderVisible(true);

    const handleScroll = () => {
      if (frameRef.current !== null) return;
      frameRef.current = window.requestAnimationFrame(updateHeader);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, [pathname, updateHeader]);

  if (shouldHideMobileNavigation(pathname)) return null;

  const notificationHref = isAuthenticated ? "/user/notifications" : undefined;
  const unreadLabel =
    unreadNotificationsCount > 99 ? "99+" : unreadNotificationsCount;

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-[60] border-b border-white/[0.06] bg-black/90 pt-[env(safe-area-inset-top)] backdrop-blur-xl transition-transform duration-300 ease-out md:hidden ${
          isHeaderVisible ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <div className="mx-auto flex h-16 w-full max-w-screen-sm items-center justify-between px-4 sm:px-5">
          <Link
            href="/"
            aria-label="Về trang chủ DlowPhim"
            className="flex min-w-0 items-center gap-2.5"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-pink-500/10 shadow-[0_0_24px_rgba(236,72,153,0.22)]">
              <Image
                src="/images/logo.png"
                alt=""
                width={32}
                height={32}
                className="size-8 object-contain"
                priority
              />
            </span>
            <span className="truncate text-[1.55rem] font-black leading-none tracking-[-0.045em] text-white">
              Dlow<span className="text-pink-500">Phim</span>
            </span>
          </Link>

          {notificationHref ? (
            <Link
              href={notificationHref}
              aria-label="Thông báo"
              className="relative flex size-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.055] text-zinc-100 transition-colors active:bg-pink-500/15"
            >
              <Bell size={21} strokeWidth={2} />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-pink-500 px-1 text-[9px] font-black leading-none text-white ring-2 ring-black">
                  {unreadLabel}
                </span>
              )}
            </Link>
          ) : (
            <button
              type="button"
              aria-label="Đăng nhập để xem thông báo"
              disabled={isAuthLoading}
              onClick={onOpenAuth}
              className="relative flex size-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.055] text-zinc-100 transition-colors active:bg-pink-500/15 disabled:opacity-50"
            >
              <Bell size={21} strokeWidth={2} />
            </button>
          )}
        </div>
      </header>

      <div
        aria-hidden="true"
        className="h-[calc(4rem+env(safe-area-inset-top))] md:hidden"
      />

      <nav
        aria-label="Điều hướng chính trên điện thoại"
        className="fixed inset-x-0 bottom-0 z-[70] px-3 pb-[max(0.65rem,env(safe-area-inset-bottom))] md:hidden"
      >
        <div className="mx-auto grid w-full max-w-[31rem] grid-cols-4 gap-1 rounded-[1.7rem] border border-white/15 bg-[#17171d]/92 p-1.5 shadow-[0_-8px_34px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isItemActive(pathname, item.section);
            const isProtectedAccount =
              item.section === "account" && !isAuthenticated;
            const controlClassName = `relative flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-[1.25rem] px-1 transition-all duration-200 ${
              active
                ? "-translate-y-1 bg-pink-500 text-white shadow-[0_8px_22px_rgba(236,72,153,0.3)]"
                : "text-zinc-400 active:bg-white/[0.07] active:text-white"
            }`;
            const content = (
              <>
                <Icon size={20} strokeWidth={active ? 2.5 : 2} />
                <span className="max-w-full truncate text-[10px] font-bold leading-none">
                  {item.label}
                </span>
              </>
            );

            if (isProtectedAccount) {
              return (
                <button
                  key={item.section}
                  type="button"
                  disabled={isAuthLoading}
                  onClick={onOpenAuth}
                  className={`${controlClassName} disabled:opacity-50`}
                >
                  {content}
                </button>
              );
            }

            return (
              <Link
                key={item.section}
                href={item.href}
                className={controlClassName}
              >
                {content}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
