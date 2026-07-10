"use client";

import React, { useState, useEffect } from "react";
import {
  Film, Users, MessageSquare, AlertTriangle, TrendingUp, TrendingDown,
  Loader2, Activity, Eye, ArrowRight, Zap, ShieldAlert, UserPlus,
  Clock, BarChart3, CheckCircle2, Circle,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import Cookies from "js-cookie";

type TabId = "dashboard" | "comments" | "movies" | "users" | "banners" | "reports" | "notifications" | "settings";

interface DashboardViewProps {
  stats: {
    totalUsers: number;
    totalComments: number;
    activeReports: number;
    totalViews: number;
    chartData: Array<{ month: string; LuotXem: number; BinhLuan: number }>;
  } | null;
  loading: boolean;
  setActiveTab?: (tab: TabId) => void;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#0e0f16]/95 backdrop-blur-xl border border-white/[0.07] rounded-xl px-3 py-2.5 shadow-2xl">
        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1.5">{label}</p>
        {payload.map((p: any, i: number) => (
          <div key={i} className="flex items-center gap-2 text-[11px] font-bold">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="text-zinc-400">{p.name}:</span>
            <span className="text-white">{p.value?.toLocaleString("vi-VN")}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function DashboardView({ stats, loading, setActiveTab }: DashboardViewProps) {
  const [mounted, setMounted] = useState(false);
  const [recentUsers, setRecentUsers] = useState<any[]>([]);
  const [recentReports, setRecentReports] = useState<any[]>([]);
  const [loadingExtra, setLoadingExtra] = useState(false);
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const fetchExtra = async () => {
      setLoadingExtra(true);
      try {
        const token = Cookies.get("token");
        const headers = { Authorization: `Bearer ${token}` };

        const [usersRes, reportsRes] = await Promise.allSettled([
          fetch(`${API_URL}/users/admin/list?limit=5`, { headers }),
          fetch(`${API_URL}/movie-reports/admin?limit=5`, { headers }),
        ]);

        if (usersRes.status === "fulfilled" && usersRes.value.ok) {
          const data = await usersRes.value.json();
          setRecentUsers((data.items || data || []).slice(0, 5));
        }
        if (reportsRes.status === "fulfilled" && reportsRes.value.ok) {
          const data = await reportsRes.value.json();
          setRecentReports((data || []).slice(0, 5));
        }
      } catch (e) {
        console.error("Lỗi fetch dashboard extra:", e);
      } finally {
        setLoadingExtra(false);
      }
    };
    fetchExtra();
  }, []);

  if (loading || !stats) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[100px] rounded-2xl bg-white/[0.03]" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 rounded-2xl bg-white/[0.03] h-72" />
          <div className="rounded-2xl bg-white/[0.03] h-72" />
        </div>
      </div>
    );
  }

  const statItems: { title: string; value: any; change: string; positive: boolean; icon: any; accent: string; glow: string; tab: TabId }[] = [
    {
      title: "Người dùng",
      value: stats.totalUsers.toLocaleString("vi-VN"),
      change: "+4.1%",
      positive: true,
      icon: Users,
      accent: "#3b82f6",
      glow: "rgba(59,130,246,0.12)",
      tab: "users",
    },
    {
      title: "Lượt xem",
      value: stats.totalViews.toLocaleString("vi-VN"),
      change: "+22.4%",
      positive: true,
      icon: Eye,
      accent: "#ec4899",
      glow: "rgba(236,72,153,0.12)",
      tab: "movies",
    },
    {
      title: "Bình luận",
      value: stats.totalComments.toLocaleString("vi-VN"),
      change: "+15.6%",
      positive: true,
      icon: MessageSquare,
      accent: "#8b5cf6",
      glow: "rgba(139,92,246,0.12)",
      tab: "comments",
    },
    {
      title: "Báo cáo",
      value: stats.activeReports,
      change: stats.activeReports > 0 ? `${stats.activeReports} chờ xử lý` : "Không có",
      positive: stats.activeReports === 0,
      icon: AlertTriangle,
      accent: "#f59e0b",
      glow: "rgba(245,158,11,0.12)",
      tab: "reports",
    },
  ];

  const quickActions: { label: string; icon: any; color: string; tab: TabId }[] = [
    { label: "Thêm phim mới", icon: Film, color: "#ec4899", tab: "movies" },
    { label: "Duyệt báo cáo", icon: ShieldAlert, color: "#f59e0b", tab: "reports" },
    { label: "Quản lý user", icon: UserPlus, color: "#3b82f6", tab: "users" },
    { label: "Xem bình luận", icon: MessageSquare, color: "#8b5cf6", tab: "comments" },
  ];

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statItems.map((stat, idx) => {
          const Icon = stat.icon;
          const Trend = stat.positive ? TrendingUp : TrendingDown;
          return (
            <button
              key={idx}
              onClick={() => stat.tab && setActiveTab?.(stat.tab)}
              className="relative group p-4 rounded-2xl bg-white/[0.025] border border-white/[0.05] hover:border-white/[0.09] transition-all duration-300 overflow-hidden text-left cursor-pointer"
              style={{ boxShadow: `0 0 0 1px ${stat.glow}` }}
            >
              <div
                className="absolute top-3 right-3 w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${stat.accent}18`, color: stat.accent }}
              >
                <Icon size={15} />
              </div>
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{ background: `radial-gradient(ellipse at 80% 0%, ${stat.glow} 0%, transparent 60%)` }}
              />
              <div className="space-y-2 relative">
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{stat.title}</p>
                <p className="text-2xl font-black tracking-tight text-zinc-100">{stat.value}</p>
                <div className="flex items-center gap-1.5">
                  <Trend size={10} style={{ color: stat.positive ? "#10b981" : "#f87171" }} />
                  <span className="text-[10px] font-bold" style={{ color: stat.positive ? "#10b981" : "#f87171" }}>
                    {stat.change}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Row 2: Chart + Quick Actions ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Chart (2 cols) */}
        {mounted && (
          <div className="lg:col-span-2 p-5 rounded-2xl bg-white/[0.025] border border-white/[0.05] space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Activity size={13} className="text-pink-500" />
                  <h4 className="text-[11px] font-black text-zinc-300 uppercase tracking-wider">
                    Tương tác & Lượt xem
                  </h4>
                </div>
                <p className="text-[10px] text-zinc-600 mt-0.5 ml-5">6 tháng gần nhất</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-pink-500" />
                  <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Lượt xem</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-violet-500" />
                  <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Bình luận</span>
                </div>
              </div>
            </div>
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="glv" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ec4899" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gbl" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="month" stroke="#374151" fontSize={9} tickLine={false} axisLine={false} tick={{ fill: "#4b5563", fontWeight: "700" }} />
                  <YAxis stroke="#374151" fontSize={9} tickLine={false} axisLine={false} tick={{ fill: "#4b5563", fontWeight: "700" }} />
                  <Tooltip content={<CustomTooltip />} cursor={{ stroke: "rgba(255,255,255,0.06)", strokeWidth: 1 }} />
                  <Area type="monotone" dataKey="LuotXem" stroke="#ec4899" strokeWidth={2} fillOpacity={1} fill="url(#glv)" name="Lượt xem" dot={false} activeDot={{ r: 4, fill: "#ec4899", strokeWidth: 0 }} />
                  <Area type="monotone" dataKey="BinhLuan" stroke="#8b5cf6" strokeWidth={2} fillOpacity={1} fill="url(#gbl)" name="Bình luận" dot={false} activeDot={{ r: 4, fill: "#8b5cf6", strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="p-5 rounded-2xl bg-white/[0.025] border border-white/[0.05] space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Zap size={13} className="text-yellow-400" />
            <h4 className="text-[11px] font-black text-zinc-300 uppercase tracking-wider">Truy cập nhanh</h4>
          </div>
          <div className="space-y-2">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.tab}
                  onClick={() => setActiveTab?.(action.tab)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.04] hover:border-white/[0.08] transition-all cursor-pointer group text-left"
                >
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${action.color}18`, color: action.color }}
                  >
                    <Icon size={13} />
                  </div>
                  <span className="text-[12px] font-bold text-zinc-400 group-hover:text-zinc-200 transition-colors flex-1">
                    {action.label}
                  </span>
                  <ArrowRight size={11} className="text-zinc-700 group-hover:text-zinc-400 transition-colors" />
                </button>
              );
            })}
          </div>

          {/* System Status */}
          <div className="mt-3 pt-3 border-t border-white/[0.04] space-y-2">
            <div className="flex items-center gap-1.5 mb-2">
              <BarChart3 size={11} className="text-zinc-500" />
              <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Trạng thái hệ thống</span>
            </div>
            {[
              { label: "API Server", ok: true },
              { label: "Database", ok: true },
              { label: "Socket.io", ok: true },
            ].map((s) => (
              <div key={s.label} className="flex items-center justify-between">
                <span className="text-[10px] text-zinc-500 font-bold">{s.label}</span>
                <div className="flex items-center gap-1">
                  {s.ok ? (
                    <CheckCircle2 size={11} className="text-emerald-500" />
                  ) : (
                    <Circle size={11} className="text-red-500" />
                  )}
                  <span className={`text-[9px] font-black ${s.ok ? "text-emerald-500" : "text-red-500"}`}>
                    {s.ok ? "Online" : "Offline"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Row 3: Recent Users + Recent Reports ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent users */}
        <div className="p-5 rounded-2xl bg-white/[0.025] border border-white/[0.05] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserPlus size={13} className="text-blue-400" />
              <h4 className="text-[11px] font-black text-zinc-300 uppercase tracking-wider">Người dùng mới</h4>
            </div>
            <button
              onClick={() => setActiveTab?.("users")}
              className="text-[9px] font-black text-zinc-500 hover:text-pink-400 uppercase tracking-widest flex items-center gap-1 border-none bg-transparent cursor-pointer transition-colors"
            >
              Xem tất cả <ArrowRight size={9} />
            </button>
          </div>
          <div className="space-y-2">
            {loadingExtra ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-9 rounded-xl bg-white/[0.03] animate-pulse" />
              ))
            ) : recentUsers.length > 0 ? (
              recentUsers.map((u, i) => (
                <div key={u._id || i} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                  {u.avatar ? (
                    <img src={u.avatar} alt={u.displayName} className="w-7 h-7 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-[10px] font-black text-white shrink-0">
                      {(u.displayName || u.email || "U")[0].toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-zinc-300 truncate">{u.displayName || "—"}</p>
                    <p className="text-[9px] text-zinc-600 truncate">{u.email}</p>
                  </div>
                  <span className="text-[9px] font-bold text-zinc-700 shrink-0">
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString("vi-VN", { day: "numeric", month: "numeric" }) : ""}
                  </span>
                </div>
              ))
            ) : (
              <div className="py-6 text-center text-[10px] text-zinc-600 font-bold">Chưa có dữ liệu</div>
            )}
          </div>
        </div>

        {/* Recent reports */}
        <div className="p-5 rounded-2xl bg-white/[0.025] border border-white/[0.05] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle size={13} className="text-amber-400" />
              <h4 className="text-[11px] font-black text-zinc-300 uppercase tracking-wider">Báo cáo lỗi phim</h4>
            </div>
            <button
              onClick={() => setActiveTab?.("reports")}
              className="text-[9px] font-black text-zinc-500 hover:text-pink-400 uppercase tracking-widest flex items-center gap-1 border-none bg-transparent cursor-pointer transition-colors"
            >
              Xem tất cả <ArrowRight size={9} />
            </button>
          </div>
          <div className="space-y-2">
            {loadingExtra ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-9 rounded-xl bg-white/[0.03] animate-pulse" />
              ))
            ) : recentReports.length > 0 ? (
              recentReports.map((r, i) => (
                <div key={r._id || i} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                  <div className="w-7 h-7 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                    <Film size={12} className="text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-zinc-300 truncate">{r.movieName || r.movieSlug || "—"}</p>
                    <p className="text-[9px] text-zinc-600 truncate capitalize">{r.errorType?.replace("_", " ") || r.episodeName || ""}</p>
                  </div>
                  <span
                    className={`text-[8px] font-black px-1.5 py-0.5 rounded-full shrink-0 ${
                      r.status === "pending"
                        ? "bg-amber-500/10 text-amber-400"
                        : r.status === "resolved"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-zinc-700/40 text-zinc-500"
                    }`}
                  >
                    {r.status === "pending" ? "Chờ" : r.status === "resolved" ? "Xong" : r.status || ""}
                  </span>
                </div>
              ))
            ) : (
              <div className="py-6 text-center text-[10px] text-zinc-600 font-bold flex flex-col items-center gap-2">
                <CheckCircle2 size={20} className="text-emerald-600" />
                Không có báo cáo chờ xử lý
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
