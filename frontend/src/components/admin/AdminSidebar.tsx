"use client";

import React from "react";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard,
  Film,
  Users,
  MessageSquare,
  Image as ImageIcon,
  AlertTriangle,
  Bell,
  LogOut,
  Settings,
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

export default function AdminSidebar({
  activeTab,
  setActiveTab,
  reportsCount,
  movieReportsCount = 0,
  unreadNotificationsCount = 0,
  sidebarOpen,
  setSidebarOpen,
}: AdminSidebarProps) {
  const { user, logout, showToast } = useAuth();

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 w-[280px] bg-[#0d0e13] border-r border-zinc-900 flex flex-col justify-between transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:h-screen ${
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div>
        {/* Sidebar Header: Logo */}
        <div className="h-16 flex items-center gap-3.5 px-6 border-b border-zinc-900 select-none">
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-pink-500 to-rose-500 flex items-center justify-center font-black text-white text-lg shadow shadow-pink-500/30">
            D
          </div>
          <div className="flex flex-col text-left">
            <span className="text-base font-black text-white tracking-tight leading-none">DlowPhim</span>
            <span className="text-[10px] font-black text-pink-500 uppercase tracking-widest mt-1.5">Admin Portal</span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="p-4 space-y-1.5">
          {[
            { id: "dashboard", label: "Thống kê chung", icon: LayoutDashboard },
            { id: "movies", label: "Quản lý Phim", icon: Film },
            { id: "users", label: "Quản lý Người dùng", icon: Users },
            { id: "comments", label: "Bình luận & Báo xấu", icon: MessageSquare, count: reportsCount },
            { id: "banners", label: "Quản lý Banner", icon: ImageIcon },
            { id: "reports", label: "Báo cáo lỗi", icon: AlertTriangle, count: movieReportsCount },
            { id: "notifications", label: "Thông báo", icon: Bell, count: unreadNotificationsCount },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl font-extrabold text-[13px] transition-all cursor-pointer border-none ${
                  isActive
                    ? "bg-pink-500 text-white shadow-md shadow-pink-500/10"
                    : "bg-transparent text-zinc-400 hover:text-white hover:bg-zinc-900"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon size={18} />
                  <span>{item.label}</span>
                </div>
                {item.count !== undefined && item.count > 0 && (
                  <span className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full select-none shadow shadow-red-500/20 animate-pulse">
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Sidebar Footer */}
      <div className="p-4 border-t border-zinc-900 bg-[#0a0a0d]/60 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-pink-500 to-rose-500 flex items-center justify-center font-black text-white text-sm select-none shadow shrink-0">
            {user?.displayName ? user.displayName[0].toUpperCase() : "A"}
          </div>
          <div className="flex-grow text-left min-w-0">
            <h4 className="text-xs font-bold text-zinc-100 truncate leading-tight">{user?.displayName || "Quản trị viên"}</h4>
            <p className="text-[10px] text-pink-500 font-black truncate uppercase tracking-widest mt-1">Super Admin</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => {
              setActiveTab("settings");
              setSidebarOpen(false);
            }}
            className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer border-none ${
              activeTab === "settings"
                ? "bg-pink-500 text-white shadow-md shadow-pink-500/10"
                : "bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
            }`}
            title="Cài đặt hệ thống"
          >
            <Settings size={14} />
          </button>
          <button
            onClick={logout}
            className="w-8 h-8 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 flex items-center justify-center transition-colors cursor-pointer border-none"
            title="Đăng xuất"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}
