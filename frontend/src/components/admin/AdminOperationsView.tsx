"use client";

import React, { useCallback, useEffect, useState } from "react";
import Cookies from "js-cookie";
import { Activity, CheckCircle2, Clock3, History, Loader2, Play, RefreshCw, Search, XCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useConfirmDialog } from "@/components/ConfirmDialog";

type AuditItem = { _id: string; actorName: string; actorEmail: string; actorRole: string; action: string; path: string; status: "success" | "failed"; statusCode?: number; errorMessage?: string; createdAt: string };
type JobItem = { _id: string; type: string; status: "pending" | "processing" | "completed" | "failed"; attempts: number; maxAttempts: number; result?: Record<string, unknown>; errorMessage?: string; createdAt: string; finishedAt?: string };

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const authHeaders = () => ({ Authorization: `Bearer ${Cookies.get("token") || ""}`, "Content-Type": "application/json" });

export default function AdminOperationsView() {
  const { user, showToast } = useAuth();
  const { confirm, confirmDialog } = useConfirmDialog();
  const [tab, setTab] = useState<"audit" | "jobs">(user?.role === "super_admin" || user?.role === "admin" ? "audit" : "jobs");
  const [audit, setAudit] = useState<AuditItem[]>([]);
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const isSuper = user?.role === "super_admin" || user?.role === "admin";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = tab === "audit"
        ? `${API_URL}/admin/audit-logs?limit=30&search=${encodeURIComponent(search)}`
        : `${API_URL}/admin/jobs?limit=30`;
      const response = await fetch(url, { headers: authHeaders(), cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Không thể tải dữ liệu vận hành");
      if (tab === "audit") setAudit(data.items || []); else setJobs(data.items || []);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Không thể tải dữ liệu vận hành", "error");
    } finally { setLoading(false); }
  }, [search, showToast, tab]);

  useEffect(() => { const timer = setTimeout(() => void load(), tab === "audit" ? 300 : 0); return () => clearTimeout(timer); }, [load, tab]);

  const enqueue = async (type: "upcoming_reminder_scan" | "source_health_check") => {
    const accepted = await confirm({ title: "Chạy tác vụ nền?", message: "Tác vụ sẽ chạy ở background. Bạn có thể rời trang và quay lại xem kết quả sau.", confirmLabel: "Chạy tác vụ", tone: "warning" });
    if (!accepted) return;
    const response = await fetch(`${API_URL}/admin/jobs`, { method: "POST", headers: authHeaders(), body: JSON.stringify({ type }) });
    const data = await response.json();
    if (!response.ok) return showToast(data?.message || "Không thể tạo tác vụ", "error");
    showToast("Đã đưa tác vụ vào hàng đợi", "success");
    void load();
  };

  const retry = async (id: string) => {
    const response = await fetch(`${API_URL}/admin/jobs/${id}/retry`, { method: "POST", headers: authHeaders() });
    const data = await response.json();
    if (!response.ok) return showToast(data?.message || "Không thể thử lại", "error");
    showToast("Đã đưa tác vụ trở lại hàng đợi", "success");
    void load();
  };

  return <div className="space-y-5">
    {confirmDialog}
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="flex items-center gap-2 text-xl font-black text-white"><Activity className="text-pink-500" /> Vận hành hệ thống</h1><p className="mt-1 text-xs text-zinc-500">Theo dõi thao tác quản trị và các công việc chạy nền.</p></div>
      <button onClick={() => void load()} className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-zinc-400 hover:text-white"><RefreshCw size={15} className={loading ? "animate-spin" : ""} /></button>
    </div>
    <div className="flex rounded-2xl border border-white/[0.06] bg-[#0c0d13] p-1">
      {isSuper && <button onClick={() => setTab("audit")} className={`flex-1 rounded-xl px-4 py-2.5 text-xs font-black ${tab === "audit" ? "bg-pink-500 text-white" : "text-zinc-500"}`}><History size={14} className="mr-2 inline" />Nhật ký Admin</button>}
      <button onClick={() => setTab("jobs")} className={`flex-1 rounded-xl px-4 py-2.5 text-xs font-black ${tab === "jobs" ? "bg-pink-500 text-white" : "text-zinc-500"}`}><Activity size={14} className="mr-2 inline" />Tác vụ nền</button>
    </div>
    {tab === "audit" ? <>
      <div className="relative"><Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm email, tên admin hoặc đường dẫn..." className="h-11 w-full rounded-xl border border-white/[0.06] bg-[#090a0f] pl-11 pr-4 text-xs text-white outline-none focus:border-pink-500/40" /></div>
      <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0c0d13]">{loading ? <EmptyLoader /> : audit.length === 0 ? <Empty text="Chưa có thao tác quản trị" /> : audit.map((item) => <div key={item._id} className="flex flex-wrap items-center gap-3 border-b border-white/[0.04] px-4 py-3 last:border-0"><Status status={item.status} /><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-zinc-200">{item.action}</p><p className="mt-1 truncate text-[10px] text-zinc-500">{item.actorName} · {item.actorEmail} · {item.actorRole}</p>{item.errorMessage && <p className="mt-1 text-[10px] text-red-400">{item.errorMessage}</p>}</div><time className="text-[10px] text-zinc-600">{new Date(item.createdAt).toLocaleString("vi-VN")}</time></div>)}</div>
    </> : <>
      <div className="grid gap-3 md:grid-cols-2"><JobButton title="Dò phim sắp chiếu" text="Kiểm tra phim đã có bản phát và gửi nhắc đúng lịch." onClick={() => void enqueue("upcoming_reminder_scan")} /><JobButton title="Kiểm tra nguồn phim" text="Đo trạng thái PhimAPI và OPhim ở background." onClick={() => void enqueue("source_health_check")} /></div>
      <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0c0d13]">{loading ? <EmptyLoader /> : jobs.length === 0 ? <Empty text="Chưa có tác vụ nền" /> : jobs.map((job) => <div key={job._id} className="flex flex-wrap items-center gap-3 border-b border-white/[0.04] px-4 py-3 last:border-0"><Status status={job.status} /><div className="min-w-0 flex-1"><p className="text-xs font-bold text-zinc-200">{job.type === "upcoming_reminder_scan" ? "Dò phim sắp chiếu" : "Kiểm tra nguồn phim"}</p><p className="mt-1 text-[10px] text-zinc-500">Lần chạy {job.attempts}/{job.maxAttempts} · {new Date(job.createdAt).toLocaleString("vi-VN")}</p>{job.errorMessage && <p className="mt-1 text-[10px] text-red-400">{job.errorMessage}</p>}</div>{job.status === "failed" && <button onClick={() => void retry(job._id)} className="rounded-lg border border-red-500/20 px-3 py-1.5 text-[10px] font-black text-red-400">Thử lại</button>}</div>)}</div>
    </>}
  </div>;
}

function Status({ status }: { status: string }) { if (status === "success" || status === "completed") return <CheckCircle2 size={17} className="text-emerald-400" />; if (status === "failed") return <XCircle size={17} className="text-red-400" />; if (status === "processing") return <Loader2 size={17} className="animate-spin text-blue-400" />; return <Clock3 size={17} className="text-amber-400" />; }
function EmptyLoader() { return <div className="flex h-40 items-center justify-center"><Loader2 className="animate-spin text-pink-500" /></div>; }
function Empty({ text }: { text: string }) { return <div className="flex h-40 items-center justify-center text-xs text-zinc-600">{text}</div>; }
function JobButton({ title, text, onClick }: { title: string; text: string; onClick: () => void }) { return <button onClick={onClick} className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-[#0c0d13] p-4 text-left hover:border-pink-500/30"><span className="rounded-xl bg-pink-500/10 p-3 text-pink-400"><Play size={16} /></span><span><b className="block text-xs text-white">{title}</b><small className="mt-1 block text-[10px] leading-4 text-zinc-500">{text}</small></span></button>; }
