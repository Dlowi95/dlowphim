"use client";

import React, { useEffect, useState } from "react";
import { User, Loader2, Save } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import Cookies from "js-cookie";

export default function UserAccountPage() {
  const { user, showToast, refreshUser } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || "");
    }
  }, [user]);

  useEffect(() => {
    refreshUser();
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      showToast("Vui lòng điền tên hiển thị", "error");
      return;
    }

    setIsSaving(true);
    try {
      const token = Cookies.get("token");
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
      
      const res = await fetch(`${API_URL}/auth/me/update`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ displayName: displayName.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        if (user) {
          user.displayName = data.displayName;
        }
        showToast("Cập nhật thông tin thành công", "success");
      } else {
        const errData = await res.json();
        showToast(errData.message || "Cập nhật thất bại", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Không thể kết nối máy chủ", "error");
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-zinc-900 pb-3.5">
        <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight text-zinc-100 flex items-center gap-2.5">
          <User className="text-pink-500" size={24} />
          <span>Thông tin tài khoản</span>
        </h2>
      </div>

      <form onSubmit={handleSaveProfile} className="max-w-lg bg-[#12131b]/60 border border-zinc-800/40 p-6 md:p-8 rounded-3xl space-y-5 text-left shadow-md">
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Email tài khoản</label>
          <input 
            type="email"
            disabled
            value={user.email}
            className="w-full h-11 bg-zinc-900/40 border border-zinc-800 rounded-xl px-4 text-sm text-zinc-500 outline-none cursor-not-allowed"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Tên hiển thị</label>
          <input 
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Nhập tên hiển thị mới..."
            className="w-full h-11 bg-zinc-900/60 border border-zinc-800 focus:border-pink-500 rounded-xl px-4 text-sm text-zinc-200 outline-none transition-colors"
          />
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="h-11 w-full md:w-auto md:px-8 bg-pink-500 hover:bg-pink-600 disabled:bg-zinc-800 text-white font-extrabold text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-pink-500/10 active:scale-98 transition-all cursor-pointer"
        >
          {isSaving ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Save size={16} />
          )}
          <span>Lưu thông tin</span>
        </button>
      </form>
    </div>
  );
}
