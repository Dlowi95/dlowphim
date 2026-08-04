"use client";

import { useCallback, useEffect, useState } from "react";
import Cookies from "js-cookie";
import { Activity, AlertTriangle, CheckCircle2, RefreshCw, Server, ShieldX } from "lucide-react";

interface OriginHealth {
  origin: string;
  status: "healthy" | "degraded" | "blocked";
  starts: number;
  failures: number;
  buffers: number;
  failureRate: number;
  averageStartupMs: number;
  averageBufferMs: number;
  blockedUntil: number;
  lastSeenAt: number;
}

interface HealthDashboard {
  generatedAt: number;
  summary: {
    activeOrigins: number;
    healthyOrigins: number;
    degradedOrigins: number;
    blockedOrigins: number;
  };
  origins: OriginHealth[];
}

const EMPTY: HealthDashboard = {
  generatedAt: 0,
  summary: { activeOrigins: 0, healthyOrigins: 0, degradedOrigins: 0, blockedOrigins: 0 },
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

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await fetch(`${API_URL}/playback-health/admin`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${Cookies.get("token")}` },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setData(await response.json());
      setError("");
    } catch {
      setError("Không thể tải dữ liệu sức khỏe nguồn phát.");
    } finally {
      setLoading(false);
    }
  }, [API_URL]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(true), 30_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const cards = [
    ["Nguồn hoạt động", data.summary.activeOrigins, Server, "text-sky-400 bg-sky-500/10"],
    ["Ổn định", data.summary.healthyOrigins, CheckCircle2, "text-emerald-400 bg-emerald-500/10"],
    ["Cần theo dõi", data.summary.degradedOrigins, AlertTriangle, "text-amber-400 bg-amber-500/10"],
    ["Đang tạm né", data.summary.blockedOrigins, ShieldX, "text-red-400 bg-red-500/10"],
  ] as const;

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-pink-400">
            <Activity size={18} />
            <span className="text-[10px] font-black uppercase tracking-[0.22em]">Playback Intelligence</span>
          </div>
          <h2 className="mt-1 text-xl font-black text-white">Sức khỏe nguồn phát</h2>
          <p className="mt-1 text-xs text-zinc-500">Tổng hợp 30 phút gần nhất. CDN lỗi được né tạm và tự phục hồi.</p>
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

      <div className="overflow-hidden rounded-2xl border border-white/[0.05] bg-[#0c0c13]">
        <div className="flex items-center justify-between border-b border-white/[0.05] px-4 py-3">
          <p className="text-xs font-black uppercase tracking-wider text-zinc-300">Chi tiết CDN</p>
          <p className="text-[10px] text-zinc-600">{data.generatedAt ? `Cập nhật ${new Date(data.generatedAt).toLocaleTimeString("vi-VN")}` : "Chưa có dữ liệu"}</p>
        </div>
        {error ? <div className="p-8 text-center text-sm text-red-400">{error}</div> :
          data.origins.length === 0 && !loading ? (
            <div className="p-10 text-center"><Server className="mx-auto mb-3 text-zinc-700" size={34} /><p className="text-sm font-bold text-zinc-400">Chưa có phiên HLS nào để thống kê</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-xs">
                <thead className="bg-white/[0.02] text-[9px] font-black uppercase tracking-wider text-zinc-600"><tr>
                  <th className="px-4 py-3">CDN</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3">Mở phim</th><th className="px-4 py-3">Thất bại</th><th className="px-4 py-3">Buffer</th><th className="px-4 py-3">Khởi động TB</th><th className="px-4 py-3">Buffer TB</th><th className="px-4 py-3">Gần nhất</th>
                </tr></thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {data.origins.map((origin) => {
                    const meta = STATUS[origin.status];
                    const Icon = meta.icon;
                    return <tr key={origin.origin} className="hover:bg-white/[0.025]">
                      <td className="max-w-[260px] px-4 py-3 font-bold text-zinc-200"><span className="block truncate" title={origin.origin}>{origin.origin}</span></td>
                      <td className="px-4 py-3"><span className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[9px] font-black uppercase ${meta.style}`}><Icon size={11} />{meta.label}</span>{origin.blockedUntil > 0 && <span className="mt-1 block text-[9px] text-zinc-600">đến {new Date(origin.blockedUntil).toLocaleTimeString("vi-VN")}</span>}</td>
                      <td className="px-4 py-3 font-bold text-zinc-300">{origin.starts}</td>
                      <td className={`px-4 py-3 ${origin.failures ? "font-bold text-red-400" : "text-zinc-500"}`}>{origin.failures} · {origin.failureRate}%</td>
                      <td className="px-4 py-3 text-zinc-400">{origin.buffers}</td>
                      <td className="px-4 py-3 text-zinc-400">{formatDuration(origin.averageStartupMs)}</td>
                      <td className="px-4 py-3 text-zinc-400">{formatDuration(origin.averageBufferMs)}</td>
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
