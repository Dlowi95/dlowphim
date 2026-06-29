"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import Cookies from "js-cookie";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";
import DashboardView from "@/components/admin/DashboardView";
import CommentReportsView from "@/components/admin/CommentReportsView";
import PlaceholderView from "@/components/admin/PlaceholderView";
import MoviesManagementView from "@/components/admin/MoviesManagementView";
import UsersManagementView from "@/components/admin/UsersManagementView";
import BannersManagementView from "@/components/admin/BannersManagementView";
import MovieReportsView from "@/components/admin/MovieReportsView";

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

export default function AdminDashboardPage() {
  const { showToast } = useAuth();
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

  // Tab state
  const [activeTab, setActiveTab] = useState<"dashboard" | "comments" | "movies" | "users" | "banners" | "reports">("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Reported comments state
  const [reports, setReports] = useState<ReportedComment[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // All comments state
  const [allComments, setAllComments] = useState<any[]>([]);
  const [loadingAllComments, setLoadingAllComments] = useState(false);

  // Real statistics states
  const [stats, setStats] = useState<{
    totalUsers: number;
    totalComments: number;
    activeReports: number;
    totalViews: number;
    chartData: Array<{ month: string; LuotXem: number; BinhLuan: number }>;
  } | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Fetch stats from backend
  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const token = Cookies.get("token");
      const res = await fetch(`${API_URL}/comments/admin/stats`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        setStats(await res.json());
      } else {
        showToast("Không thể tải số liệu thống kê", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Lỗi kết nối máy chủ", "error");
    } finally {
      setLoadingStats(false);
    }
  };

  // Fetch reported comments from API
  const fetchReports = async () => {
    setLoadingReports(true);
    try {
      const token = Cookies.get("token");
      const res = await fetch(`${API_URL}/comments/admin/reports`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        setReports(await res.json());
      } else {
        showToast("Không thể tải danh sách báo cáo vi phạm", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Lỗi kết nối máy chủ", "error");
    } finally {
      setLoadingReports(false);
    }
  };

  // Fetch all comments from API
  const fetchAllComments = async () => {
    setLoadingAllComments(true);
    try {
      const token = Cookies.get("token");
      const res = await fetch(`${API_URL}/comments/admin/all`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        setAllComments(await res.json());
      } else {
        showToast("Không thể tải danh sách tất cả bình luận", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Lỗi kết nối máy chủ", "error");
    } finally {
      setLoadingAllComments(false);
    }
  };

  // Movie reports state
  const [movieReports, setMovieReports] = useState<any[]>([]);
  const [loadingMovieReports, setLoadingMovieReports] = useState(false);

  const fetchMovieReports = async () => {
    setLoadingMovieReports(true);
    try {
      const token = Cookies.get("token");
      const res = await fetch(`${API_URL}/movie-reports/admin`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        setMovieReports(await res.json());
      }
    } catch (err) {
      console.error("Lỗi fetch movie reports:", err);
    } finally {
      setLoadingMovieReports(false);
    }
  };

  // Run on mount to populate sidebar badge
  useEffect(() => {
    fetchReports();
    fetchStats();
    fetchMovieReports();
  }, []);

  // Automatically refresh reports list or stats when switching tabs
  useEffect(() => {
    if (activeTab === "comments") {
      fetchReports();
      fetchAllComments();
    } else if (activeTab === "dashboard") {
      fetchStats();
    } else if (activeTab === "reports") {
      fetchMovieReports();
    }
  }, [activeTab]);

  // Handle dismiss (bỏ qua báo cáo)
  const handleDismissReport = async (reportId: string) => {
    try {
      const token = Cookies.get("token");
      const res = await fetch(`${API_URL}/comments/admin/reports/${reportId}/dismiss`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        setReports((prev) => prev.filter((r) => r.id !== reportId));
        showToast("Đã bỏ qua báo cáo vi phạm", "success");
      } else {
        const data = await res.json();
        showToast(data.message || "Thao tác thất bại", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Lỗi kết nối máy chủ", "error");
    }
  };

  // Handle delete comment (xóa bình luận và các báo cáo đi kèm)
  const handleDeleteComment = async (commentId: string) => {
    try {
      const token = Cookies.get("token");
      const res = await fetch(`${API_URL}/comments/${commentId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        setReports((prev) => prev.filter((r) => r.comment.id !== commentId));
        setAllComments((prev) => prev.filter((c) => c.id !== commentId && c.parentId !== commentId));
        showToast("Xóa bình luận vi phạm thành công", "success");
      } else {
        const data = await res.json();
        showToast(data.message || "Thao tác thất bại", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Lỗi kết nối máy chủ", "error");
    }
  };

  return (
    <div className="flex min-h-screen bg-[#07070a] text-zinc-100 font-sans">
      {/* ─── SIDEBAR ─── */}
      <AdminSidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        reportsCount={reports.length}
        movieReportsCount={movieReports.filter((r) => r.status === "pending").length}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />

      {/* Sidebar background overlay for mobile view */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden cursor-default"
        />
      )}

      {/* ─── MAIN PANEL ─── */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        <AdminHeader
          activeTab={activeTab}
          setSidebarOpen={setSidebarOpen}
          reportsCount={reports.length}
          setActiveTab={setActiveTab}
          reports={reports}
          movieReports={movieReports}
        />

        {/* ─── CONTENT TAB PANEL ─── */}
        <div className="flex-grow p-6">
          {activeTab === "dashboard" && (
            <DashboardView stats={stats} loading={loadingStats} />
          )}

          {activeTab === "comments" && (
            <CommentReportsView
              reports={reports}
              loadingReports={loadingReports}
              allComments={allComments}
              loadingAllComments={loadingAllComments}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              onRefresh={() => {
                fetchReports();
                fetchAllComments();
              }}
              onDismiss={handleDismissReport}
              onDelete={handleDeleteComment}
            />
          )}

          {activeTab === "movies" && (
            <MoviesManagementView />
          )}

          {activeTab === "users" && (
            <UsersManagementView />
          )}

          {activeTab === "banners" && (
            <BannersManagementView />
          )}

          {activeTab === "reports" && (
            <MovieReportsView />
          )}
        </div>
      </div>
    </div>
  );
}
