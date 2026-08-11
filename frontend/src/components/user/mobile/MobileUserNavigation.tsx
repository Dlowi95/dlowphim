"use client";

import Link from "next/link";
import { ArrowLeft, ChevronRight, LogOut, User } from "lucide-react";
import type { ReactNode } from "react";

type MobileUser = {
  avatar?: string;
  displayName: string;
  email: string;
};

type MenuItem = {
  href: string;
  label: string;
  icon: (active: boolean) => ReactNode;
};

type MobileUserNavigationProps = {
  isAccountPage: boolean;
  user: MobileUser;
  menuItems: MenuItem[];
  onLogout: () => void;
};

export default function MobileUserNavigation({ isAccountPage, user, menuItems, onLogout }: MobileUserNavigationProps) {
  if (!isAccountPage) {
    return (
      <Link
        href="/user/account"
        aria-label="Quay lại trang tài khoản"
        className="inline-flex min-h-10 items-center gap-2.5 rounded-xl text-sm font-extrabold text-zinc-300 transition-colors active:text-pink-400"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-[#14151b] text-zinc-300">
          <ArrowLeft size={18} />
        </span>
        <span>Tài khoản</span>
      </Link>
    );
  }

  return (
    <section className="w-full select-none" aria-labelledby="mobile-account-title">
      <h1 id="mobile-account-title" className="mb-4 flex items-center gap-2 text-xl font-black text-zinc-100">
        <User size={21} className="text-pink-500" />
        <span>Tài khoản</span>
      </h1>

      <div className="rounded-2xl border border-white/[0.08] bg-[#14151b] p-4 shadow-lg shadow-black/20">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full border border-zinc-700 bg-zinc-900">
            {user.avatar ? (
              <img src={user.avatar} alt={user.displayName} className="h-full w-full object-cover avatar-smooth" referrerPolicy="no-referrer" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-pink-500"><User size={22} /></div>
            )}
          </div>
          <div className="min-w-0 flex-1 text-left">
            <p className="truncate text-sm font-extrabold text-white">{user.displayName}</p>
            <p className="mt-0.5 truncate text-[11px] text-zinc-500">{user.email}</p>
          </div>
          <a href="#thong-tin-tai-khoan" className="shrink-0 rounded-xl border border-pink-500/25 bg-pink-500/10 px-3 py-2 text-[11px] font-extrabold text-pink-400">
            Hồ sơ
          </a>
        </div>
      </div>

      <nav aria-label="Lối tắt tài khoản" className="mt-4 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111217]">
        {menuItems.filter((item) => item.href !== "/user/account").slice().reverse().map((item) => (
          <Link key={item.href} href={item.href} className="flex min-h-[3.25rem] items-center gap-3 border-b border-white/[0.06] px-4 py-3 text-sm font-bold text-zinc-200 transition-colors last:border-b-0 active:bg-white/[0.05]">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.04] text-zinc-400">{item.icon(false)}</span>
            <span className="flex-1 text-left">
              {item.href === "/user/history" ? "Đang xem" : item.href === "/user/watchlist" ? "Danh sách phim của tôi" : item.label}
            </span>
            <ChevronRight size={17} className="text-zinc-600" />
          </Link>
        ))}
        <button type="button" onClick={onLogout} className="flex min-h-[3.25rem] w-full items-center gap-3 px-4 py-3 text-sm font-bold text-red-400 transition-colors active:bg-red-500/[0.06]">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-red-500/[0.06]"><LogOut size={18} /></span>
          <span className="flex-1 text-left">Đăng xuất</span>
          <ChevronRight size={17} className="text-red-500/40" />
        </button>
      </nav>
    </section>
  );
}
