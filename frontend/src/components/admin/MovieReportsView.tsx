"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Cookies from "js-cookie";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Film,
  Loader2,
  RefreshCw,
  Search,
  Server,
  Trash2,
  User,
  XCircle,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useConfirmDialog } from "@/components/ConfirmDialog";

interface MovieReport {
  _id: string;
  userId?: { _id: string; email: string; displayName: string };
  movieSlug: string;
  movieName: string;
  episodeName: string;
  episodeSlug?: string;
  errorType: string;
  description?: string;
  status: "pending" | "resolved" | "ignored";
  createdAt: string;
  lastReportedAt?: string;
  occurrenceCount?: number;
  playbackType?: "hls" | "embed" | "unknown";
  serverName?: string;
  streamOrigin?: string;
  currentTime?: number;
  handledBy?: { displayName?: string };
  handledAt?: string;
}

type Counts = { pending: number; resolved: number; ignored: number; all: number };

interface MovieReportsViewProps {
  onPendingCountChange?: (count: number) => void;
}

const STATUS_TABS = [
  { value: "pending", label: "Chờ xử lý" },
  { value: "resolved", label: "Đã khắc phục" },
  { value: "ignored", label: "Đã bỏ qua" },
  { value: "all", label: "Tất cả" },
] as const;

export default function MovieReportsView({ onPendingCountChange }: MovieReportsViewProps) {
  const { showToast } = useAuth();
  const { confirm, confirmDialog } = useConfirmDialog();
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
  const [reports, setReports] = useState<MovieReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_TABS)[number]["value"]>("pending");
  const [errorTypeFilter, setErrorTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Counts>({ pending: 0, resolved: 0, ignored: 0, all: 0 });

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
        status: statusFilter,
        errorType: errorTypeFilter,
      });
      if (search.trim()) params.set("search", search.trim());
      const response = await fetch(`${API_URL}/movie-reports/admin?${params}`, {
        headers: { Authorization: `Bearer ${Cookies.get("token")}` },
      });
      if (!response.ok) throw new Error("Không thể tải báo cáo");

      const data = await response.json();
      const nextCounts = data.counts || { pending: 0, resolved: 0, ignored: 0, all: 0 };
      setReports(data.items || []);
      setTotalPages(Math.max(1, data.totalPages || 1));
      setTotal(data.total || 0);
      setCounts(nextCounts);
      onPendingCountChange?.(nextCounts.pending || 0);
    } catch (error) {
      console.error(error);
      showToast("Không thể tải danh sách báo cáo lỗi", "error");
    } finally {
      setLoading(false);
    }
  }, [API_URL, errorTypeFilter, onPendingCountChange, page, search, showToast, statusFilter]);

  useEffect(() => {
    const timer = window.setTimeout(fetchReports, search ? 300 : 0);
    return () => window.clearTimeout(timer);
  }, [fetchReports, search]);

  const handleUpdateStatus = async (id: string, status: "resolved" | "ignored") => {
    try {
      const response = await fetch(`${API_URL}/movie-reports/admin/${id}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Cookies.get("token")}`,
        },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error("Cập nhật thất bại");
      await fetchReports();
      showToast(status === "resolved" ? "Đã đánh dấu báo cáo là đã khắc phục" : "Đã bỏ qua báo cáo", "success");
    } catch (error) {
      console.error(error);
      showToast("Không thể cập nhật báo cáo", "error");
    }
  };

  const handleDeleteReport = async (id: string) => {
    try {
      const response = await fetch(`${API_URL}/movie-reports/admin/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${Cookies.get("token")}` },
      });
      if (!response.ok) throw new Error("Xóa thất bại");
      await fetchReports();
      showToast("Đã xóa báo cáo lỗi", "success");
    } catch (error) {
      console.error(error);
      showToast("Không thể xóa báo cáo lỗi", "error");
    }
  };

  const getErrorTypeLabel = (type: string) => ({
    video_broken: "Không phát được",
    audio_issue: "Lỗi âm thanh",
    subtitle_issue: "Lỗi phụ đề",
    other: "Lỗi khác",
  }[type] || "Lỗi khác");

  const getErrorTypeStyle = (type: string) => ({
    video_broken: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    audio_issue: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    subtitle_issue: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  }[type] || "bg-zinc-800 text-zinc-400 border-zinc-700");

  const formatPlaybackTime = (seconds?: number) => {
    if (!seconds || seconds < 1) return "";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return hours
      ? `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
      : `${minutes}:${String(secs).padStart(2, "0")}`;
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
        <div className="text-left">
          <h3 className="text-base md:text-lg font-black text-white tracking-tight">Báo cáo lỗi phim</h3>
          <p className="text-[10px] font-semibold text-zinc-500 mt-1">
            Theo dõi lỗi phát, nguồn xảy ra lỗi và số người gặp cùng sự cố.
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => { setStatusFilter(tab.value); setPage(1); }}
              className={`min-w-[94px] px-3 py-2 rounded-xl border text-left transition-all cursor-pointer ${
                statusFilter === tab.value
                  ? "bg-pink-500/15 border-pink-500/35 text-pink-300"
                  : "bg-[#0d0e13] border-zinc-900 text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <span className="block text-[9px] font-black uppercase tracking-wider">{tab.label}</span>
              <span className="block text-base font-black mt-0.5">{counts[tab.value]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-2">
        <label className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
          <input
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(1); }}
            placeholder="Tìm tên phim, slug, tập hoặc nội dung báo cáo..."
            className="w-full h-10 pl-9 pr-3 rounded-xl bg-[#0d0e13] border border-zinc-900 text-xs text-white outline-none focus:border-pink-500/40"
          />
        </label>
        <select
          value={errorTypeFilter}
          onChange={(event) => { setErrorTypeFilter(event.target.value); setPage(1); }}
          className="h-10 px-3 rounded-xl bg-[#0d0e13] border border-zinc-900 text-xs font-bold text-zinc-300 outline-none"
        >
          <option value="all">Tất cả loại lỗi</option>
          <option value="video_broken">Không phát được</option>
          <option value="audio_issue">Lỗi âm thanh</option>
          <option value="subtitle_issue">Lỗi phụ đề</option>
          <option value="other">Lỗi khác</option>
        </select>
        <button
          onClick={() => fetchReports()}
          disabled={loading}
          className="h-10 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 flex items-center justify-center gap-2 text-[10px] font-black uppercase border-none cursor-pointer disabled:opacity-50"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Làm mới
        </button>
      </div>

      <div className="bg-[#0d0e13] border border-zinc-900 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-14 flex flex-col items-center gap-3 text-zinc-500">
            <Loader2 className="animate-spin text-pink-500" size={24} />
            <span className="text-xs font-bold">Đang tải báo cáo...</span>
          </div>
        ) : reports.length === 0 ? (
          <div className="p-16 flex flex-col items-center gap-3 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-500/5 border border-emerald-500/10 flex items-center justify-center text-emerald-400">
              <CheckCircle2 size={28} />
            </div>
            <h4 className="font-extrabold text-xs text-zinc-300">Không có báo cáo phù hợp</h4>
            <p className="text-[10px] text-zinc-600">Thử đổi bộ lọc hoặc từ khóa tìm kiếm.</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-900/70">
            {reports.map((report) => (
              <article key={report._id} className="p-4 md:p-5 hover:bg-zinc-900/10 transition-colors">
                <div className="grid grid-cols-1 xl:grid-cols-[1.25fr_1fr_auto] gap-4">
                  <div className="flex gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-pink-500/5 border border-pink-500/10 flex items-center justify-center text-pink-400 shrink-0"><Film size={15} /></div>
                    <div className="min-w-0 text-left">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/watch/${report.movieSlug}?ep=${encodeURIComponent(report.episodeSlug || report.episodeName)}`} target="_blank" className="font-extrabold text-sm text-zinc-100 hover:text-pink-400 truncate">
                          {report.movieName} <ExternalLink size={11} className="inline ml-1" />
                        </Link>
                        {(report.occurrenceCount || 1) > 1 && (
                          <span className="px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-[9px] font-black text-rose-400">
                            {report.occurrenceCount} lần báo
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] font-bold text-zinc-500 mt-1">Tập: <span className="text-zinc-300">{report.episodeName}</span></p>
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        <span className={`px-2 py-1 rounded-md text-[8px] font-black uppercase border ${getErrorTypeStyle(report.errorType)}`}>{getErrorTypeLabel(report.errorType)}</span>
                        {report.playbackType && report.playbackType !== "unknown" && <span className="px-2 py-1 rounded-md bg-violet-500/10 border border-violet-500/20 text-[8px] font-black uppercase text-violet-300">{report.playbackType}</span>}
                        {formatPlaybackTime(report.currentTime) && <span className="px-2 py-1 rounded-md bg-zinc-900 text-[8px] font-black text-zinc-400">Tại {formatPlaybackTime(report.currentTime)}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="text-left space-y-2 min-w-0">
                    <p className="text-[11px] text-zinc-300 leading-relaxed break-words">{report.description || <span className="italic text-zinc-600">Không có ghi chú</span>}</p>
                    {(report.serverName || report.streamOrigin) && (
                      <div className="flex items-start gap-2 text-[10px] text-zinc-500">
                        <Server size={12} className="mt-0.5 shrink-0 text-cyan-500" />
                        <span className="break-all">{report.serverName || "Máy chủ không xác định"}{report.streamOrigin ? ` · ${report.streamOrigin}` : ""}</span>
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] font-semibold text-zinc-600">
                      <span className="flex items-center gap-1"><User size={10} />{report.userId?.displayName || report.userId?.email || "Khách ẩn danh"}</span>
                      <span className="flex items-center gap-1"><Clock size={10} />{new Date(report.lastReportedAt || report.createdAt).toLocaleString("vi-VN")}</span>
                    </div>
                  </div>

                  <div className="flex xl:flex-col items-center xl:items-end justify-between gap-3">
                    <span className={`px-2 py-1 rounded-md text-[8px] font-black uppercase border ${
                      report.status === "pending" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                      report.status === "resolved" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                      "bg-zinc-800 text-zinc-500 border-zinc-700"
                    }`}>
                      {report.status === "pending" ? "Đang chờ" : report.status === "resolved" ? "Đã sửa" : "Đã bỏ qua"}
                    </span>
                    <div className="flex gap-1.5">
                      {report.status === "pending" && (
                        <>
                          <button onClick={() => handleUpdateStatus(report._id, "resolved")} title="Đã khắc phục" className="w-8 h-8 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg flex items-center justify-center border-none cursor-pointer"><CheckCircle2 size={13} /></button>
                          <button onClick={() => handleUpdateStatus(report._id, "ignored")} title="Bỏ qua" className="w-8 h-8 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-lg flex items-center justify-center border-none cursor-pointer"><XCircle size={13} /></button>
                        </>
                      )}
                      <button
                        onClick={async () => {
                          const accepted = await confirm({ title: "Xóa báo cáo lỗi?", message: "Báo cáo này sẽ bị xóa vĩnh viễn và không thể khôi phục.", confirmLabel: "Xóa báo cáo" });
                          if (accepted) await handleDeleteReport(report._id);
                        }}
                        title="Xóa báo cáo"
                        className="w-8 h-8 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg flex items-center justify-center border-none cursor-pointer"
                      ><Trash2 size={13} /></button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {!loading && total > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[10px] font-bold text-zinc-500">
          <span>{total} báo cáo · Trang {page}/{totalPages}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1} className="h-9 px-3 rounded-lg bg-zinc-900 text-zinc-300 disabled:opacity-35 border-none cursor-pointer flex items-center gap-1"><ChevronLeft size={13} /> Trước</button>
            <button onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={page >= totalPages} className="h-9 px-3 rounded-lg bg-zinc-900 text-zinc-300 disabled:opacity-35 border-none cursor-pointer flex items-center gap-1">Sau <ChevronRight size={13} /></button>
          </div>
        </div>
      )}
      {confirmDialog}
    </div>
  );
}
