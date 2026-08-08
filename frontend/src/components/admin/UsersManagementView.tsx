"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Cookies from "js-cookie";
import {
  AlertTriangle,
  CalendarDays,
  KeyRound,
  LockKeyhole,
  MailCheck,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import Pagination from "./Pagination";
import { ADMIN_ROLE_LABELS, hasAdminPermission, normalizeAdminRole } from "@/utils/adminPermissions";

type UserRole = "member" | "super_admin" | "content_admin" | "moderator" | "support";
type AuthProvider = "password" | "google" | "hybrid";

interface UserItem {
  _id: string;
  email: string;
  displayName: string;
  avatar?: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  lastLoginAt?: string;
  lastActiveAt?: string;
  suspendedAt?: string;
  suspensionReason?: string;
  authProvider: AuthProvider;
  verificationStatus?: "verified" | "pending";
  verificationExpiresAt?: string;
}

interface UsersResponse {
  items: UserItem[];
  pagination: { page: number; limit: number; totalItems: number; totalPages: number };
  summary: {
    totalUsers: number;
    activeUsers: number;
    blockedUsers: number;
    inactiveUsers: number;
    newUsers: number;
    admins: number;
    pendingVerification: number;
  };
  policy: { inactiveAfterDays: number; autoDeleteInactiveUsers: boolean };
}

const EMPTY_SUMMARY: UsersResponse["summary"] = {
  totalUsers: 0,
  activeUsers: 0,
  blockedUsers: 0,
  inactiveUsers: 0,
  newUsers: 0,
  admins: 0,
  pendingVerification: 0,
};

const providerLabel: Record<AuthProvider, string> = {
  password: "Mật khẩu",
  google: "Google",
  hybrid: "Google + mật khẩu",
};

function formatDate(value?: string) {
  if (!value) return "Chưa ghi nhận";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function activityLabel(user: UserItem) {
  const value = user.lastActiveAt || user.lastLoginAt || user.createdAt;
  if (!value) return { text: "Chưa hoạt động", stale: true };
  const days = Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000);
  if (days <= 0) return { text: "Hôm nay", stale: false };
  if (days === 1) return { text: "Hôm qua", stale: false };
  return { text: `${days} ngày trước`, stale: days >= 15 };
}

export default function UsersManagementView() {
  const { user: currentUser, showToast } = useAuth();
  const { confirm, confirmDialog } = useConfirmDialog();
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
  const requestIdRef = useRef(0);
  const canManageRoles = hasAdminPermission(currentUser?.role, "roles.manage");
  const roleLabel = (value: UserRole) => value === "member" ? "Thành viên" : ADMIN_ROLE_LABELS[normalizeAdminRole(value)!];

  const [users, setUsers] = useState<UserItem[]>([]);
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [activity, setActivity] = useState("");
  const [provider, setProvider] = useState("");
  const [verification, setVerification] = useState("");
  const [lockTarget, setLockTarget] = useState<UserItem | null>(null);
  const [lockReason, setLockReason] = useState("");

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const fetchUsers = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "10" });
      if (search) params.set("search", search);
      if (role) params.set("role", role);
      if (status) params.set("status", status);
      if (activity) params.set("activity", activity);
      if (provider) params.set("provider", provider);
      if (verification) params.set("verification", verification);
      const response = await fetch(`${API_URL}/auth/admin/users?${params}`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${Cookies.get("token") || ""}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Không thể tải danh sách người dùng");
      if (requestId !== requestIdRef.current) return;
      const result = data as UsersResponse;
      setUsers(result.items || []);
      setSummary(result.summary || EMPTY_SUMMARY);
      setTotalItems(result.pagination?.totalItems || 0);
      setTotalPages(result.pagination?.totalPages || 1);
      if (page > (result.pagination?.totalPages || 1)) setPage(result.pagination?.totalPages || 1);
    } catch (error) {
      if (requestId === requestIdRef.current) {
        showToast(error instanceof Error ? error.message : "Lỗi kết nối máy chủ", "error");
      }
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [API_URL, activity, page, provider, role, search, showToast, status, verification]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  const runAction = async (path: string, init: RequestInit) => {
    setActionLoading(true);
    try {
      const response = await fetch(`${API_URL}${path}`, {
        ...init,
        headers: {
          ...(init.body ? { "Content-Type": "application/json" } : {}),
          Authorization: `Bearer ${Cookies.get("token") || ""}`,
          ...init.headers,
        },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Thao tác thất bại");
      showToast(data.message || "Cập nhật người dùng thành công", "success");
      await fetchUsers();
      return true;
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Lỗi kết nối máy chủ", "error");
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  const changeRole = async (target: UserItem, nextRole: UserRole) => {
    if (nextRole === target.role) return;
    const accepted = await confirm({
      title: "Thay đổi quyền tài khoản?",
      message: `${target.displayName} sẽ được chuyển thành ${roleLabel(nextRole)}. Các phiên đăng nhập cũ sẽ được thu hồi. Không thể cấp vai trò Super Admin tại đây.`,
      confirmLabel: "Đổi quyền",
      tone: "warning",
    });
    if (!accepted) return;
    await runAction(`/auth/admin/users/${encodeURIComponent(target._id)}/role`, {
      method: "PUT",
      body: JSON.stringify({ role: nextRole }),
    });
  };

  const unlockUser = async (target: UserItem) => {
    const accepted = await confirm({
      title: "Mở khóa tài khoản?",
      message: `${target.displayName} có thể đăng nhập lại, nhưng phải đăng nhập mới vì phiên cũ đã bị thu hồi.`,
      confirmLabel: "Mở khóa",
      tone: "warning",
    });
    if (!accepted) return;
    await runAction(`/auth/admin/users/${encodeURIComponent(target._id)}/status`, {
      method: "PUT",
      body: JSON.stringify({ isActive: true }),
    });
  };

  const submitLock = async () => {
    if (!lockTarget) return;
    const success = await runAction(`/auth/admin/users/${encodeURIComponent(lockTarget._id)}/status`, {
      method: "PUT",
      body: JSON.stringify({ isActive: false, reason: lockReason.trim() }),
    });
    if (success) {
      setLockTarget(null);
      setLockReason("");
    }
  };

  const deleteUser = async (target: UserItem) => {
    const accepted = await confirm({
      title: "Xóa và ẩn danh tài khoản?",
      message: `Dữ liệu cá nhân của ${target.displayName} sẽ bị xóa và tài khoản bị ẩn. ID vô danh được giữ lại để bình luận, đánh giá cũ không bị hỏng liên kết.`,
      confirmLabel: "Xóa & ẩn danh",
      tone: "danger",
    });
    if (!accepted) return;
    const success = await runAction(`/auth/admin/users/${encodeURIComponent(target._id)}`, { method: "DELETE" });
    if (success && users.length === 1 && page > 1) setPage((value) => value - 1);
  };

  const resetFilters = () => {
    setSearchInput("");
    setSearch("");
    setRole("");
    setStatus("");
    setActivity("");
    setProvider("");
    setVerification("");
    setPage(1);
  };

  const statCards = [
    ["Tổng tài khoản", summary.totalUsers, Users, "text-blue-400 bg-blue-500/10"],
    ["Tài khoản đang mở", summary.activeUsers, UserCheck, "text-emerald-400 bg-emerald-500/10"],
    ["Không hoạt động 15 ngày", summary.inactiveUsers, CalendarDays, "text-amber-400 bg-amber-500/10"],
    ["Đang bị khóa", summary.blockedUsers, LockKeyhole, "text-red-400 bg-red-500/10"],
    ["Mới trong 30 ngày", summary.newUsers, ShieldCheck, "text-pink-400 bg-pink-500/10"],
    ["Chờ xác minh email", summary.pendingVerification, MailCheck, "text-cyan-400 bg-cyan-500/10"],
  ] as const;

  return (
    <div className="space-y-5 animate-fadeIn text-left">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h3 className="text-lg font-black tracking-tight text-white">Quản lý Người dùng</h3>
          <p className="mt-1 text-[10px] font-semibold text-zinc-500">Theo dõi hoạt động, nguồn đăng nhập, quyền và trạng thái tài khoản.</p>
        </div>
        <button type="button" onClick={() => void fetchUsers()} disabled={loading} className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-white/5 bg-white/[0.03] px-3 text-[10px] font-black text-zinc-400 transition-colors hover:text-white disabled:opacity-50">
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Làm mới
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">
        {statCards.map(([label, value, Icon, color]) => (
          <div key={label} className="rounded-2xl border border-white/[0.05] bg-white/[0.025] p-4">
            <div className={`mb-3 flex h-8 w-8 items-center justify-center rounded-xl ${color}`}><Icon size={15} /></div>
            <p className="text-xl font-black text-white">{value}</p>
            <p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-zinc-600">{label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-3 rounded-2xl border border-amber-500/15 bg-amber-500/[0.04] p-4 text-amber-200/80">
        <AlertTriangle size={17} className="mt-0.5 shrink-0 text-amber-400" />
        <div>
          <p className="text-xs font-black">Không tự động xóa tài khoản sau 15 ngày</p>
          <p className="mt-1 text-[10px] leading-5 text-zinc-500">Mốc 15 ngày chỉ giúp lọc người dùng lâu chưa quay lại. Xóa tự động sẽ làm mất lịch sử xem, yêu thích và danh sách cá nhân; admin chỉ có thể xóa và ẩn danh tài khoản đã khóa.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-white/[0.05] bg-[#0d0e13]">
        <div className="grid gap-2 border-b border-white/[0.05] p-4 md:grid-cols-2 xl:grid-cols-[minmax(200px,1fr)_repeat(5,135px)_auto]">
          <label className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
            <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Tìm tên hoặc email..." className="h-9 w-full rounded-xl border border-white/[0.06] bg-black/25 pl-9 pr-3 text-xs text-white outline-none transition-colors focus:border-pink-500/40" />
          </label>
          <select value={role} onChange={(event) => { setRole(event.target.value); setPage(1); }} className="h-9 rounded-xl border border-white/[0.06] bg-[#090a0f] px-3 text-[10px] font-bold text-zinc-400 outline-none"><option value="">Mọi vai trò</option><option value="member">Thành viên</option><option value="super_admin">Super Admin</option><option value="content_admin">Quản lý nội dung</option><option value="moderator">Kiểm duyệt viên</option><option value="support">Hỗ trợ vận hành</option></select>
          <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="h-9 rounded-xl border border-white/[0.06] bg-[#090a0f] px-3 text-[10px] font-bold text-zinc-400 outline-none"><option value="">Mọi trạng thái</option><option value="active">Đang mở</option><option value="blocked">Đang khóa</option></select>
          <select value={activity} onChange={(event) => { setActivity(event.target.value); setPage(1); }} className="h-9 rounded-xl border border-white/[0.06] bg-[#090a0f] px-3 text-[10px] font-bold text-zinc-400 outline-none"><option value="">Mọi hoạt động</option><option value="recent">Trong 15 ngày</option><option value="inactive">Quá 15 ngày</option><option value="never">Chưa ghi nhận</option></select>
          <select value={provider} onChange={(event) => { setProvider(event.target.value); setPage(1); }} className="h-9 rounded-xl border border-white/[0.06] bg-[#090a0f] px-3 text-[10px] font-bold text-zinc-400 outline-none"><option value="">Mọi đăng nhập</option><option value="password">Mật khẩu</option><option value="google">Google</option><option value="hybrid">Hybrid</option></select>
          <select value={verification} onChange={(event) => { setVerification(event.target.value); setPage(1); }} className="h-9 rounded-xl border border-white/[0.06] bg-[#090a0f] px-3 text-[10px] font-bold text-zinc-400 outline-none"><option value="">Mọi xác minh</option><option value="verified">Đã xác minh</option><option value="pending">Chờ xác minh</option></select>
          <button type="button" onClick={resetFilters} className="h-9 rounded-xl px-3 text-[10px] font-black text-zinc-600 hover:bg-white/[0.04] hover:text-zinc-300">Xóa lọc</button>
        </div>

        {loading ? (
          <div className="space-y-3 p-5">{Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-16 animate-pulse rounded-xl bg-white/[0.025]" />)}</div>
        ) : users.length === 0 ? (
          <div className="flex min-h-56 flex-col items-center justify-center gap-2 p-8 text-center"><Users size={30} className="text-zinc-700" /><p className="text-xs font-black text-zinc-400">Không tìm thấy tài khoản phù hợp</p><button type="button" onClick={resetFilters} className="text-[10px] font-bold text-pink-400">Xóa bộ lọc</button></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-left">
              <thead><tr className="border-b border-white/[0.05] text-[9px] font-black uppercase tracking-wider text-zinc-600"><th className="px-4 py-3">Người dùng</th><th className="px-3 py-3">Đăng nhập</th><th className="px-3 py-3">Hoạt động gần nhất</th><th className="px-3 py-3">Vai trò</th><th className="px-3 py-3">Trạng thái</th><th className="px-4 py-3 text-right">Thao tác</th></tr></thead>
              <tbody className="divide-y divide-white/[0.04]">
                {users.map((target) => {
                  const self = currentUser?.id === target._id;
                  const targetIsStaff = target.role !== "member";
                  const canManageTarget = !self && target.role !== "super_admin" && (canManageRoles || !targetIsStaff);
                  const activityMeta = activityLabel(target);
                  return (
                    <tr key={target._id} className="transition-colors hover:bg-white/[0.018]">
                      <td className="px-4 py-3"><div className="flex items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-pink-500/10 text-xs font-black text-pink-400">{target.avatar ? <img src={target.avatar} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" /> : target.displayName?.[0]?.toUpperCase() || "U"}</div><div className="min-w-0"><div className="flex items-center gap-2"><p className="max-w-52 truncate text-xs font-black text-zinc-200">{target.displayName}</p>{self && <span className="rounded bg-pink-500/10 px-1.5 py-0.5 text-[8px] font-black text-pink-400">BẠN</span>}</div><p className="mt-0.5 max-w-60 truncate text-[10px] text-zinc-600">{target.email}</p><p className="mt-1 text-[8px] text-zinc-700">Tạo {formatDate(target.createdAt)}</p></div></div></td>
                      <td className="px-3 py-3"><span className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.05] bg-white/[0.025] px-2 py-1 text-[9px] font-bold text-zinc-400"><KeyRound size={10} />{providerLabel[target.authProvider]}</span>{target.verificationStatus === "pending" && <p className="mt-1 text-[8px] font-black text-cyan-400">CHỜ XÁC MINH · tự dọn sau 72 giờ</p>}</td>
                      <td className="px-3 py-3"><p className={`text-[10px] font-black ${activityMeta.stale ? "text-amber-400" : "text-emerald-400"}`}>{activityMeta.text}</p><p className="mt-1 text-[8px] text-zinc-700">{target.lastActiveAt || target.lastLoginAt ? formatDate(target.lastActiveAt || target.lastLoginAt) : "Ước tính theo ngày tạo"}</p></td>
                      <td className="px-3 py-3">{canManageRoles && !self && target.role !== "super_admin" ? <select value={target.role} disabled={actionLoading} onChange={(event) => void changeRole(target, event.target.value as UserRole)} className="rounded-lg border border-white/[0.06] bg-[#08090d] px-2 py-1.5 text-[9px] font-black text-zinc-300 outline-none"><option value="member">Thành viên</option><option value="content_admin">Quản lý nội dung</option><option value="moderator">Kiểm duyệt viên</option><option value="support">Hỗ trợ vận hành</option></select> : <span className="text-[9px] font-black uppercase text-pink-400">{roleLabel(target.role)}</span>}</td>
                      <td className="px-3 py-3"><button type="button" disabled={!canManageTarget || actionLoading} onClick={() => target.isActive ? setLockTarget(target) : void unlockUser(target)} className={`rounded-full border px-2.5 py-1 text-[9px] font-black disabled:cursor-not-allowed disabled:opacity-60 ${target.isActive ? "border-emerald-500/15 bg-emerald-500/[0.06] text-emerald-400" : "border-red-500/15 bg-red-500/[0.06] text-red-400"}`}>{target.isActive ? "Đang mở" : "Bị khóa"}</button>{!target.isActive && target.suspensionReason && <p title={target.suspensionReason} className="mt-1 max-w-40 truncate text-[8px] text-zinc-700">{target.suspensionReason}</p>}</td>
                      <td className="px-4 py-3 text-right">{canManageTarget && !target.isActive && <button type="button" disabled={actionLoading} onClick={() => void deleteUser(target)} title="Xóa dữ liệu cá nhân và ẩn danh tài khoản đã khóa" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-500/10 bg-red-500/[0.04] text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-40"><Trash2 size={12} /></button>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && totalPages > 1 && <div className="flex items-center justify-between border-t border-white/[0.05] px-4"><p className="text-[9px] font-bold text-zinc-700">{totalItems} tài khoản phù hợp</p><Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} /></div>}
      </div>

      {lockTarget && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !actionLoading) setLockTarget(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="lock-user-title" className="w-full max-w-md rounded-3xl border border-amber-500/20 bg-[#101119] p-6 shadow-2xl">
            <div className="flex items-start gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400"><LockKeyhole size={20} /></div><div><h3 id="lock-user-title" className="text-base font-black text-white">Khóa tài khoản {lockTarget.displayName}?</h3><p className="mt-1 text-xs leading-5 text-zinc-500">Người dùng sẽ bị đăng xuất và không thể đăng nhập cho tới khi được mở khóa.</p></div></div>
            <label className="mt-5 block"><span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Lý do quản trị</span><textarea value={lockReason} onChange={(event) => setLockReason(event.target.value.slice(0, 200))} maxLength={200} rows={3} placeholder="Ví dụ: Spam bình luận hoặc vi phạm điều khoản..." className="mt-2 w-full resize-none rounded-2xl border border-white/[0.07] bg-black/25 p-3 text-xs text-white outline-none focus:border-amber-500/30" /><span className="mt-1 block text-right text-[8px] text-zinc-700">{lockReason.length}/200</span></label>
            <div className="mt-5 flex justify-end gap-2"><button type="button" disabled={actionLoading} onClick={() => { setLockTarget(null); setLockReason(""); }} className="rounded-xl bg-zinc-900 px-4 py-2.5 text-xs font-black text-zinc-400">Hủy</button><button type="button" disabled={actionLoading} onClick={() => void submitLock()} className="inline-flex min-w-28 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-black text-black disabled:opacity-50">{actionLoading && <RefreshCw size={13} className="animate-spin" />}Khóa tài khoản</button></div>
          </section>
        </div>
      )}

      {confirmDialog}
    </div>
  );
}
