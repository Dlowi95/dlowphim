"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard,
  Film,
  Users,
  MessageSquare,
  Image as ImageIcon,
  AlertTriangle,
  Bell,
  Home,
  Settings,
  Clapperboard,
  Sword,
} from "lucide-react";

interface AdminSidebarProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
  reportsCount: number;
  movieReportsCount?: number;
  unreadNotificationsCount?: number;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

const NAV_ITEMS = [
  { id: "dashboard", label: "Tổng quan", icon: LayoutDashboard },
  { id: "movies", label: "Quản lý Phim", icon: Film },
  { id: "users", label: "Người dùng", icon: Users },
  { id: "comments", label: "Bình luận & Báo xấu", icon: MessageSquare, countKey: "reports" },
  { id: "banners", label: "Banner", icon: ImageIcon },
  { id: "tokusatsu", label: "🦾 Tokusatsu", icon: Sword },
  { id: "reports", label: "Báo cáo lỗi", icon: AlertTriangle, countKey: "movieReports" },
  { id: "notifications", label: "Thông báo", icon: Bell, countKey: "notifications" },
];

export default function AdminSidebar({
  activeTab,
  setActiveTab,
  reportsCount,
  movieReportsCount = 0,
  unreadNotificationsCount = 0,
  sidebarOpen,
  setSidebarOpen,
}: AdminSidebarProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);

  const getCount = (countKey?: string) => {
    if (!countKey) return 0;
    if (countKey === "reports") return reportsCount;
    if (countKey === "movieReports") return movieReportsCount;
    if (countKey === "notifications") return unreadNotificationsCount;
    return 0;
  };

  const avatarUrl = user?.avatar;
  const initials = user?.displayName
    ? user.displayName.slice(0, 2).toUpperCase()
    : "AD";

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
        />
      )}

      <aside
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
        className={`
          fixed inset-y-0 left-0 z-50 flex flex-col
          bg-[#09090f]/95 backdrop-blur-xl
          border-r border-white/[0.04]
          transition-all duration-300 ease-in-out
          shadow-[4px_0_40px_rgba(0,0,0,0.6)]
          lg:relative lg:translate-x-0
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          ${expanded ? "w-[220px]" : "w-[68px]"}
        `}
      >
        {/* Top: Logo */}
        <div className="h-16 flex items-center gap-3 px-[18px] border-b border-white/[0.04] select-none shrink-0 overflow-hidden">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-pink-500 via-rose-500 to-red-600 flex items-center justify-center shadow-lg shadow-pink-500/30 shrink-0">
            <Clapperboard size={15} className="text-white" />
          </div>
          <div
            className={`flex flex-col leading-tight transition-all duration-200 overflow-hidden whitespace-nowrap ${
              expanded ? "opacity-100 max-w-[160px]" : "opacity-0 max-w-0"
            }`}
          >
            <span className="text-sm font-black text-white tracking-tight">DlowPhim</span>
            <span className="text-[9px] font-black text-pink-500 uppercase tracking-[0.2em]">Admin Portal</span>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-3 flex flex-col gap-1 px-2 overflow-hidden">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const count = getCount(item.countKey);

            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setSidebarOpen(false);
                }}
                title={!expanded ? item.label : undefined}
                className={`
                  relative w-full flex items-center gap-3 px-[11px] py-2.5 rounded-xl
                  font-bold text-[12.5px] transition-all duration-200 cursor-pointer border-none
                  overflow-hidden whitespace-nowrap
                  ${isActive
                    ? "bg-pink-500/15 text-pink-400 shadow-[inset_0_0_0_1px_rgba(236,72,153,0.25)]"
                    : "text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04]"
                  }
                `}
              >
                {/* Active indicator bar */}
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.8)]" />
                )}

                <Icon size={16} className={`shrink-0 ${isActive ? "text-pink-400" : ""}`} />

                <span
                  className={`transition-all duration-200 flex-1 text-left ${
                    expanded ? "opacity-100" : "opacity-0 w-0"
                  }`}
                >
                  {item.label}
                </span>

                {/* Count badge */}
                {count > 0 && (
                  <span
                    className={`shrink-0 min-w-[17px] h-[17px] rounded-full bg-red-500 text-white text-[8px] font-black flex items-center justify-center px-1 shadow-[0_0_8px_rgba(239,68,68,0.5)] transition-all ${
                      expanded ? "opacity-100" : "opacity-0"
                    }`}
                  >
                    {count}
                  </span>
                )}
                {count > 0 && !expanded && (
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)]" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Divider */}
        <div className="mx-3 h-px bg-white/[0.04]" />

        {/* Bottom: User profile with inline actions */}
        <div className="py-3 px-2">
          <div className="flex items-center gap-2 px-[11px] py-2.5 rounded-xl bg-white/[0.025] overflow-hidden whitespace-nowrap">
            {/* Avatar */}
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={user?.displayName || "Admin"}
                className="w-7 h-7 rounded-full object-cover shrink-0 ring-2 ring-pink-500/40"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-[10px] font-black text-white shrink-0 ring-2 ring-pink-500/30">
                {initials}
              </div>
            )}

            {/* Name + role (visible when expanded) */}
            <div
              className={`flex flex-col leading-tight transition-all duration-200 flex-1 min-w-0 ${
                expanded ? "opacity-100 max-w-[120px]" : "opacity-0 max-w-0"
              }`}
            >
              <span className="text-[11px] font-bold text-zinc-200 truncate">{user?.displayName || "Admin"}</span>
              <span className="text-[9px] font-black text-pink-500 uppercase tracking-widest">Super Admin</span>
            </div>

            {/* Action icons (visible when expanded) */}
            {expanded && (
              <div className="flex items-center gap-1 ml-auto shrink-0">
                <button
                  onClick={() => { setActiveTab("settings"); setSidebarOpen(false); }}
                  title="Cài đặt"
                  className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all cursor-pointer border-none ${
                    activeTab === "settings"
                      ? "bg-pink-500/20 text-pink-400"
                      : "bg-white/[0.04] text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.07]"
                  }`}
                >
                  <Settings size={12} />
                </button>
                <button
                  onClick={() => router.push("/")}
                  title="Về trang chủ"
                  className="w-6 h-6 rounded-lg bg-white/[0.04] text-zinc-500 hover:text-blue-400 hover:bg-blue-500/[0.08] flex items-center justify-center transition-all cursor-pointer border-none"
                >
                  <Home size={12} />
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
