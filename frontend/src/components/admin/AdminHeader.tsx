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
  movieReports?: any[];
}

export default function AdminHeader({
  activeTab,
  setSidebarOpen,
  reportsCount,
  setActiveTab,
  reports = [],
  movieReports = [],
}: AdminHeaderProps) {
  const { showToast } = useAuth();
  const [showNotif, setShowNotif] = useState(false);

  // Filter pending (unresolved) movie reports
  const activeMovieReports = movieReports.filter((r) => r.status === "pending");

  // Merge and sort reports by creation date descending
  const notificationsList = [
    ...reports.map((r) => ({
      id: r.id || r._id,
      type: "comment_report",
      title: `${r.reporter?.name || "Thành viên"} báo xấu bình luận`,
      subtitle: `Lý do: ${r.reason}`,
      content: `"${r.comment?.content || ""}"`,
      createdAt: r.createdAt,
      targetTab: "comments",
    })),
    ...activeMovieReports.map((r) => {
      const getErrorLabel = (t: string) => {
        if (t === "video_broken") return "Link hỏng / Không phát được";
        if (t === "audio_issue") return "Lỗi âm thanh";
        if (t === "subtitle_issue") return "Lỗi phụ đề";
        return "Lỗi khác";
      };
      return {
        id: r._id,
        type: "movie_report",
        title: `Báo lỗi phim: ${r.movieName}`,
        subtitle: `Sự cố: ${getErrorLabel(r.errorType)} (${r.episodeName})`,
        content: r.description ? `"${r.description}"` : "Không có ghi chú chi tiết",
        createdAt: r.createdAt,
        targetTab: "reports",
      };
    }),
  ].sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const totalUnresolvedCount = reports.length + activeMovieReports.length;

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
          {totalUnresolvedCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full bg-red-500 text-[8px] font-black text-white px-1 flex items-center justify-center shadow-[0_0_8px_rgba(239,68,68,0.7)] animate-pulse border border-[#0d0e13]">
              {totalUnresolvedCount}
            </span>
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
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Thông báo hệ thống</span>
                  {totalUnresolvedCount > 0 && (
                    <span className="bg-red-500/10 text-red-400 font-extrabold text-[9px] px-2 py-0.5 rounded">
                      {totalUnresolvedCount} mới
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-2 max-h-[320px] overflow-y-auto pr-1 custom-scrollbar">
                  {notificationsList.length > 0 ? (
                    <>
                      {notificationsList.slice(0, 5).map((notif) => (
                        <div
                          key={notif.id}
                          onClick={() => {
                            setActiveTab(notif.targetTab);
                            setShowNotif(false);
                          }}
                          className={`p-2.5 rounded-xl border cursor-pointer flex gap-2.5 items-start text-left transition-all ${
                            notif.type === "comment_report"
                              ? "bg-red-500/5 hover:bg-red-500/10 border-red-500/10 hover:border-red-500/20"
                              : "bg-amber-500/5 hover:bg-amber-500/10 border-amber-500/10 hover:border-amber-500/20"
                          }`}
                        >
                          {notif.type === "comment_report" ? (
                            <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />
                          ) : (
                            <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
                          )}
                          <div className="space-y-1 flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] font-extrabold text-zinc-200 truncate">
                                {notif.title}
                              </span>
                              <span className="text-[8px] font-bold text-zinc-550 shrink-0">
                                {notif.createdAt
                                  ? new Date(notif.createdAt).toLocaleDateString("vi-VN", {
                                      day: "numeric",
                                      month: "numeric",
                                    })
                                  : ""}
                              </span>
                            </div>
                            <p className={`text-[9px] font-extrabold uppercase tracking-wider ${
                              notif.type === "comment_report" ? "text-pink-500" : "text-amber-500"
                            }`}>
                              {notif.subtitle}
                            </p>
                            <p className="text-[10px] text-zinc-400 leading-normal italic line-clamp-2 bg-zinc-950/60 px-2 py-1.5 rounded border border-zinc-900/40">
                              {notif.content}
                            </p>
                          </div>
                        </div>
                      ))}

                      {notificationsList.length > 5 && (
                        <div className="flex gap-2 pt-1 border-t border-zinc-900/60">
                          {reports.length > 0 && (
                            <button
                              onClick={() => {
                                setActiveTab("comments");
                                setShowNotif(false);
                              }}
                              className="flex-1 py-1.5 rounded-xl bg-zinc-900/40 hover:bg-zinc-900 border border-zinc-900 hover:border-zinc-800 text-[8px] font-extrabold text-zinc-400 hover:text-white uppercase tracking-wider transition-all cursor-pointer text-center"
                            >
                              Bình luận ({reports.length})
                            </button>
                          )}
                          {activeMovieReports.length > 0 && (
                            <button
                              onClick={() => {
                                setActiveTab("reports");
                                setShowNotif(false);
                              }}
                              className="flex-1 py-1.5 rounded-xl bg-zinc-900/40 hover:bg-zinc-900 border border-zinc-900 hover:border-zinc-800 text-[8px] font-extrabold text-zinc-400 hover:text-white uppercase tracking-wider transition-all cursor-pointer text-center"
                            >
                              Báo lỗi ({activeMovieReports.length})
                            </button>
                          )}
                        </div>
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
