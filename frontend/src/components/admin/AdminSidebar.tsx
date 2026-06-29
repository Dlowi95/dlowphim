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
  LogOut,
  Settings,
} from "lucide-react";

interface AdminSidebarProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
  reportsCount: number;
  movieReportsCount?: number;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export default function AdminSidebar({
  activeTab,
  setActiveTab,
  reportsCount,
  movieReportsCount = 0,
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
                  <span className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full select-none shadow shadow-red-500/20">
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Sidebar Footer */}
      <div className="p-4 border-t border-zinc-900 bg-[#0a0a0d]/60 space-y-3.5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-pink-500 to-rose-500 flex items-center justify-center font-black text-white text-sm select-none shadow">
            {user?.displayName ? user.displayName[0].toUpperCase() : "A"}
          </div>
          <div className="flex-1 text-left min-w-0">
            <h4 className="text-sm font-bold text-zinc-100 truncate">{user?.displayName || "Quản trị viên"}</h4>
            <p className="text-[11px] text-pink-500 font-extrabold truncate uppercase tracking-wider">Super Admin</p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => showToast("Cài đặt hệ thống đang phát triển", "warning")}
            className="flex-1 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-[11px] font-black rounded-lg transition-colors cursor-pointer border-none flex items-center justify-center gap-1.5"
          >
            <Settings size={13} /> Cài đặt
          </button>
          <button
            onClick={logout}
            className="px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 text-[11px] font-black rounded-lg transition-colors cursor-pointer border-none flex items-center justify-center"
            title="Đăng xuất"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}
