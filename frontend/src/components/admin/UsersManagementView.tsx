"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import Cookies from "js-cookie";
import {
  Search,
  RefreshCw,
  UserCheck,
  UserX,
  Trash2,
  Shield,
  User,
  AlertTriangle,
  Calendar,
} from "lucide-react";
import Pagination from "./Pagination";

interface UserItem {
  _id: string;
  email: string;
  displayName: string;
  avatar?: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

export default function UsersManagementView() {
  const { user: currentUser, showToast } = useAuth();
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

  // State
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Modals / Dialog confirmations
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: "delete" | "status" | "role";
    targetUser: UserItem | null;
    newValue?: any;
  }>({
    isOpen: false,
    type: "status",
    targetUser: null,
  });

  const [actionLoading, setActionLoading] = useState(false);

  // Fetch users from API
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const token = Cookies.get("token");
      const res = await fetch(`${API_URL}/auth/admin/users`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      } else {
        showToast("Không thể tải danh sách người dùng", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Lỗi kết nối máy chủ", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Filter users by search term
  const filteredUsers = users.filter((u) => {
    const q = searchTerm.toLowerCase();
    return (
      u.displayName?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.role?.toLowerCase().includes(q)
    );
  });

  // Pagination
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Reset page to 1 when search term changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Handle action calls
  const handleConfirmAction = async () => {
    const { type, targetUser, newValue } = confirmModal;
    if (!targetUser) return;

    setActionLoading(true);
    try {
      const token = Cookies.get("token");
      let res;

      if (type === "role") {
        res = await fetch(`${API_URL}/auth/admin/users/${targetUser._id}/role`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ role: newValue }),
        });
      } else if (type === "status") {
        res = await fetch(`${API_URL}/auth/admin/users/${targetUser._id}/status`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ isActive: newValue }),
        });
      } else {
        res = await fetch(`${API_URL}/auth/admin/users/${targetUser._id}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }

      const data = await res.json();
      if (res.ok) {
        showToast(data.message || "Thao tác thành công", "success");
        // Update local state immediately
        if (type === "role") {
          setUsers((prev) =>
            prev.map((u) => (u._id === targetUser._id ? { ...u, role: newValue } : u))
          );
        } else if (type === "status") {
          setUsers((prev) =>
            prev.map((u) => (u._id === targetUser._id ? { ...u, isActive: newValue } : u))
          );
        } else {
          setUsers((prev) => prev.filter((u) => u._id !== targetUser._id));
        }
      } else {
        showToast(data.message || "Thao tác thất bại", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Lỗi kết nối máy chủ", "error");
    } finally {
      setActionLoading(false);
      setConfirmModal({ isOpen: false, type: "status", targetUser: null });
    }
  };

  const openConfirmModal = (type: "delete" | "status" | "role", targetUser: UserItem, newValue?: any) => {
    if (currentUser?.id === targetUser._id) {
      showToast("Bạn không thể tự chỉnh sửa hoặc xóa chính mình!", "warning");
      return;
    }
    setConfirmModal({
      isOpen: true,
      type,
      targetUser,
      newValue,
    });
  };

  return (
    <div className="space-y-6 animate-fadeIn text-left">
      {/* Header controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base md:text-lg font-black text-white tracking-tight">Quản lý Người dùng</h3>
          <p className="text-[10px] font-semibold text-zinc-500 mt-0.5">
            Quản lý quyền hạn, chặn truy cập và tài khoản người dùng hệ thống.
          </p>
        </div>

        <div className="flex gap-2 items-center">
          {/* Search bar */}
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo tên, email..."
              className="h-9 w-48 sm:w-60 bg-[#0d0e13] border border-zinc-900 rounded-xl px-3 pl-8 text-xs text-zinc-200 placeholder-zinc-650 focus:outline-none focus:border-pink-500/50"
            />
            <Search size={12} className="text-zinc-650 absolute top-1/2 left-3 -translate-y-1/2" />
          </div>

          {/* Reload button */}
          <button
            onClick={fetchUsers}
            disabled={loading}
            className="w-9 h-9 rounded-xl bg-zinc-900/60 hover:bg-zinc-900 text-zinc-400 hover:text-white flex items-center justify-center transition-all cursor-pointer border-none disabled:opacity-50"
            title="Tải lại dữ liệu"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-[#0d0e13] border border-zinc-900 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          // Skeleton loader
          <div className="p-6 space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex gap-4 p-4 rounded-xl border border-zinc-900 animate-pulse bg-zinc-900/20">
                <div className="w-9 h-9 rounded-full bg-zinc-800 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="w-32 h-3.5 bg-zinc-800 rounded" />
                  <div className="w-1/2 h-3 bg-zinc-900/40 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredUsers.length === 0 ? (
          // Empty State
          <div className="p-16 text-center flex flex-col items-center justify-center gap-3.5 select-none">
            <div className="w-14 h-14 rounded-full bg-pink-500/5 border border-pink-500/10 flex items-center justify-center text-pink-400">
              <User size={28} />
            </div>
            <div className="space-y-1">
              <h4 className="font-extrabold text-xs text-zinc-300">Không tìm thấy người dùng</h4>
              <p className="text-[10px] text-zinc-500 max-w-sm">
                Không tìm thấy tài khoản nào khớp với từ khóa tìm kiếm của bạn.
              </p>
            </div>
          </div>
        ) : (
          <div className="w-full">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto w-full">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-zinc-900/80 text-[10px] font-black text-zinc-550 uppercase select-none">
                    <th className="py-3.5 pl-4">Người dùng</th>
                    <th className="py-3.5">Ngày đăng ký</th>
                    <th className="py-3.5">Vai trò (Role)</th>
                    <th className="py-3.5">Trạng thái (Status)</th>
                    <th className="py-3.5 pr-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900/40">
                  {paginatedUsers.map((u) => {
                    const isSelf = currentUser?.id === u._id;
                    const dateStr = u.createdAt ? new Date(u.createdAt).toLocaleDateString("vi-VN") : "N/A";

                    return (
                      <tr key={u._id} className="hover:bg-zinc-900/10 transition-colors">
                        {/* Name & Email info */}
                        <td className="py-4 pl-4">
                          <div className="flex gap-3 items-center">
                            {u.avatar ? (
                              <img
                                src={u.avatar}
                                alt={u.displayName}
                                className="w-8 h-8 rounded-full object-cover shrink-0 select-none border border-zinc-800"
                                onError={(e) => {
                                  (e.target as any).style.display = "none";
                                }}
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-pink-500/10 border border-pink-500/25 flex items-center justify-center shrink-0 font-black text-xs text-pink-400 select-none">
                                {u.displayName ? u.displayName[0].toUpperCase() : "U"}
                              </div>
                            )}

                            <div className="text-left space-y-0.5 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-zinc-200 truncate">{u.displayName}</span>
                                {isSelf && (
                                  <span className="text-[8px] bg-pink-500/20 text-pink-400 font-extrabold uppercase px-1 rounded-sm tracking-wider">
                                    Bạn
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-zinc-500 truncate leading-none">
                                {u.email}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Reg date */}
                        <td className="py-4 text-zinc-400 font-medium tabular-nums">
                          <div className="flex items-center gap-1 text-[11px]">
                            <Calendar size={12} className="text-zinc-600" />
                            {dateStr}
                          </div>
                        </td>

                        {/* Role selection dropdown */}
                        <td className="py-4">
                          {isSelf ? (
                            <span className="inline-flex items-center gap-1 bg-pink-500/10 text-pink-400 border border-pink-500/20 font-black text-[9px] uppercase px-2 py-0.5 rounded-md">
                              <Shield size={10} />
                              {u.role}
                            </span>
                          ) : (
                            <select
                              value={u.role}
                              onChange={(e) => openConfirmModal("role", u, e.target.value)}
                              className="bg-[#07070a] border border-zinc-900 rounded-lg px-2 py-1 text-[11px] text-zinc-300 font-bold focus:outline-none focus:border-pink-500/50 cursor-pointer text-white"
                            >
                              <option value="member">Thành viên</option>
                              <option value="admin">Quản trị viên</option>
                            </select>
                          )}
                        </td>

                        {/* Active/Blocked Status */}
                        <td className="py-4">
                          {isSelf ? (
                            <span className="inline-flex items-center gap-1.5 bg-green-500/5 text-green-400 border border-green-500/10 font-bold text-[9px] px-2.5 py-0.5 rounded-full select-none">
                              <UserCheck size={11} />
                              Đang hoạt động
                            </span>
                          ) : (
                            <button
                              onClick={() => openConfirmModal("status", u, !u.isActive)}
                              className={`inline-flex items-center gap-1.5 font-bold text-[9px] px-2.5 py-0.5 rounded-full select-none transition-all cursor-pointer border ${
                                u.isActive
                                  ? "bg-green-500/5 text-green-400 border-green-500/10 hover:bg-green-500/15 hover:border-green-500/20"
                                  : "bg-red-500/5 text-red-400 border-red-500/10 hover:bg-red-500/15 hover:border-red-500/20"
                              }`}
                            >
                              {u.isActive ? (
                                <>
                                  <UserCheck size={11} />
                                  Hoạt động
                                </>
                              ) : (
                                <>
                                  <UserX size={11} />
                                  Bị khóa
                                </>
                              )}
                            </button>
                          )}
                        </td>

                        {/* Delete actions */}
                        <td className="py-4 pr-4 text-right">
                          {!isSelf && (
                            <button
                              onClick={() => openConfirmModal("delete", u)}
                              className="w-7 h-7 rounded-lg bg-red-500/5 hover:bg-red-500/10 border border-red-500/10 hover:border-red-500/20 text-red-400 hover:text-red-300 flex items-center justify-center transition-all cursor-pointer inline-flex"
                              title="Xóa người dùng"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards Stack View */}
            <div className="block md:hidden divide-y divide-zinc-900/40">
              {paginatedUsers.map((u) => {
                const isSelf = currentUser?.id === u._id;
                const dateStr = u.createdAt ? new Date(u.createdAt).toLocaleDateString("vi-VN") : "N/A";

                return (
                  <div key={u._id} className="p-4 space-y-3.5 text-left">
                    {/* User Header */}
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex gap-2.5 items-center">
                        {u.avatar ? (
                          <img
                            src={u.avatar}
                            alt={u.displayName}
                            className="w-8 h-8 rounded-full object-cover shrink-0 select-none border border-zinc-800"
                            onError={(e) => {
                              (e.target as any).style.display = "none";
                            }}
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-pink-500/10 border border-pink-500/25 flex items-center justify-center shrink-0 font-black text-xs text-pink-400 select-none">
                            {u.displayName ? u.displayName[0].toUpperCase() : "U"}
                          </div>
                        )}
                        <div className="text-left min-w-0 space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs text-zinc-200 truncate">{u.displayName}</span>
                            {isSelf && (
                              <span className="text-[8px] bg-pink-500/20 text-pink-400 font-extrabold uppercase px-1 rounded-sm tracking-wider">
                                Bạn
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-zinc-550 truncate leading-none">{u.email}</p>
                        </div>
                      </div>

                      <span className="text-[9px] text-zinc-500 font-medium tabular-nums flex items-center gap-0.5 pt-0.5">
                        <Calendar size={11} className="text-zinc-650" />
                        {dateStr}
                      </span>
                    </div>

                    {/* Settings Details: Role & Status */}
                    <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-950/20 p-2.5 rounded-xl border border-zinc-900/60">
                      {/* Role selection */}
                      <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                        <span>Vai trò:</span>
                        {isSelf ? (
                          <span className="inline-flex items-center gap-1 bg-pink-500/10 text-pink-400 border border-pink-500/20 font-black text-[9px] uppercase px-2 py-0.5 rounded-md">
                            <Shield size={10} />
                            {u.role}
                          </span>
                        ) : (
                          <select
                            value={u.role}
                            onChange={(e) => openConfirmModal("role", u, e.target.value)}
                            className="bg-[#07070a] border border-zinc-900 rounded-lg px-2 py-1 text-[11px] text-zinc-300 font-bold focus:outline-none focus:border-pink-500/50 cursor-pointer text-white"
                          >
                            <option value="member">Thành viên</option>
                            <option value="admin">Quản trị viên</option>
                          </select>
                        )}
                      </div>

                      {/* Active toggle */}
                      <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                        <span>Trạng thái:</span>
                        {isSelf ? (
                          <span className="inline-flex items-center gap-1 bg-green-500/5 text-green-400 border border-green-500/10 font-bold text-[9px] px-2 py-0.5 rounded-full select-none">
                            Hoạt động
                          </span>
                        ) : (
                          <button
                            onClick={() => openConfirmModal("status", u, !u.isActive)}
                            className={`inline-flex items-center gap-1 font-bold text-[9px] px-2 py-0.5 rounded-md transition-all cursor-pointer border ${
                              u.isActive
                                ? "bg-green-500/5 text-green-400 border-green-500/10"
                                : "bg-red-500/5 text-red-400 border-red-500/10"
                            }`}
                          >
                            {u.isActive ? "Đang hoạt động" : "Bị khóa"}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Actions Footer */}
                    {!isSelf && (
                      <div className="flex justify-end pt-1">
                        <button
                          onClick={() => openConfirmModal("delete", u)}
                          className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/10 hover:border-red-500/20 text-red-500 font-extrabold text-[10px] rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                          title="Xóa người dùng"
                        >
                          <Trash2 size={11} /> Xóa tài khoản
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Pagination block */}
        {!loading && totalPages > 1 && (
          <div className="border-t border-zinc-900/60 px-4">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={(page) => setCurrentPage(page)}
            />
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {confirmModal.isOpen && confirmModal.targetUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
          <div
            onClick={() => setConfirmModal({ isOpen: false, type: "status", targetUser: null })}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />
          <div className="relative w-full max-w-sm bg-[#0d0e13] border border-zinc-900 rounded-2xl p-6 shadow-2xl space-y-4 animate-scaleUp">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/5 border border-red-500/10 flex items-center justify-center text-red-400 shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div className="text-left">
                <h4 className="font-extrabold text-sm text-zinc-150">Xác nhận thao tác</h4>
                <p className="text-[10px] text-zinc-500 mt-0.5">
                  Thao tác này ảnh hưởng trực tiếp đến người dùng.
                </p>
              </div>
            </div>

            <div className="text-xs text-zinc-400 bg-[#07070a] border border-zinc-900/60 rounded-xl p-3.5 text-left leading-relaxed">
              {confirmModal.type === "delete" && (
                <>
                  Bạn có chắc chắn muốn <span className="text-red-400 font-bold">xóa vĩnh viễn</span> tài khoản của{" "}
                  <span className="text-zinc-200 font-extrabold">{confirmModal.targetUser.displayName}</span>? Hành động này không thể hoàn tác!
                </>
              )}
              {confirmModal.type === "status" && (
                <>
                  Bạn có chắc chắn muốn {confirmModal.newValue ? "mở khóa" : "khóa"} tài khoản của{" "}
                  <span className="text-zinc-200 font-extrabold">{confirmModal.targetUser.displayName}</span>?{" "}
                  {!confirmModal.newValue && "Người dùng này sẽ không thể đăng nhập vào hệ thống nữa."}
                </>
              )}
              {confirmModal.type === "role" && (
                <>
                  Bạn có chắc chắn muốn chuyển vai trò của{" "}
                  <span className="text-zinc-200 font-extrabold">{confirmModal.targetUser.displayName}</span> thành{" "}
                  <span className="text-pink-400 font-black uppercase">
                    {confirmModal.newValue === "admin" ? "Quản trị viên" : "Thành viên"}
                  </span>
                  ?
                </>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button
                disabled={actionLoading}
                onClick={() => setConfirmModal({ isOpen: false, type: "status", targetUser: null })}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-[11px] font-black rounded-lg transition-colors cursor-pointer border-none"
              >
                Hủy bỏ
              </button>
              <button
                disabled={actionLoading}
                onClick={handleConfirmAction}
                className="px-4 py-2 bg-pink-500 hover:bg-pink-600 disabled:opacity-50 text-white text-[11px] font-black rounded-lg transition-colors cursor-pointer border-none flex items-center justify-center gap-1.5"
              >
                {actionLoading && <RefreshCw size={11} className="animate-spin" />}
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
