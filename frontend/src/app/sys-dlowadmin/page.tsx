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

  // Run on mount to populate sidebar badge
  useEffect(() => {
    fetchReports();
    fetchStats();
  }, []);

  // Automatically refresh reports list or stats when switching tabs
  useEffect(() => {
    if (activeTab === "comments") {
      fetchReports();
    } else if (activeTab === "dashboard") {
      fetchStats();
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
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              onRefresh={fetchReports}
              onDismiss={handleDismissReport}
              onDelete={handleDeleteComment}
            />
          )}

          {activeTab === "movies" && (
            <MoviesManagementView />
          )}

          {["users", "banners", "reports"].includes(activeTab) && (
            <PlaceholderView />
          )}
        </div>
      </div>
    </div>
  );
}
