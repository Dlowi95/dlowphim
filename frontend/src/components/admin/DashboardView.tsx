"use client";

import React, { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Database,
  Eye,
  Film,
  Gauge,
  MessageSquare,
  Radio,
  RefreshCw,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  Users,
  WifiOff,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "@/context/AuthContext";
import { hasAdminPermission, type AdminPermission } from "@/utils/adminPermissions";

type TabId =
  | "dashboard"
  | "comments"
  | "movies"
  | "users"
  | "banners"
  | "reports"
  | "playback"
  | "notifications"
  | "settings";

type SourceStatus = "healthy" | "degraded" | "offline";
type PlaybackStatus = "healthy" | "degraded" | "blocked";

export interface DashboardStats {
  generatedAt: string;
  totals: {
    users: number;
    views: number;
    comments: number;
    activeReports: number;
  };
  trends: Record<"users" | "views" | "comments", {
    percent: number;
    current: number;
    previous: number;
  }>;
  chartData: Array<{ month: string; LuotXem: number; BinhLuan: number }>;
  moderationQueue: {
    total: number;
    commentReports: number;
    movieReports: number;
    latestMovieReports: Array<{
      _id: string;
      movieName?: string;
      movieSlug?: string;
      episodeName?: string;
      errorType?: string;
      createdAt?: string;
    }>;
  };
  movieSources: Array<{
    id: string;
    name: string;
    domain: string;
    active: boolean;
    status: SourceStatus;
    latencyMs: number | null;
    statusCode: number | null;
    checkedAt: string;
  }>;
  playbackHealth: {
    summary: {
      activeOrigins: number;
      healthyOrigins: number;
      degradedOrigins: number;
      blockedOrigins: number;
      totalStarts: number;
      totalFailures: number;
      totalBuffers: number;
    };
    problems: Array<{
      origin: string;
      status: PlaybackStatus;
      failureRate: number;
      failures: number;
      buffers: number;
      averageStartupMs: number;
      averageBufferMs: number;
      uniqueFailureReporters: number;
      lastSeenAt: number;
    }>;
  };
  systemStatus: {
    api: boolean;
    database: boolean;
    socket: boolean;
    socketClients: number;
  };
}

interface DashboardViewProps {
  stats: DashboardStats | null;
  loading: boolean;
  setActiveTab?: (tab: TabId) => void;
  onRefresh?: () => void;
}

const sourceMeta: Record<SourceStatus, { label: string; color: string; dot: string }> = {
  healthy: { label: "Ổn định", color: "text-emerald-400", dot: "bg-emerald-400" },
  degraded: { label: "Phản hồi chậm", color: "text-amber-400", dot: "bg-amber-400" },
  offline: { label: "Mất kết nối", color: "text-red-400", dot: "bg-red-400" },
};

const playbackMeta: Record<PlaybackStatus, { label: string; className: string }> = {
  healthy: { label: "Ổn định", className: "bg-emerald-500/10 text-emerald-400" },
  degraded: { label: "Suy giảm", className: "bg-amber-500/10 text-amber-400" },
  blocked: { label: "Tạm chặn", className: "bg-red-500/10 text-red-400" },
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/[0.07] bg-[#0e0f16]/95 px-3 py-2.5 shadow-2xl backdrop-blur-xl">
      <p className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-zinc-400">{label}</p>
      {payload.map((item: any) => (
        <div key={item.name} className="flex items-center gap-2 text-[11px] font-bold">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
          <span className="text-zinc-400">{item.name}:</span>
          <span className="text-white">{item.value?.toLocaleString("vi-VN")}</span>
        </div>
      ))}
    </div>
  );
};

export default function DashboardView({ stats, loading, setActiveTab, onRefresh }: DashboardViewProps) {
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (loading) {
    return (
      <div className="animate-pulse space-y-5">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-[108px] rounded-2xl bg-white/[0.03]" />
          ))}
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="h-72 rounded-2xl bg-white/[0.03] lg:col-span-2" />
          <div className="h-72 rounded-2xl bg-white/[0.03]" />
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 rounded-2xl border border-red-500/10 bg-red-500/[0.025] px-6 text-center">
        <AlertTriangle size={30} className="text-red-400" />
        <div>
          <h3 className="text-sm font-black text-zinc-200">Không tải được dữ liệu tổng quan</h3>
          <p className="mt-1 text-xs font-medium text-zinc-500">Kiểm tra kết nối backend rồi thử tải lại.</p>
        </div>
        <button type="button" onClick={onRefresh} className="mt-1 h-9 rounded-xl border border-pink-500/20 bg-pink-500/10 px-4 text-xs font-black text-pink-400 transition-colors hover:bg-pink-500/15">
          Thử lại
        </button>
      </div>
    );
  }

  const trendInfo = (key: "users" | "views" | "comments") => {
    const trend = stats.trends[key];
    return {
      label: `${trend.percent > 0 ? "+" : ""}${trend.percent.toLocaleString("vi-VN")}% so với 30 ngày trước`,
      positive: trend.percent >= 0,
    };
  };

  const cards: Array<{ title: string; value: number; icon: typeof Users; accent: string; trend: ReturnType<typeof trendInfo>; tab: TabId; permission: AdminPermission }> = [
    { title: "Người dùng", value: stats.totals.users, icon: Users, accent: "#3b82f6", trend: trendInfo("users"), tab: "users", permission: "users.read" },
    { title: "Phim đang xem dở", value: stats.totals.views, icon: Eye, accent: "#ec4899", trend: trendInfo("views"), tab: "movies", permission: "movies.manage" },
    { title: "Bình luận", value: stats.totals.comments, icon: MessageSquare, accent: "#8b5cf6", trend: trendInfo("comments"), tab: "comments", permission: "comments.moderate" },
    {
      title: "Việc chờ xử lý",
      value: stats.moderationQueue.total,
      icon: ShieldAlert,
      accent: "#f59e0b",
      trend: { label: stats.moderationQueue.total ? "Cần quản trị viên kiểm tra" : "Không còn việc tồn đọng", positive: stats.moderationQueue.total === 0 },
      tab: "reports",
      permission: "reports.manage",
    },
  ];

  const systemItems = [
    { label: "Database", ok: stats.systemStatus.database, icon: Database },
    { label: `Socket · ${stats.systemStatus.socketClients}`, ok: stats.systemStatus.socket, icon: Radio },
  ];

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div className="flex items-center justify-end gap-2 text-[10px] font-bold text-zinc-600">
        <Clock3 size={11} />
        <span>Cập nhật lúc {new Date(stats.generatedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</span>
        <button type="button" onClick={onRefresh} aria-label="Làm mới tổng quan" className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.05] bg-white/[0.025] transition-colors hover:bg-white/[0.06] hover:text-zinc-300">
          <RefreshCw size={12} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.filter((card) => hasAdminPermission(user?.role, card.permission)).map((card) => {
          const Icon = card.icon;
          const TrendIcon = card.trend.positive ? TrendingUp : TrendingDown;
          return (
            <button key={card.title} type="button" onClick={() => setActiveTab?.(card.tab)} className="group relative overflow-hidden rounded-2xl border border-white/[0.05] bg-white/[0.025] p-4 text-left transition-all hover:border-white/[0.1]">
              <div className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-xl" style={{ backgroundColor: `${card.accent}18`, color: card.accent }}>
                <Icon size={15} />
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{card.title}</p>
              <p className="mt-2 text-2xl font-black tracking-tight text-zinc-100">{card.value.toLocaleString("vi-VN")}</p>
              <div className="mt-2 flex items-center gap-1.5">
                <TrendIcon size={10} className={card.trend.positive ? "text-emerald-500" : "text-red-400"} />
                <span className={`text-[10px] font-bold ${card.trend.positive ? "text-emerald-500" : "text-red-400"}`}>{card.trend.label}</span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {mounted && (
          <section className="space-y-4 rounded-2xl border border-white/[0.05] bg-white/[0.025] p-5 lg:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Activity size={13} className="text-pink-500" />
                  <h2 className="text-[11px] font-black uppercase tracking-wider text-zinc-300">Hoạt động người xem</h2>
                </div>
                <p className="ml-5 mt-0.5 text-[10px] text-zinc-600">Lịch sử xem dở và bình luận trong 6 tháng</p>
              </div>
              <div className="flex gap-3 text-[9px] font-bold uppercase tracking-widest text-zinc-500">
                <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-pink-500" />Xem dở</span>
                <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-violet-500" />Bình luận</span>
              </div>
            </div>
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="dashboardViews" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ec4899" stopOpacity={0.22} /><stop offset="95%" stopColor="#ec4899" stopOpacity={0} /></linearGradient>
                    <linearGradient id="dashboardComments" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2} /><stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} /></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="month" fontSize={9} tickLine={false} axisLine={false} tick={{ fill: "#4b5563", fontWeight: 700 }} />
                  <YAxis fontSize={9} tickLine={false} axisLine={false} tick={{ fill: "#4b5563", fontWeight: 700 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="LuotXem" stroke="#ec4899" strokeWidth={2} fill="url(#dashboardViews)" name="Xem dở" dot={false} />
                  <Area type="monotone" dataKey="BinhLuan" stroke="#8b5cf6" strokeWidth={2} fill="url(#dashboardComments)" name="Bình luận" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-white/[0.05] bg-white/[0.025] p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gauge size={14} className="text-cyan-400" />
              <h2 className="text-[11px] font-black uppercase tracking-wider text-zinc-300">Nguồn dữ liệu phim</h2>
            </div>
            {hasAdminPermission(user?.role, "settings.manage") && <button type="button" onClick={() => setActiveTab?.("settings")} className="text-[9px] font-black uppercase tracking-widest text-zinc-600 transition-colors hover:text-pink-400">Cấu hình</button>}
          </div>
          <div className="space-y-2.5">
            {stats.movieSources.map((source) => {
              const meta = sourceMeta[source.status];
              return (
                <div key={source.id} className="rounded-xl border border-white/[0.05] bg-white/[0.025] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                        <p className="truncate text-[11px] font-black text-zinc-200">
                          {source.id === "phimapi" ? "PhimAPI" : source.id === "ophim" ? "OPhim" : source.name}
                        </p>
                        {source.active && <span className="rounded-full bg-pink-500/10 px-1.5 py-0.5 text-[7px] font-black uppercase text-pink-400">Mặc định</span>}
                      </div>
                      <p className="mt-1 truncate pl-4 text-[9px] text-zinc-600">{source.domain}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`text-[9px] font-black ${meta.color}`}>{meta.label}</p>
                      <p className="mt-1 text-[9px] font-bold text-zinc-600">{source.latencyMs === null ? "Timeout" : `${source.latencyMs} ms`}</p>
                    </div>
                  </div>
                </div>
              );
            })}
            {!stats.movieSources.length && <p className="py-6 text-center text-[10px] font-bold text-zinc-600">Chưa cấu hình nguồn phim</p>}
          </div>
          <div className="mt-4 flex flex-wrap gap-2 border-t border-white/[0.05] pt-3">
            {systemItems.map((item) => {
              const Icon = item.icon;
              return <span key={item.label} className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-[8px] font-black ${item.ok ? "bg-emerald-500/[0.07] text-emerald-500" : "bg-red-500/[0.08] text-red-400"}`}><Icon size={9} />{item.label}</span>;
            })}
          </div>
        </section>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {(hasAdminPermission(user?.role, "comments.moderate") || hasAdminPermission(user?.role, "reports.manage")) && <section className="rounded-2xl border border-white/[0.05] bg-white/[0.025] p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert size={14} className="text-amber-400" />
              <div>
                <h2 className="text-[11px] font-black uppercase tracking-wider text-zinc-300">Hàng chờ quản trị</h2>
                <p className="mt-0.5 text-[9px] text-zinc-600">Chỉ hiển thị những việc chưa xử lý</p>
              </div>
            </div>
            <span className="rounded-full bg-amber-500/10 px-2 py-1 text-[9px] font-black text-amber-400">{stats.moderationQueue.total} việc</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {hasAdminPermission(user?.role, "comments.moderate") && <button type="button" onClick={() => setActiveTab?.("comments")} className="rounded-xl border border-white/[0.05] bg-white/[0.025] p-3 text-left transition-colors hover:bg-white/[0.05]">
              <MessageSquare size={14} className="text-violet-400" />
              <p className="mt-3 text-xl font-black text-zinc-100">{stats.moderationQueue.commentReports}</p>
              <p className="mt-0.5 text-[9px] font-bold text-zinc-500">Bình luận bị báo xấu</p>
            </button>}
            {hasAdminPermission(user?.role, "reports.manage") && <button type="button" onClick={() => setActiveTab?.("reports")} className="rounded-xl border border-white/[0.05] bg-white/[0.025] p-3 text-left transition-colors hover:bg-white/[0.05]">
              <Film size={14} className="text-amber-400" />
              <p className="mt-3 text-xl font-black text-zinc-100">{stats.moderationQueue.movieReports}</p>
              <p className="mt-0.5 text-[9px] font-bold text-zinc-500">Báo lỗi phim</p>
            </button>}
          </div>
          {hasAdminPermission(user?.role, "reports.manage") && stats.moderationQueue.latestMovieReports.length > 0 && (
            <div className="mt-3 space-y-1.5 border-t border-white/[0.05] pt-3">
              {stats.moderationQueue.latestMovieReports.slice(0, 3).map((report) => (
                <button key={report._id} type="button" onClick={() => setActiveTab?.("reports")} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/[0.035]">
                  <AlertTriangle size={11} className="shrink-0 text-amber-500" />
                  <span className="min-w-0 flex-1 truncate text-[10px] font-bold text-zinc-400">{report.movieName || report.movieSlug} · {report.episodeName}</span>
                  <ArrowRight size={10} className="text-zinc-700" />
                </button>
              ))}
            </div>
          )}
        </section>}

        {hasAdminPermission(user?.role, "playback.read") && <section className="rounded-2xl border border-white/[0.05] bg-white/[0.025] p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <WifiOff size={14} className="text-red-400" />
              <div>
                <h2 className="text-[11px] font-black uppercase tracking-wider text-zinc-300">Lỗi nguồn phát gần đây</h2>
                <p className="mt-0.5 text-[9px] text-zinc-600">Tổng hợp từ HLS và buffering của người xem</p>
              </div>
            </div>
            <button type="button" onClick={() => setActiveTab?.("playback")} className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-zinc-600 transition-colors hover:text-pink-400">Chi tiết <ArrowRight size={9} /></button>
          </div>
          <div className="mb-3 grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-white/[0.025] p-2 text-center"><p className="text-sm font-black text-zinc-200">{stats.playbackHealth.summary.activeOrigins}</p><p className="text-[8px] font-bold text-zinc-600">Nguồn hoạt động</p></div>
            <div className="rounded-lg bg-amber-500/[0.05] p-2 text-center"><p className="text-sm font-black text-amber-400">{stats.playbackHealth.summary.degradedOrigins}</p><p className="text-[8px] font-bold text-zinc-600">Suy giảm</p></div>
            <div className="rounded-lg bg-red-500/[0.05] p-2 text-center"><p className="text-sm font-black text-red-400">{stats.playbackHealth.summary.blockedOrigins}</p><p className="text-[8px] font-bold text-zinc-600">Tạm chặn</p></div>
          </div>
          <div className="space-y-2">
            {stats.playbackHealth.problems.length ? stats.playbackHealth.problems.map((problem) => {
              const meta = playbackMeta[problem.status];
              return (
                <div key={problem.origin} className="flex items-center gap-3 rounded-xl border border-white/[0.04] bg-white/[0.02] px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[10px] font-black text-zinc-300">{problem.origin}</p>
                    <p className="mt-1 text-[9px] font-medium text-zinc-600">Lỗi {problem.failureRate}% · {problem.buffers} lần buffering · {problem.uniqueFailureReporters} người báo</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-1 text-[8px] font-black ${meta.className}`}>{meta.label}</span>
                </div>
              );
            }) : (
              <div className="flex flex-col items-center gap-2 py-5 text-[10px] font-bold text-zinc-600">
                <CheckCircle2 size={20} className="text-emerald-600" />
                Chưa ghi nhận nguồn phát bất ổn
              </div>
            )}
          </div>
        </section>}
      </div>
    </div>
  );
}
