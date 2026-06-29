"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Search,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  Trash2,
  MessageSquare,
  X,
  FileText,
  UserCheck,
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
  allComments: any[];
  loadingAllComments: boolean;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  onRefresh: () => void;
  onDismiss: (reportId: string) => void;
  onDelete: (commentId: string) => void;
}

export default function CommentReportsView({
  reports,
  loadingReports,
  allComments,
  loadingAllComments,
  searchTerm,
  setSearchTerm,
  onRefresh,
  onDismiss,
  onDelete,
}: CommentReportsViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<"reports" | "all">("reports");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Filtered reports computed property
  const filteredReports = reports.filter((r) => {
    const q = searchTerm.toLowerCase();
    return (
      r.comment?.content?.toLowerCase().includes(q) ||
      r.comment?.author?.name?.toLowerCase().includes(q) ||
      r.reporter?.name?.toLowerCase().includes(q) ||
      r.reason?.toLowerCase().includes(q) ||
      r.comment?.movieSlug?.toLowerCase().includes(q)
    );
  });

  // Group comments by user on frontend
  const usersWithComments = React.useMemo(() => {
    const groups: {
      [key: string]: {
        userId: string;
        name: string;
        email: string;
        avatar: string;
        role: string;
        comments: any[];
      };
    } = {};

    for (const c of allComments) {
      const uId = c.userId || "anonymous";
      if (!groups[uId]) {
        groups[uId] = {
          userId: uId,
          name: c.author?.name || c.name || "Thành viên",
          email: c.author?.email || "",
          avatar: c.author?.avatar || c.avatar || "",
          role: c.role || "member",
          comments: [],
        };
      }
      groups[uId].comments.push(c);
    }

    return Object.values(groups).sort((a, b) => b.comments.length - a.comments.length);
  }, [allComments]);

  // Filtered commenters based on search term (name or email)
  const filteredCommenters = usersWithComments.filter((u) => {
    const q = searchTerm.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    );
  });

  const activeUser = usersWithComments.find((u) => u.userId === selectedUserId);
  const isLoading = activeSubTab === "reports" ? loadingReports : loadingAllComments;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Page controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="text-left">
          <h3 className="text-base md:text-lg font-black text-white tracking-tight">Quản lý Bình luận</h3>
          <p className="text-[10px] font-semibold text-zinc-500 mt-0.5">
            Kiểm duyệt bình luận vi phạm và giám sát toàn bộ nội dung thảo luận.
          </p>
        </div>

        <div className="flex gap-2 items-center">
          {/* Search bar */}
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={activeSubTab === "reports" ? "Tìm kiếm báo cáo..." : "Tìm người dùng, email..."}
              className="h-9 w-48 sm:w-60 bg-[#0d0e13] border border-zinc-900 rounded-xl px-3 pl-8 text-xs text-zinc-200 placeholder-zinc-650 focus:outline-none focus:border-pink-500/50"
            />
            <Search size={12} className="text-zinc-650 absolute top-1/2 left-3 -translate-y-1/2" />
          </div>

          {/* Reload button */}
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="w-9 h-9 rounded-xl bg-zinc-900/60 hover:bg-zinc-900 text-zinc-400 hover:text-white flex items-center justify-center transition-all cursor-pointer border-none disabled:opacity-50"
            title="Tải lại dữ liệu"
          >
            <RefreshCw size={13} className={isLoading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Tab selectors */}
      <div className="flex border-b border-zinc-900/60 gap-6 text-xs select-none">
        <button
          onClick={() => {
            setActiveSubTab("reports");
            setSearchTerm("");
          }}
          className={`pb-2.5 font-extrabold uppercase tracking-wider relative transition-all cursor-pointer bg-transparent border-none ${
            activeSubTab === "reports" ? "text-pink-500 font-black animate-fadeIn" : "text-zinc-400 hover:text-white"
          }`}
        >
          <span className="flex items-center gap-1.5">
            Báo cáo vi phạm
            {reports.length > 0 && (
              <span className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full shadow shadow-red-500/20 leading-none">
                {reports.length}
              </span>
            )}
          </span>
          {activeSubTab === "reports" && (
            <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-pink-500 rounded-full" />
          )}
        </button>

        <button
          onClick={() => {
            setActiveSubTab("all");
            setSearchTerm("");
          }}
          className={`pb-2.5 font-extrabold uppercase tracking-wider relative transition-all cursor-pointer bg-transparent border-none ${
            activeSubTab === "all" ? "text-pink-500 font-black animate-fadeIn" : "text-zinc-400 hover:text-white"
          }`}
        >
          <span className="flex items-center gap-1.5">
            Tất cả bình luận
            {usersWithComments.length > 0 && (
              <span className="bg-zinc-800 text-zinc-350 text-[9px] font-black px-1.5 py-0.2 rounded-full leading-none">
                {usersWithComments.length}
              </span>
            )}
          </span>
          {activeSubTab === "all" && (
            <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-pink-500 rounded-full" />
          )}
        </button>
      </div>

      {/* Main content body */}
      <div className="bg-[#0d0e13] border border-zinc-900 rounded-2xl overflow-hidden shadow-sm">
        {isLoading ? (
          // Skeleton Loader
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
        ) : activeSubTab === "reports" ? (
          // ─── TAB 1: REPORTS ───
          filteredReports.length === 0 ? (
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
            <div className="w-full">
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto w-full">
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
                        <td className="py-4 pl-4 max-w-xs md:max-w-md">
                          <div className="flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center shrink-0 font-bold text-xs text-zinc-300 select-none">
                              {report.comment.author?.name ? report.comment.author.name[0].toUpperCase() : "U"}
                            </div>
                            <div className="text-left space-y-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-zinc-200 truncate">{report.comment.author?.name}</span>
                                <span className="text-[9px] text-zinc-550 font-bold tabular-nums">({report.comment.time})</span>
                              </div>
                              <p className="text-zinc-400 leading-relaxed font-medium break-words text-[11px] sm:text-xs">
                                {report.comment.content}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="py-4">
                          <div className="flex flex-col text-left">
                            <span className="font-bold text-zinc-350">{report.reporter?.name}</span>
                            <span className="text-[10px] text-zinc-500 tabular-nums">{report.reporter?.email || "Google Member"}</span>
                          </div>
                        </td>

                        <td className="py-4">
                          <span className="inline-flex items-center gap-1 bg-red-500/5 text-red-400 border border-red-500/10 font-bold text-[9px] px-2 py-0.5 rounded-md">
                            <ShieldAlert size={10} />
                            {report.reason}
                          </span>
                        </td>

                        <td className="py-4 font-bold text-zinc-300 max-w-[120px] truncate">
                          {report.comment.movieSlug}
                        </td>

                        <td className="py-4 pr-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => onDismiss(report.id)}
                              className="px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white font-extrabold text-[10px] rounded-lg transition-colors cursor-pointer border-none"
                            >
                              Bỏ qua
                            </button>
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

              {/* Mobile Stack Cards */}
              <div className="block md:hidden divide-y divide-zinc-900/40">
                {filteredReports.map((report) => (
                  <div key={report.id} className="p-4 space-y-3.5 text-left">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex gap-2.5 items-center">
                        <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center shrink-0 font-bold text-xs text-zinc-300 select-none">
                          {report.comment.author?.name ? report.comment.author.name[0].toUpperCase() : "U"}
                        </div>
                        <div className="text-left space-y-0.5">
                          <h4 className="font-bold text-xs text-zinc-200">{report.comment.author?.name}</h4>
                          <p className="text-[9px] text-zinc-550 tabular-nums">{report.comment.time}</p>
                        </div>
                      </div>
                      <span className="text-[9px] bg-zinc-900 text-zinc-450 font-bold px-2 py-0.5 rounded border border-zinc-800/80 truncate max-w-[120px]" title={report.comment.movieSlug}>
                        Phim: {report.comment.movieSlug}
                      </span>
                    </div>

                    <p className="text-zinc-350 text-[11px] leading-relaxed bg-[#07070a] border border-zinc-900/60 p-2.5 rounded-xl font-medium break-words">
                      {report.comment.content}
                    </p>

                    <div className="text-[10px] text-zinc-500 bg-zinc-950/20 p-2 rounded-lg space-y-0.5">
                      <div className="flex justify-between">
                        <span>Người báo:</span>
                        <span className="font-bold text-zinc-400">{report.reporter?.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Email báo:</span>
                        <span className="font-medium text-zinc-400">{report.reporter?.email || "Google Member"}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-zinc-900/30">
                      <span className="inline-flex items-center gap-1 bg-red-500/5 text-red-400 border border-red-500/10 font-bold text-[9px] px-2 py-0.5 rounded-md">
                        <ShieldAlert size={10} />
                        {report.reason}
                      </span>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => onDismiss(report.id)}
                          className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white font-extrabold text-[10px] rounded-lg transition-colors cursor-pointer border-none"
                        >
                          Bỏ qua
                        </button>
                        <button
                          onClick={() => onDelete(report.comment.id)}
                          className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 font-extrabold text-[10px] rounded-lg transition-colors cursor-pointer border-none flex items-center gap-1"
                        >
                          <Trash2 size={11} /> Xóa
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        ) : (
          // ─── TAB 2: USER GROUPS ───
          filteredCommenters.length === 0 ? (
            <div className="p-16 text-center flex flex-col items-center justify-center gap-3.5 select-none">
              <div className="w-14 h-14 rounded-full bg-pink-500/5 border border-pink-500/10 flex items-center justify-center text-pink-400">
                <MessageSquare size={28} />
              </div>
              <div className="space-y-1">
                <h4 className="font-extrabold text-xs text-zinc-300">Không tìm thấy người dùng nào có bình luận</h4>
                <p className="text-[10px] text-zinc-500 max-w-sm">
                  Chưa có bình luận nào trên hệ thống hoặc từ khóa tìm kiếm của bạn không khớp.
                </p>
              </div>
            </div>
          ) : (
            <div className="w-full">
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto w-full">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-900/80 text-[10px] font-black text-zinc-550 uppercase select-none">
                      <th className="py-3.5 pl-4">Người dùng</th>
                      <th className="py-3.5">Email</th>
                      <th className="py-3.5">Vai trò</th>
                      <th className="py-3.5">Tổng số bình luận</th>
                      <th className="py-3.5 pr-4 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900/40">
                    {filteredCommenters.map((u) => (
                      <tr key={u.userId} className="hover:bg-zinc-900/10 transition-colors">
                        <td className="py-4 pl-4 font-bold text-zinc-200">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center shrink-0 font-bold text-xs text-zinc-300 select-none">
                              {u.name ? u.name[0].toUpperCase() : "U"}
                            </div>
                            <span>{u.name}</span>
                          </div>
                        </td>

                        <td className="py-4 text-zinc-400 font-medium">{u.email || "Google Member"}</td>

                        <td className="py-4">
                          <span
                            className={`inline-flex font-black text-[9px] uppercase tracking-wider px-2 py-0.5 rounded ${
                              u.role === "admin"
                                ? "bg-pink-500/10 text-pink-400 border border-pink-500/20"
                                : u.role === "vip"
                                ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                                : "bg-zinc-800 text-zinc-400"
                            }`}
                          >
                            {u.role === "admin" ? "Quản trị" : u.role === "vip" ? "Vip" : "Thành viên"}
                          </span>
                        </td>

                        <td className="py-4 font-extrabold text-zinc-300 pl-6 tabular-nums">{u.comments.length}</td>

                        <td className="py-4 pr-4 text-right">
                          <button
                            onClick={() => setSelectedUserId(u.userId)}
                            className="px-3 py-1.5 bg-[#1b1d2a] hover:bg-[#1b1d2a]/80 text-pink-400 font-extrabold text-[10px] rounded-lg transition-colors border-none cursor-pointer flex items-center gap-1.5 inline-flex"
                          >
                            <FileText size={11} /> Xem bình luận
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Stack Cards */}
              <div className="block md:hidden divide-y divide-zinc-900/40">
                {filteredCommenters.map((u) => (
                  <div key={u.userId} className="p-4 space-y-3.5 text-left">
                    <div className="flex justify-between items-center gap-2">
                      <div className="flex gap-2.5 items-center">
                        <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center shrink-0 font-bold text-xs text-zinc-300 select-none">
                          {u.name ? u.name[0].toUpperCase() : "U"}
                        </div>
                        <div className="text-left space-y-0.5">
                          <h4 className="font-bold text-xs text-zinc-200">{u.name}</h4>
                          <p className="text-[9px] text-zinc-550">{u.email || "Google Member"}</p>
                        </div>
                      </div>
                      <span
                        className={`inline-flex font-black text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded ${
                          u.role === "admin"
                            ? "bg-pink-500/10 text-pink-400 border border-pink-500/20"
                            : u.role === "vip"
                            ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                            : "bg-zinc-800 text-zinc-400"
                        }`}
                      >
                        {u.role === "admin" ? "Quản trị" : u.role === "vip" ? "Vip" : "Thành viên"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-zinc-900/30">
                      <span className="text-[10px] text-zinc-500 font-semibold">
                        Tổng số bình luận: <strong className="text-zinc-300 tabular-nums">{u.comments.length}</strong>
                      </span>

                      <button
                        onClick={() => setSelectedUserId(u.userId)}
                        className="px-3 py-1.5 bg-[#1b1d2a] hover:bg-[#1b1d2a]/80 text-pink-400 font-extrabold text-[10px] rounded-lg transition-colors border-none cursor-pointer flex items-center gap-1.5"
                      >
                        <FileText size={11} /> Xem bình luận
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        )}
      </div>

      {/* ─── OVERLAY MODAL: COMMENTS OF SELECTED USER ─── */}
      {activeUser && mounted && createPortal(
        <div
          onClick={() => setSelectedUserId(null)}
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-md px-4 animate-fadeIn cursor-default"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl bg-[#0c0d12] border border-zinc-900 shadow-2xl flex flex-col max-h-[85vh] animate-scaleUp text-left"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-900">
              <div className="flex gap-3 items-center">
                <div className="w-8 h-8 rounded-full bg-pink-500/5 border border-pink-500/10 flex items-center justify-center text-pink-400 shrink-0 font-extrabold text-xs select-none">
                  {activeUser.name ? activeUser.name[0].toUpperCase() : "U"}
                </div>
                <div>
                  <h4 className="font-extrabold text-xs text-zinc-150 flex items-center gap-1.5">
                    {activeUser.name}
                    <span className="bg-[#1b1d2a] text-zinc-400 text-[8px] font-black px-1.5 py-0.2 rounded uppercase leading-none">
                      {activeUser.role}
                    </span>
                  </h4>
                  <p className="text-[9px] text-zinc-550 font-semibold mt-0.5">
                    {activeUser.email || "Google Member"} — Tổng số: {activeUser.comments.length} bình luận
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedUserId(null)}
                className="p-1.5 hover:bg-zinc-900 text-zinc-400 hover:text-white rounded-lg transition-colors cursor-pointer border-none bg-transparent animate-fadeIn"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Scrollable container */}
            <div className="overflow-y-auto p-5 space-y-4 text-left flex-1 custom-scrollbar">
              {activeUser.comments.length === 0 ? (
                <div className="py-12 text-center text-zinc-500 text-xs font-bold">
                  Không còn bình luận nào.
                </div>
              ) : (
                activeUser.comments.map((c) => (
                  <div
                    key={c.id}
                    className="p-3.5 rounded-xl bg-[#13141d]/40 border border-zinc-900/70 hover:bg-[#13141d]/75 transition-colors space-y-2 flex flex-col justify-between"
                  >
                    <div className="flex justify-between items-start gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1 bg-[#13141d] border border-zinc-800/80 px-2 py-0.5 rounded text-zinc-400 font-semibold text-[9px] select-none">
                        Phim: {c.movieSlug}
                      </span>
                      <span className="text-[9px] text-zinc-550 font-bold tabular-nums">
                        Đăng lúc: {c.time}
                      </span>
                    </div>

                    <p className="text-zinc-300 text-xs font-medium leading-relaxed break-words pl-0.5">
                      {c.content}
                    </p>

                    <div className="flex items-center justify-between pt-1.5 border-t border-zinc-900/30">
                      <div className="flex gap-1.5">
                        {c.isSpoiler && (
                          <span className="bg-amber-500/10 text-amber-500 text-[8px] font-black px-1.5 py-0.2 rounded uppercase leading-none select-none">
                            Spoiler
                          </span>
                        )}
                        {c.episodeLabel && (
                          <span className="bg-[#1c2035]/40 text-zinc-450 text-[9px] font-semibold px-1.5 py-0.2 rounded leading-none select-none border border-transparent">
                            {c.episodeLabel}
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => onDelete(c.id)}
                        className="px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-500 font-extrabold text-[9px] rounded-md transition-colors cursor-pointer border-none flex items-center gap-1"
                      >
                        <Trash2 size={10} /> Xóa
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-zinc-900 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedUserId(null)}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-[11px] font-black rounded-lg transition-colors cursor-pointer border-none"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
