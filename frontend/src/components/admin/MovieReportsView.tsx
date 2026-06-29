"use client";

import React, { useState, useEffect } from "react";
import Cookies from "js-cookie";
import {
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Loader2,
  RefreshCw,
  Clock,
  Film,
  User,
  Info
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface MovieReport {
  _id: string;
  userId?: {
    _id: string;
    email: string;
    displayName: string;
  };
  movieSlug: string;
  movieName: string;
  episodeName: string;
  errorType: string;
  description?: string;
  status: string;
  createdAt: string;
}

export default function MovieReportsView() {
  const { showToast } = useAuth();
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

  const [reports, setReports] = useState<MovieReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "resolved">("pending");

  const fetchReports = async () => {
    setLoading(true);
    try {
      const token = Cookies.get("token");
      const res = await fetch(`${API_URL}/movie-reports/admin`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        setReports(await res.json());
      } else {
        showToast("Không thể tải danh sách báo cáo lỗi", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Lỗi kết nối máy chủ", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleUpdateStatus = async (id: string, status: "resolved" | "ignored") => {
    try {
      const token = Cookies.get("token");
      const res = await fetch(`${API_URL}/movie-reports/admin/${id}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        setReports((prev) =>
          prev.map((r) => (r._id === id ? { ...r, status } : r))
        );
        showToast(
          status === "resolved" ? "Đã đánh dấu đã khắc phục thành công" : "Đã bỏ qua báo cáo",
          "success"
        );
      } else {
        showToast("Thao tác thất bại", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Lỗi kết nối máy chủ", "error");
    }
  };

  const handleDeleteReport = async (id: string) => {
    try {
      const token = Cookies.get("token");
      const res = await fetch(`${API_URL}/movie-reports/admin/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        setReports((prev) => prev.filter((r) => r._id !== id));
        showToast("Xóa báo cáo lỗi thành công", "success");
      } else {
        showToast("Xóa báo cáo lỗi thất bại", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Lỗi kết nối máy chủ", "error");
    }
  };

  const getErrorTypeLabel = (type: string) => {
    switch (type) {
      case "video_broken":
        return "Link hỏng / Không xem được";
      case "audio_issue":
        return "Lỗi âm thanh";
      case "subtitle_issue":
        return "Lỗi phụ đề / Vietsub";
      default:
        return "Lỗi khác";
    }
  };

  const getErrorTypeStyle = (type: string) => {
    switch (type) {
      case "video_broken":
        return "bg-rose-500/10 text-rose-400 border border-rose-500/20";
      case "audio_issue":
        return "bg-amber-500/10 text-amber-400 border border-amber-500/20";
      case "subtitle_issue":
        return "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20";
      default:
        return "bg-zinc-800 text-zinc-400 border border-transparent";
    }
  };

  const filteredReports = reports.filter((r) => {
    if (statusFilter === "all") return true;
    return r.status === statusFilter;
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="text-left">
          <h3 className="text-base md:text-lg font-black text-white tracking-tight">Báo cáo lỗi phim</h3>
          <p className="text-[10px] font-semibold text-zinc-500 mt-0.5">
            Danh sách phản hồi từ người xem về các sự cố phát video, âm thanh hoặc phụ đề của phim.
          </p>
        </div>

        {/* Filters and Actions */}
        <div className="flex items-center gap-2 self-end">
          <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-900">
            {(["pending", "resolved", "all"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border-none cursor-pointer ${
                  statusFilter === tab
                    ? "bg-pink-500 text-white"
                    : "bg-transparent text-zinc-500 hover:text-zinc-350"
                }`}
              >
                {tab === "pending"
                  ? "Chờ xử lý"
                  : tab === "resolved"
                  ? "Đã khắc phục"
                  : "Tất cả"}
              </button>
            ))}
          </div>

          <button
            onClick={fetchReports}
            disabled={loading}
            className="w-9 h-9 rounded-xl bg-zinc-900/60 hover:bg-zinc-900 text-zinc-400 hover:text-white flex items-center justify-center transition-all cursor-pointer border-none disabled:opacity-50"
            title="Tải lại dữ liệu"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Reports Table Container */}
      <div className="bg-[#0d0e13] border border-zinc-900 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center flex flex-col items-center justify-center gap-3">
            <Loader2 className="animate-spin text-pink-500" size={24} />
            <span className="text-xs text-zinc-500 font-bold">Đang tải danh sách báo cáo...</span>
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="p-16 text-center flex flex-col items-center justify-center gap-3.5 select-none">
            <div className="w-14 h-14 rounded-full bg-emerald-500/5 border border-emerald-500/10 flex items-center justify-center text-emerald-400">
              <CheckCircle2 size={28} />
            </div>
            <div className="space-y-1">
              <h4 className="font-extrabold text-xs text-zinc-300">Không có báo cáo lỗi nào</h4>
              <p className="text-[10px] text-zinc-550 max-w-sm leading-normal">
                Tuyệt vời! Hiện tại không có sự cố phim nào được báo cáo hoặc mọi báo cáo đã được giải quyết.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-900/80 bg-zinc-950/40 text-[10px] font-black text-zinc-400 uppercase tracking-wider">
                  <th className="p-4 pl-5">Bộ phim / Tập</th>
                  <th className="p-4">Loại sự cố</th>
                  <th className="p-4 max-w-xs">Chi tiết sự cố</th>
                  <th className="p-4">Người báo cáo</th>
                  <th className="p-4">Thời gian</th>
                  <th className="p-4 text-center">Trạng thái</th>
                  <th className="p-4 pr-5 text-right">Tác vụ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900/60 text-xs">
                {filteredReports.map((report) => (
                  <tr
                    key={report._id}
                    className="hover:bg-zinc-900/10 transition-colors"
                  >
                    {/* Movie Info */}
                    <td className="p-4 pl-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-pink-500/5 border border-pink-500/10 flex items-center justify-center text-pink-400 shrink-0">
                          <Film size={14} />
                        </div>
                        <div className="min-w-0 text-left">
                          <p className="font-extrabold text-zinc-200 truncate max-w-[180px]">
                            {report.movieName}
                          </p>
                          <p className="text-[10px] font-bold text-zinc-500 mt-0.5">
                            Tập: <span className="text-zinc-400">{report.episodeName}</span>
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Error Type */}
                    <td className="p-4">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider ${getErrorTypeStyle(
                          report.errorType
                        )}`}
                      >
                        {getErrorTypeLabel(report.errorType)}
                      </span>
                    </td>

                    {/* Description */}
                    <td className="p-4 max-w-xs text-left">
                      {report.description ? (
                        <p className="text-[11px] text-zinc-300 font-medium leading-relaxed break-words" title={report.description}>
                          {report.description}
                        </p>
                      ) : (
                        <span className="text-[10px] text-zinc-650 italic">Không có ghi chú</span>
                      )}
                    </td>

                    {/* Submitter */}
                    <td className="p-4">
                      <div className="flex items-center gap-1.5 text-zinc-400">
                        <User size={12} className="text-zinc-550" />
                        <span className="text-[11px] font-bold truncate max-w-[120px]">
                          {report.userId?.displayName || report.userId?.email || "Khách ẩn danh"}
                        </span>
                      </div>
                    </td>

                    {/* Time */}
                    <td className="p-4">
                      <div className="flex items-center gap-1 text-zinc-500 text-[10px] font-semibold">
                        <Clock size={11} />
                        <span>{new Date(report.createdAt).toLocaleDateString("vi-VN")}</span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="p-4 text-center">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase ${
                          report.status === "pending"
                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            : report.status === "resolved"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-zinc-800 text-zinc-500"
                        }`}
                      >
                        {report.status === "pending"
                          ? "Đang chờ"
                          : report.status === "resolved"
                          ? "Đã sửa"
                          : "Đã ẩn"}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="p-4 pr-5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {report.status === "pending" && (
                          <button
                            onClick={() => handleUpdateStatus(report._id, "resolved")}
                            className="w-7 h-7 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 rounded-lg flex items-center justify-center transition-all cursor-pointer border-none"
                            title="Đã sửa xong"
                          >
                            <CheckCircle2 size={12} />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            if (window.confirm("Bạn có chắc chắn muốn xóa vĩnh viễn báo cáo lỗi này?")) {
                              handleDeleteReport(report._id);
                            }
                          }}
                          className="w-7 h-7 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-lg flex items-center justify-center transition-all cursor-pointer border-none"
                          title="Xóa báo cáo"
                        >
                          <Trash2 size={12} />
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
