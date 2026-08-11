"use client";

import React, { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Heart,
  Plus,
  History,
  Bell,
  User,
  LogOut,
  Loader2,
  AlertCircle,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";

export default function UserLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("dlowphim_open_auth"));
      }
    }
  }, [user, loading]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-3">
        <Loader2 className="animate-spin text-pink-500" size={40} />
        <p className="text-sm font-semibold text-zinc-400">Đang kiểm tra tài khoản...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[70vh] bg-black text-white flex flex-col items-center justify-center gap-4 px-6 text-center select-none pt-28">
        <AlertCircle size={56} className="text-zinc-650" />
        <h2 className="text-xl md:text-2xl font-black text-zinc-300">Vui lòng đăng nhập tài khoản</h2>
        <p className="text-sm text-zinc-500 max-w-sm">
          Đăng nhập tài khoản DlowPhim để đồng bộ và quản lý danh sách của bạn.
        </p>
        <button
          onClick={() => {
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("dlowphim_open_auth"));
            }
          }}
          className="mt-2 h-11 px-6 rounded-full bg-pink-500 hover:bg-pink-600 text-white font-extrabold text-sm transition-all duration-200"
        >
          Đăng nhập ngay
        </button>
      </div>
    );
  }

  const menuItems = [
    {
      href: "/user/account",
      label: "Tài khoản",
      icon: (isActive: boolean) => (
        <User size={18} className={isActive ? "text-pink-500" : ""} />
      ),
    },
    {
      href: "/user/favorite",
      label: "Yêu thích",
      icon: (isActive: boolean) => (
        <Heart size={18} className={isActive ? "fill-pink-500 text-pink-500" : ""} />
      ),
    },
    {
      href: "/user/watchlist",
      label: "Danh sách",
      icon: (isActive: boolean) => (
        <Plus size={18} className={isActive ? "text-pink-500" : ""} />
      ),
    },
    {
      href: "/user/history",
      label: "Xem tiếp",
      icon: (isActive: boolean) => (
        <History size={18} className={isActive ? "text-pink-500" : ""} />
      ),
    },
    {
      href: "/user/notifications",
      label: "Thông báo",
      icon: (isActive: boolean) => (
        <Bell size={18} className={isActive ? "text-pink-500 fill-pink-500/20" : ""} />
      ),
    },
  ];

  const isAccountPage = pathname === "/user/account";

  return (
    <div className="w-full bg-black text-white pt-5 pb-28 md:py-10 md:pt-28 flex-grow flex flex-col">
      <div className="container mx-auto px-4 md:px-6 max-w-7xl flex-grow flex flex-col">
        <div className="flex flex-col md:flex-row gap-5 md:gap-8 items-start flex-grow w-full">

          {isAccountPage && (
            <section className="md:hidden w-full select-none" aria-labelledby="mobile-account-title">
              <h1 id="mobile-account-title" className="mb-4 flex items-center gap-2 text-xl font-black text-zinc-100">
                <User size={21} className="text-pink-500" />
                <span>Tài khoản</span>
              </h1>

              <div className="rounded-2xl border border-white/[0.08] bg-[#14151b] p-4 shadow-lg shadow-black/20">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full border border-zinc-700 bg-zinc-900">
                    {user.avatar ? (
                      <img
                        src={user.avatar}
                        alt={user.displayName}
                        className="h-full w-full object-cover avatar-smooth"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-pink-500">
                        <User size={22} />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <p className="truncate text-sm font-extrabold text-white">{user.displayName}</p>
                    <p className="mt-0.5 truncate text-[11px] text-zinc-500">{user.email}</p>
                  </div>
                  <a
                    href="#thong-tin-tai-khoan"
                    className="shrink-0 rounded-xl border border-pink-500/25 bg-pink-500/10 px-3 py-2 text-[11px] font-extrabold text-pink-400"
                  >
                    Hồ sơ
                  </a>
                </div>
              </div>

              <nav aria-label="Lối tắt tài khoản" className="mt-4 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111217]">
                {menuItems
                  .filter((item) => item.href !== "/user/account")
                  .slice()
                  .reverse()
                  .map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="flex min-h-[3.25rem] items-center gap-3 border-b border-white/[0.06] px-4 py-3 text-sm font-bold text-zinc-200 transition-colors last:border-b-0 active:bg-white/[0.05]"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.04] text-zinc-400">
                        {item.icon(false)}
                      </span>
                      <span className="flex-1 text-left">
                        {item.href === "/user/history"
                          ? "Đang xem"
                          : item.href === "/user/watchlist"
                            ? "Danh sách phim của tôi"
                            : item.label}
                      </span>
                      <ChevronRight size={17} className="text-zinc-600" />
                    </Link>
                  ))}
                <button
                  type="button"
                  onClick={() => logout()}
                  className="flex min-h-[3.25rem] w-full items-center gap-3 px-4 py-3 text-sm font-bold text-red-400 transition-colors active:bg-red-500/[0.06]"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-red-500/[0.06]">
                    <LogOut size={18} />
                  </span>
                  <span className="flex-1 text-left">Đăng xuất</span>
                  <ChevronRight size={17} className="text-red-500/40" />
                </button>
              </nav>
            </section>
          )}

          {!isAccountPage && (
            <Link
              href="/user/account"
              aria-label="Quay lại trang tài khoản"
              className="md:hidden inline-flex min-h-10 items-center gap-2.5 rounded-xl text-sm font-extrabold text-zinc-300 transition-colors active:text-pink-400"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-[#14151b] text-zinc-300">
                <ArrowLeft size={18} />
              </span>
              <span>Tài khoản</span>
            </Link>
          )}
          
          {/* SIDEBAR */}
          <div className="hidden md:flex w-full md:w-[280px] bg-[#12131b] border border-zinc-800/40 rounded-3xl p-6 flex-col justify-between shrink-0 select-none">
            <div className="space-y-6">
              <h3 className="text-lg font-black text-zinc-300 tracking-tight px-1 uppercase">
                Quản lý tài khoản
              </h3>
              
              <nav aria-label="Quản lý tài khoản" className="flex flex-col gap-1">
                {menuItems.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                      className={`flex items-center gap-3.5 py-3 px-4 rounded-xl font-bold text-sm transition-all ${
                        isActive
                          ? "bg-pink-500/10 border border-pink-500/20 text-pink-500 shadow-[0_0_12px_rgba(236,72,153,0.15)]"
                          : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 border border-transparent"
                      }`}
                    >
                      {item.icon(isActive)}
                      <span className="whitespace-nowrap">{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Profile Avatar and Information */}
            <div className="border-t border-zinc-800/60 mt-8 pt-6 flex flex-col gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center shrink-0 border border-zinc-800 shadow-lg select-none">
                  {user.avatar ? (
                    <img 
                      src={user.avatar} 
                      alt={user.displayName}
                      className="w-full h-full rounded-full object-cover avatar-smooth"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="#ffff00"
                      className="w-6 h-6"
                    >
                      <path d="M12 .587l3.668 7.431 8.2 1.192-5.934 5.786 1.4 8.168L12 18.896l-7.334 3.857 1.4-8.168L.132 9.21l8.2-1.192z" />
                    </svg>
                  )}
                </div>
                
                <div className="flex-1 min-w-0 text-left">
                  <h4 className="font-extrabold text-sm text-zinc-200 truncate leading-snug">
                    {user.displayName}
                  </h4>
                  <p className="text-[11px] text-zinc-550 truncate mt-0.5 leading-none">
                    {user.email}
                  </p>
                </div>
              </div>
              
              <button
                onClick={() => logout()}
                className="w-full h-11 rounded-xl border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/40 text-zinc-300 font-extrabold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <LogOut size={16} />
                <span>Thoát</span>
              </button>
            </div>
          </div>

          {/* CONTENT AREA */}
          <div className="min-w-0 flex-1 w-full">
            {children}
          </div>
          
        </div>
      </div>
    </div>
  );
}
