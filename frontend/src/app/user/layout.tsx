"use client";

import React, { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Heart, Plus, History, Bell, User, LogOut, Loader2, AlertCircle } from "lucide-react";

export default function UserLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout, refreshUser } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("dlowphim_open_auth"));
      }
    }
  }, [user, loading]);

  useEffect(() => {
    refreshUser();
  }, []);

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
    {
      href: "/user/account",
      label: "Tài khoản",
      icon: (isActive: boolean) => (
        <User size={18} className={isActive ? "text-pink-500" : ""} />
      ),
    },
  ];

  return (
    <div className="w-full bg-black text-white py-10 pt-28 flex-grow flex flex-col">
      <div className="container mx-auto px-6 max-w-7xl flex-grow flex flex-col">
        <div className="flex flex-col lg:flex-row gap-8 items-start flex-grow w-full">
          
          {/* SIDEBAR */}
          <div className="w-full lg:w-[280px] bg-[#12131b] border border-zinc-800/40 rounded-3xl p-6 flex flex-col justify-between shrink-0 select-none">
            <div className="space-y-6">
              <h3 className="text-lg font-black text-zinc-300 tracking-tight px-1 uppercase">
                Quản lý tài khoản
              </h3>
              
              <div className="flex flex-col gap-1">
                {menuItems.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3.5 py-3 px-4 rounded-xl font-bold text-sm transition-all ${
                        isActive
                          ? "bg-pink-500/10 border border-pink-500/20 text-pink-500 shadow-[0_0_12px_rgba(236,72,153,0.15)]"
                          : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 border border-transparent"
                      }`}
                    >
                      {item.icon(isActive)}
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Profile Avatar and Information */}
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
          <div className="flex-1 w-full">
            {children}
          </div>
          
        </div>
      </div>
    </div>
  );
}
