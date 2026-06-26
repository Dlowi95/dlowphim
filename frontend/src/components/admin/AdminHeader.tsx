"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Bell, Menu, AlertTriangle, ShieldCheck } from "lucide-react";

interface AdminHeaderProps {
  activeTab: string;
  setSidebarOpen: (open: boolean) => void;
  reportsCount: number;
  setActiveTab: (tab: any) => void;
  reports?: any[];
}

export default function AdminHeader({
  activeTab,
  setSidebarOpen,
  reportsCount,
  setActiveTab,
  reports = [],
}: AdminHeaderProps) {
  const { showToast } = useAuth();
  const [showNotif, setShowNotif] = useState(false);

  return (
    <header className="h-16 shrink-0 bg-[#0d0e13]/60 backdrop-blur-md border-b border-zinc-900 flex items-center justify-between px-6 sticky top-0 z-30 select-none">
      <div className="flex items-center gap-4">
        {/* Mobile menu trigger */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 -ml-2 rounded-lg bg-zinc-900 text-zinc-400 hover:text-white border-none cursor-pointer lg:hidden flex items-center justify-center"
        >
          <Menu size={18} />
        </button>

        {/* Path indicator */}
        <div className="hidden sm:flex items-center gap-2 text-[11px] font-extrabold text-zinc-500 uppercase tracking-widest">
          <span>Admin Portal</span>
          <span>/</span>
          <span className="text-pink-500">
            {activeTab === "dashboard"
              ? "Thống kê chung"
              : activeTab === "comments"
              ? "Bình luận & Báo xấu"
              : activeTab === "movies"
              ? "Quản lý Phim"
              : activeTab === "users"
              ? "Quản lý Người dùng"
              : activeTab === "banners"
              ? "Quản lý Banner"
              : "Báo cáo lỗi"}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Notifications badge */}
        <div className="relative">
          <button
            onClick={() => setShowNotif(!showNotif)}
            className={`w-9 h-9 rounded-xl bg-zinc-900/60 hover:bg-zinc-900 flex items-center justify-center transition-all cursor-pointer border-none ${
              showNotif ? "text-pink-500 bg-zinc-900" : "text-zinc-400"
            }`}
          >
            <Bell size={15} />
          </button>
          {reportsCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 animate-ping shadow" />
          )}

          {showNotif && (
            <>
              {/* Click outside overlay */}
              <div className="fixed inset-0 z-40 bg-transparent cursor-default" onClick={() => setShowNotif(false)} />

              {/* Dropdown panel */}
              <div
                className="absolute right-0 mt-2 w-[340px] bg-[#0d0e13] border rounded-2xl shadow-[0_0_25px_rgba(236,72,153,0.18)] p-3.5 z-50 flex flex-col gap-3.5 animate-fadeIn"
                style={{ borderColor: "rgba(236, 72, 153, 0.25)" }}
              >
                <div className="flex items-center justify-between pb-2 border-b border-zinc-900">
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Thông báo</span>
                  {reportsCount > 0 && (
                    <span className="bg-red-500/10 text-red-400 font-extrabold text-[9px] px-2 py-0.5 rounded">
                      {reportsCount} mới
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-2 max-h-[320px] overflow-y-auto pr-1">
                  {reports.length > 0 ? (
                    <>
                      {reports.slice(0, 5).map((report) => (
                        <div
                          key={report.id}
                          onClick={() => {
                            setActiveTab("comments");
                            setShowNotif(false);
                          }}
                          className="p-2.5 rounded-xl bg-red-500/5 hover:bg-red-500/10 border border-red-500/10 hover:border-red-500/20 cursor-pointer flex gap-2.5 items-start text-left transition-all"
                        >
                          <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />
                          <div className="space-y-1 flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] font-extrabold text-zinc-200 truncate">
                                {report.reporter?.name || "Thành viên"} báo xấu
                              </span>
                              <span className="text-[8px] font-bold text-zinc-550 shrink-0">
                                {report.createdAt
                                  ? new Date(report.createdAt).toLocaleDateString("vi-VN", {
                                      day: "numeric",
                                      month: "numeric",
                                    })
                                  : ""}
                              </span>
                            </div>
                            <p className="text-[9px] font-extrabold text-pink-500 uppercase tracking-wider">
                              Lý do: {report.reason}
                            </p>
                            <p className="text-[10px] text-zinc-400 leading-normal italic line-clamp-2 bg-zinc-950/60 px-2 py-1.5 rounded border border-zinc-900/40">
                              "{report.comment?.content || ""}"
                            </p>
                          </div>
                        </div>
                      ))}

                      {reports.length > 5 && (
                        <button
                          onClick={() => {
                            setActiveTab("comments");
                            setShowNotif(false);
                          }}
                          className="w-full py-2 mt-1 rounded-xl bg-zinc-900/40 hover:bg-zinc-900 border border-zinc-900 hover:border-zinc-800 text-[10px] font-extrabold text-zinc-400 hover:text-white uppercase tracking-wider transition-all cursor-pointer"
                        >
                          Xem thêm {reports.length - 5} báo cáo khác
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="py-8 flex flex-col items-center justify-center gap-2 text-zinc-550">
                      <ShieldCheck size={20} className="text-zinc-650" />
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-600">
                        Không có thông báo mới
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
