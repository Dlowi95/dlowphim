"use client";

import React from "react";
import {
  Search,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  Trash2,
} from "lucide-react";

interface ReportedComment {
  id: string;
  reason: string;
  createdAt: string;
  comment: {
    id: string;
    content: string;
    movieSlug: string;
    time: string;
    author: {
      id: string;
      name: string;
      email: string;
      avatar: string;
    };
  };
  reporter: {
    id: string;
    name: string;
    email: string;
    avatar: string;
  };
}

interface CommentReportsViewProps {
  reports: ReportedComment[];
  loadingReports: boolean;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  onRefresh: () => void;
  onDismiss: (reportId: string) => void;
  onDelete: (commentId: string) => void;
}

export default function CommentReportsView({
  reports,
  loadingReports,
  searchTerm,
  setSearchTerm,
  onRefresh,
  onDismiss,
  onDelete,
}: CommentReportsViewProps) {
  // Filtered reports computed property
  const filteredReports = reports.filter((r) => {
    const q = searchTerm.toLowerCase();
    return (
      r.comment.content.toLowerCase().includes(q) ||
      r.comment.author.name.toLowerCase().includes(q) ||
      r.reporter.name.toLowerCase().includes(q) ||
      r.reason.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Page controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="text-left">
          <h3 className="text-base md:text-lg font-black text-white tracking-tight">Quản lý Báo cáo Bình luận</h3>
          <p className="text-[10px] font-semibold text-zinc-500 mt-0.5">
            Kiểm duyệt nội dung bình luận bị báo xấu bởi người xem.
          </p>
        </div>

        <div className="flex gap-2 items-center">
          {/* Search reports */}
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm kiếm báo cáo..."
              className="h-9 w-48 sm:w-60 bg-[#0d0e13] border border-zinc-900 rounded-xl px-3 pl-8 text-xs text-zinc-200 placeholder-zinc-650 focus:outline-none focus:border-pink-500/50"
            />
            <Search size={12} className="text-zinc-650 absolute top-1/2 left-3 -translate-y-1/2" />
          </div>

          {/* Reload button */}
          <button
            onClick={onRefresh}
            disabled={loadingReports}
            className="w-9 h-9 rounded-xl bg-zinc-900/60 hover:bg-zinc-900 text-zinc-400 hover:text-white flex items-center justify-center transition-all cursor-pointer border-none disabled:opacity-50"
            title="Tải lại dữ liệu"
          >
            <RefreshCw size={13} className={loadingReports ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* List / Table of reports */}
      <div className="bg-[#0d0e13] border border-zinc-900 rounded-2xl overflow-hidden shadow-sm">
        {loadingReports ? (
          // Skeleton Loader Grid
          <div className="p-6 space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-4 p-4 rounded-xl border border-zinc-900 animate-pulse bg-zinc-900/20">
                <div className="w-10 h-10 rounded-full bg-zinc-800 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="w-24 h-3.5 bg-zinc-800 rounded" />
                  <div className="w-full h-3 bg-zinc-900/40 rounded" />
                  <div className="w-3/4 h-3 bg-zinc-900/40 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredReports.length === 0 ? (
          // Empty state
          <div className="p-16 text-center flex flex-col items-center justify-center gap-3.5 select-none">
            <div className="w-14 h-14 rounded-full bg-pink-500/5 border border-pink-500/10 flex items-center justify-center text-pink-400">
              <ShieldCheck size={28} />
            </div>
            <div className="space-y-1">
              <h4 className="font-extrabold text-xs text-zinc-300">Tuyệt vời, không có báo cáo vi phạm nào!</h4>
              <p className="text-[10px] text-zinc-500 max-w-sm">
                Hiện tại không có bình luận nào bị người dùng báo xấu hoặc các bộ lọc đã quét sạch.
              </p>
            </div>
          </div>
        ) : (
          // Table of reports
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-900/80 text-[10px] font-black text-zinc-550 uppercase select-none">
                  <th className="py-3.5 pl-4">Bình luận bị báo cáo</th>
                  <th className="py-3.5">Người báo cáo</th>
                  <th className="py-3.5">Lý do vi phạm</th>
                  <th className="py-3.5">Phim</th>
                  <th className="py-3.5 pr-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900/40">
                {filteredReports.map((report) => (
                  <tr key={report.id} className="hover:bg-zinc-900/10 transition-colors">
                    {/* Reported Comment Content */}
                    <td className="py-4 pl-4 max-w-xs md:max-w-md">
                      <div className="flex gap-3">
                        {/* Avatar */}
                        <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center shrink-0 font-bold text-xs text-zinc-300 select-none">
                          {report.comment.author.name ? report.comment.author.name[0].toUpperCase() : "U"}
                        </div>
                        <div className="text-left space-y-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-zinc-200 truncate">{report.comment.author.name}</span>
                            <span className="text-[9px] text-zinc-550 font-bold tabular-nums">({report.comment.time})</span>
                          </div>
                          <p className="text-zinc-400 leading-relaxed font-medium break-words text-[11px] sm:text-xs">
                            {report.comment.content}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Reporter */}
                    <td className="py-4">
                      <div className="flex flex-col text-left">
                        <span className="font-bold text-zinc-350">{report.reporter.name}</span>
                        <span className="text-[10px] text-zinc-500 tabular-nums">{report.reporter.email || "Google Member"}</span>
                      </div>
                    </td>

                    {/* Reason */}
                    <td className="py-4">
                      <span className="inline-flex items-center gap-1 bg-red-500/5 text-red-400 border border-red-500/10 font-bold text-[9px] px-2 py-0.5 rounded-md">
                        <ShieldAlert size={10} />
                        {report.reason}
                      </span>
                    </td>

                    {/* Movie */}
                    <td className="py-4 font-bold text-zinc-300 max-w-[120px] truncate">
                      {report.comment.movieSlug}
                    </td>

                    {/* Action Controls */}
                    <td className="py-4 pr-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Dismiss Report (Bỏ qua) */}
                        <button
                          onClick={() => onDismiss(report.id)}
                          className="px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white font-extrabold text-[10px] rounded-lg transition-colors cursor-pointer border-none"
                        >
                          Bỏ qua
                        </button>

                        {/* Delete Comment (Xóa bình luận) */}
                        <button
                          onClick={() => onDelete(report.comment.id)}
                          className="px-2.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 font-extrabold text-[10px] rounded-lg transition-colors cursor-pointer border-none flex items-center gap-1"
                        >
                          <Trash2 size={11} /> Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
