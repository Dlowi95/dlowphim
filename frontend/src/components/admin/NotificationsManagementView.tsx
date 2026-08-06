"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Cookies from "js-cookie";
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  Megaphone,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  Users,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useConfirmDialog } from "@/components/ConfirmDialog";

interface NotificationItem {
  _id: string;
  type: "movie_report" | "comment_report" | "system";
  title: string;
  subtitle?: string;
  content?: string;
  targetTab: "reports" | "comments";
  isRead: boolean;
  createdAt: string;
}

interface CampaignItem {
  _id: string;
  title: string;
  content: string;
  link?: string;
  status: "queued" | "sending" | "sent" | "failed";
  recipientCount: number;
  deliveredCount: number;
  createdAt: string;
  sentAt?: string;
  errorMessage?: string;
  createdBy?: { displayName?: string; email?: string };
}

interface NotificationsManagementViewProps {
  setActiveTab: (tab: any) => void;
  onRefreshStats?: () => void;
}

const CAMPAIGN_STATUS = {
  queued: { label: "Đang chờ", style: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20" },
  sending: { label: "Đang gửi", style: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  sent: { label: "Đã gửi", style: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  failed: { label: "Gửi lỗi", style: "bg-red-500/10 text-red-400 border-red-500/20" },
};

export default function NotificationsManagementView({
  setActiveTab,
  onRefreshStats,
}: NotificationsManagementViewProps) {
  const { showToast } = useAuth();
  const { confirm, confirmDialog } = useConfirmDialog();
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
  const [activeView, setActiveView] = useState<"alerts" | "broadcasts">("alerts");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [readFilter, setReadFilter] = useState<"all" | "unread" | "read">("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
  const [campaignPage, setCampaignPage] = useState(1);
  const [campaignTotalPages, setCampaignTotalPages] = useState(1);
  const [campaignLoading, setCampaignLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({ title: "", content: "", link: "", expiresInDays: 30 });

  const authHeaders = useCallback(() => ({ Authorization: `Bearer ${Cookies.get("token")}` }), []);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "12",
        read: readFilter,
        type: typeFilter,
      });
      if (search.trim()) params.set("search", search.trim());
      const response = await fetch(`${API_URL}/notifications?${params}`, { headers: authHeaders() });
      if (!response.ok) throw new Error("Không thể tải cảnh báo");
      const data = await response.json();
      setNotifications(data.items || []);
      setTotalPages(data.totalPages || 1);
      setTotalItems(data.total || 0);
      setUnreadCount(data.unreadCount || 0);
    } catch (error) {
      console.error(error);
      showToast("Không thể tải cảnh báo quản trị", "error");
    } finally {
      setLoading(false);
    }
  }, [API_URL, authHeaders, page, readFilter, search, showToast, typeFilter]);

  const fetchCampaigns = useCallback(async () => {
    setCampaignLoading(true);
    try {
      const response = await fetch(
        `${API_URL}/notifications/admin/broadcasts?page=${campaignPage}&limit=10`,
        { headers: authHeaders() },
      );
      if (!response.ok) throw new Error("Không thể tải chiến dịch");
      const data = await response.json();
      setCampaigns(data.items || []);
      setCampaignTotalPages(data.totalPages || 1);
    } catch (error) {
      console.error(error);
      showToast("Không thể tải lịch sử gửi thông báo", "error");
    } finally {
      setCampaignLoading(false);
    }
  }, [API_URL, authHeaders, campaignPage, showToast]);

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchAlerts(), search ? 300 : 0);
    return () => window.clearTimeout(timer);
  }, [fetchAlerts, search]);

  useEffect(() => {
    if (activeView === "broadcasts") void fetchCampaigns();
  }, [activeView, fetchCampaigns]);

  useEffect(() => {
    const refresh = () => {
      if (activeView === "alerts") void fetchAlerts();
      else void fetchCampaigns();
      onRefreshStats?.();
    };
    window.addEventListener("dlowphim:notifications-changed", refresh);
    return () => window.removeEventListener("dlowphim:notifications-changed", refresh);
  }, [activeView, fetchAlerts, fetchCampaigns, onRefreshStats]);

  const markAsRead = async (item: NotificationItem) => {
    try {
      await fetch(`${API_URL}/notifications/${item._id}/read`, {
        method: "PUT",
        headers: authHeaders(),
      });
      onRefreshStats?.();
      setActiveTab(item.targetTab);
    } catch {
      showToast("Không thể mở cảnh báo", "error");
    }
  };

  const markAllAsRead = async () => {
    const response = await fetch(`${API_URL}/notifications/read-all`, {
      method: "PUT",
      headers: authHeaders(),
    });
    if (response.ok) {
      showToast("Đã đọc tất cả cảnh báo", "success");
      await fetchAlerts();
      onRefreshStats?.();
    }
  };

  const archiveAll = async () => {
    const accepted = await confirm({
      title: "Lưu trữ toàn bộ cảnh báo?",
      message: "Cảnh báo sẽ được ẩn khỏi tài khoản admin của bạn, không ảnh hưởng tới admin khác và không xóa dữ liệu xử lý.",
      confirmLabel: "Lưu trữ",
    });
    if (!accepted) return;
    const response = await fetch(`${API_URL}/notifications/clear`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (response.ok) {
      showToast("Đã lưu trữ hộp cảnh báo", "success");
      setPage(1);
      await fetchAlerts();
      onRefreshStats?.();
    }
  };

  const submitBroadcast = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      showToast("Bạn cần nhập tiêu đề và nội dung", "error");
      return;
    }
    const accepted = await confirm({
      title: "Gửi cho toàn bộ người dùng?",
      message: `Thông báo “${form.title.trim()}” sẽ xuất hiện trong chuông của tất cả tài khoản đang hoạt động.`,
      confirmLabel: "Gửi thông báo",
    });
    if (!accepted) return;

    setSending(true);
    try {
      const response = await fetch(`${API_URL}/notifications/admin/broadcasts`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Gửi thông báo thất bại");
      showToast(data.message || "Đã đưa thông báo vào hàng gửi", "success");
      setForm({ title: "", content: "", link: "", expiresInDays: 30 });
      setCampaignPage(1);
      await fetchCampaigns();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Gửi thông báo thất bại", "error");
    } finally {
      setSending(false);
    }
  };

  const preview = useMemo(() => ({
    title: form.title.trim() || "Tiêu đề thông báo",
    content: form.content.trim() || "Nội dung mà người dùng sẽ nhìn thấy trong chuông thông báo.",
  }), [form.content, form.title]);

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-black text-white"><Bell size={18} className="text-pink-500" />Trung tâm thông báo</h3>
          <p className="mt-1 text-[10px] font-semibold text-zinc-500">Xử lý cảnh báo nội bộ và gửi thông báo hệ thống tới người dùng.</p>
        </div>
        <div className="flex rounded-xl border border-zinc-900 bg-zinc-950 p-1">
          <button onClick={() => setActiveView("alerts")} className={`rounded-lg px-4 py-2 text-[10px] font-black uppercase border-none cursor-pointer ${activeView === "alerts" ? "bg-pink-500 text-white" : "bg-transparent text-zinc-500"}`}>Cảnh báo quản trị {unreadCount > 0 && `(${unreadCount})`}</button>
          <button onClick={() => setActiveView("broadcasts")} className={`rounded-lg px-4 py-2 text-[10px] font-black uppercase border-none cursor-pointer ${activeView === "broadcasts" ? "bg-pink-500 text-white" : "bg-transparent text-zinc-500"}`}>Gửi người dùng</button>
        </div>
      </div>

      {activeView === "alerts" ? (
        <>
          <div className="flex flex-col gap-2 xl:flex-row">
            <label className="relative flex-1"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Tìm cảnh báo..." className="h-10 w-full rounded-xl border border-zinc-900 bg-[#0d0e13] pl-9 pr-3 text-xs text-white outline-none focus:border-pink-500/40" /></label>
            <select value={readFilter} onChange={(event) => { setReadFilter(event.target.value as typeof readFilter); setPage(1); }} className="h-10 rounded-xl border border-zinc-900 bg-[#0d0e13] px-3 text-xs font-bold text-zinc-300"><option value="all">Tất cả trạng thái</option><option value="unread">Chưa đọc</option><option value="read">Đã đọc</option></select>
            <select value={typeFilter} onChange={(event) => { setTypeFilter(event.target.value); setPage(1); }} className="h-10 rounded-xl border border-zinc-900 bg-[#0d0e13] px-3 text-xs font-bold text-zinc-300"><option value="all">Tất cả loại</option><option value="movie_report">Lỗi phim</option><option value="comment_report">Báo xấu bình luận</option><option value="system">Hệ thống</option></select>
            {unreadCount > 0 && <button onClick={markAllAsRead} className="h-10 rounded-xl border border-emerald-500/15 bg-emerald-500/10 px-3 text-[10px] font-black text-emerald-400 cursor-pointer"><CheckCheck size={13} className="mr-1 inline" />Đọc tất cả</button>}
            {totalItems > 0 && <button onClick={archiveAll} className="h-10 rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-[10px] font-black text-zinc-400 cursor-pointer">Lưu trữ tất cả</button>}
            <button onClick={() => void fetchAlerts()} disabled={loading} className="h-10 w-10 rounded-xl border-none bg-zinc-900 text-zinc-400 cursor-pointer"><RefreshCw size={13} className={`mx-auto ${loading ? "animate-spin" : ""}`} /></button>
          </div>

          <div className="space-y-2">
            {loading ? <Loading label="Đang tải cảnh báo..." /> : notifications.length === 0 ? <Empty label="Không có cảnh báo phù hợp" /> : notifications.map((item) => (
              <button key={item._id} onClick={() => void markAsRead(item)} className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left cursor-pointer ${item.isRead ? "border-zinc-900 bg-[#0d0e13]" : "border-pink-500/20 bg-pink-500/[0.05]"}`}>
                {!item.isRead && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-pink-500" />}
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${item.type === "comment_report" ? "bg-red-500/10 text-red-400" : "bg-amber-500/10 text-amber-400"}`}><AlertTriangle size={16} /></span>
                <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center justify-between gap-2"><strong className="text-xs text-zinc-100">{item.title}</strong><small className="flex items-center gap-1 text-[9px] text-zinc-600"><Clock size={10} />{new Date(item.createdAt).toLocaleString("vi-VN")}</small></span>{item.subtitle && <span className="mt-1 block text-[9px] font-black uppercase text-pink-400">{item.subtitle}</span>}{item.content && <span className="mt-2 block line-clamp-2 text-[10px] leading-relaxed text-zinc-400">{item.content}</span>}</span>
              </button>
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} onChange={setPage} label={`${totalItems} cảnh báo`} />
        </>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[1fr_1.15fr]">
          <div className="space-y-4 rounded-2xl border border-zinc-900 bg-[#0d0e13] p-5">
            <div><h4 className="flex items-center gap-2 text-sm font-black text-white"><Megaphone size={16} className="text-pink-400" />Gửi thông báo toàn hệ thống</h4><p className="mt-1 text-[10px] text-zinc-600">Backend sẽ tự chia lô, chống gửi trùng và cập nhật realtime.</p></div>
            <label className="block text-[10px] font-black uppercase text-zinc-500">Tiêu đề<input maxLength={160} value={form.title} onChange={(event) => setForm((value) => ({ ...value, title: event.target.value }))} placeholder="Ví dụ: DlowPhim vừa có tính năng mới" className="mt-2 h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-xs normal-case text-white outline-none focus:border-pink-500/40" /></label>
            <label className="block text-[10px] font-black uppercase text-zinc-500">Nội dung<textarea maxLength={500} rows={5} value={form.content} onChange={(event) => setForm((value) => ({ ...value, content: event.target.value }))} placeholder="Nhập nội dung ngắn gọn, rõ ràng..." className="mt-2 w-full resize-none rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-xs normal-case leading-relaxed text-white outline-none focus:border-pink-500/40" /><span className="mt-1 block text-right text-[9px] text-zinc-700">{form.content.length}/500</span></label>
            <div className="grid gap-3 sm:grid-cols-[1fr_140px]"><label className="block text-[10px] font-black uppercase text-zinc-500">Liên kết nội bộ<input maxLength={500} value={form.link} onChange={(event) => setForm((value) => ({ ...value, link: event.target.value }))} placeholder="/movie/slug hoặc để trống" className="mt-2 h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-xs normal-case text-white outline-none" /></label><label className="block text-[10px] font-black uppercase text-zinc-500">Tự xóa sau<select value={form.expiresInDays} onChange={(event) => setForm((value) => ({ ...value, expiresInDays: Number(event.target.value) }))} className="mt-2 h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-xs normal-case text-white"><option value={7}>7 ngày</option><option value={30}>30 ngày</option><option value={60}>60 ngày</option><option value={90}>90 ngày</option></select></label></div>
            <div className="rounded-xl border border-pink-500/15 bg-pink-500/[0.04] p-4"><p className="text-[9px] font-black uppercase text-pink-400">Xem trước trên chuông</p><p className="mt-2 text-xs font-black text-white">{preview.title}</p><p className="mt-1 text-[10px] leading-relaxed text-zinc-400">{preview.content}</p>{form.link && <p className="mt-2 text-[9px] text-sky-400">Mở: {form.link}</p>}</div>
            <button onClick={() => void submitBroadcast()} disabled={sending} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border-none bg-pink-500 text-xs font-black text-white shadow-[0_8px_24px_rgba(236,72,153,0.2)] cursor-pointer disabled:opacity-50">{sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}Gửi tới toàn bộ user</button>
          </div>

          <div className="space-y-3"><div className="flex items-center justify-between"><div><h4 className="text-sm font-black text-white">Lịch sử gửi</h4><p className="text-[10px] text-zinc-600">Theo dõi tiến độ phân phối từng chiến dịch.</p></div><button onClick={() => void fetchCampaigns()} className="h-9 w-9 rounded-xl border-none bg-zinc-900 text-zinc-400 cursor-pointer"><RefreshCw size={13} className={`mx-auto ${campaignLoading ? "animate-spin" : ""}`} /></button></div>
            {campaignLoading ? <Loading label="Đang tải lịch sử gửi..." /> : campaigns.length === 0 ? <Empty label="Chưa có thông báo toàn hệ thống" /> : campaigns.map((campaign) => { const meta = CAMPAIGN_STATUS[campaign.status]; const progress = campaign.recipientCount ? Math.min(100, Math.round(campaign.deliveredCount / campaign.recipientCount * 100)) : 100; return <div key={campaign._id} className="rounded-2xl border border-zinc-900 bg-[#0d0e13] p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h5 className="truncate text-xs font-black text-white">{campaign.title}</h5><p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-zinc-500">{campaign.content}</p></div><span className={`shrink-0 rounded-md border px-2 py-1 text-[8px] font-black uppercase ${meta.style}`}>{meta.label}</span></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-900"><div className={`h-full rounded-full ${campaign.status === "failed" ? "bg-red-500" : "bg-pink-500"}`} style={{ width: `${progress}%` }} /></div><div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[9px] text-zinc-600"><span className="flex items-center gap-1"><Users size={10} />{campaign.deliveredCount}/{campaign.recipientCount} tài khoản</span><span>{new Date(campaign.createdAt).toLocaleString("vi-VN")}</span></div>{campaign.errorMessage && <p className="mt-2 text-[9px] text-red-400">{campaign.errorMessage}</p>}</div>; })}
            <Pagination page={campaignPage} totalPages={campaignTotalPages} onChange={setCampaignPage} />
          </div>
        </div>
      )}
      {confirmDialog}
    </div>
  );
}

function Loading({ label }: { label: string }) {
  return <div className="flex flex-col items-center gap-3 rounded-2xl border border-zinc-900 bg-[#0d0e13] p-14 text-xs font-bold text-zinc-500"><Loader2 size={22} className="animate-spin text-pink-500" />{label}</div>;
}

function Empty({ label }: { label: string }) {
  return <div className="flex flex-col items-center gap-3 rounded-2xl border border-zinc-900 bg-[#0d0e13] p-14 text-xs font-bold text-zinc-500"><ShieldAlert size={28} className="text-zinc-700" />{label}</div>;
}

function Pagination({ page, totalPages, onChange, label }: { page: number; totalPages: number; onChange: (page: number) => void; label?: string }) {
  if (totalPages <= 1 && !label) return null;
  return <div className="flex items-center justify-between gap-3 pt-2 text-[10px] font-bold text-zinc-600"><span>{label || `Trang ${page}/${totalPages}`}</span><div className="flex gap-2"><button onClick={() => onChange(Math.max(1, page - 1))} disabled={page <= 1} className="h-8 w-8 rounded-lg border-none bg-zinc-900 text-zinc-400 cursor-pointer disabled:opacity-30"><ChevronLeft size={14} className="mx-auto" /></button><button onClick={() => onChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages} className="h-8 w-8 rounded-lg border-none bg-zinc-900 text-zinc-400 cursor-pointer disabled:opacity-30"><ChevronRight size={14} className="mx-auto" /></button></div></div>;
}
