"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Heart, Plus, History, Bell, User, LogOut, Loader2, AlertCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";

export default function UserNotificationsPage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();

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
      <div className="min-h-[70vh] bg-black text-white flex flex-col items-center justify-center gap-4 px-6 text-center select-none">
        <AlertCircle size={56} className="text-zinc-650" />
        <h2 className="text-xl md:text-2xl font-black text-zinc-300">Vui lòng đăng nhập tài khoản</h2>
        <p className="text-sm text-zinc-500 max-w-sm">
          Đăng nhập tài khoản DlowPhim để xem hộp thư thông báo của bạn.
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

  return (
    <div className="min-h-screen bg-black text-white py-10 pt-28">
      <div className="container mx-auto px-6 max-w-7xl">
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          
          {/* SIDEBAR */}
          <div className="w-full lg:w-[280px] bg-[#12131b] border border-zinc-800/40 rounded-3xl p-6 flex flex-col justify-between shrink-0 select-none">
            <div className="space-y-6">
              <h3 className="text-lg font-black text-zinc-300 tracking-tight px-1 uppercase">
                Quản lý tài khoản
              </h3>
              
              <div className="flex flex-col gap-1">
                <Link
                  href="/user/favorite"
                  className="flex items-center gap-3.5 py-3 px-4 rounded-xl font-bold text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 border border-transparent transition-all"
                >
                  <Heart size={18} />
                  <span>Yêu thích</span>
                </Link>
                
                <Link
                  href="/user/watchlist"
                  className="flex items-center gap-3.5 py-3 px-4 rounded-xl font-bold text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 border border-transparent transition-all"
                >
                  <Plus size={18} />
                  <span>Danh sách</span>
                </Link>
                
                <Link
                  href="/user/history"
                  className="flex items-center gap-3.5 py-3 px-4 rounded-xl font-bold text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 border border-transparent transition-all"
                >
                  <History size={18} />
                  <span>Xem tiếp</span>
                </Link>
                
                <Link
                  href="/user/notifications"
                  className="flex items-center gap-3.5 py-3 px-4 rounded-xl font-bold text-sm bg-pink-500/10 border border-pink-500/15 text-pink-500 transition-all"
                >
                  <Bell size={18} className="text-pink-500 fill-pink-500" />
                  <span>Thông báo</span>
                </Link>
                
                <Link
                  href="/user/vip"
                  className="flex items-center gap-3.5 py-3 px-4 rounded-xl font-bold text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 border border-transparent transition-all"
                >
                  <div className="flex items-center justify-center w-[18px] h-[18px] text-[10px] font-black border border-zinc-500 rounded-md shrink-0">VIP</div>
                  <span>Nâng cấp VIP</span>
                </Link>
                
                <Link
                  href="/user/account"
                  className="flex items-center gap-3.5 py-3 px-4 rounded-xl font-bold text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 border border-transparent transition-all"
                >
                  <User size={18} />
                  <span>Tài khoản</span>
                </Link>
              </div>
            </div>

            <div className="border-t border-zinc-800/60 mt-8 pt-6 flex flex-col gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-full bg-[#da251d] flex items-center justify-center shrink-0 border border-[#da251d]/40 shadow-lg select-none">
                  {user.avatar ? (
                    <img 
                      src={user.avatar} 
                      alt={user.displayName}
                      className="w-full h-full rounded-full object-cover"
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
                  <p className="text-[11px] text-zinc-500 font-semibold truncate mt-0.5 leading-none">
                    {user.email}
                  </p>
                </div>
              </div>

              <button
                onClick={logout}
                className="w-full py-2.5 px-4 rounded-xl bg-zinc-900/60 hover:bg-red-500/10 text-zinc-400 hover:text-red-500 border border-zinc-850 hover:border-red-500/20 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all duration-200"
              >
                <LogOut size={14} />
                <span>Thoát</span>
              </button>
            </div>
          </div>

          {/* MAIN CONTENT AREA */}
          <div className="flex-1 w-full space-y-6">
            <div className="flex items-center justify-between border-b border-zinc-900 pb-3.5">
              <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight text-zinc-100 flex items-center gap-2.5">
                <Bell className="text-pink-500" size={24} />
                <span>Thông báo hệ thống</span>
              </h2>
            </div>

            <div className="bg-[#12131b]/30 border border-zinc-900 rounded-3xl py-20 px-8 flex flex-col items-center justify-center gap-3 select-none text-center">
              <Bell size={44} className="text-zinc-700" />
              <h4 className="text-base font-bold text-zinc-400">Không có thông báo mới</h4>
              <p className="text-xs text-zinc-500 max-w-xs">
                Bạn đã đọc hết tất cả các thông báo từ hệ thống DlowPhim.
              </p>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
