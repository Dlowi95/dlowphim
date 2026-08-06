"use client";

import { useCallback, useEffect, useState } from "react";
import Cookies from "js-cookie";
import { Activity, AlertTriangle, CheckCircle2, RefreshCw, Search, Server, ShieldX, Users } from "lucide-react";

interface OriginHealth {
  origin: string;
  status: "healthy" | "degraded" | "blocked";
  starts: number;
  successes: number;
  failures: number;
  buffers: number;
  failureRate: number;
  averageStartupMs: number;
  averageBufferMs: number;
  bufferRate: number;
  uniqueFailureReporters: number;
  lastFailureType: string;
  blockedUntil: number;
  lastSeenAt: number;
}

interface MovieSourceHealth {
  id: string;
  name: string;
  domain: string;
  active: boolean;
  status: "healthy" | "degraded" | "offline";
  latencyMs: number | null;
  statusCode: number | null;
  checkedAt: string;
}

interface HealthDashboard {
  generatedAt: number;
  storageScope: "shared" | "instance";
  windowMinutes: number;
  summary: {
    activeOrigins: number;
    healthyOrigins: number;
    degradedOrigins: number;
    blockedOrigins: number;
    totalStarts: number;
    totalFailures: number;
    totalBuffers: number;
  };
  origins: OriginHealth[];
}

const EMPTY: HealthDashboard = {
  generatedAt: 0,
  storageScope: "instance",
  windowMinutes: 30,
  summary: { activeOrigins: 0, healthyOrigins: 0, degradedOrigins: 0, blockedOrigins: 0, totalStarts: 0, totalFailures: 0, totalBuffers: 0 },
  origins: [],
};

const STATUS = {
  healthy: { label: "Ổn định", style: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400", icon: CheckCircle2 },
  degraded: { label: "Cần theo dõi", style: "border-amber-500/20 bg-amber-500/10 text-amber-400", icon: AlertTriangle },
  blocked: { label: "Đang tạm né", style: "border-red-500/20 bg-red-500/10 text-red-400", icon: ShieldX },
};

const formatDuration = (ms: number) => !ms ? "—" : ms >= 1000 ? `${(ms / 1000).toFixed(1)} giây` : `${ms} ms`;

export default function PlaybackHealthView() {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [movieSources, setMovieSources] = useState<MovieSourceHealth[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | OriginHealth["status"]>("all");

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${Cookies.get("token")}` };
      const [response, sourcesResponse] = await Promise.all([
        fetch(`${API_URL}/playback-health/admin`, { cache: "no-store", headers }),
        fetch(`${API_URL}/admin/dashboard/source-health`, { cache: "no-store", headers }),
      ]);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setData(await response.json());
      if (sourcesResponse.ok) setMovieSources(await sourcesResponse.json());
      setError("");
    } catch {
      setError("Không thể tải dữ liệu sức khỏe nguồn phát.");
    } finally {
      setLoading(false);
    }
  }, [API_URL]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh(true);
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const cards = [
    ["Nguồn hoạt động", data.summary.activeOrigins, Server, "text-sky-400 bg-sky-500/10"],
    ["Ổn định", data.summary.healthyOrigins, CheckCircle2, "text-emerald-400 bg-emerald-500/10"],
    ["Cần theo dõi", data.summary.degradedOrigins, AlertTriangle, "text-amber-400 bg-amber-500/10"],
    ["Đang tạm né", data.summary.blockedOrigins, ShieldX, "text-red-400 bg-red-500/10"],
  ] as const;
  const filteredOrigins = data.origins.filter((origin) => {
    const matchesStatus = statusFilter === "all" || origin.status === statusFilter;
    const keyword = search.trim().toLowerCase();
    return matchesStatus && (!keyword || origin.origin.toLowerCase().includes(keyword) || String(origin.lastFailureType || "").toLowerCase().includes(keyword));
  });

  const failureLabel = (value: string) => {
    if (!value) return "—";
    if (/cors/i.test(value)) return "CORS bị chặn";
    if (/manifest/i.test(value)) return "Không tải được manifest";
    if (/fragment/i.test(value)) return "Lỗi tải đoạn phim";
    if (/network/i.test(value)) return "Lỗi mạng/CDN";
    if (/media/i.test(value)) return "Lỗi giải mã video";
    return value;
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-pink-400">
            <Activity size={18} />
            <span className="text-[10px] font-black uppercase tracking-[0.22em]">Playback Intelligence</span>
          </div>
          <h2 className="mt-1 text-xl font-black text-white">Sức khỏe nguồn phát</h2>
          <p className="mt-1 text-xs text-zinc-500">Tổng hợp {data.windowMinutes || 30} phút gần nhất. CDN lỗi được né tạm và tự phục hồi.</p>
        </div>
        <button onClick={() => void refresh()} disabled={loading} className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.04] px-3 py-2 text-xs font-bold text-zinc-300 hover:bg-white/[0.08] disabled:opacity-50">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Làm mới
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {cards.map(([label, value, Icon, tone]) => (
          <div key={label} className="rounded-2xl border border-white/[0.05] bg-[#0c0c13] p-4">
            <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl ${tone}`}><Icon size={17} /></div>
            <p className="text-2xl font-black text-white">{loading ? "—" : value}</p>
            <p className="mt-1 text-[10px] font-black uppercase tracking-wider text-zinc-500">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3 rounded-2xl border border-white/[0.05] bg-[#0c0c13] px-4 py-3 text-center">
        <div><p className="text-lg font-black text-white">{data.summary.totalStarts ?? 0}</p><p className="text-[9px] font-black uppercase text-zinc-600">Lượt khởi động</p></div>
        <div><p className="text-lg font-black text-red-400">{data.summary.totalFailures ?? 0}</p><p className="text-[9px] font-black uppercase text-zinc-600">Lỗi phát</p></div>
        <div><p className="text-lg font-black text-amber-400">{data.summary.totalBuffers ?? 0}</p><p className="text-[9px] font-black uppercase text-zinc-600">Lần buffering</p></div>
      </div>

      {data.storageScope === "instance" && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/15 bg-amber-500/[0.06] px-4 py-3 text-[10px] leading-relaxed text-amber-200/80">
          <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-400" />
          <span>Dữ liệu hiện chỉ nằm trong bộ nhớ của server này và sẽ mất khi restart. Khi deploy nhiều instance, cấu hình Upstash Redis để mọi server dùng chung số liệu.</span>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-white/[0.05] bg-[#0c0c13]">
        <div className="border-b border-white/[0.05] px-4 py-3">
          <p className="text-xs font-black uppercase tracking-wider text-zinc-300">Nguồn API phim</p>
          <p className="mt-1 text-[10px] text-zinc-600">Kiểm tra cấu hình PhimAPI/OPhim tối đa một lần mỗi phút.</p>
        </div>
        {movieSources.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs font-bold text-zinc-600">Chưa có nguồn phim nào được cấu hình</div>
        ) : (
          <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
            {movieSources.map((source) => {
              const sourceMeta = source.status === "healthy"
                ? { label: "Hoạt động", style: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" }
                : source.status === "degraded"
                ? { label: "Phản hồi chậm", style: "text-amber-400 bg-amber-500/10 border-amber-500/20" }
                : { label: "Mất kết nối", style: "text-red-400 bg-red-500/10 border-red-500/20" };
              return (
                <div key={source.id} className={`rounded-xl border p-3 ${source.active ? "border-pink-500/30 bg-pink-500/[0.04]" : "border-white/[0.05] bg-white/[0.015]"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><p className="truncate text-xs font-black text-white">{source.name}</p><p className="mt-1 truncate text-[9px] text-zinc-600" title={source.domain}>{source.domain}</p></div>
                    {source.active && <span className="rounded-md bg-pink-500/15 px-2 py-1 text-[8px] font-black uppercase text-pink-300">Mặc định</span>}
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className={`rounded-md border px-2 py-1 text-[8px] font-black uppercase ${sourceMeta.style}`}>{sourceMeta.label}</span>
                    <span className="text-[10px] font-bold text-zinc-500">{source.latencyMs === null ? "Timeout" : `${source.latencyMs} ms`}{source.statusCode ? ` · HTTP ${source.statusCode}` : ""}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm CDN hoặc loại lỗi..." className="h-10 w-full rounded-xl border border-white/[0.06] bg-[#0c0c13] pl-9 pr-3 text-xs text-white outline-none focus:border-pink-500/40" />
        </label>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="h-10 rounded-xl border border-white/[0.06] bg-[#0c0c13] px-3 text-xs font-bold text-zinc-300 outline-none">
          <option value="all">Tất cả trạng thái</option><option value="healthy">Ổn định</option><option value="degraded">Cần theo dõi</option><option value="blocked">Đang tạm né</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/[0.05] bg-[#0c0c13]">
        <div className="flex items-center justify-between border-b border-white/[0.05] px-4 py-3">
          <p className="text-xs font-black uppercase tracking-wider text-zinc-300">Chi tiết CDN</p>
          <p className="text-[10px] text-zinc-600">{data.generatedAt ? `Cập nhật ${new Date(data.generatedAt).toLocaleTimeString("vi-VN")} · ${data.storageScope === "shared" ? "Redis dùng chung" : "Bộ nhớ server"}` : "Chưa có dữ liệu"}</p>
        </div>
        {error ? <div className="p-8 text-center text-sm text-red-400"><p>{error}</p><button onClick={() => void refresh()} className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-[10px] font-black text-red-300">Thử lại</button></div> :
          data.origins.length === 0 && !loading ? (
            <div className="p-10 text-center"><Server className="mx-auto mb-3 text-zinc-700" size={34} /><p className="text-sm font-bold text-zinc-400">Chưa có phiên HLS nào để thống kê</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-xs">
                <thead className="bg-white/[0.02] text-[9px] font-black uppercase tracking-wider text-zinc-600"><tr>
                  <th className="px-4 py-3">CDN</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3">Mở phim</th><th className="px-4 py-3">Thất bại</th><th className="px-4 py-3">Buffer</th><th className="px-4 py-3">Người gặp lỗi</th><th className="px-4 py-3">Lỗi gần nhất</th><th className="px-4 py-3">Khởi động TB</th><th className="px-4 py-3">Gần nhất</th>
                </tr></thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {filteredOrigins.length === 0 ? (
                    <tr><td colSpan={9} className="px-4 py-10 text-center text-xs font-bold text-zinc-600">Không có CDN phù hợp với bộ lọc</td></tr>
                  ) : filteredOrigins.map((origin) => {
                    const meta = STATUS[origin.status];
                    const Icon = meta.icon;
                    return <tr key={origin.origin} className="hover:bg-white/[0.025]">
                      <td className="max-w-[260px] px-4 py-3 font-bold text-zinc-200"><span className="block truncate" title={origin.origin}>{origin.origin}</span></td>
                      <td className="px-4 py-3"><span className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[9px] font-black uppercase ${meta.style}`}><Icon size={11} />{meta.label}</span>{origin.blockedUntil > 0 && <span className="mt-1 block text-[9px] text-zinc-600">đến {new Date(origin.blockedUntil).toLocaleTimeString("vi-VN")}</span>}</td>
                      <td className="px-4 py-3 font-bold text-zinc-300">{origin.starts}</td>
                      <td className={`px-4 py-3 ${origin.failures ? "font-bold text-red-400" : "text-zinc-500"}`}>{origin.failures} · {origin.failureRate}%</td>
                      <td className="px-4 py-3 text-zinc-400">{origin.buffers} · {origin.bufferRate ?? 0}%</td>
                      <td className="px-4 py-3 text-zinc-400"><span className="inline-flex items-center gap-1"><Users size={11} />{origin.uniqueFailureReporters}</span></td>
                      <td className="max-w-[180px] px-4 py-3 text-zinc-400"><span className="block truncate" title={origin.lastFailureType}>{failureLabel(origin.lastFailureType)}</span></td>
                      <td className="px-4 py-3 text-zinc-400">{formatDuration(origin.averageStartupMs)}</td>
                      <td className="px-4 py-3 text-zinc-500">{new Date(origin.lastSeenAt).toLocaleTimeString("vi-VN")}</td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
          )}
      </div>
    </section>
  );
}
